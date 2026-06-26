/**
 * Distribution-shape metrics for comparing predicted vs observed
 * histograms from context-inspector.
 *
 * The parametric Milne error catches moment-level deviations. KL and
 * Wasserstein catch shape deviations that moments can miss — notably
 * bimodality emerging mid-session (classic contamination signature).
 *
 * Histograms are expected as arrays summing to ~1 (densities over
 * binCount bins on [0,1]). Zero bins are smoothed to avoid KL blow-up.
 */

const EPS = 1e-9;

function normalize(h) {
  const s = h.reduce((a, b) => a + b, 0);
  if (s <= 0) return h.map(() => 1 / h.length);
  return h.map(v => v / s);
}

function smooth(h) {
  // Add-epsilon smoothing, renormalize.
  const raw = h.map(v => v + EPS);
  return normalize(raw);
}

/**
 * Kullback-Leibler divergence D_KL(p || q), in nats.
 * Asymmetric — p is the observed, q is the predicted (nominal).
 */
function klDivergence(p, q) {
  if (p.length !== q.length) throw new Error('KL: length mismatch');
  const ps = smooth(p);
  const qs = smooth(q);
  let kl = 0;
  for (let i = 0; i < ps.length; i++) {
    kl += ps[i] * Math.log(ps[i] / qs[i]);
  }
  return kl;
}

/**
 * Jensen-Shannon divergence (symmetric, bounded in [0, ln 2]).
 * Safer than raw KL for dashboards.
 */
function jsDivergence(p, q) {
  if (p.length !== q.length) throw new Error('JS: length mismatch');
  const ps = smooth(p);
  const qs = smooth(q);
  const m = ps.map((v, i) => 0.5 * (v + qs[i]));
  return 0.5 * klDivergence(ps, m) + 0.5 * klDivergence(qs, m);
}

/**
 * 1-Wasserstein / Earth Mover's Distance for 1D histograms on a
 * uniform grid. Computed via the CDF shortcut: W1 = sum |F_p - F_q| * dx.
 * Bins assumed equal width binWidth (defaults to 1/n).
 */
function wasserstein1d(p, q, binWidth) {
  if (p.length !== q.length) throw new Error('W1: length mismatch');
  const ps = normalize(p);
  const qs = normalize(q);
  const dx = binWidth ?? 1 / p.length;
  let cdfP = 0, cdfQ = 0, w = 0;
  for (let i = 0; i < ps.length; i++) {
    cdfP += ps[i];
    cdfQ += qs[i];
    w += Math.abs(cdfP - cdfQ) * dx;
  }
  return w;
}

/**
 * Synthesize a histogram from a Gaussian fit with given mean/stdDev.
 * Useful for building the "predicted histogram" once the integrator
 * has advanced (mean, stdDev) without tracking per-bin densities.
 * binCount defaults to 20 (matches context-inspector).
 */
function gaussianHistogram(mean, stdDev, binCount = 20) {
  const out = new Array(binCount).fill(0);
  if (stdDev <= 0) {
    const idx = Math.min(binCount - 1, Math.max(0, Math.floor(mean * binCount)));
    out[idx] = 1;
    return out;
  }
  const dx = 1 / binCount;
  let total = 0;
  for (let i = 0; i < binCount; i++) {
    const x = (i + 0.5) * dx;
    const z = (x - mean) / stdDev;
    out[i] = Math.exp(-0.5 * z * z) / (stdDev * Math.sqrt(2 * Math.PI));
    total += out[i];
  }
  return out.map(v => v / (total || 1));
}

module.exports = {
  klDivergence,
  jsDivergence,
  wasserstein1d,
  gaussianHistogram,
  normalize,
};
