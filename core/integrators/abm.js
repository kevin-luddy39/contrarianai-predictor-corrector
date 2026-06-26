/**
 * Adams-Bashforth-Moulton 4-step predictor-corrector (PECE mode).
 *
 *   Predictor (AB4, explicit):
 *     x_{n+1}^p = x_n + (h/24)(55 f_n - 59 f_{n-1} + 37 f_{n-2} - 9 f_{n-3})
 *
 *   Corrector (AM4, implicit — evaluated with predicted f):
 *     x_{n+1}^c = x_n + (h/24)(9 f_{n+1}^p + 19 f_n - 5 f_{n-1} + f_{n-2})
 *
 *   Milne error estimate:
 *     eps ≈ (19/270) * ||x_{n+1}^c - x_{n+1}^p||
 *
 * The Milne error is the principal health signal: it measures how
 * much the corrector had to pull the predictor back. When it spikes,
 * the system is leaving the regime described by our dynamics.
 *
 * Caller must supply the last four (x, f) pairs from history in
 * chronological order (oldest first, newest last).
 */

const { sub, norm } = require('../state');
const { rk4Step } = require('./rk4');

const MILNE_COEF = 19 / 270;

/**
 * @param {Function} f          dynamics: (x, events) -> dx/dt
 * @param {Array<{x:number[], f:number[]}>} history  last 4 entries, newest last
 * @param {number}   h          step size (default 1 turn)
 * @param {object}   events     events at step n+1 (drives predictor evaluate)
 * @returns {{ predicted, corrected, error, fPredicted, fCorrected }}
 */
function abmStep(f, history, h = 1, events = {}) {
  if (!Array.isArray(history) || history.length < 4) {
    throw new Error(`ABM needs >=4 history entries, got ${history?.length ?? 0}`);
  }
  const [h3, h2, h1, h0] = history.slice(-4);  // n-3, n-2, n-1, n

  // Predictor (AB4)
  const predicted = h0.x.map((_, i) =>
    h0.x[i] + (h / 24) * (
      55 * h0.f[i] - 59 * h1.f[i] + 37 * h2.f[i] - 9 * h3.f[i]
    )
  );

  // Evaluate f at predicted state
  const fPredicted = f(predicted, events);

  // Corrector (AM4)
  const corrected = h0.x.map((_, i) =>
    h0.x[i] + (h / 24) * (
      9 * fPredicted[i] + 19 * h0.f[i] - 5 * h1.f[i] + h2.f[i]
    )
  );

  // Second evaluate (the second E in PECE — gives f_{n+1} for next step)
  const fCorrected = f(corrected, events);

  // Milne error
  const error = MILNE_COEF * norm(sub(corrected, predicted));

  return { predicted, corrected, error, fPredicted, fCorrected };
}

/**
 * Bootstrap the first 4 entries using RK4 when history is short.
 * Returns a filled history array of length 4. Call once, then use
 * abmStep for subsequent steps.
 */
function bootstrap(f, x0, events, h = 1) {
  const hist = [];
  let x = x0;
  for (let i = 0; i < 4; i++) {
    const fx = f(x, events);
    hist.push({ x, f: fx });
    x = rk4Step(f, x, h, events);
  }
  return hist;
}

module.exports = { abmStep, bootstrap, MILNE_COEF };
