/**
 * Diagonal linear Kalman filter — alternative engine.
 *
 * Since our state components are weakly coupled and the measurement
 * model is identity (context-inspector reports what we're tracking),
 * a diagonal KF is both sufficient and transparent.
 *
 *   Predict:
 *     x_{n+1|n} = F x_n + B u_n
 *     P_{n+1|n} = F P_n F^T + Q
 *
 *   Update (on measurement z):
 *     y = z - H x_{n+1|n}
 *     S = H P H^T + R
 *     K = P H^T S^{-1}
 *     x_{n+1|n+1} = x_{n+1|n} + K y
 *     P_{n+1|n+1} = (I - K H) P
 *
 * F encodes mean-reversion: F = I + h * diag(-k1, -k2, -k3, -k4).
 * B u encodes the event-driven injection the same way dynamics.js does.
 * H = I (direct observation of all four moments from CI).
 *
 * Q is process noise (how wrong our model is); R is measurement noise
 * (how noisy CI's stats are on finite chunks). Both diagonal.
 */

const { STATE_DIM, add, sub } = require('../state');
const { DEFAULT_PARAMS } = require('../dynamics');

const DEFAULT_Q = [1e-4, 1e-4, 1e-3, 1e-3];   // process noise per moment
const DEFAULT_R = [1e-3, 1e-3, 1e-2, 2e-2];   // measurement noise per moment

function createKalman(x0, baseline, options = {}) {
  const p = { ...DEFAULT_PARAMS, ...(options.params || {}) };
  const h = options.h ?? 1;

  let x = x0.slice();
  let P = (options.P0 || [0.01, 0.01, 0.05, 0.05]).slice();
  const Q = (options.Q || DEFAULT_Q).slice();
  const R = (options.R || DEFAULT_R).slice();

  // Transition diagonal: x_{n+1} = x_n + h * (-k * (x_n - x*)) + drive
  //                  => x_{n+1} = (1 - h*k) * x_n + h*k*x* + drive
  const decay = [1 - h * p.k1, 1 - h * p.k2, 1 - h * p.k3, 1 - h * p.k4];
  const pull  = [    h * p.k1,     h * p.k2,     h * p.k3,     h * p.k4];

  function controlInput(events = {}) {
    const drift = (typeof events.newestChunkScore === 'number')
      ? (events.newestChunkScore - baseline[0]) : 0;
    const chunks = events.chunksAdded ?? 0;
    const summ   = events.summarizations ?? 0;
    const skewEv = events.injectionAsymmetry ?? 0;
    const kurtEv = events.bimodalSignal ?? 0;
    return [
      h * p.alpha * drift,
      h * (p.beta * chunks * Math.abs(drift) - p.gamma * summ),
      h * p.zeta  * skewEv,
      h * p.eta   * kurtEv,
    ];
  }

  function predict(events) {
    const u = controlInput(events);
    const xPred = [];
    for (let i = 0; i < STATE_DIM; i++) {
      xPred[i] = decay[i] * x[i] + pull[i] * baseline[i] + u[i];
    }
    const PPred = P.map((v, i) => decay[i] * decay[i] * v + Q[i]);
    return { xPred, PPred };
  }

  function update(xPred, PPred, z) {
    const y = sub(z, xPred);
    const S = PPred.map((v, i) => v + R[i]);
    const K = PPred.map((v, i) => v / S[i]);
    const xNew = xPred.map((v, i) => v + K[i] * y[i]);
    const PNew = PPred.map((v, i) => (1 - K[i]) * v);
    // Innovation magnitude is a secondary health signal
    const innovation = Math.sqrt(y.reduce((a, yi, i) => a + (yi * yi) / S[i], 0));
    return { x: xNew, P: PNew, innovation };
  }

  function step(events, measurement) {
    const { xPred, PPred } = predict(events);
    if (!measurement) {
      // Pure forecast with no observation yet
      x = xPred; P = PPred;
      return { predicted: xPred, corrected: xPred, error: 0, innovation: 0 };
    }
    const upd = update(xPred, PPred, measurement);
    x = upd.x; P = upd.P;
    // "Error" in KF-land is the innovation — how surprised the filter was.
    // Treat it analogously to Milne error for the health score.
    return {
      predicted: xPred,
      corrected: upd.x,
      error: upd.innovation,
      innovation: upd.innovation,
    };
  }

  function getState() {
    return { x: x.slice(), P: P.slice() };
  }

  return { step, predict, update, getState };
}

module.exports = { createKalman, DEFAULT_Q, DEFAULT_R };
