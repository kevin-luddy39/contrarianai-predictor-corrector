/**
 * Governing ODE for bell-curve state evolution.
 *
 * x = [ mean, stdDev, skewness, kurtosis ]
 *
 *   dmean/dt   = -k1 (mean    - mean*)    + alpha * drift
 *   dstdDev/dt = -k2 (stdDev  - stdDev*)  + beta  * chunks * |drift|  - gamma * compression
 *   dskew/dt   = -k3 (skew    - skew*)    + zeta  * injection_asymmetry
 *   dkurt/dt   = -k4 (kurt    - kurt*)    + eta   * bimodal_signal
 *
 * Note the |drift| factor on the stdDev noise term: adding new chunks
 * only disperses the distribution when those chunks deviate from the
 * baseline mean. Healthy on-topic chunks produce drift≈0 and therefore
 * contribute no dispersion — mean reversion alone governs stdDev.
 *
 * Mean-reversion (Ornstein-Uhlenbeck in deterministic form) pulls each
 * moment toward the baseline. Event-driven terms model the observable
 * forces that knock the distribution off baseline: new chunks arriving,
 * summarization compressing, retrieval injecting off-domain content.
 *
 * Default coefficients are chosen for O(1)-per-turn timescales. Tune
 * per workflow via params.
 */

const DEFAULT_PARAMS = {
  k1: 0.25,   // mean reversion rate
  k2: 0.20,   // stdDev reversion rate
  k3: 0.15,   // skew reversion rate
  k4: 0.10,   // kurt reversion rate
  alpha: 0.30, // chunk-score drift coupling
  beta:  0.08, // chunks-added noise coupling
  gamma: 0.05, // summarization compression on stdDev
  zeta:  0.10, // injection asymmetry → skew
  eta:   0.12, // bimodal signature → kurt
};

/**
 * @param {number[]} x        current state vector
 * @param {number[]} baseline baseline state vector (same shape as x)
 * @param {object}   events   workflow events for this step
 * @param {object}   [params] override coefficients
 * @returns {number[]} dx/dt
 */
function dynamics(x, baseline, events = {}, params = {}) {
  const p = { ...DEFAULT_PARAMS, ...params };
  const [m, s, g1, g2] = x;
  const [mStar, sStar, g1Star, g2Star] = baseline;

  const newestChunkScore = events.newestChunkScore;
  const drift = (typeof newestChunkScore === 'number')
    ? (newestChunkScore - mStar)
    : 0;

  const chunksAdded = events.chunksAdded ?? 0;
  const summarizations = events.summarizations ?? 0;
  const injectionAsymmetry = events.injectionAsymmetry ?? 0;
  const bimodalSignal = events.bimodalSignal ?? 0;

  const dm  = -p.k1 * (m  - mStar)  + p.alpha * drift;
  const ds  = -p.k2 * (s  - sStar)  + p.beta  * chunksAdded * Math.abs(drift) - p.gamma * summarizations;
  const dg1 = -p.k3 * (g1 - g1Star) + p.zeta  * injectionAsymmetry;
  const dg2 = -p.k4 * (g2 - g2Star) + p.eta   * bimodalSignal;

  return [dm, ds, dg1, dg2];
}

module.exports = { dynamics, DEFAULT_PARAMS };
