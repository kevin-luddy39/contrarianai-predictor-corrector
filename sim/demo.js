#!/usr/bin/env node
/**
 * Synthetic walkthrough of the predictor-corrector.
 *
 * Generates a fake 20-turn session. The first 10 turns are healthy
 * (mean ≈ 0.78, stdDev ≈ 0.15). Starting at turn 11 we simulate
 * contamination: mean drifts down, stdDev expands, kurtosis rises
 * (bimodal emerging). The forecaster should flag this before the
 * collapse finishes.
 */

const { Forecaster } = require('../core');
const { ingest } = require('../adapters/context-inspector');
const { classify } = require('../adapters/events');
const { gaussianHistogram } = require('../core/metrics');

function makeCi(mean, stdDev, skew, kurt, count) {
  return {
    domain: {
      stats: {
        mean, stdDev,
        skewness: skew, kurtosis: kurt,
        count, histogram: gaussianHistogram(mean, stdDev, 20),
      },
      scores: [],
    },
  };
}

const baseline = [0.78, 0.15, 0, 0];
const forecaster = new Forecaster({
  baseline, engine: 'abm', adaptive: false,
});

const rows = [];
let prev = null;
for (let turn = 1; turn <= 20; turn++) {
  let mean, std, skew, kurt, count;
  if (turn <= 10) {
    mean = 0.78 + (Math.random() - 0.5) * 0.02;
    std  = 0.15 + (Math.random() - 0.5) * 0.01;
    skew = (Math.random() - 0.5) * 0.05;
    kurt = (Math.random() - 0.5) * 0.05;
    count = 10 + turn;
  } else {
    const t = (turn - 10) / 10;  // 0..1 progressive rot
    mean = 0.78 - 0.45 * t;
    std  = 0.15 + 0.25 * t;
    skew = -0.6 * t;
    kurt = 1.4 * t;
    count = 20 + turn;
  }
  const curr = ingest(makeCi(mean, std, skew, kurt, count), { turn });
  const ev = classify(prev, curr, { turn });
  const step = forecaster.observe(curr, ev);
  rows.push({
    turn,
    observed: { mean: +mean.toFixed(3), std: +std.toFixed(3), skew: +skew.toFixed(2), kurt: +kurt.toFixed(2) },
    predicted: { mean: +step.predicted[0].toFixed(3), std: +step.predicted[1].toFixed(3) },
    error: +step.error.toFixed(4),
    health: +step.health.toFixed(3),
    regime: step.regime,
  });
  prev = curr;
}

console.log('turn  observed (μ/σ/γ₁/γ₂)            predicted (μ/σ)   error   health  regime');
console.log('----  -------------------------------  ---------------   ------  ------  --------------');
for (const r of rows) {
  const o = `${String(r.observed.mean).padStart(5)}/${String(r.observed.std).padStart(5)}/${String(r.observed.skew).padStart(5)}/${String(r.observed.kurt).padStart(5)}`;
  const p = `${String(r.predicted.mean).padStart(5)}/${String(r.predicted.std).padStart(5)}`;
  console.log(
    `${String(r.turn).padStart(4)}  ${o.padEnd(31)}  ${p.padEnd(15)}   ${String(r.error).padStart(6)}  ${String(r.health).padStart(6)}  ${r.regime}`
  );
}

console.log('\nFinal report:');
console.log(JSON.stringify(forecaster.healthReport(), null, 2));
