import { proportionalSplit } from '../proportional-split';

let passed = 0;
let failed = 0;

function assert(label: string, got: Map<string, number>, expected: Record<string, number>) {
  const keys = new Set([...Object.keys(expected), ...Array.from(got.keys())]);
  let ok = true;
  for (const k of keys) {
    if (got.get(k) !== expected[k]) { ok = false; break; }
  }
  // Verify sum
  const sum = Array.from(got.values()).reduce((a, b) => a + b, 0);
  const expectedSum = Object.values(expected).reduce((a, b) => a + b, 0);
  if (sum !== expectedSum) ok = false;

  if (ok) {
    passed++;
  } else {
    console.error(`FAIL ${label}: got ${JSON.stringify(Object.fromEntries(got))}, expected ${JSON.stringify(expected)}`);
    failed++;
  }
}

// Case 1: equal subtotals — tax split evenly
assert(
  'equal subtotals',
  proportionalSplit(600, new Map([['A', 4000], ['B', 4000]])),
  { A: 300, B: 300 },
);

// Case 2: 2:1 ratio — Mike's items 2× Sarah's
assert(
  '2:1 ratio ($6.84 tax)',
  proportionalSplit(684, new Map([['Mike', 4000], ['Sarah', 2000]])),
  { Mike: 456, Sarah: 228 },
);

// Case 3: 4-way split of $11.40 tip, equal subtotals
// 1140 / 4 = 285 each
assert(
  '4-way equal $11.40 tip',
  proportionalSplit(1140, new Map([['A', 1000], ['B', 1000], ['C', 1000], ['D', 1000]])),
  { A: 285, B: 285, C: 285, D: 285 },
);

// Case 4: remainder distribution — $0.07 split 3 ways
// 7 / 3 = 2 each + 1 extra → first gets 3, others get 2
assert(
  '$0.07 split 3 ways (remainder)',
  proportionalSplit(7, new Map([['A', 100], ['B', 100], ['C', 100]])),
  { A: 3, B: 2, C: 2 },
);

// Case 5: all subtotals $0 → equal split
assert(
  'all-zero subtotals → equal split',
  proportionalSplit(300, new Map([['A', 0], ['B', 0], ['C', 0]])),
  { A: 100, B: 100, C: 100 },
);

// Case 6: tax = 0 → everyone gets 0
assert(
  'zero tax',
  proportionalSplit(0, new Map([['A', 5000], ['B', 3000]])),
  { A: 0, B: 0 },
);

// Case 7: single participant
assert(
  'single participant',
  proportionalSplit(684, new Map([['A', 7600]])),
  { A: 684 },
);

// Case 8: large uneven split — verify no cents lost
// $76 subtotal: Mike $40, Sarah $20, Tom $16 → $6.84 tax
// Mike: 684 * 40/76 = 360 exact
// Sarah: 684 * 20/76 = 180 exact
// Tom: 684 * 16/76 = 144 exact
assert(
  'uneven 3-way $6.84 tax',
  proportionalSplit(684, new Map([['Mike', 4000], ['Sarah', 2000], ['Tom', 1600]])),
  { Mike: 360, Sarah: 180, Tom: 144 },
);

console.log(`proportionalSplit: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
