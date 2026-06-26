#!/usr/bin/env node
/**
 * Conversation Rot — experiment runner.
 *
 * 50-turn hand-crafted beekeeping chat with three drift-recovery
 * cycles and a per-turn ground-truth drift label (0=on-topic,
 * 1=bridging, 2=off-topic, 3=wholly unrelated).
 *
 * Runs four detectors under two context-management strategies:
 *
 *   (A) accumulate    — context grows unboundedly (Unseen Tide control)
 *   (B) sliding(K=10) — only the last K turns remain in context
 *                       (realistic chat token budget)
 *
 * Outputs per-turn traces plus summary statistics: precision, recall,
 * F1 against drift>=2, and Pearson correlation between (1 - health)
 * and the continuous drift label.
 */

const path = require('path');
const fs = require('fs');

const ciCore = require('../../../context-inspector/core.js');

const { analyticalBaseline, empiricalBaseline } = require('../../core/baseline');
const { ingest } = require('../../adapters/context-inspector');
const { classify } = require('../../adapters/events');
const {
  staticMeanDetector,
  staticSigmaDetector,
  forecastDetector,
  STATIC_MEAN_THRESHOLD,
  STATIC_SIGMA_THRESHOLD,
  FORECAST_HEALTH_THRESHOLD,
} = require('../unseen-tide/detectors');

const { reference, turns } = require('./transcript');

// Sliding-window size. Chosen to be smaller than the shortest
// recovery phase in the transcript (5 turns) so that recovery actually
// flushes out drift content — otherwise the window always contains
// stale drift and neither detector can recover cleanly.
const WINDOW_SIZE = 5;
const DRIFT_ALERT_THRESHOLD = 2;  // drift >= 2 is considered off-topic
const BASELINE_CALIBRATION_TURNS = 5; // first N drift=0 turns used for empirical baseline

function computeEmpiricalBaseline(domainTerms, contextBuilder) {
  // Run the first BASELINE_CALIBRATION_TURNS through the same pipeline
  // the experiment uses, collect the resulting stats, and average them.
  const calibStats = [];
  for (let i = 0; i < BASELINE_CALIBRATION_TURNS; i++) {
    if (turns[i].drift !== 0) continue;  // use only on-topic turns
    const context = contextBuilder(i);
    const analysis = ciCore.analyze(context, { fixedDomainTerms: domainTerms });
    const stats = analysis.domain?.stats || analysis.stats;
    calibStats.push(stats);
  }
  return empiricalBaseline(calibStats);
}

function runStrategy(strategyName, contextBuilder) {
  const domainTerms = ciCore.extractDomainTerms(reference);
  // Empirical baseline derived from the first on-topic turns of the
  // transcript rather than from the reference alone — this prevents
  // the "term-dense reference" pitfall where authentic chat content
  // scores systematically below the reference's self-score, causing
  // forecasters to never return to healthy state.
  const baseline = computeEmpiricalBaseline(domainTerms, contextBuilder);

  const detectors = [
    staticMeanDetector(),
    staticSigmaDetector(),
    forecastDetector('abm',    'abm',    baseline, { ingest, classify }),
    forecastDetector('kalman', 'kalman', baseline, { ingest, classify }),
  ];

  const rows = [];

  for (let i = 0; i < turns.length; i++) {
    const turnIdx = i + 1;
    const context = contextBuilder(i);
    const analysis = ciCore.analyze(context, { fixedDomainTerms: domainTerms });
    const stats = analysis.domain?.stats || analysis.stats;

    const detectorOutputs = {};
    for (const d of detectors) {
      detectorOutputs[d.name] = d.observe(analysis);
    }

    rows.push({
      turn: turnIdx,
      drift: turns[i].drift,
      mean:   +stats.mean.toFixed(4),
      stdDev: +stats.stdDev.toFixed(4),
      skew:   +stats.skewness.toFixed(4),
      kurt:   +stats.kurtosis.toFixed(4),
      count:  stats.count,
      detectors: detectorOutputs,
    });
  }

  return { strategy: strategyName, baseline, rows };
}

function accumulateContext(i) {
  // Reference plus all turns 1..i+1
  return reference + '\n\n' + turns.slice(0, i + 1).map(t => t.text).join('\n\n');
}

function slidingContext(i) {
  const windowStart = Math.max(0, i - WINDOW_SIZE + 1);
  return reference + '\n\n' + turns.slice(windowStart, i + 1).map(t => t.text).join('\n\n');
}

function confusion(rows, detectorName, driftThreshold = DRIFT_ALERT_THRESHOLD) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const r of rows) {
    const truth = r.drift >= driftThreshold;
    const alert = r.detectors[detectorName].alert;
    if (truth && alert) tp++;
    else if (!truth && alert) fp++;
    else if (!truth && !alert) tn++;
    else fn++;
  }
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall    = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1        = (precision + recall) === 0 ? 0 : 2 * precision * recall / (precision + recall);
  return { tp, fp, tn, fn, precision, recall, f1 };
}

