/**
 * ODE integrator correctness test.
 *
 * Check RK4 and ABM-PECE against an analytically solvable case:
 *   dx/dt = -k (x - x*)     →  x(t) = x* + (x0 - x*) exp(-k t)
 *
 * Using only the first component of the state and constant zero events.
 */

const assert = require('assert');
const { rk4Step } = require('../core/integrators/rk4');
const { abmStep, bootstrap } = require('../core/integrators/abm');

function exactSolution(x0, xStar, k, t) {
  return xStar + (x0 - xStar) * Math.exp(-k * t);
}

module.exports = async function () {
  const k = 0.3;
  const xStar = [0.8, 0.15, 0, 0];
  const x0    = [0.2, 0.4, 0, 0];
  const h = 0.5;
  const steps = 20;

  const f = (x) => [
    -k * (x[0] - xStar[0]),
    -k * (x[1] - xStar[1]),
    0,
    0,
  ];

  // RK4
  let x = x0.slice();
  for (let i = 0; i < steps; i++) x = rk4Step(f, x, h, {});
  const exactAt = exactSolution(x0[0], xStar[0], k, steps * h);
  assert(Math.abs(x[0] - exactAt) < 1e-4,
    `RK4 diverged: got ${x[0]}, expected ${exactAt}`);

  // ABM-PECE
  // bootstrap leaves hist at times {0, h, 2h, 3h}. Each abmStep advances
  // by h, so after N steps the solution is at t = 3h + N*h.
  const hist = bootstrap(f, x0, {}, h);
  let h0 = hist.slice();
  let cur = h0[h0.length - 1].x.slice();
  const abmSteps = steps - 3;
  for (let i = 0; i < abmSteps; i++) {
    const res = abmStep(f, h0, h, {});
    h0.shift();
    h0.push({ x: res.corrected, f: res.fCorrected });
    cur = res.corrected;
  }
  const tEnd = (3 + abmSteps) * h;
  const exactAbm = exactSolution(x0[0], xStar[0], k, tEnd);
  assert(Math.abs(cur[0] - exactAbm) < 1e-3,
    `ABM diverged: got ${cur[0]}, expected ${exactAbm}`);

  // Milne error on a smooth problem should be small
  const res2 = abmStep(f, h0, h, {});
  assert(res2.error < 1e-2,
    `ABM Milne error too large on smooth ODE: ${res2.error}`);
};
