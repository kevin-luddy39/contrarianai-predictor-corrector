/**
 * State vector shape and helpers.
 *
 * Every integrator operates on a 4-component state:
 *   x = [ mean, stdDev, skewness, kurtosis ]
 *
 * These are the four moments context-inspector already computes.
 * Higher moments hide contamination signatures (bimodal kurtosis spike),
 * so carrying them explicitly matters even when they look noisy.
 */

const STATE_KEYS = ['mean', 'stdDev', 'skewness', 'kurtosis'];
const STATE_DIM = STATE_KEYS.length;

function zeros() {
  return new Array(STATE_DIM).fill(0);
}

function add(a, b) {
  return a.map((v, i) => v + b[i]);
}

function sub(a, b) {
  return a.map((v, i) => v - b[i]);
}

function scale(a, s) {
  return a.map(v => v * s);
}

function norm(a) {
  return Math.sqrt(a.reduce((acc, v) => acc + v * v, 0));
}

/**
 * Weighted Euclidean norm. Defaults reflect that mean and stdDev are
 * robust stats while skew and kurt are genuinely noisy on small
 * samples (±0.2 per-turn jitter is typical with n < 30 chunks). Shape
 * information is captured more reliably by the histogram KL / W1
 * signals, so skew and kurt are excluded from the parametric gap and
 * carried in the state vector only for the integrator's dynamics.
 *
 * Callers can override via options.gapWeights on the Forecaster — set
 * [1,1,0.2,0.1] if you have large chunk counts (n > 50) and want the
 * higher moments to contribute.
 */
const DEFAULT_GAP_WEIGHTS = [1.0, 1.0, 0.0, 0.0];

function weightedNorm(a, weights = DEFAULT_GAP_WEIGHTS) {
  let acc = 0;
  for (let i = 0; i < a.length; i++) acc += weights[i] * a[i] * a[i];
  return Math.sqrt(acc);
}

function fromStats(stats) {
  return [
    stats.mean ?? 0,
    stats.stdDev ?? 0,
    stats.skewness ?? 0,
    stats.kurtosis ?? 0,
  ];
}

function toStats(x) {
  return {
    mean: x[0],
    stdDev: x[1],
    skewness: x[2],
    kurtosis: x[3],
  };
}

function clone(x) {
  return x.slice();
}

function clamp(x) {
  // Physical constraints: mean in [0,1], stdDev >= 0.
  // Skew/kurt can be any real number.
  const out = clone(x);
  out[0] = Math.max(0, Math.min(1, out[0]));
  out[1] = Math.max(0, out[1]);
  return out;
}

module.exports = {
  STATE_KEYS,
  STATE_DIM,
  zeros,
  add,
  sub,
  scale,
  norm,
  weightedNorm,
  DEFAULT_GAP_WEIGHTS,
  fromStats,
  toStats,
  clone,
  clamp,
};
