/**
 * End-to-end forecast behaviour.
 *
 * Build a synthetic "healthy" session and verify that health stays high.
 * Then inject contamination and verify that the forecaster flags it
 * before the mean has fully collapsed.
 */

const assert = require('assert');
const { Forecaster } = require('../core');
const { gaussianHistogram } = require('../core/metrics');

function fakeCi(mean, stdDev, skew = 0, kurt = 0, count = 10) {
  const histogram = gaussianHistogram(mean, stdDev, 20);
  return {
    domain: {
      stats: { mean, stdDev, skewness: skew, kurtosis: kurt, count, histogram },
      scores: [],
    },
  };
}

module.exports = async function () {
  const baseline = [0.78, 0.15, 0, 0];
  const fc = new Forecaster({ baseline, engine: 'abm' });

  const { ingest } = require('../adapters/context-inspector');
  const { classify } = require('../adapters/events');

  // 10 healthy turns — small noise around baseline
  let prev = null;
  for (let i = 0; i < 10; i++) {
    const mean = 0.78 + (Math.random() - 0.5) * 0.02;
    const std  = 0.15 + (Math.random() - 0.5) * 0.01;
    const curr = ingest(fakeCi(mean, std, 0, 0, 10 + i), { turn: i + 1 });
    const ev = classify(prev, curr);
    const step = fc.observe(curr, ev);
    prev = curr;
    // Cold start noise is higher; settled steps should be healthy.
    if (i >= 5) {
      assert(step.health > 0.6,
        `healthy session should keep health > 0.6 at turn ${i + 1}, got ${step.health}`);
    }
  }

  // Contamination: mean drops + stdDev rises sharply
  const badCi = fakeCi(0.45, 0.35, -0.8, 1.2, 22);
  const curr = ingest(badCi);
  const ev = classify(prev, curr);
  const step = fc.observe(curr, ev);
  assert(step.error > 0.05,
    `contamination should spike Milne/innovation error, got ${step.error}`);
  assert(step.health < 0.85,
    `contamination should drop health below 0.85, got ${step.health}`);

  // Kalman engine should work end-to-end too
  const kf = new Forecaster({ baseline, engine: 'kalman' });
  prev = null;
  for (let i = 0; i < 5; i++) {
    const c = ingest(fakeCi(0.78, 0.15));
    const e = classify(prev, c);
    kf.observe(c, e);
    prev = c;
  }
  const kfReport = kf.healthReport();
  assert(kfReport.engine === 'kalman');
  assert(typeof kfReport.health === 'number');
};
