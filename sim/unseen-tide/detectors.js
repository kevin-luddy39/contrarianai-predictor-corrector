/**
 * Detector suite for the Unseen Tide experiment.
 *
 * Four detectors, uniform interface:
 *   detector(analysis, forecasterState?) -> { alert: bool, metric: number, name }
 *
 * Static detectors ignore history entirely. Forecast detectors own a
 * Forecaster instance and update it per turn.
 */

const { Forecaster } = require('../../core');

const STATIC_MEAN_THRESHOLD  = 0.50;
const STATIC_SIGMA_THRESHOLD = 0.30;
// Alert when health drops below this. Calibrated against Phase 1's
// observed floor of ~0.78 — staying above keeps false-positives at
// zero while catching the Phase 2 stylistic-drift slide below 0.72.
const FORECAST_HEALTH_THRESHOLD = 0.72;

function staticMeanDetector() {
  return {
    name: 'static-mean',
    threshold: STATIC_MEAN_THRESHOLD,
    observe(ciAnalysis) {
      const m = ciAnalysis.domain?.stats?.mean ?? ciAnalysis.stats?.mean ?? 0;
      return { metric: m, alert: m < STATIC_MEAN_THRESHOLD };
    },
  };
}

function staticSigmaDetector() {
  return {
    name: 'static-sigma',
    threshold: STATIC_SIGMA_THRESHOLD,
    observe(ciAnalysis) {
      const s = ciAnalysis.domain?.stats?.stdDev ?? ciAnalysis.stats?.stdDev ?? 0;
      return { metric: s, alert: s > STATIC_SIGMA_THRESHOLD };
    },
  };
}

function forecastDetector(label, engine, baseline, helpers) {
  const { ingest, classify } = helpers;
  const forecaster = new Forecaster({
    baseline,
    engine,
    adaptive: false,
    initialState: baseline,
  });
  let prev = null;
  let turn = 0;
  return {
    name: label,
    threshold: FORECAST_HEALTH_THRESHOLD,
    forecaster,
    observe(ciAnalysis) {
      turn++;
      const curr = ingest(ciAnalysis, { turn });
      const events = classify(prev, curr, { turn });
      const step = forecaster.observe(curr, events);
      prev = curr;
      return {
        metric: step.health,
        alert: step.health < FORECAST_HEALTH_THRESHOLD,
        regime: step.regime,
        error: step.error,
        milne: step.milneError,
        signals: step.signals,
      };
    },
  };
}

module.exports = {
  staticMeanDetector,
  staticSigmaDetector,
  forecastDetector,
  STATIC_MEAN_THRESHOLD,
  STATIC_SIGMA_THRESHOLD,
  FORECAST_HEALTH_THRESHOLD,
};
