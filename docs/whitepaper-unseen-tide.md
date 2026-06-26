# The Unseen Tide: Model-Based Forecasting Detects Context Drift 17 Turns Before Output Failure

**Experimental evaluation of the predictor-corrector numerical method as a leading-indicator signal for AI context-window health, compared against static-threshold baselines on a staged four-phase perturbation protocol.**

---

## Abstract

Three Little Pigs ([Context Rot whitepaper](../../context-inspector/docs/whitepaper.md)) demonstrated that the statistical bell curve of context-window domain alignment flattens before the underlying AI system produces visibly degraded output. That work established the *existence* of an early-warning signal. Its practical detection method was a static threshold: watch σ, alert when σ crosses a number.

This paper takes the next step. We compare four detectors against a staged drift scenario — the **Unseen Tide** — in which four distinct classes of context perturbation are applied in sequence over 40 turns: pure calibration, same-topic stylistic drift, adjacent-topic creep, and hard contamination. We find:

- **Static mean-threshold detection fires at turn 34** (4 turns into Phase 4 hard contamination).
- **Static σ-threshold detection fires at turn 28** (8 turns into Phase 3 adjacent-topic creep).
- **Predictor-corrector detection fires at turn 17** (7 turns into Phase 2 stylistic drift).
- **Static detectors never fire during Phase 2.** The forecasters catch a class of drift that static thresholds miss entirely.
- **No detector fires in Phase 1.** Zero false positives across the calibration phase.

The predictor-corrector leads static-σ by 11 turns to first alert and static-mean by 17 turns. It also raises an alert during a phase (stylistic drift) where static thresholds are structurally blind — the domain mean stays near baseline while the bell curve subtly deforms.

> **Key finding.** A model-based forecaster that compares observed bell-curve state against a predicted ideal trajectory detects drift 17 turns before a static mean threshold — and detects a class of drift (same-topic, different register) that static thresholds cannot see at all.

---

## 1. Motivation

The core claim of Bell Tuning is that the statistical distribution of context-chunk alignment scores is a leading indicator of AI output quality. Context Inspector measures that distribution live. Three Little Pigs demonstrated that σ rising and mean falling predicts output failure.

But *how* you convert those raw statistics into an alert matters. Two approaches are in common use:

1. **Static thresholds** — alert when mean falls below some fixed value, or σ rises above one.
2. **Trend-following** — alert when the moving average of some statistic crosses a threshold.

Both share a structural weakness: they treat the bell curve as an isolated snapshot. They do not encode expectations about how the distribution *should* evolve, and so they cannot detect deviations from expected dynamics — only deviations of the statistic itself.

The predictor-corrector framework borrowed from numerical analysis of ordinary differential equations offers a different approach. It maintains a dynamical model of how the bell curve evolves under healthy conditions, forecasts the next state, and compares the forecast to the actual measurement. The forecast error itself becomes the health signal — a signal that rises when the bell curve diverges from its modeled trajectory, independent of any absolute threshold.

This paper asks: *does that theoretical advantage translate into measurably earlier detection on a controlled perturbation protocol?*

---

## 2. Experimental design

### 2.1 Domain

We selected **urban beekeeping** as the domain. It has three properties that make it well-suited to a controlled experiment:

1. **Bounded, distinctive vocabulary** — terms like *hive*, *queen*, *nectar*, *varroa*, *apiary*, *swarm* are near-unique to the domain, so domain-alignment scoring via TF-IDF is sharp.
2. **Easily produced stylistic variants** — we can rewrite the same factual content in legal, academic, tweet, pirate, marketing, cookbook, and children's-book registers.
3. **Natural adjacent topics** — pollinator gardening, butterfly conservation, wasps, pesticide policy are semantically adjacent but not beekeeping-specific.

### 2.2 Four-phase perturbation protocol

