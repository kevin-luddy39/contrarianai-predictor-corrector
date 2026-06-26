/**
 * Workflow event classification.
 *
 * The dynamics ODE is driven by four exogenous inputs per turn:
 *   newestChunkScore     — how well the freshly added content aligned
 *   chunksAdded          — raw new-chunk count (noise source)
 *   summarizations       — compression events (shrink stdDev)
 *   injectionAsymmetry   — skew-inducing one-sided content
 *   bimodalSignal        — kurtosis-inducing two-cluster content
 *
 * This adapter derives them from consecutive context-inspector records
 * when the caller hasn't supplied them directly. Heuristic but
 * bounded — overrides always take precedence.
 */

const { extractScores, extractStats } = require('./context-inspector');

function classify(prevIngested, currIngested, overrides = {}) {
  const prevStats = prevIngested?.stats;
  const currStats = currIngested?.stats;

  const prevCount = prevStats?.count ?? 0;
  const currCount = currStats?.count ?? 0;
  const chunksAdded = Math.max(0, currCount - prevCount);

  // Newest chunk score — if scores grew, take the tail ones' mean.
  let newestChunkScore;
  const currScores = currIngested?.scores || [];
  if (currScores.length > 0 && chunksAdded > 0) {
    const tail = currScores.slice(-chunksAdded);
    newestChunkScore = tail.reduce((a, b) => a + b, 0) / tail.length;
  } else if (typeof currStats?.mean === 'number') {
    newestChunkScore = currStats.mean;
  }

  // Summarization heuristic: chunk count dropped.
  const summarizations = Math.max(0, prevCount - currCount);

  // Shape-derived heuristics for higher moments.
  const injectionAsymmetry = currStats?.skewness ?? 0;
  const bimodalSignal = detectBimodality(currIngested?.histogram);

  return {
    newestChunkScore,
    chunksAdded,
    summarizations,
    injectionAsymmetry,
    bimodalSignal,
    ...overrides,
  };
}

/**
 * Dip test lite — two-mode detection by scanning for a local minimum
 * between two local maxima in a smoothed histogram. Returns a signal
 * in [0, 1] indicating how pronounced the bimodality is.
 */
function detectBimodality(histogram) {
  if (!Array.isArray(histogram) || histogram.length < 5) return 0;
  // Simple moving-average smoothing
  const k = 2;
  const sm = histogram.map((_, i) => {
    let s = 0, n = 0;
    for (let j = Math.max(0, i - k); j <= Math.min(histogram.length - 1, i + k); j++) {
      s += histogram[j]; n++;
    }
    return s / n;
  });
  const peaks = [];
  const valleys = [];
  for (let i = 1; i < sm.length - 1; i++) {
    if (sm[i] > sm[i - 1] && sm[i] > sm[i + 1]) peaks.push({ i, v: sm[i] });
    if (sm[i] < sm[i - 1] && sm[i] < sm[i + 1]) valleys.push({ i, v: sm[i] });
  }
  if (peaks.length < 2) return 0;
  peaks.sort((a, b) => b.v - a.v);
  const [p1, p2] = peaks;
  const lo = Math.min(p1.i, p2.i);
  const hi = Math.max(p1.i, p2.i);
  let minBetween = Infinity;
  for (let i = lo + 1; i < hi; i++) {
    if (sm[i] < minBetween) minBetween = sm[i];
  }
  if (!isFinite(minBetween)) return 0;
  const smallerPeak = Math.min(p1.v, p2.v);
  if (smallerPeak <= 0) return 0;
  const dip = 1 - (minBetween / smallerPeak);
  return Math.max(0, Math.min(1, dip));
}

module.exports = { classify, detectBimodality };