function pearson(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  const den = Math.sqrt(sxx * syy);
  return den === 0 ? 0 : num / den;
}

function correlationForForecaster(rows, name) {
  const driftLevels = rows.map(r => r.drift);
  // Use the raw observation-gap signal (unclipped) — the health score
  // clamps at 0 and loses discrimination between drift levels 2 and 3.
  const rawSignal  = rows.map(r => r.detectors[name].error ?? (1 - r.detectors[name].metric));
  return pearson(driftLevels, rawSignal);
}

function correlationForStatic(rows, name, positiveDir) {
  const driftLevels = rows.map(r => r.drift);
  const signal = rows.map(r => {
    const m = r.detectors[name].metric;
    return positiveDir === 'low-is-bad' ? -m : m;
  });
  return pearson(driftLevels, signal);
}

function recoveryTiming(rows, detectorName) {
  // Measure detection and clearance latency around drift-recovery boundaries.
  // For each transition drift >=2 → drift < 2 in ground truth, measure the
  // number of turns until the detector also clears its alert.
  const transitions = [];
  for (let i = 1; i < rows.length; i++) {
    const wasOfftopic = rows[i - 1].drift >= DRIFT_ALERT_THRESHOLD;
    const isOntopic   = rows[i].drift     <  DRIFT_ALERT_THRESHOLD;
    if (wasOfftopic && isOntopic) {
      let clearedAt = null;
      for (let j = i; j < rows.length; j++) {
        if (!rows[j].detectors[detectorName].alert) { clearedAt = j + 1; break; }
      }
      transitions.push({
        recoveryTurn: rows[i].turn,
        clearedAtTurn: clearedAt,
        latencyTurns: clearedAt == null ? null : (clearedAt - rows[i].turn),
      });
    }
  }
  return transitions;
}

function printTable(label, rows) {
  const lines = [];
  lines.push(`\n=== ${label} ===`);
  lines.push('turn dr  mean    σ    |smn|ssg|  abm  regime       | kf   regime');
  lines.push('---- -- ------ ------  |---|---|---------------------|---------------------');
  for (const r of rows) {
    const sm = r.detectors['static-mean'];
    const ss = r.detectors['static-sigma'];
    const ab = r.detectors['abm'];
    const kf = r.detectors['kalman'];
    lines.push([
      String(r.turn).padStart(3),
      ' ',
      String(r.drift),
      '  ',
      fmt(r.mean, 5),
      fmt(r.stdDev, 5),
      '  ',
      sm.alert ? ' A ' : '   ',
      ss.alert ? ' A ' : '   ',
      ab.metric.toFixed(3).padStart(5) + '  ' + ab.regime.padEnd(14) + (ab.alert ? 'A' : ' '),
      '| ',
      kf.metric.toFixed(3).padStart(5) + '  ' + kf.regime.padEnd(14) + (kf.alert ? 'A' : ' '),
    ].join(' '));
  }
  return lines.join('\n');
}

function fmt(v, n) { return (v >= 0 ? ' ' : '') + v.toFixed(3).padStart(n - 1); }

function renderSparkline(values, min, max) {
  const chars = '▁▂▃▄▅▆▇█';
  const span = max - min;
  return values.map(v => {
    if (!Number.isFinite(v)) return '·';
    const norm = span > 0 ? (v - min) / span : 0.5;
    const idx = Math.max(0, Math.min(chars.length - 1, Math.floor(norm * chars.length)));
    return chars[idx];
  }).join('');
}