| Turns | Phase | Content injected |
|---|---|---|
| 1–10 | **Calibration** | Additional on-topic beekeeping paragraphs |
| 11–20 | **Stylistic drift** | Same topic, different register (legal, academic, tweet, pirate, marketing, cookbook, children's-book, etc.) |
| 21–30 | **Adjacent-domain creep** | Pollinator gardening, butterfly conservation, wasps, pesticides, native plants, aquaponics, chickens |
| 31–40 | **Hard contamination** | Unrelated topics (Treaty of Westphalia, volcanology, aviation safety, distributed consensus, soufflés, basketball, stellar nucleosynthesis, cryptography, Silk Road, photovoltaics) |

The context window starts pre-loaded with the reference corpus (~3,700 characters, ~8 chunks). Each turn appends one new chunk of ~400–700 characters. Context is never truncated — the accumulating context is the system's full state.

Content is fixed and deterministic; results are reproducible exactly.

### 2.3 Baseline and detectors

The predictor-corrector baseline is derived analytically by running Context Inspector on the reference corpus scored against its own extracted domain terms:

```
baseline = [ mean = 0.769,  stdDev = 0.188,  skewness = 0.072,  kurtosis = -1.755 ]
```

Four detectors run in parallel on every turn, consuming the same Context Inspector analysis:

| Detector | Mechanism | Alert condition |
|---|---|---|
| **static-mean** | Observed domain mean | `mean < 0.50` |
| **static-sigma** | Observed domain stdDev | `stdDev > 0.30` |
| **ABM forecaster** | Adams-Bashforth-Moulton predictor-corrector vs analytical baseline | `health < 0.72` |
| **Kalman forecaster** | Linear diagonal Kalman filter vs analytical baseline | `health < 0.72` |

The forecast health score combines three signals: the observation-vs-prediction gap (leading indicator), the observation-vs-baseline gap (lagging indicator), and histogram Jensen-Shannon and Wasserstein divergences (shape signals). Both forecasters use identical ODE dynamics and identical baselines; only the integration method differs.

### 2.4 Metric: lead time

For each detector and each phase, we record **lead time to first alert** measured in turns from the start of the phase. Lower is better. A dash indicates the detector never fired during that phase.

---

## 3. Results

### 3.1 Alert lead times

```
detector         phase 1   phase 2   phase 3   phase 4
static-mean            -         -         -       T+4
static-sigma           -         -       T+8       T+1
abm                    -       T+7       T+1       T+1
kalman                 -       T+7       T+1       T+1
```

**Absolute first-alert turns:**

| Detector | First alert turn | Turn delta vs output collapse |
|---|---:|---:|
| static-mean | 34 | output has collapsed |
| static-sigma | 28 | 6 turns before visible mean failure |
| **ABM forecaster** | **17** | **17 turns before visible mean failure** |
| **Kalman forecaster** | **17** | **17 turns before visible mean failure** |

### 3.2 Phase-by-phase behaviour

**Phase 1 (Calibration, turns 1–10).** No detector alerts. The forecasters report the `healthy` regime for turns 1–3 and `drift` from turn 4 onward as per-turn sampling noise causes the observed moments to jitter around baseline. Minimum observed ABM health is **0.781** — comfortably above the 0.72 alert threshold. No false positives. This is the critical negative control: the predictor-corrector does not flag noise as drift.

**Phase 2 (Stylistic drift, turns 11–20).** Observed mean drifts slowly from 0.779 at turn 11 to 0.721 at turn 20 — a gentle slide of 0.058 over 10 turns. σ actually drops slightly (from 0.191 peak in Phase 1 down to 0.168 in Phase 2). Neither static detector ever fires in this phase. The forecasters, by contrast, track the baseline drift continuously: ABM health falls from 0.762 at turn 11 to 0.639 at turn 20, crossing the 0.72 alert threshold at **turn 17 (T+7)**. This is the phase where predictor-corrector detection is uniquely valuable — no static threshold on any single moment would fire here.

**Phase 3 (Adjacent-domain creep, turns 21–30).** Both mean and σ begin moving in the expected directions (mean falling, σ rising). Forecaster health was already below 0.72 entering this phase, so both ABM and Kalman alert at T+1. Static-σ alerts at **T+8 (turn 28)** when σ first crosses 0.30. Static-mean never alerts in this phase — the observed mean bottoms at 0.568, above its 0.50 threshold. **Lead time of forecasters over static-σ: 7 turns.**

**Phase 4 (Hard contamination, turns 31–40).** All four detectors eventually fire. Static-σ fires immediately at T+1 (σ was already above 0.30 from Phase 3). Static-mean fires at T+4 (turn 34) when mean first crosses 0.50. The forecasters remain in alert from earlier phases.

### 3.3 Health trajectory

The forecaster health score provides continuous quantitative signal throughout the session, not just binary alerts. Selected values:

| Turn | Phase | Observed mean | ABM health | Kalman health | Regime |
|---:|---|---:|---:|---:|---|
| 1 | Calibration | 0.771 | 0.856 | 0.855 | healthy |
| 10 | Calibration | 0.780 | 0.781 | 0.778 | drift |
| 17 | Stylistic | 0.745 | **0.718** | **0.715** | drift (first alert) |
| 20 | Stylistic | 0.721 | 0.639 | 0.642 | drift |
| 21 | Adjacent | 0.702 | 0.583 | 0.584 | contamination |
| 25 | Adjacent | 0.629 | 0.053 | 0.051 | rot |
| 31 | Contamination | 0.549 | 0.000 | 0.000 | rot |

The score degrades monotonically and smoothly, enabling risk-based routing decisions rather than binary gate-keeping.

### 3.4 ABM vs Kalman

The two engines produce nearly identical detection timing on this experiment. Health scores track within 0.01 of each other across almost all turns. The ABM engine exposes an additional Milne integrator-error signal; Kalman exposes innovation covariance. Both signals remained small in this experiment (ABM Milne peaked at 0.0008), reflecting that the underlying ODE dynamics remained non-stiff throughout. We expect Particle Filter (not yet implemented) to meaningfully differentiate in the presence of bimodal histogram signatures — a stiffer test we plan as Experiment 2.

---

## 4. Analysis

### 4.1 Why static detectors miss stylistic drift

Stylistic drift — rewriting the same facts in a different register — shifts vocabulary away from the domain's distinctive terms (*queen*, *brood*, *varroa*) while retaining topic coherence. Per-chunk alignment scores drop modestly but variance across chunks does not necessarily grow. The bell curve shifts leftward a little and may *narrow* rather than widen, because every stylistic chunk under-aligns by a similar amount. Neither a mean threshold nor a σ threshold fires because neither moment crosses its bound.

The predictor-corrector catches this because its baseline is a full four-moment state vector, and its health signal is the *distance* from that vector in moment space (plus the forecast error). A mean drift of 0.05 plus a σ drop of 0.02 plus co-drift in skew/kurtosis produces a distance in weighted state space that exceeds tolerance even though no single component is near its individual threshold.

### 4.2 Why the predictor-corrector does not false-positive on calibration noise

Phase 1 is the structural test: does the forecaster confuse natural sampling noise for drift? On this experiment, no. The exponential-moving-average smoothing on the observation gap (α=0.4 by default) absorbs single-turn moment jitter. The weighted gap norm places zero weight on the noisy skewness and kurtosis components — they jitter ±0.2 per turn with chunk counts below 30 — leaving mean and stdDev (the robust moments) as the primary signal. This is a parameter choice of the tool, not a property of the experiment; downstream users tuning against production data may choose to include higher moments when chunk counts are large.

### 4.3 The two signals: forecast error vs baseline distance

The forecaster combines a leading indicator (forecast-vs-observation gap) with a lagging indicator (observation-vs-baseline gap), taking the worse of the two for the primary health term. On this experiment, baseline distance does most of the detecting: the injected perturbations push observed state away from baseline at a rate the mean-reversion ODE does not anticipate. The leading indicator would shine brighter on a scenario with non-trivial healthy dynamics — for example, a RAG pipeline where σ is expected to grow slowly as documents accumulate, and deviations from *that expected growth rate* are meaningful.

### 4.4 The contrarian position

The dominant convention in production AI monitoring is to set thresholds on a single moment of some derived statistic and alert when it crosses. Three Little Pigs demonstrated that σ specifically is a better signal than output quality. This paper demonstrates a further step: σ as a static threshold is leaving detection power on the table. A four-moment, model-based forecaster with baseline-distance + forecast-error combination detects drift classes (stylistic) that single-moment thresholds miss entirely, and detects shared drift classes (adjacent, contamination) earlier. The complexity cost is modest (one ODE integrator, ~500 lines of Node.js). The alerting power gain is measured at 11–17 turns of lead time.

---

## 5. Reproducibility

```bash
git clone <contrarianAI repo>
cd contrarianAI/tools/predictor-corrector
npm install
node sim/unseen-tide/runner.js
```

Output:
- `sim/unseen-tide/results/results.json` — full per-turn record
- `sim/unseen-tide/results/summary.txt` — human-readable table and lead-time report

Corpus is fixed and embedded in `sim/unseen-tide/corpus.js`. Results are deterministic — no randomness, no network calls, no LLM invocations.

---

## 6. Limitations

1. **Synthetic corpus.** The perturbations in each phase were authored by hand to exercise specific properties. Real-world contamination arrives in more varied and less structured forms. Production validation requires running the same detectors against authentic traces.
2. **TF-IDF-based alignment scoring.** Context Inspector's chunk-score metric is term-frequency-based. Alignment metrics based on semantic embeddings would produce a different bell-curve shape and might change detector sensitivities. We view this as orthogonal — the predictor-corrector framework consumes whatever bell curve its sensor emits.
3. **Single domain.** Urban beekeeping is one domain. Replication across technical, legal, conversational, and creative domains is work we intend to pursue.
4. **Only two engines tested.** Particle filter (for bimodal detection) and variable-order ABM are on the roadmap but not implemented yet. Either may change the story on more challenging perturbation protocols.
5. **Fixed thresholds in this experiment.** Both the static-mean (0.50) and static-σ (0.30) thresholds are common-sense defaults but tunable. A more aggressive tuning of static-σ (say 0.22) would alert earlier in Phase 3 — though it would also false-positive in healthy sessions with naturally higher σ. The forecaster's advantage is that its threshold is tuned against its own calibration distribution, not against a universal number.

---

## 7. Recommended screenshots

Automated plot generation was not included in this experiment's scope. The following visualizations should be captured from `results.json` using any standard plotting stack (matplotlib, D3, Recharts, etc.) to accompany a public release of this paper:

| ID | Caption | Data source |
|---|---|---|
| **Fig. 1** | "Lead time to first alert per detector, per phase" — grouped bar chart; four groups (phases), four bars per group (detectors); y-axis: turns from phase start; bars labelled "—" for phases where the detector never fired | `leadTimes` field of `results.json` |
| **Fig. 2** | "Observed bell-curve trajectory over 40 turns" — line plot of `mean` and `stdDev` versus turn; phase boundaries marked as vertical dashed lines; static-mean and static-σ thresholds marked as horizontal dashed lines; alert points marked with stars | `rows[].mean`, `rows[].stdDev` |
| **Fig. 3** | "Forecaster health trajectory" — line plot of ABM and Kalman health versus turn; alert threshold (0.72) as horizontal dashed line; phase boundaries marked; regime bands shaded (green/yellow/orange/red for healthy/drift/contamination/rot) | `rows[].detectors.abm.metric` |
| **Fig. 4** | "Bell curve snapshots — healthy vs contamination" — two side-by-side histograms: Phase 1 terminal histogram (turn 10) vs Phase 4 terminal histogram (turn 40); overlay Gaussian fit; clearly shows distributional collapse | Context Inspector histogram output, captured at the two reference turns |
| **Fig. 5** | "ABM Milne error and forecast-vs-baseline gap over time" — dual-axis line plot showing the two internal signals that feed the health score; demonstrates the relative contribution of leading vs lagging indicators | `rows[].detectors.abm.signals` |
| **Fig. 6** | "Detection phase map" — horizontal swim-lane diagram; four lanes (detectors); coloured blocks marking alert spans in each phase; emphasizes that forecasters alert across Phases 2, 3, 4 while static detectors alert only in Phases 3 and 4 | `rows[].detectors.<name>.alert` |

Figures 1, 3, and 6 are the highest-impact visualizations for the executive version of this paper.

---

## 8. Next experiments

- **Experiment 2 — Bimodal Contamination.** Design a perturbation that produces a bimodal bell curve (two coexisting distributions — e.g., half the chunks strongly on-domain, half strongly off-domain). Predicts that Particle Filter engine outperforms ABM and Kalman; static detectors and parametric forecasters may all miss it because moments alone cannot distinguish bimodal from wide.
- **Experiment 3 — RAG Drift.** Run against a real retrieval-augmented pipeline with a fixed query set and a knowledge base that slowly accumulates off-topic documents. Validates the leading-indicator term in a real workflow.
- **Experiment 4 — Multi-turn Conversation Rot.** Long chat transcripts with natural topic drift. Compares forecaster detection to human judgement of "when did the assistant lose the plot?"
- **Experiment 5 — Adversarial Stylistic Paraphrase.** Actively adversarial scenario: a malicious actor attempts to slip off-domain content past detection by paraphrasing it in the on-domain register. Tests robustness of the forecaster against deliberately camouflaged drift.

---

## 9. Conclusion

The Unseen Tide experiment demonstrates that model-based forecasting, using a predictor-corrector numerical integrator to maintain an expected bell-curve trajectory, detects context drift measurably earlier than static-threshold detectors on a controlled four-phase protocol. On this experiment:

- Zero false positives in the calibration phase.
- 17-turn lead over static mean detection.
- 11-turn lead over static σ detection.
- Uniquely detects stylistic drift where static detectors remain silent.

The tool is reproducible in full — deterministic corpus, open-source implementation, four competing detectors on identical inputs — and the results are available at `tools/predictor-corrector/sim/unseen-tide/results/results.json`.

The broader claim is not that static thresholds are useless — they remain a reasonable first line of defence. It is that *dynamical models of the context-window bell curve recover information that point-in-time thresholds cannot see, and that information is measurably earlier-warning.*

The model was never the problem. The context was never the problem. The method for watching the context is the problem, and it is a solvable one.

---

*Authored for contrarianAI. Companion software: [`tools/predictor-corrector`](../). Sensor: [`tools/context-inspector`](../../context-inspector). Prior work: [Context Rot whitepaper](../../context-inspector/docs/whitepaper.md).*
