#!/usr/bin/env node
/**
 * predictor-corrector — MCP Server
 *
 * Forecasts the next ideal bell-curve state for a context window using
 * Adams-Bashforth-Moulton predictor-corrector (default) or a linear
 * Kalman filter. Designed to compose with context-inspector.
 *
 * Add to .mcp.json:
 *
 *   {
 *     "mcpServers": {
 *       "predictor-corrector": {
 *         "command": "node",
 *         "args": ["/path/to/tools/predictor-corrector/mcp-server.js"]
 *       }
 *     }
 *   }
 *
 * Tools:
 *   predict_next_bell        — one-step forecast from prior CI analyses
 *   correct_with_measurement — PECE correction given prediction + observation
 *   baseline_from_reference  — derive ideal bell curve from a reference text
 *   health_score             — single scalar + regime label
 *   simulate_trajectory      — N-step look-ahead
 */

const path = require('path');
const fs = require('fs');

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

const { Forecaster } = require('./core');
const {
  analyticalBaseline,
  empiricalBaseline,
  prescriptiveBaseline,
} = require('./core/baseline');
const { ingest } = require('./adapters/context-inspector');
const { classify } = require('./adapters/events');

const server = new McpServer({
  name: 'predictor-corrector',
  version: '0.1.0',
});

function loadCiCore() {
  try {
    return require('contrarianai-context-inspector');
  } catch {
    return null;
  }
}

function resolveBaseline(spec = {}) {
  const mode = spec.mode || 'prescriptive';
  if (mode === 'analytical') {
    const ciCore = loadCiCore();
    if (!ciCore) throw new Error('context-inspector core.js not reachable');
    const refText = spec.reference ?? (spec.referencePath ? fs.readFileSync(spec.referencePath, 'utf8') : null);
    if (!refText) throw new Error('analytical baseline requires reference or referencePath');
    return analyticalBaseline(refText, ciCore);
  }
  if (mode === 'empirical') {
    if (!Array.isArray(spec.goldenRunStats)) throw new Error('empirical baseline requires goldenRunStats array');
    return empiricalBaseline(spec.goldenRunStats);
  }
  return prescriptiveBaseline(spec.target || {});
}

function buildForecaster(input) {
  const baseline = input.baseline
    ? (Array.isArray(input.baseline) ? input.baseline : resolveBaseline(input.baseline))
    : resolveBaseline({});
  const forecaster = new Forecaster({
    baseline,
    engine: input.engine || 'abm',
    adaptive: !!input.adaptive,
    tolerance: input.tolerance,
    initialState: input.initialState || baseline,
  });
  if (Array.isArray(input.history)) {
    // Seed from prior CI analyses (if given).
    let prev = null;
    const channel = input.channel || 'domain';
    for (let i = 0; i < input.history.length; i++) {
      const curr = ingest(input.history[i], { channel, turn: i + 1 });
      const events = classify(prev, curr, { turn: i + 1 });
      forecaster.observe(curr, events);
      prev = curr;
    }
  }
  return forecaster;
}

// ---------------------------------------------------------------
// Tool: predict_next_bell
// ---------------------------------------------------------------
server.tool(
  'predict_next_bell',
  'Given a sequence of prior context-inspector analyses, forecast the next bell-curve state (mean, stdDev, skewness, kurtosis) assuming the workflow stays on baseline.',
  {
    history: z.array(z.any()).describe('Array of context-inspector analyze_context outputs, chronological'),
    baseline: z.any().optional().describe('4-element [mean,stdDev,skew,kurt] array, or {mode, target, reference, goldenRunStats} spec'),
    engine: z.enum(['abm', 'kalman']).optional().default('abm'),
    channel: z.enum(['domain', 'user']).optional().default('domain'),
    events: z.any().optional().describe('Optional workflow events for the next step'),
  },
  async ({ history, baseline, engine, channel, events }) => {
    const forecaster = buildForecaster({ baseline, engine, channel, history });
    const { predicted, error } = forecaster.predictNext(events || {});
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          predicted: { mean: predicted[0], stdDev: predicted[1], skewness: predicted[2], kurtosis: predicted[3] },
          predictorError: error,
          engine,
        }, null, 2),
      }],
    };
  }
);

