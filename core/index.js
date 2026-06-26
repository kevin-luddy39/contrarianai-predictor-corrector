/**
 * Forecaster — high-level orchestrator.
 *
 * Holds:
 *   - baseline (target state vector)
 *   - engine   (abm | kalman)
 *   - history  (rolling window of x, f, events)
 *   - dynamics params
 *   - tolerance / health config
 *
 * Exposes:
 *   predictNext(events)        — forecast next state (no measurement yet)
 *   observe(state, events)     — ingest CI measurement; run PECE correction;
 *                                return predicted, corrected, error, health
 *   simulate(nSteps, events[]) — pure look-ahead (no observations)
 *   healthReport()             — latest signals + regime label
 */

const { STATE_DIM, fromStats, sub, weightedNorm, DEFAULT_GAP_WEIGHTS } = require('./state');
const { dynamics, DEFAULT_PARAMS } = require('./dynamics');
const { abmStep, bootstrap } = require('./integrators/abm');
const { rk4Step } = require('./integrators/rk4');
const { createKalman } = require('./integrators/kalman');
const { nextStep, accept } = require('./integrators/adaptive');
const { History } = require('./history');
const { scoreFromSignals, regime, DEFAULT_TOLERANCE } = require('./health');
const {
  jsDivergence, wasserstein1d, gaussianHistogram,
} = require('./metrics');

class Forecaster {
  constructor(options = {}) {
    if (!Array.isArray(options.baseline) || options.baseline.length !== STATE_DIM) {
      throw new Error('Forecaster needs options.baseline: 4-element state vector');
    }
    this.baseline = options.baseline.slice();
    this.params = { ...DEFAULT_PARAMS, ...(options.params || {}) };
    this.engine = options.engine || 'abm';
    this.h = options.h ?? 1;
    this.adaptive = options.adaptive ?? false;
    this.tolerance = { ...DEFAULT_TOLERANCE, ...(options.tolerance || {}) };
    this.history = new History(options.historyLen || 32);
    this.lastSignals = null;
    this.lastHealth = 1;
    this.lastRegime = 'healthy';
    // EMA smoothing on the observation gap — single-turn blips
    // shouldn't flip regime. Set alpha=1 to disable smoothing.
    this.emaAlpha = options.emaAlpha ?? 0.4;
    this.emaError = null;
    this.emaBaseline = null;
    // Weights for the observation-gap norm. Mean and stdDev are robust
    // to sample size; skew/kurt are noisy for small chunk counts and
    // get down-weighted so they don't dominate the health signal.
    this.gapWeights = options.gapWeights || DEFAULT_GAP_WEIGHTS;

    this.f = (x, events) => dynamics(x, this.baseline, events, this.params);

    if (this.engine === 'kalman') {
      const x0 = options.initialState ? options.initialState.slice() : this.baseline.slice();
      this.kf = createKalman(x0, this.baseline, {
        params: this.params,
        h: this.h,
        P0: options.P0,
        Q: options.Q,
        R: options.R,
      });
    }
  }

  /**
   * Forecast the next state without any observation.
   * Uses ABM's predictor alone (for abm engine) or KF predict-only.
   */
  predictNext(events = {}) {
    if (this.engine === 'kalman') {
      const { xPred } = this.kf.predict(events);
      return { predicted: xPred, error: 0 };
    }
    // ABM path — need at least 4 history entries.
    if (this.history.length() < 4) {
      // Cold start: use RK4 from the last known state (or baseline).
      const last = this.history.last();
      const x = last ? last.x.slice() : this.baseline.slice();
      const predicted = rk4Step(this.f, x, this.h, events);
      return { predicted, error: 0 };
    }
    const { predicted, corrected, error } = abmStep(
      this.f, this.history.tail(4), this.h, events
    );
    // No observation to correct against — report the predictor alone.
    return { predicted, corrected, error };
  }

