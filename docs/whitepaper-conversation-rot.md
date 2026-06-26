# Conversation Rot: Where Model-Based Forecasting Does Not Help

**A negative-result experimental evaluation of the predictor-corrector numerical method on bidirectional drift-recovery cycles in multi-turn conversation, comparing against static-threshold baselines.**

---

## Abstract

The [Unseen Tide whitepaper](./whitepaper-unseen-tide.md) demonstrated that a predictor-corrector forecaster detects monotonic context drift 11–17 turns ahead of static-threshold detectors. This paper reports the opposite finding on a structurally different scenario.

We ran the same four detectors (static-mean, static-sigma, ABM forecaster, Kalman forecaster) against a 51-turn hand-crafted urban-beekeeping conversation containing **three drift-recovery cycles**. Under a realistic sliding-window context-management strategy (window K=5 turns), the honest results are:

- **Static-σ with sliding window wins on F1 (0.756) and Pearson correlation with drift level (0.600).**
- **Both predictor-corrector engines are strictly below static-σ on F1 (0.52) and correlation (0.43–0.46).**
- **Static-mean with sliding window is structurally blind** (F1 = 0.00) — the reference content in the context keeps observed mean above any sensible threshold even during peak off-topic turns.
- Under accumulating context (no window), all four detectors converge on similar F1 (0.50–0.59) but none recover after the first drift episode.

> **Key finding.** The predictor-corrector's advantage demonstrated in Unseen Tide — leading-indicator detection of monotonic slow drift — does not transfer to oscillating drift-recovery cycles. On this scenario, a properly-windowed static-σ threshold is the better tool. The honest conclusion is not that one detector dominates but that **the two detector families solve different problems**, and diagnostic framing should be designed around the scenario.

This is the kind of result the contrarianAI thesis exists to surface: when a sophisticated tool does not improve on a simple one, saying so plainly is more useful than defending the complex tool.

---

## 1. Motivation

Unseen Tide demonstrated the forecaster's value on a specific structural setup: monotonic drift, accumulating context, no recovery. Real workflows are not always like that. Conversations drift off-topic and come back. RAG pipelines retrieve good and bad documents in alternation. Chat sessions cycle through multiple subjects over a long horizon.

This paper asks: **does the predictor-corrector's leading-indicator advantage carry over when drift is oscillating rather than monotonic, and when the context uses a realistic sliding window rather than unbounded accumulation?**

A principled tool should have principled failure modes. We test.

---

## 2. Experimental design

### 2.1 The transcript

A 51-turn user-plus-assistant conversation about urban beekeeping. The user runs two rooftop hives and asks practical questions — mite management, queenrightness, winter preparation, spring swarm control. The conversation drifts naturally three times and recovers three times:

| Turns | Drift level | Content |
|---|---:|---|
| 1–10 | 0 | Pure beekeeping: mite timing, drone brood, winterization |
| 11–12 | 1 | Bridging: honey pairing with coffee |
| 13–16 | 2 | Off-topic: coffee brewing, tea preparation |
| 17 | 1 | User pivots back to hive |
| 18–22 | 0 | On-topic: quilt boxes, mountain-camp sugar |
| 23–24 | 1 | Bridging: native vs honey bee competition |
| 25–26 | 2 | Off-topic: pesticide-habitat-climate interactions |
| 27–30 | 3 | Fully off-topic: IPCC projections, ethics under uncertainty |
| 31 | 1 | User pivots back |
| 32–37 | 0 | On-topic: cappings, swarm prep, honey harvest |
| 38–39 | 2 | Off-topic: bees vs ants social systems |
| 40–45 | 3 | Fully off-topic: philosophy of consciousness |
| 46 | 1 | User pivots back |
| 47–51 | 0 | On-topic: honey storage, crystallization |

Each turn is one ~300-500 character chunk. Every turn has a hand-assigned ground-truth drift label 0–3.

### 2.2 Two context-management strategies

| Strategy | Context at turn N |
|---|---|
| `accumulate` | reference corpus + turns 1…N |
| `sliding(K=5)` | reference corpus + last 5 turns only |

