#!/usr/bin/env node
/**
 * Unseen Tide — experiment runner.
 *
 * 40-turn session with staged perturbations:
 *   Turns  1-10  Phase 1  Calibration   (pure reference content)
 *   Turns 11-20  Phase 2  Stylistic     (same topic, different register)
 *   Turns 21-30  Phase 3  Adjacent      (adjacent-domain creep)
 *   Turns 31-40  Phase 4  Contamination (unrelated content)
 *
 * Four detectors race per turn:
 *   - static-mean   (alert when mean < 0.50)
 *   - static-sigma  (alert when stdDev > 0.30)
 *   - abm           (alert when predictor-corrector health < 0.60)
 *   - kalman        (alert when kalman-filter health < 0.60)
 *
 * Output:
 *   ./results/results.json     — full per-turn record
 *   ./results/summary.txt      — human-readable table + lead-time report
 */

const path = require('path');
const fs = require('fs');

const ciCore = require('../../../context-inspector/core.js');

const { analyticalBaseline } = require('../../core/baseline');
const { ingest } = require('../../adapters/context-inspector');
const { classify } = require('../../adapters/events');
const {
  staticMeanDetector,
  staticSigmaDetector,
  forecastDetector,
  STATIC_MEAN_THRESHOLD,
  STATIC_SIGMA_THRESHOLD,
  FORECAST_HEALTH_THRESHOLD,
} = require('./detectors');

const { reference, phase1, phase2, phase3, phase4 } = require('./corpus');

const PHASE_PLAN = [
  { phase: 1, label: 'calibration',  chunks: phase1, turns: 10 },
  { phase: 2, label: 'stylistic',    chunks: phase2, turns: 10 },
  { phase: 3, label: 'adjacent',     chunks: phase3, turns: 10 },
  { phase: 4, label: 'contamination',chunks: phase4, turns: 10 },
];

function plannedChunks() {
  const flat = [];
  for (const p of PHASE_PLAN) {
    for (let i = 0; i < p.turns; i++) {
      flat.push({ phase: p.phase, label: p.label, text: p.chunks[i % p.chunks.length] });
    }
  }
  return flat;
}

