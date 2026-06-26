/**
 * Classical 4th-order Runge-Kutta.
 *
 * Self-starting — used to bootstrap the first 4 steps of ABM
 * (which needs a history of derivatives before it can run).
 *
 * f is (x, events) -> dx/dt. The ABM step size h corresponds to one
 * turn by default; fractional h is supported for adaptive mode.
 */

const { add, scale } = require('../state');

function rk4Step(f, x, h, events) {
  const k1 = f(x, events);
  const k2 = f(add(x, scale(k1, h / 2)), events);
  const k3 = f(add(x, scale(k2, h / 2)), events);
  const k4 = f(add(x, scale(k3, h)),     events);

  const combined = k1.map((_, i) => k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  return add(x, scale(combined, h / 6));
}

module.exports = { rk4Step };
