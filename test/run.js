#!/usr/bin/env node
/**
 * Lightweight test harness. Each test file exports an async function.
 */

const path = require('path');

const tests = [
  'ode.test.js',
  'metrics.test.js',
  'forecast.test.js',
];

let pass = 0, fail = 0;

(async () => {
  for (const name of tests) {
    const full = path.join(__dirname, name);
    const mod = require(full);
    const fn = typeof mod === 'function' ? mod : mod.run;
    try {
      await fn();
      pass++;
      console.log(`  ok  ${name}`);
    } catch (e) {
      fail++;
      console.log(`  FAIL ${name}`);
      console.log(`       ${e.stack || e.message}`);
    }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})();
