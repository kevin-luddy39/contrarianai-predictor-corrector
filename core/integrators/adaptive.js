/**
 * Step-size controller for ABM via the Milne device.
 *
 * Standard I-controller on the estimated local error. Given a target
 * tolerance `tol` and current Milne error `eps`:
 *
 *   ratio = (tol / max(eps, eps_floor))^(1/5)       // AB4/AM4 order = 4
 *   h_new = clip(safety * h * ratio, h_min, h_max)
 *
 * Accept the step when eps <= tol. Otherwise reject and retry with
 * smaller h.
 *
 * For turn-indexed contexts, fractional h < 1 means sub-turn forecasts
 * (per-chunk resolution). h > 1 skips ahead across quiet turns.
 */

const ORDER = 4;
const SAFETY = 0.9;
const EPS_FLOOR = 1e-12;

function nextStep(h, eps, tol, opts = {}) {
  const hMin = opts.hMin ?? 0.05;
  const hMax = opts.hMax ?? 4.0;
  const ratio = Math.pow(tol / Math.max(eps, EPS_FLOOR), 1 / (ORDER + 1));
  const proposed = SAFETY * h * ratio;
  return Math.max(hMin, Math.min(hMax, proposed));
}

function accept(eps, tol) {
  return eps <= tol;
}

module.exports = { nextStep, accept, ORDER, SAFETY };