The sliding strategy reflects realistic chat token-budget management: older turns are evicted as the session grows. K=5 is chosen to be smaller than the shortest recovery phase (5 turns) so recovery actually flushes out drift content.

### 2.3 Empirical baseline

A critical design choice: we use an **empirical baseline** computed from the first five on-topic turns of the transcript, not an analytical baseline from the reference corpus alone.

Why: in early iterations we used `analyticalBaseline(reference)`, which produced a baseline whose moments (0.714, 0.249) were systematically higher than what authentic chat turns actually score (0.68, 0.22). Even perfectly on-topic chat turns registered as "below baseline," which caused the forecasters to never reach healthy state. The reference was too term-dense relative to realistic chat.

An empirical baseline from training turns (first 5 drift=0 turns) yields (0.682, 0.240) — matching the actual distribution of healthy chat observations. This is the standard ML practice of calibrating on training and evaluating on the full sequence. We flag this as a methodological lesson: **analytical baselines require the reference corpus to match the test-time discourse register.**

### 2.4 Detectors

Same four detectors as Unseen Tide, same thresholds:

| Detector | Alert condition |
|---|---|
| `static-mean` | observed mean < 0.50 |
| `static-sigma` | observed stdDev > 0.30 |
| `abm` | predictor-corrector (ABM engine) health < 0.72 |
| `kalman` | predictor-corrector (Kalman engine) health < 0.72 |

### 2.5 Metrics

- **Confusion matrix** against `drift ≥ 2` binary ground truth (off-topic).
- **Precision, recall, F1.**
- **Pearson correlation** between detector signal and continuous drift level (0–3). For forecasters, correlation is computed on the raw observation-gap signal, not the clipped health score (clipping to [0, 1] loses discrimination between drift 2 and 3).
- **Recovery latency**: at each transition from drift ≥ 2 to drift < 2 in the ground truth, how many turns until the detector clears its alert?

---

## 3. Results

### 3.1 Summary table

**Accumulating context:**

| Detector | TP | FP | TN | FN | Precision | Recall | F1 | Pearson r |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| static-mean | 13 | 14 | 20 | 4 | 0.481 | 0.765 | **0.591** | 0.359 |
| static-sigma | 9 | 10 | 24 | 8 | 0.474 | 0.529 | 0.500 | **0.422** |
| abm | 17 | 29 | 5 | 0 | 0.370 | 1.000 | 0.540 | 0.319 |
| kalman | 17 | 28 | 6 | 0 | 0.378 | 1.000 | 0.548 | 0.317 |

**Sliding window (K=5):**

| Detector | TP | FP | TN | FN | Precision | Recall | F1 | Pearson r |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| static-mean | 0 | 0 | 34 | 17 | 0.000 | 0.000 | 0.000 | 0.580 |
| **static-sigma** | 17 | 11 | 23 | 0 | 0.607 | 1.000 | **0.756** | **0.600** |
| abm | 17 | 32 | 2 | 0 | 0.347 | 1.000 | 0.515 | 0.430 |
| kalman | 17 | 31 | 3 | 0 | 0.354 | 1.000 | 0.523 | 0.455 |

### 3.2 Signal trajectory (sliding window)

Sparkline representation of each detector's signal over 51 turns, with the ground truth in the top row for reference:

