/**
 * Rolling history window.
 *
 * ABM needs the last 4 (x, f) pairs; adaptive step-size may want more
 * context for controller tuning. This wrapper owns the bookkeeping so
 * the integrators stay pure.
 */

class History {
  constructor(maxLen = 32) {
    this.maxLen = maxLen;
    this.entries = [];  // each: { turn, x, f, events, error, h }
  }

  push(entry) {
    this.entries.push(entry);
    if (this.entries.length > this.maxLen) {
      this.entries.shift();
    }
  }

  tail(n) {
    return this.entries.slice(-n);
  }

  last() {
    return this.entries[this.entries.length - 1];
  }

  length() {
    return this.entries.length;
  }

  clear() {
    this.entries.length = 0;
  }

  toJSON() {
    return this.entries.slice();
  }
}

module.exports = { History };