  /**
   * Ingest an observation from context-inspector.
   * Runs full PECE (ABM) or predict-then-update (Kalman).
   */
  observe(ingested, events = {}) {
    const measurement = Array.isArray(ingested) ? ingested : ingested.x;
    const observedHistogram = Array.isArray(ingested) ? null : ingested.histogram;

    let predicted, corrected, milneError, fCorrected;

    if (this.engine === 'kalman') {
      const res = this.kf.step(events, measurement);
      predicted = res.predicted;
      corrected = res.corrected;
      milneError = res.error;
      fCorrected = this.f(corrected, events);
    } else {
      // ABM path
      if (this.history.length() < 4) {
        // Bootstrap: use measurement directly; accumulate (x, f) pairs.
        const x = measurement.slice();
        const f = this.f(x, events);
        predicted = this.history.length() > 0
          ? rk4Step(this.f, this.history.last().x, this.h, events)
          : x.slice();
        corrected = x;
        milneError = 0; // integrator not yet active
        fCorrected = f;
      } else {
        const res = abmStep(this.f, this.history.tail(4), this.h, events);
        predicted = res.predicted;
        // Observation overrides corrector — ground truth wins.
        corrected = measurement.slice();
        milneError = res.error;
        fCorrected = this.f(corrected, events);
      }
    }

    // Two primary health signals, combined by taking the worse:
    //   forecastError  (leading)  — did observation match the ODE forecast?
    //   baselineDistance (lagging) — how far is the observation from the
    //                                ideal? A forecaster that tracks along
    //                                with gradual drift can produce a small
    //                                forecastError even when the system has
    //                                drifted far from baseline, so this
    //                                second signal anchors us to the target.
    const rawGap = weightedNorm(sub(measurement, predicted), this.gapWeights);
    this.emaError = this.emaError == null
      ? rawGap
      : this.emaAlpha * rawGap + (1 - this.emaAlpha) * this.emaError;
    const forecastErr = this.emaError;

    const rawBaselineDist = weightedNorm(sub(measurement, this.baseline), this.gapWeights);
    this.emaBaseline = this.emaBaseline == null
      ? rawBaselineDist
      : this.emaAlpha * rawBaselineDist + (1 - this.emaAlpha) * this.emaBaseline;
    const baselineDistance = this.emaBaseline;

    // The "observation gap" reported upstream is whichever is worse —
    // health drops whenever either signal exceeds tolerance.
    const observationGap = Math.max(forecastErr, baselineDistance);

    // Shape-level metrics (when histograms available)
    let histogramKL, histogramW1;
    if (observedHistogram) {
      const predHist = gaussianHistogram(
        predicted[0], Math.max(predicted[1], 1e-3), observedHistogram.length
      );
      histogramKL = jsDivergence(observedHistogram, predHist);
      histogramW1 = wasserstein1d(observedHistogram, predHist);
    }

    this.lastSignals = {
      forecastError: observationGap,   // worst-of (forecastErr, baselineDistance) for the health combine
      forecastErr,                     // pure forecast-vs-observation gap (leading indicator)
      baselineDistance,                // state vs baseline gap (lagging indicator)
      milneError,
      histogramKL,
      histogramW1,
    };
    this.lastHealth = scoreFromSignals(this.lastSignals, this.tolerance);
    this.lastRegime = regime(this.lastHealth);

    // Adaptive step-size for next round (ABM only) — driven by
    // integrator self-consistency, not observation gap.
    if (this.adaptive && this.engine !== 'kalman' && milneError > 0) {
      this.h = nextStep(this.h, milneError, this.tolerance.forecastError);
    }

    this.history.push({
      turn: events.turn,
      x: corrected,
      f: fCorrected,
      events,
      error: observationGap,
      milneError,
      h: this.h,
    });

    return {
      predicted,
      corrected,
      error: observationGap,
      milneError,
      health: this.lastHealth,
      regime: this.lastRegime,
      signals: this.lastSignals,
      h: this.h,
      accepted: accept(observationGap, this.tolerance.forecastError),
    };
  }

  /**
   * Pure look-ahead: advance nSteps from the current state without
   * observations. Useful for "what-if" projections.
   */
  simulate(nSteps, eventsPerStep = []) {
    const out = [];
    let hist = this.history.length() >= 4
      ? this.history.tail(4).map(e => ({ x: e.x.slice(), f: e.f.slice() }))
      : null;

    let x = this.history.last()?.x.slice() || this.baseline.slice();

    for (let i = 0; i < nSteps; i++) {
      const events = eventsPerStep[i] || {};
      if (this.engine === 'kalman') {
        const { xPred } = this.kf.predict(events);
        out.push({ x: xPred, step: i + 1 });
        x = xPred;
        continue;
      }
      if (hist) {
        const res = abmStep(this.f, hist, this.h, events);
        out.push({ x: res.corrected, error: res.error, step: i + 1 });
        hist.shift();
        hist.push({ x: res.corrected, f: res.fCorrected });
        x = res.corrected;
      } else {
        x = rk4Step(this.f, x, this.h, events);
        out.push({ x, step: i + 1 });
      }
    }
    return out;
  }

  healthReport() {
    return {
      health: this.lastHealth,
      regime: this.lastRegime,
      signals: this.lastSignals,
      historyLen: this.history.length(),
      engine: this.engine,
      h: this.h,
    };
  }

  /**
   * Seed the history with an initial sequence of CI ingestions so ABM
   * can skip RK4 bootstrap. Pass at least 4 prior records.
   */
  seedHistory(ingestedList, eventsList = []) {
    for (let i = 0; i < ingestedList.length; i++) {
      const ing = ingestedList[i];
      const events = eventsList[i] || {};
      const x = Array.isArray(ing) ? ing : ing.x;
      const f = this.f(x, events);
      this.history.push({ turn: events.turn ?? i, x, f, events, error: 0, h: this.h });
    }
  }
}

module.exports = {
  Forecaster,
  dynamics,
  fromStats,
};
