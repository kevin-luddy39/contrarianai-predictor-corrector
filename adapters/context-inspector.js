/**
 * Adapter: context-inspector analysis output → predictor-corrector state.
 *
 * Context-inspector's computeStats returns:
 *   { mean, stdDev, variance, skewness, kurtosis, min, max, median,
 *     count, histogram, gaussianFit, binEdges }
 *
 * analyzeContext wraps per-chunk scores in domain/user sections:
 *   { domain: { stats, scores }, user: { stats, scores }, chunks, ... }
 *
 * We accept any of these shapes and normalize to a clean ingestion
 * record the Forecaster can consume.
 */

const { fromStats } = require('../core/state');

function extractStats(ciAnalysis, channel = 'domain') {
  if (!ciAnalysis || typeof ciAnalysis !== 'object') return null;
  if (ciAnalysis.stats) return ciAnalysis.stats;            // already a stats object
  if (ciAnalysis[channel]?.stats) return ciAnalysis[channel].stats;
  if (typeof ciAnalysis.mean === 'number') return ciAnalysis;   // bare stats
  return null;
}

function extractScores(ciAnalysis, channel = 'domain') {
  if (!ciAnalysis) return [];
  if (Array.isArray(ciAnalysis.scores)) return ciAnalysis.scores;
  if (Array.isArray(ciAnalysis[channel]?.scores)) return ciAnalysis[channel].scores;
  return [];
}

function extractHistogram(ciAnalysis, channel = 'domain') {
  const s = extractStats(ciAnalysis, channel);
  return s?.histogram ?? null;
}

function ingest(ciAnalysis, options = {}) {
  const channel = options.channel || 'domain';
  const stats = extractStats(ciAnalysis, channel);
  if (!stats) throw new Error('ingest: could not locate stats on ciAnalysis');
  return {
    turn: options.turn,
    x: fromStats(stats),
    stats,
    histogram: stats.histogram ?? null,
    scores: extractScores(ciAnalysis, channel),
    binEdges: stats.binEdges ?? null,
  };
}

module.exports = { ingest, extractStats, extractScores, extractHistogram };