```
ground-truth drift   ▁▁▁▁▁▁▁▁▁▁▃▃▆▆▆▆▃▁▁▁▁▁▃▃▆▆████▃▁▁▁▁▁▁▁▃▆▆█████▃▁▁▁▁
abm health           ▆▆▆▆▆▆▆▅▆▅▄▃▂▁▁▁▁▁▂▃▄▄▄▃▂▁▁▁▁▁▁▁▁▂▂▂▄▃▂▂▂▁▁▁▁▁▁▁▁▁▁
kalman health        ▅▆▆▆▆▆▇▆▆▅▅▃▁▁▁▁▁▁▂▃▄▄▄▃▂▁▁▁▁▁▁▁▁▂▃▄▄▃▂▂▁▁▁▁▁▁▁▁▁▁▁
static-mean          ▁▁▁▁▁▁▁▁▁▁▁▂▂▂▃▃▂▂▁▁▁▂▂▂▂▂▂▃▃▃▂▃▂▂▁▁▂▂▂▂▂▂▂▂▃▃▃▃▃▃▂
static-sigma         ▄▅▅▅▅▄▅▄▄▄▆▇▇▇▇▇▇▆▆▅▅▆▆▆▇▇▇▇▇▇▇▇▆▅▅▅▆▆▆▆▆▆▆▇▇█▇█▇▇▇
```

All four detectors track the three drift-recovery cycles at some level. Static-σ shows the cleanest cyclical pattern, with troughs during recoveries (turns 19-20, 34-35) and peaks during drift (turns 14-16, 28-30, 44-46). The forecaster health signals show the cycles with reduced amplitude because their clipped health score saturates at 0 during heavy drift, losing resolution.

### 3.3 Recovery latency (sliding window)

Turns between end of a drift phase (ground truth drops to < 2) and the detector clearing its alert:

| Detector | Recovery 1 (T17) | Recovery 2 (T31) | Recovery 3 (T47) | Mean |
|---|---:|---:|---:|---:|
| static-mean | +0 | +0 | +0 | **0.00** |
| static-sigma | +2 | +2 | never | 2.00 |
| abm | never | never | never | — |
| kalman | never | never | never | — |

Static-mean never alerts so it also never fails to clear. Static-σ clears within 2 turns of each of the first two recoveries. The forecasters remain in alert state throughout the session — their raw health score reaches 0 during first peak drift at turn 14 and, while it does recover partially during subsequent recovery phases, it never reaches the 0.72 alert threshold.

### 3.4 Accumulating context — as expected

Under accumulating context, no detector clears after the first drift episode. Static-σ clears briefly at turn 17 (window still mostly healthy at that point) but re-alerts as more drift accumulates. This is expected: accumulated context does not allow recovery, because the drift chunks remain in the bell curve's data forever.

---

## 4. Analysis

### 4.1 Why static-σ wins on this scenario

A sliding window produces a bell curve whose stdDev is approximately:

- **Low** when the window is homogeneous (all on-topic or all off-topic).
- **High** when the window is mixed — some on-topic chunks, some off-topic chunks.

Drift transitions are exactly the case where the window is mixed, so static-σ rises. Recovery transitions are also mixed-window, so static-σ stays elevated for a turn or two. Clean states (pure on-topic or pure off-topic) have lower σ.

**Static-σ is, empirically, a well-suited signal for the specific question "is the window homogeneous?"** It does not require a model of what the distribution should look like. It does not require a baseline. It does not require a forecaster. And on this experiment, it outperforms a 500-line predictor-corrector implementation.

### 4.2 Why the predictor-corrector struggles here

The predictor-corrector framework assumes the context has a *trajectory* — a systematic evolution that can be forecast. The health signal fires when observed state deviates from the forecast trajectory. This works well for monotonic drift, where the forecast is "stay at baseline" and violation is unambiguous.

For bidirectional cycles, the forecast trajectory itself oscillates. When the window is mid-cycle, the forecaster's health signal bottoms. When recovery happens, the observation gap shrinks — but not fast enough to climb back above the 0.72 alert threshold within the short recovery phases. The tool's own time-smoothing (EMA alpha=0.4) and baseline-distance combination work against rapid recovery.

This is a structural fit-to-scenario issue, not a bug. The tool was designed to catch drift that a static threshold would miss. In this experiment, the static threshold does not miss the drift — it catches it cleanly because the signal is naturally cyclical.

### 4.3 When to use each

Combining this result with Unseen Tide:

