# predictor-corrector

> Forecasts the ideal bell curve of AI context-window alignment using predictor-corrector numerical methods. Companion to [`context-inspector`](../context-inspector).

`context-inspector` measures. `predictor-corrector` predicts. Together they form a closed-loop Bell Tuning instrument: the sensor reports the live distribution of context chunk alignment; the forecaster says what the distribution *should* look like next turn if the workflow is healthy. The gap between prediction and observation is the health signal.

## Why predictor-corrector

Most teams watch `σ` and set a threshold. That's reactive — by the time `σ` crosses a line, the context has already degraded.

A predictor-corrector integrator treats the bell-curve state as a dynamical system. It forecasts the next state from prior states, then compares against the actual context-inspector measurement. The **forecast error itself is the health metric**: a mathematically grounded leading indicator, not a heuristic.

The contrarian position: model-based forecasting catches divergence before any fixed threshold does.

## State and dynamics

The state vector is the four moments context-inspector already computes:

```
x(t) = [ mean, stdDev, skewness, kurtosis ]
```

Evolution is governed by a deterministic ODE — Ornstein-Uhlenbeck mean reversion toward a baseline, plus event-driven injection from workflow events:

```
dmean/dt   = -k1 (mean   - mean*)    + α · drift
dstdDev/dt = -k2 (stdDev - stdDev*)  + β · chunks · |drift|  - γ · compression
dskew/dt   = -k3 (skew   - skew*)    + ζ · injection_asymmetry
dkurt/dt   = -k4 (kurt   - kurt*)    + η · bimodal_signal
```

`drift = newestChunkScore - mean*` — the deviation of the freshly added content from the domain. Healthy chunks have `drift ≈ 0`, so the stdDev noise term vanishes automatically and mean reversion alone governs the trajectory.

## Two engines

### Adams-Bashforth-Moulton (default)

Classical 4-step PECE scheme:

```
Predictor (AB4):  x_{n+1}^p = x_n + (h/24)(55 f_n − 59 f_{n-1} + 37 f_{n-2} − 9 f_{n-3})
Corrector (AM4):  x_{n+1}^c = x_n + (h/24)(9 f_{n+1}^p + 19 f_n − 5 f_{n-1} + f_{n-2})
Milne error:      ε ≈ (19/270) ‖x_{n+1}^c − x_{n+1}^p‖
```

Bootstrapped by 4 RK4 steps. Adaptive step-size control via the Milne device is available (`adaptive: true`).

### Kalman filter (alternative)

Diagonal linear Kalman filter over the same 4-moment state. Transition matrix encodes the mean-reversion rates; measurement matrix is identity. Natural choice if you want uncertainty bands for free.

Pick one with `engine: 'abm' | 'kalman'`.

## Health signal

At every observation:

- **forecastError** — `‖measurement − predicted‖` with EMA smoothing (α=0.4 default). This is the primary signal.
- **milneError** — integrator self-consistency (ABM only). Secondary; flags when the ODE becomes stiff.
- **histogramKL** — Jensen-Shannon divergence between observed and predicted 20-bin histograms. Catches bimodality that parametric moments miss.
- **histogramW1** — 1D Wasserstein distance between the same histograms. Catches tail-shifted content.

Combined into a single `health ∈ [0,1]` via "worst-signal-dominates":

| health | regime |
|---|---|
| ≥ 0.85 | healthy |
| ≥ 0.60 | drift |
| ≥ 0.30 | contamination |
| < 0.30 | rot |

## Install

```bash
cd tools/predictor-corrector
npm install
```

## CLI

```bash
# Pipe a JSON array of context-inspector analyses in; get forecasts + health out
cat ci-analyses.json | node cli.js --engine abm --baseline prescriptive

# Prescriptive baseline (explicit target)
node cli.js ci-analyses.json --baseline prescriptive --target '{"mean":0.78,"stdDev":0.15}'

# Analytical baseline derived from a reference corpus
node cli.js ci-analyses.json --baseline analytical --reference ./reference.txt

# Kalman engine, custom tolerance
node cli.js ci-analyses.json --engine kalman --tolerance 0.12

# Adaptive step-size (ABM only)
node cli.js ci-analyses.json --adaptive
```

## MCP server

```json
{
  "mcpServers": {
    "predictor-corrector": {
      "command": "node",
      "args": ["/path/to/tools/predictor-corrector/mcp-server.js"]
    }
  }
}
```

Exposes five tools:

| Tool | Purpose |
|---|---|
| `predict_next_bell` | One-step forecast from prior CI analyses |
| `correct_with_measurement` | Full PECE step — predict, observe, correct, score |
| `baseline_from_reference` | Derive ideal baseline by running CI on a reference corpus |
| `health_score` | Final health + regime after a session |
| `simulate_trajectory` | N-step look-ahead with no new observations |

## Library

```js
const { Forecaster } = require('./core');
const { ingest } = require('./adapters/context-inspector');
const { classify } = require('./adapters/events');

const fc = new Forecaster({
  baseline: [0.78, 0.15, 0, 0],   // [mean*, stdDev*, skew*, kurt*]
  engine: 'abm',                  // or 'kalman'
  adaptive: false,
  tolerance: { forecastError: 0.15 },
});

let prev = null;
for (const ciAnalysis of session) {
  const curr = ingest(ciAnalysis, { turn: t });
  const events = classify(prev, curr);
  const step = fc.observe(curr, events);
  console.log(step.health, step.regime, step.signals);
  prev = curr;
}
```

## Baseline strategies

Three ways to set the target distribution `(mean*, stdDev*, skew*, kurt*)`:

| Source | Construction | When to use |
|---|---|---|
| `prescriptive` | Specify the target directly | Policy-driven workflows |
| `analytical` | Run context-inspector on a pristine reference corpus; use its stats | Cold start, domain-locked workflows |
| `empirical` | Average stats across a known-good exemplar session | You have a trusted session to mimic |

## Tests

```bash
node test/run.js
```

Three suites:
- `ode.test.js` — RK4 and ABM match the analytical solution of a linear mean-reversion ODE.
- `metrics.test.js` — KL, JS, Wasserstein properties (self-zero, monotonicity, symmetry).
- `forecast.test.js` — end-to-end: healthy sessions stay healthy, contamination injection drops health.

## Demo

```bash
node sim/demo.js
```

Simulates a 20-turn session: 10 healthy turns, then contamination. Prints turn-by-turn observed vs predicted state, observation-gap error, health, and regime. The forecaster flags contamination on the first contaminated turn.

## Roadmap

- **Particle filter engine** for bimodal/non-Gaussian distributions (the clearest contamination signature).
- **Adaptive-order ABM (VODE-style)** — drop to 2-step when history is sparse, raise to 5-step on smooth stretches.
- **Stiffness-aware switching to BDF** when tool calls or retrievals cause large state discontinuities.
- **Heston-style stochastic volatility** — treat σ itself as a stochastic process driven by its own SDE.
- **Richardson extrapolation** across step sizes for higher-order accuracy.

## Related reading

- Hairer, Nørsett, Wanner. *Solving Ordinary Differential Equations I: Nonstiff Problems.*
- Shampine & Reichelt. *The Matlab ODE Suite.* (Variable-order, variable-step machinery.)
- Welch & Bishop. *An Introduction to the Kalman Filter.*
- Context Inspector [white paper](../context-inspector/docs/whitepaper.md).