function summarize(run) {
  const lines = [];
  lines.push(`\n### Strategy: ${run.strategy}`);
  lines.push(`baseline: mean=${run.baseline[0].toFixed(3)}  stdDev=${run.baseline[1].toFixed(3)}`);

  lines.push('');
  lines.push('Confusion against drift>=2:');
  lines.push('detector          tp  fp  tn  fn   precision  recall   f1');
  for (const name of ['static-mean', 'static-sigma', 'abm', 'kalman']) {
    const c = confusion(run.rows, name);
    lines.push([
      name.padEnd(16),
      String(c.tp).padStart(3),
      String(c.fp).padStart(3),
      String(c.tn).padStart(3),
      String(c.fn).padStart(3),
      c.precision.toFixed(3).padStart(10),
      c.recall.toFixed(3).padStart(8),
      c.f1.toFixed(3).padStart(6),
    ].join('  '));
  }

  lines.push('');
  lines.push('Pearson correlation with drift level:');
  lines.push('  static-mean  (−mean vs drift)        r = ' + correlationForStatic(run.rows, 'static-mean', 'low-is-bad').toFixed(3));
  lines.push('  static-sigma (stdDev vs drift)        r = ' + correlationForStatic(run.rows, 'static-sigma').toFixed(3));
  lines.push('  abm          (obs-gap vs drift)       r = ' + correlationForForecaster(run.rows, 'abm').toFixed(3));
  lines.push('  kalman       (obs-gap vs drift)       r = ' + correlationForForecaster(run.rows, 'kalman').toFixed(3));

  lines.push('');
  lines.push('Recovery latency (turns to clear alert after drift ends):');
  for (const name of ['static-mean', 'static-sigma', 'abm', 'kalman']) {
    const ts = recoveryTiming(run.rows, name);
    if (ts.length === 0) { lines.push(`  ${name.padEnd(16)} no recoveries detected`); continue; }
    const latencies = ts.map(t => t.latencyTurns).filter(x => x != null);
    const mean = latencies.length === 0 ? null : latencies.reduce((a,b)=>a+b,0)/latencies.length;
    const str = ts.map(t => t.latencyTurns == null ? 'never' : `T${t.recoveryTurn}→+${t.latencyTurns}`).join('  ');
    lines.push(`  ${name.padEnd(16)} ${str}  mean=${mean == null ? '—' : mean.toFixed(2)}`);
  }

  // Sparklines — compact visual of how each signal tracked drift.
  lines.push('');
  lines.push('Sparklines over 50 turns (lower = worse health / higher signal):');
  lines.push('  ground-truth drift   ' + renderSparkline(run.rows.map(r => r.drift), 0, 3));
  lines.push('  abm health           ' + renderSparkline(run.rows.map(r => r.detectors.abm.metric), 0, 1));
  lines.push('  kalman health        ' + renderSparkline(run.rows.map(r => r.detectors.kalman.metric), 0, 1));
  lines.push('  static-mean          ' + renderSparkline(run.rows.map(r => 1 - r.detectors['static-mean'].metric), 0.3, 0.85));
  lines.push('  static-sigma         ' + renderSparkline(run.rows.map(r => r.detectors['static-sigma'].metric), 0.05, 0.40));

  return lines.join('\n');
}

function main() {
  const outDir = path.join(__dirname, 'results');
  fs.mkdirSync(outDir, { recursive: true });

  const accumRun   = runStrategy('accumulate',  accumulateContext);
  const slidingRun = runStrategy(`sliding(K=${WINDOW_SIZE})`, slidingContext);

  // Per-strategy summary lines
  const lines = [];
  lines.push('Conversation Rot — experiment summary');
  lines.push('=====================================');
  lines.push(`turns: ${turns.length}   reference: ${reference.length} chars   window K=${WINDOW_SIZE}`);
  lines.push(`thresholds: static-mean<${STATIC_MEAN_THRESHOLD}  static-σ>${STATIC_SIGMA_THRESHOLD}  forecast-health<${FORECAST_HEALTH_THRESHOLD}  drift-ground-truth>=${DRIFT_ALERT_THRESHOLD}`);

  lines.push(summarize(accumRun));
  lines.push(summarize(slidingRun));

  lines.push(printTable('Accumulating context — full trace', accumRun.rows));
  lines.push(printTable('Sliding window — full trace',     slidingRun.rows));

  const summary = lines.join('\n') + '\n';
  fs.writeFileSync(path.join(outDir, 'summary.txt'), summary);
  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify({
    experiment: 'conversation-rot',
    windowSize: WINDOW_SIZE,
    turns: turns.length,
    thresholds: {
      staticMean: STATIC_MEAN_THRESHOLD,
      staticSigma: STATIC_SIGMA_THRESHOLD,
      forecastHealth: FORECAST_HEALTH_THRESHOLD,
      driftGroundTruth: DRIFT_ALERT_THRESHOLD,
    },
    strategies: [accumRun, slidingRun].map(run => ({
      strategy: run.strategy,
      baseline: {
        mean: run.baseline[0], stdDev: run.baseline[1],
        skewness: run.baseline[2], kurtosis: run.baseline[3],
      },
      metrics: {
        'static-mean':  { confusion: confusion(run.rows, 'static-mean'),  r: correlationForStatic(run.rows, 'static-mean', 'low-is-bad') },
        'static-sigma': { confusion: confusion(run.rows, 'static-sigma'), r: correlationForStatic(run.rows, 'static-sigma') },
        'abm':          { confusion: confusion(run.rows, 'abm'),          r: correlationForForecaster(run.rows, 'abm') },
        'kalman':       { confusion: confusion(run.rows, 'kalman'),       r: correlationForForecaster(run.rows, 'kalman') },
      },
      rows: run.rows,
    })),
  }, null, 2));

  process.stdout.write(summary);
}

main();