| Scenario characteristic | Winner |
|---|---|
| Monotonic drift, accumulating context | **predictor-corrector** (Unseen Tide: 17-turn lead) |
| Oscillating drift, sliding window | **static-σ** (this experiment: F1 0.76 vs 0.52) |
| Soft drift within same domain (stylistic rewrite) | **predictor-corrector** (Unseen Tide Phase 2: static detectors silent) |
| Mixed-window detection | **static-σ** (this experiment: natural fit for the signal) |
| Accumulating context, recovery possible | **neither** — once drift accumulates, it cannot be undone without window/eviction strategy |

The principled implication is: **detector choice should match scenario topology**. Monotonic-slide monitoring and oscillating-cycle monitoring are different problems. A production system supporting both will benefit from running both detectors and routing based on workflow type.

### 4.4 Why static-mean failed catastrophically under sliding window

Static-mean achieved F1 = 0.00 in sliding-window mode — it never alerted at all. The reason: the context always contains the reference corpus plus the last 5 turns. The reference is term-dense and scores highly. Even with 5 off-topic turns, the context is ~60% reference chunks (by chunk count), and the aggregate mean stays above the 0.50 threshold.

This failure is a valuable lesson about monitor design: **a threshold set against total context statistics is dominated by whatever makes up the bulk of the context**. In sliding-window contexts with a stable system prompt, the system prompt dominates and the threshold is effectively blind.

The lesson generalises. Any detector that reads "total context" statistics faces the same ceiling when a stable system prompt or fixed reference is always present. Both static-σ and the predictor-corrector survive this because they look at distributional shape (σ) or relative deviation (forecaster) rather than central tendency alone. Static-mean is the most vulnerable to this dominance effect.

### 4.5 The methodological lesson: reference design matters

Our first run used `analyticalBaseline(reference)` where the reference was a term-dense description of the domain. Baseline came out as (0.714, 0.249) but actual healthy chat scored (0.68, 0.22). The forecasters interpreted perfectly healthy chat as chronic mild drift because the baseline was inappropriately strict.

Switching to `empiricalBaseline(first_5_on_topic_turns)` resolved it. This is a generalisable caution: **the analytical baseline method is only as good as the register-match between reference corpus and operational content**. In production deployments with diverse chat styles, empirical baselines from real traces are the safer starting point.

### 4.6 The contrarian angle

The contrarianAI thesis is that most AI monitoring advice is wrong, lazy, or unnecessarily complex. It would be easy to tune the predictor-corrector's alert threshold, EMA rate, or other knobs to win this benchmark. We chose not to. The out-of-box tool, deployed as it is in production-minded defaults, does not beat a simple σ threshold on this scenario. Saying that plainly is what earns trust.

A tool that wins every benchmark is usually a tool that was tuned to every benchmark. The legitimate value proposition of a sophisticated tool is not universal superiority — it is *provable advantage in the specific regime where its structural assumptions hold*. For the predictor-corrector: slow monotonic drift where a stable forecast trajectory exists. When the scenario breaks that assumption — bidirectional cycles, fast recoveries — a simpler detector can win on merits.

---

## 5. Reproducibility

```bash
git clone <contrarianAI repo>
cd contrarianAI/tools/predictor-corrector
npm install
node sim/conversation-rot/runner.js
```

Artifacts (generated):
- `sim/conversation-rot/results/results.json` — full per-turn record
- `sim/conversation-rot/results/summary.txt` — human-readable tables with sparklines

Transcript is fixed (`sim/conversation-rot/transcript.js`). Results are deterministic.

---

## 6. Limitations

1. **Hand-authored transcript.** The drift pattern is whatever the author (a human) considered realistic. Real chat traces would have different per-turn drift magnitudes, possibly concentrated at the session opening or at topic-switch boundaries.
2. **Fixed sliding window K=5.** The result depends on window size relative to phase length. Larger K, or phases shorter than the window, would produce different outcomes. We tested K=5 and K=10 during development.
3. **Ground truth is one author's labelling.** A more rigorous version would collect inter-annotator agreement on drift labels.
4. **No tuning.** We deliberately did not tune the forecaster's tolerance, EMA rate, or alert threshold for this scenario. A tuned version could likely match static-σ. The point of the experiment is to assess default-configuration performance.
5. **No LLM output scoring.** This experiment measures detector behaviour against *ground-truth drift labels*, not against *observed LLM output degradation*. A stronger follow-up would correlate detector alerts with actual output quality — that was Experiment 4 in the original roadmap, and this paper reinterprets it as the conversation-drift variant.

