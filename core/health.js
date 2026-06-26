/**
 * Health scoring.
 *
 * Converts the integrator's local error estimate (Milne error for ABM,
 * innovation magnitude for Kalman) plus distribution-shape divergences
 * into a single scalar in [0, 1].
 *
 *   1.0  → on baseline, prediction and observation agree
 *   0.0  → divergence at or beyond tolerance
 *
 * Also exposes regime labels so a dashboard can show "healthy / drift /
 * contamination / rot" without the caller having to interpret numbers.
 */

const DEFAULT_TOLERANCE = {
  // Observation-vs-prediction gap in 4D state-space. A realistic quiet
  // healthy trace produces ~0.02-0.04 just from per-turn sampling noise,
  // so 0.15 gives ~3x headroom before the score starts to drop.
  forecastError: 0.15,
  // Histogram tolerances are deliberately loose — small-sample empirical
  // histograms vs smooth Gaussian predictions naturally produce KL of
  // 0.5+ nats and W1 of 0.1+ even on healthy traces.
  histogramKL:   1.0,
  histogramW1:   0.30,
};

const SECONDARY_WEIGHT = 0.25;   // max health reduction per secondary signal

/**
 * Primary-plus-penalty combine.
 *
 * The forecast error (observation vs prediction gap in moment-space) is
 * the primary signal — when the model and reality agree, health is
 * high. Histogram divergences are secondary diagnostic signals: they
 * can REDUCE health but by a bounded amount so a noisy empirical
 * histogram doesn't tank the score on its own.
 */
function scoreFromSignals(signals, tolerance = DEFAULT_TOLERANCE) {
  const primary = (typeof signals.forecastError === 'number')
    ? 1 - clip(signals.forecastError / tolerance.forecastError)
    : 1;

  let penalty = 0;
  if (typeof signals.histogramKL === 'number') {
    penalty += SECONDARY_WEIGHT * clip(signals.histogramKL / tolerance.histogramKL);
  }
  if (typeof signals.histogramW1 === 'number') {
    penalty += SECONDARY_WEIGHT * clip(signals.histogramW1 / tolerance.histogramW1);
  }

  return Math.max(0, primary - penalty);
}

function regime(score) {
  if (score >= 0.85) return 'healthy';
  if (score >= 0.60) return 'drift';
  if (score >= 0.30) return 'contamination';
  return 'rot';
}

function clip(v) { return Math.max(0, Math.min(1, v)); }

module.exports = {
  scoreFromSignals,
  regime,
  DEFAULT_TOLERANCE,
};
