/**
 * Distribution metric properties.
 */

const assert = require('assert');
const {
  klDivergence, jsDivergence, wasserstein1d, gaussianHistogram,
} = require('../core/metrics');

module.exports = async function () {
  const p = gaussianHistogram(0.75, 0.15, 20);
  const q = gaussianHistogram(0.75, 0.15, 20);
  const r = gaussianHistogram(0.30, 0.25, 20);

  // Self-divergence ~ 0
  assert(klDivergence(p, q) < 1e-6, `KL(p,p) should be ~0, got ${klDivergence(p, q)}`);
  assert(jsDivergence(p, q) < 1e-6);
  assert(wasserstein1d(p, q) < 1e-6);

  // Divergence from different distribution > 0
  assert(jsDivergence(p, r) > 0.01, 'JS should detect real divergence');
  assert(wasserstein1d(p, r) > 0.05, 'W1 should detect real divergence');

  // W1 monotonicity: shifting mean further → larger W1
  const r2 = gaussianHistogram(0.10, 0.25, 20);
  assert(wasserstein1d(p, r2) > wasserstein1d(p, r),
    'W1 should grow with mean separation');

  // Symmetry of JS
  const jspq = jsDivergence(p, r);
  const jsqp = jsDivergence(r, p);
  assert(Math.abs(jspq - jsqp) < 1e-9, 'JS should be symmetric');
};