function main() {
  const outDir = path.join(__dirname, 'results');
  fs.mkdirSync(outDir, { recursive: true });

  // 1. Build analytical baseline from reference.
  const baseline = analyticalBaseline(reference, ciCore);
  const domainTerms = ciCore.extractDomainTerms(reference);

  // 2. Register detectors.
  const detectors = [
    staticMeanDetector(),
    staticSigmaDetector(),
    forecastDetector('abm',    'abm',    baseline, { ingest, classify }),
    forecastDetector('kalman', 'kalman', baseline, { ingest, classify }),
  ];

  // 3. Play 40 turns, accumulating context (never dropping).
  // Initialize the context with the reference corpus — the session
  // begins from a well-established baseline state, and Phase 1 adds
  // additional on-topic content to an already-loaded workspace.
  const plan = plannedChunks();
  let context = reference + '\n\n';
  const rows = [];

  for (let i = 0; i < plan.length; i++) {
    const turn = i + 1;
    const piece = plan[i];
    context += piece.text + '\n\n';

    const analysis = ciCore.analyze(context, { fixedDomainTerms: domainTerms });
    const domainStats = analysis.domain?.stats || analysis.stats;

    const detectorOutputs = {};
    for (const d of detectors) {
      detectorOutputs[d.name] = d.observe(analysis);
    }

    rows.push({
      turn,
      phase: piece.phase,
      phaseLabel: piece.label,
      mean:    +domainStats.mean.toFixed(4),
      stdDev:  +domainStats.stdDev.toFixed(4),
      skew:    +domainStats.skewness.toFixed(4),
      kurt:    +domainStats.kurtosis.toFixed(4),
      count:   domainStats.count,
      detectors: detectorOutputs,
    });
  }

  const phaseFirstTurn = { 1: 1, 2: 11, 3: 21, 4: 31 };

  // 4. Compute lead times per detector per phase.
  const leadTimes = {};
  for (const d of detectors) {
    leadTimes[d.name] = {};
    for (const phase of [1, 2, 3, 4]) {
      const firstAlertRow = rows.find(
        r => r.phase === phase && r.detectors[d.name].alert
      );
      leadTimes[d.name][`phase${phase}`] = firstAlertRow
        ? (firstAlertRow.turn - phaseFirstTurn[phase] + 1) // 1 = alerted on the very first turn of the phase
        : null;
    }
  }

  // 5. Emit JSON.
  const payload = {
    experiment: 'unseen-tide',
    turns: rows.length,
    baseline: {
      mean: baseline[0], stdDev: baseline[1], skewness: baseline[2], kurtosis: baseline[3],
    },
    thresholds: {
      staticMean:     STATIC_MEAN_THRESHOLD,
      staticSigma:    STATIC_SIGMA_THRESHOLD,
      forecastHealth: FORECAST_HEALTH_THRESHOLD,
    },
    phases: PHASE_PLAN.map(p => ({ phase: p.phase, label: p.label, turns: p.turns })),
    rows,
    leadTimes,
  };
  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(payload, null, 2));

  // 6. Emit human-readable summary.
  const lines = [];
  lines.push('Unseen Tide — experiment summary');
  lines.push('================================');
  lines.push(`baseline: mean=${baseline[0].toFixed(3)}  stdDev=${baseline[1].toFixed(3)}  skew=${baseline[2].toFixed(3)}  kurt=${baseline[3].toFixed(3)}`);
  lines.push(`thresholds: mean<${STATIC_MEAN_THRESHOLD}   sigma>${STATIC_SIGMA_THRESHOLD}   health<${FORECAST_HEALTH_THRESHOLD}`);
  lines.push('');
  lines.push('turn phase        mean    σ      skew    kurt     |static-mean|static-σ |  abm   health regime        |  kalman health regime');
  lines.push('---- -----------  ------  ------ ------  ------   |-----------|---------|---------------------------- |----------------------------');
  for (const r of rows) {
    const sm = r.detectors['static-mean'];
    const ss = r.detectors['static-sigma'];
    const ab = r.detectors['abm'];
    const kf = r.detectors['kalman'];
    lines.push([
      pad(r.turn, 4),
      pad(r.phaseLabel, 11),
      fmt(r.mean,    6),
      fmt(r.stdDev,  6),
      fmt(r.skew,    6),
      fmt(r.kurt,    6),
      '  ',
      sm.alert ? '  ALERT   ' : '   ok     ',
      ss.alert ? '   ALERT ' : '    ok   ',
      pad(ab.metric.toFixed(3), 6) + '  ' + pad(ab.regime, 14) + (ab.alert ? 'A' : ' '),
      ' | ',
      pad(kf.metric.toFixed(3), 6) + '  ' + pad(kf.regime, 14) + (kf.alert ? 'A' : ' '),
    ].join(' '));
  }
  lines.push('');
  lines.push('Lead time to first alert, by phase (turns from phase start; "-" = never alerted in phase)');
  lines.push('---------------------------------------------------------------------------------------');
  lines.push('detector         phase 1   phase 2   phase 3   phase 4');
  for (const dname of ['static-mean', 'static-sigma', 'abm', 'kalman']) {
    const lt = leadTimes[dname];
    lines.push([
      pad(dname, 16),
      fmtLT(lt.phase1),
      fmtLT(lt.phase2),
      fmtLT(lt.phase3),
      fmtLT(lt.phase4),
    ].join('   '));
  }
  const summary = lines.join('\n') + '\n';
  fs.writeFileSync(path.join(outDir, 'summary.txt'), summary);
  process.stdout.write(summary);
}

function pad(v, n) { return String(v).padEnd(n); }
function fmt(v, n) { return (v >= 0 ? ' ' : '') + v.toFixed(3).padStart(n - 1); }
function fmtLT(v) {
  if (v == null) return '    -    ';
  return pad(`T+${v}`.padStart(6), 9);
}

main();
