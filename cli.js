#!/usr/bin/env node
/**
 * predictor-corrector CLI
 *
 * Reads a JSON array of context-inspector analyses from a file or stdin
 * and emits forecasts + health signals. Composes after context-inspector:
 *
 *   ci --json run1.txt > turn01.json
 *   ci --json run2.txt > turn02.json
 *   ...
 *   cat turn*.json | jq -s '.' | predictor-corrector --baseline prescriptive
 *
 * Flags:
 *   --baseline <analytical|empirical|prescriptive>  default prescriptive
 *   --target  <json>           prescriptive target (e.g. '{"mean":0.78,"stdDev":0.15}')
 *   --reference <path>         reference corpus for analytical baseline
 *   --engine  <abm|kalman>     default abm
 *   --channel <domain|user>    which CI channel to track, default domain
 *   --adaptive                 enable Milne-device step-size control
 *   --tolerance <float>        forecast-error tolerance, default 0.08
 */

const fs = require('fs');
const path = require('path');

const { Forecaster } = require('./core');
const {
  analyticalBaseline,
  empiricalBaseline,
  prescriptiveBaseline,
} = require('./core/baseline');
const { ingest } = require('./adapters/context-inspector');
const { classify } = require('./adapters/events');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next; i++;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

function readStdinSync() {
  return fs.readFileSync(0, 'utf8');
}

function loadInput(args) {
  if (args._[0] && args._[0] !== '-') {
    return JSON.parse(fs.readFileSync(args._[0], 'utf8'));
  }
  const raw = readStdinSync();
  return JSON.parse(raw);
}

function loadCiCore() {
  try {
    return require('contrarianai-context-inspector');
  } catch (e) {
    return null;
  }
}

function buildBaseline(args) {
  const mode = args.baseline || 'prescriptive';
  if (mode === 'analytical') {
    if (!args.reference) throw new Error('--baseline analytical requires --reference <path>');
    const ciCore = loadCiCore();
    if (!ciCore) throw new Error('context-inspector core.js not found; cannot build analytical baseline');
    const ref = fs.readFileSync(args.reference, 'utf8');
    return analyticalBaseline(ref, ciCore);
  }
  if (mode === 'empirical') {
    if (!args.empiricalFrom) throw new Error('--baseline empirical requires --empiricalFrom <path>');
    const statsList = JSON.parse(fs.readFileSync(args.empiricalFrom, 'utf8'));
    return empiricalBaseline(statsList);
  }
  let target = {};
  if (args.target) {
    try { target = JSON.parse(args.target); }
    catch { throw new Error('--target must be valid JSON'); }
  }
  return prescriptiveBaseline(target);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    process.stdout.write(fs.readFileSync(__filename, 'utf8').split('*/')[0]);
    process.exit(0);
  }

  const baseline = buildBaseline(args);
  const engine = args.engine || 'abm';
  const channel = args.channel || 'domain';
  const adaptive = !!args.adaptive;
  const tolerance = args.tolerance
    ? { forecastError: parseFloat(args.tolerance) }
    : undefined;

  const forecaster = new Forecaster({
    baseline,
    engine,
    adaptive,
    tolerance,
    initialState: baseline,
  });

  const input = loadInput(args);
  const sequence = Array.isArray(input) ? input : [input];

  const results = [];
  let prev = null;
  for (let i = 0; i < sequence.length; i++) {
    const ciAnalysis = sequence[i];
    const curr = ingest(ciAnalysis, { channel, turn: i + 1 });
    const events = classify(prev, curr, { turn: i + 1 });
    const step = forecaster.observe(curr, events);
    results.push({
      turn: i + 1,
      state: curr.x,
      predicted: step.predicted,
      corrected: step.corrected,
      error: step.error,
      health: step.health,
      regime: step.regime,
      signals: step.signals,
      events,
    });
    prev = curr;
  }

  process.stdout.write(JSON.stringify({
    baseline,
    engine,
    channel,
    results,
    final: forecaster.healthReport(),
  }, null, 2) + '\n');
}

try {
  main();
} catch (err) {
  process.stderr.write(`predictor-corrector: ${err.message}\n`);
  process.exit(1);
}