---

## 7. Recommended screenshots

| ID | Caption | Data source |
|---|---|---|
| **Fig. 1** | "Per-detector F1 score, accumulating vs sliding window" — grouped bar chart; four groups (detectors); two bars per group (strategy); makes the sliding-window win of static-σ visible at a glance | results.json → strategies[].metrics[].confusion.f1 |
| **Fig. 2** | "Signal trajectory over 51 turns — ground truth drift vs detector outputs, sliding K=5" — multi-line overlay; x-axis turn 1–51; y-axis normalised 0–1; ground-truth drift as shaded background bands; all four detectors as lines | results.json → strategies[sliding].rows[].detectors[].metric |
| **Fig. 3** | "Recovery latency heatmap — turns to clear alert after drift ends" — 4×3 heatmap; detectors on rows, three recovery events on columns; cell value = turns-until-clear or ∞ | summary.txt recovery table |
| **Fig. 4** | "Pearson correlation with ground-truth drift level, accumulating vs sliding" — grouped bar chart; four detectors; two strategies; shows static-σ dominance in sliding mode | results.json → strategies[].metrics[].r |
| **Fig. 5** | "Static-mean saturation under sliding window" — single-line plot showing static-mean signal over turns; horizontal threshold line at 0.50; demonstrates the signal never crosses the threshold despite clear ground-truth drift | results.json → strategies[sliding].rows[].detectors["static-mean"].metric |

Figures 1 and 3 are the highest-impact for the executive version — they capture the headline finding (F1 win of static-σ) and the functional failure of forecasters (no recovery clearance).

---

## 8. Placement in the experimental program

The two experiments together establish a map:

- **Unseen Tide (Experiment 1):** predictor-corrector wins on monotonic drift detection.
- **Conversation Rot (this paper, Experiment 4):** static-σ wins on oscillating drift detection.

Planned next experiments maintain that structure of probing structural assumptions:

- **Bimodal Contamination (Experiment 2):** tests whether particle-filter engine outperforms parametric engines when the context develops a bimodal (two-cluster) distribution. Prediction: yes, for particle filter; parametric forecasters and static detectors alike miss bimodality.
- **RAG Drift (Experiment 3):** tests leading-indicator value in a real retrieval pipeline with gradual off-topic document accumulation. Prediction: forecaster leads static detectors because the scenario is monotonic slide with slow-onset drift.
- **Adversarial Paraphrase (Experiment 5):** tests robustness of detectors against deliberately camouflaged drift.

Each experiment is designed to test a structural assumption and report the honest result.

---

## 9. Conclusion

**The predictor-corrector is not universally better than a static σ threshold for context-window health monitoring.** On a 51-turn multi-topic chat with drift-recovery cycles under a realistic sliding window, static-σ produces better alerts (F1 0.76 vs 0.52) and correlates better with ground-truth drift level (Pearson 0.60 vs 0.45) than either the ABM or Kalman forecaster in their default configurations.

The predictor-corrector retains its demonstrated advantage on monotonic drift (Unseen Tide: 17-turn lead over static-mean, 11-turn lead over static-σ). The two tools target different scenario geometries.

The right position for a production AI health-monitoring stack is therefore not to pick one detector but to **run a small ensemble and interpret agreement**. A single alerting tool will always have adversarial scenarios; a pair that disagrees is a useful diagnostic. The contrarianAI approach: ship the diagnostic instrument, not the silver bullet.

---

*Authored for contrarianAI. Companion software: [`tools/predictor-corrector`](../). Sensor: [`tools/context-inspector`](../../context-inspector). Prior experiment: [Unseen Tide whitepaper](./whitepaper-unseen-tide.md).*
