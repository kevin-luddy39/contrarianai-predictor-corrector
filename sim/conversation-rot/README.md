# Conversation Rot — predictor-corrector Experiment 4

A 51-turn hand-crafted urban-beekeeping chat with three drift-recovery cycles. Tests whether drift detectors track bidirectional cycles (drift then recovery) as well as they track monotonic drift. Companion to [`../../docs/whitepaper-conversation-rot.md`](../../docs/whitepaper-conversation-rot.md).

## Running

```bash
cd tools/predictor-corrector
npm install
node sim/conversation-rot/runner.js
```

Outputs written to `results/`:

- `results.json` — full per-turn record with per-detector confusion matrices and Pearson correlations
- `summary.txt` — human-readable tables, compact sparklines for each signal, full per-turn traces for both strategies

## Two strategies, four detectors

| Strategy | Context at turn N |
|---|---|
| `accumulate` | reference + all turns 1..N |
| `sliding(K=5)` | reference + last 5 turns only |

| Detector | Alerts when |
|---|---|
| `static-mean` | observed domain mean < 0.50 |
| `static-sigma` | observed domain stdDev > 0.30 |
| `abm` | predictor-corrector (ABM engine) health < 0.72 |
| `kalman` | predictor-corrector (Kalman engine) health < 0.72 |

Every detector runs against the same context at each turn. Ground truth is a per-turn label (0/1/2/3) in the transcript.

## Metrics

- Confusion matrix against `drift ≥ 2` ("off-topic" binary)
- Precision, recall, F1
- Pearson correlation between detector signal and continuous drift level
- Per-recovery-boundary clearance latency

## Honest finding

Static-σ with sliding window outperforms the forecasters on this bidirectional-drift scenario (F1 0.76 vs 0.52, Pearson r 0.60 vs 0.45). See the whitepaper for analysis of why, and what this reveals about when predictor-corrector is and is not the right tool.