// ---------------------------------------------------------------
// Tool: correct_with_measurement
// ---------------------------------------------------------------
server.tool(
  'correct_with_measurement',
  'PECE correction step. Given prior history and a fresh context-inspector analysis, return predicted vs corrected state plus the Milne/innovation error that drives the health signal.',
  {
    history: z.array(z.any()).describe('Prior CI analyses'),
    measurement: z.any().describe('Latest CI analysis (the new observation)'),
    baseline: z.any().optional(),
    engine: z.enum(['abm', 'kalman']).optional().default('abm'),
    channel: z.enum(['domain', 'user']).optional().default('domain'),
    events: z.any().optional(),
  },
  async ({ history, measurement, baseline, engine, channel, events }) => {
    const forecaster = buildForecaster({ baseline, engine, channel, history });
    const curr = ingest(measurement, { channel, turn: (history?.length || 0) + 1 });
    const prev = history && history.length
      ? ingest(history[history.length - 1], { channel, turn: history.length })
      : null;
    const ev = events || classify(prev, curr);
    const step = forecaster.observe(curr, ev);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          predicted: { mean: step.predicted[0], stdDev: step.predicted[1], skewness: step.predicted[2], kurtosis: step.predicted[3] },
          corrected: { mean: step.corrected[0], stdDev: step.corrected[1], skewness: step.corrected[2], kurtosis: step.corrected[3] },
          error: step.error,
          health: step.health,
          regime: step.regime,
          signals: step.signals,
          events: ev,
        }, null, 2),
      }],
    };
  }
);

// ---------------------------------------------------------------
// Tool: baseline_from_reference
// ---------------------------------------------------------------
server.tool(
  'baseline_from_reference',
  'Derive the ideal baseline bell curve (mean, stdDev, skew, kurt) from a reference corpus by running context-inspector on it against itself.',
  {
    reference: z.string().describe('Reference corpus text'),
    chunkSize: z.number().optional().default(500),
  },
  async ({ reference, chunkSize }) => {
    const ciCore = loadCiCore();
    if (!ciCore) throw new Error('context-inspector core.js not reachable');
    const baseline = analyticalBaseline(reference, ciCore, { chunkSize });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          baseline: { mean: baseline[0], stdDev: baseline[1], skewness: baseline[2], kurtosis: baseline[3] },
        }, null, 2),
      }],
    };
  }
);

// ---------------------------------------------------------------
// Tool: health_score
// ---------------------------------------------------------------
server.tool(
  'health_score',
  'Run a full session through the forecaster and return the final health score and regime label (healthy / drift / contamination / rot).',
  {
    history: z.array(z.any()).describe('Sequence of CI analyses, chronological'),
    baseline: z.any().optional(),
    engine: z.enum(['abm', 'kalman']).optional().default('abm'),
    channel: z.enum(['domain', 'user']).optional().default('domain'),
    tolerance: z.any().optional(),
  },
  async ({ history, baseline, engine, channel, tolerance }) => {
    const forecaster = buildForecaster({ baseline, engine, channel, history, tolerance });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(forecaster.healthReport(), null, 2),
      }],
    };
  }
);

// ---------------------------------------------------------------
// Tool: simulate_trajectory
// ---------------------------------------------------------------
server.tool(
  'simulate_trajectory',
  'Advance the forecaster N steps forward from current history with no new observations. Use for what-if projections.',
  {
    history: z.array(z.any()).describe('Prior CI analyses (at least 4 for ABM)'),
    steps: z.number().int().positive(),
    baseline: z.any().optional(),
    engine: z.enum(['abm', 'kalman']).optional().default('abm'),
    channel: z.enum(['domain', 'user']).optional().default('domain'),
    eventsPerStep: z.array(z.any()).optional(),
  },
  async ({ history, steps, baseline, engine, channel, eventsPerStep }) => {
    const forecaster = buildForecaster({ baseline, engine, channel, history });
    const out = forecaster.simulate(steps, eventsPerStep || []);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ trajectory: out }, null, 2),
      }],
    };
  }
);

// ---------------------------------------------------------------
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  process.stderr.write(`predictor-corrector MCP error: ${err.stack || err.message}\n`);
  process.exit(1);
});
