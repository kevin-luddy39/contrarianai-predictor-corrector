/**
 * Baseline construction.
 *
 * The "ideal" distribution against which drift is measured. Three sources:
 *
 *   1. analyticalBaseline(referenceText, ciCore)
 *        Run context-inspector on a pristine reference corpus scored
 *        against itself. The resulting (mean, stdDev, skew, kurt) IS
 *        the ideal — by construction the reference is maximally on-domain.
 *
 *   2. empiricalBaseline(goldenRunStats)
 *        Average the moments across a known-good session. Use when
 *        you don't have a pristine reference but do have a trusted
 *        exemplar conversation.
 *
 *   3. prescriptiveBaseline({ mean, stdDev, skewness, kurtosis })
 *        Specify the target directly. Useful for policy-driven
 *        workflows ("σ must stay ≤ 0.15").
 *
 * All three return the same 4-element state vector, so downstream
 * code is source-agnostic.
 */

const { fromStats, STATE_DIM } = require('./state');

function analyticalBaseline(referenceText, ciCore, options = {}) {
  if (!ciCore || typeof ciCore.analyze !== 'function') {
    throw new Error('analyticalBaseline needs context-inspector core.js (ciCore.analyze)');
  }
  const domainTerms = typeof ciCore.extractDomainTerms === 'function'
    ? ciCore.extractDomainTerms(referenceText, options)
    : undefined;
  const analysis = ciCore.analyze(referenceText, {
    ...options,
    fixedDomainTerms: domainTerms,
  });
  const stats = analysis?.domain?.stats || analysis?.stats || analysis;
  return fromStats(stats);
}

function empiricalBaseline(goldenRunStats) {
  if (!Array.isArray(goldenRunStats) || goldenRunStats.length === 0) {
    throw new Error('empiricalBaseline needs a non-empty array of stats');
  }
  const acc = new Array(STATE_DIM).fill(0);
  for (const s of goldenRunStats) {
    const v = fromStats(s);
    for (let i = 0; i < STATE_DIM; i++) acc[i] += v[i];
  }
  return acc.map(v => v / goldenRunStats.length);
}

function prescriptiveBaseline(target) {
  const { mean = 0.75, stdDev = 0.15, skewness = 0, kurtosis = 0 } = target || {};
  return [mean, stdDev, skewness, kurtosis];
}

module.exports = {
  analyticalBaseline,
  empiricalBaseline,
  prescriptiveBaseline,
};
