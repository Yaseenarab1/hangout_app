import { computeItemShares, ItemAssignment } from '../compute-item-shares';

let passed = 0;
let failed = 0;

function assert(label: string, got: Map<string, number>, expected: Record<string, number>) {
  const totalGot = Array.from(got.values()).reduce((a, b) => a + b, 0);
  const totalExpected = Object.values(expected).reduce((a, b) => a + b, 0);
  let ok = totalGot === totalExpected;
  for (const [k, v] of Object.entries(expected)) {
    if (got.get(k) !== v) { ok = false; break; }
  }
  if (ok) {
    passed++;
  } else {
    console.error(`FAIL ${label}:`);
    console.error('  got     ', Object.fromEntries(got));
    console.error('  expected', expected);
    failed++;
  }
}

// ── Case 1: plan's example — $76 subtotal, 4 people, $6.84 tax, $11.40 tip ──
// Margherita $14 → Mike+Sarah split equally ($7 each)
// Pepperoni  $16 → You+Sarah split equally ($8 each)
// House red  $12 → all 4 split equally ($3 each)
// Salad      $34 → Tom alone ($34)
// Total items = $76, tax = $684, tip = $1140
// Item subtotals:
//   Mike: 7+3 = $10
//   Sarah: 7+8+3 = $18
//   You: 8+3 = $11
//   Tom: 34+3 = $37
// Total = $76 ✓
// Mike tax: 684 * 10/76 = 90; tip: 1140 * 10/76 = 150 → total 10+90+150=1250? wait, tax+tip share
// Actually let me compute properly:
// Mike item sub: 700+300 = 1000 (cents)
// Sarah item sub: 700+800+300 = 1800
// You item sub: 800+300 = 1100
// Tom item sub: 3400+300 = 3700
// Total = 7600
// Mike tax: 684*1000/7600 = 90; tip: 1140*1000/7600 = 150; total: 1000+90+150=1240
// Sarah tax: 684*1800/7600 = 162; tip: 1140*1800/7600 = 270; total: 1800+162+270=2232
// You tax: 684*1100/7600 ≈ 99; tip: 1140*1100/7600 = 165; total: 1100+99+165=1364
// Tom tax: 684*3700/7600 ≈ 333; tip: 1140*3700/7600 = 555; total: 3700+333+555=4588
// Sum check: 1240+2232+1364+4588 = 9424 = 7600+684+1140 ✓

const items1: ItemAssignment[] = [
  { amountCents: 1400, assignees: new Map([['Mike', 1], ['Sarah', 1]]) },
  { amountCents: 1600, assignees: new Map([['You', 1], ['Sarah', 1]]) },
  { amountCents: 1200, assignees: new Map([['Mike', 1], ['Sarah', 1], ['You', 1], ['Tom', 1]]) },
  { amountCents: 3400, assignees: new Map([['Tom', 1]]) },
];

assert(
  'plan example: 4 people $76+$6.84+$11.40',
  computeItemShares({ items: items1, taxCents: 684, tipCents: 1140 }),
  { Mike: 1240, Sarah: 2232, You: 1364, Tom: 4588 },
);

// ── Case 2: single person pays everything ──
const items2: ItemAssignment[] = [
  { amountCents: 5000, assignees: new Map([['Alice', 1]]) },
];
assert(
  'single person all items',
  computeItemShares({ items: items2, taxCents: 450, tipCents: 750 }),
  { Alice: 6200 },
);

// ── Case 3: no tax/tip ──
const items3: ItemAssignment[] = [
  { amountCents: 2000, assignees: new Map([['A', 1], ['B', 1]]) },
];
assert(
  'no tax or tip',
  computeItemShares({ items: items3, taxCents: 0, tipCents: 0 }),
  { A: 1000, B: 1000 },
);

// ── Case 4: discount item (negative amount) is allowed ──
// Items: Beer $800, Discount -$200 (both go to Alice)
// Net subtotal Alice = $600, tax $60
const items4: ItemAssignment[] = [
  { amountCents: 800, assignees: new Map([['Alice', 1]]) },
  { amountCents: -200, assignees: new Map([['Alice', 1]]) },
];
// After discount Alice's item sub = 600. Tax proportional on 600 = 60.
// Total = 600 + 60 = 660
assert(
  'discount item (negative)',
  computeItemShares({ items: items4, taxCents: 60, tipCents: 0 }),
  { Alice: 660 },
);

// ── Case 5: custom weight split (not equal) ──
// Pizza $3000: Alice gets 2/3 ($2000), Bob gets 1/3 ($1000)
// Tax $300: proportional → Alice $200, Bob $100
const items5: ItemAssignment[] = [
  { amountCents: 3000, assignees: new Map([['Alice', 2], ['Bob', 1]]) },
];
assert(
  'custom weight 2:1 split',
  computeItemShares({ items: items5, taxCents: 300, tipCents: 0 }),
  { Alice: 2200, Bob: 1100 },
);

// ── Case 6: verify sum exactly equals grand total ──
const items6: ItemAssignment[] = [
  { amountCents: 1499, assignees: new Map([['A', 1], ['B', 1], ['C', 1]]) },
  { amountCents: 2501, assignees: new Map([['B', 1], ['C', 1]]) },
];
const result6 = computeItemShares({ items: items6, taxCents: 337, tipCents: 563 });
const sum6 = Array.from(result6.values()).reduce((a, b) => a + b, 0);
const grandTotal6 = 1499 + 2501 + 337 + 563;
if (sum6 === grandTotal6) {
  passed++;
} else {
  console.error(`FAIL sum check: got ${sum6}, expected ${grandTotal6}`);
  failed++;
}

console.log(`computeItemShares: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
