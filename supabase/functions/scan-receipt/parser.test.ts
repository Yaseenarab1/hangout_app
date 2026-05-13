// Unit tests for the Vision API receipt parser.
// Fixtures are representative of real TEXT_DETECTION responses.
// Run with: npx ts-node parser.test.ts (from this directory)

import { parseReceiptText, VisionEntityAnnotation } from './parser';

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, msg?: string) {
  if (condition) {
    passed++;
  } else {
    console.error(`FAIL [${label}]${msg ? ': ' + msg : ''}`);
    failed++;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function word(text: string, x: number, y: number, w = 60, h = 20): VisionEntityAnnotation {
  return {
    description: text,
    boundingPoly: {
      vertices: [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ],
    },
  };
}

/** Build a fake annotation array with a full-text first entry (Vision convention). */
function makeAnnotations(
  words: VisionEntityAnnotation[],
  fullText?: string,
): VisionEntityAnnotation[] {
  const full: VisionEntityAnnotation = {
    description: fullText ?? words.map((w) => w.description).join('\n'),
    boundingPoly: { vertices: [] },
  };
  return [full, ...words];
}

// ── Test 1: Happy-path restaurant receipt ─────────────────────────────────────
// Layout (y positions 0..300):
//   y=20: Margherita   $14.00
//   y=45: Pepperoni    $16.00
//   y=70: House red    $12.00
//   y=110: Subtotal    $42.00
//   y=135: Tax          $3.78
//   y=160: Tip          $6.30
//   y=185: TOTAL       $52.08

{
  const annotations = makeAnnotations([
    word('Margherita', 10, 20), word('$14.00', 200, 20),
    word('Pepperoni', 10, 45), word('$16.00', 200, 45),
    word('House', 10, 70), word('red', 80, 70), word('$12.00', 200, 70),
    word('Subtotal', 10, 110), word('$42.00', 200, 110),
    word('Tax', 10, 135), word('$3.78', 200, 135),
    word('Tip', 10, 160), word('$6.30', 200, 160),
    word('TOTAL', 10, 185), word('$52.08', 200, 185),
  ]);

  const r = parseReceiptText(annotations);
  check('happy-path: item count', r.items.length === 3, `got ${r.items.length}`);
  check('happy-path: Margherita $14', r.items.some((i) => i.amountCents === 1400));
  check('happy-path: Pepperoni $16', r.items.some((i) => i.amountCents === 1600));
  check('happy-path: House red $12', r.items.some((i) => i.amountCents === 1200));
  check('happy-path: tax', r.taxCents === 378, `got ${r.taxCents}`);
  check('happy-path: tip', r.tipCents === 630, `got ${r.tipCents}`);
  check('happy-path: subtotal', r.subtotalCents === 4200, `got ${r.subtotalCents}`);
  check('happy-path: total', r.totalCents === 5208, `got ${r.totalCents}`);
  check('happy-path: confidence high', r.confidence === 'high', `got ${r.confidence}`);
}

// ── Test 2: Empty / no useful content ─────────────────────────────────────────
{
  const r = parseReceiptText([]);
  check('empty: no items', r.items.length === 0);
  check('empty: confidence low', r.confidence === 'low');
}

// ── Test 3: Only summary lines, no items ──────────────────────────────────────
{
  const annotations = makeAnnotations([
    word('Tax', 10, 10), word('$1.00', 200, 10),
    word('Total', 10, 30), word('$11.00', 200, 30),
  ]);
  const r = parseReceiptText(annotations);
  check('summary-only: no items', r.items.length === 0, `got ${r.items.length}`);
  check('summary-only: tax', r.taxCents === 100);
  check('summary-only: total', r.totalCents === 1100);
  check('summary-only: confidence low', r.confidence === 'low');
}

// ── Test 4: Quantity prefix "2x Beer $12.00" ──────────────────────────────────
{
  const annotations = makeAnnotations([
    word('2x', 10, 20), word('Beer', 50, 20), word('$12.00', 200, 20),
    word('Total', 10, 50), word('$12.00', 200, 50),
  ]);
  const r = parseReceiptText(annotations);
  check('quantity: item found', r.items.length === 1, `got ${r.items.length}`);
  check('quantity: qty=2', r.items[0]?.quantity === 2, `got ${r.items[0]?.quantity}`);
  check('quantity: amount=1200', r.items[0]?.amountCents === 1200);
}

// ── Test 5: No prices at all ──────────────────────────────────────────────────
{
  const annotations = makeAnnotations([
    word('Thank', 10, 20), word('you', 60, 20), word('for', 100, 20), word('dining', 140, 20),
  ]);
  const r = parseReceiptText(annotations);
  check('no-prices: no items', r.items.length === 0);
  check('no-prices: confidence low', r.confidence === 'low');
  check('no-prices: rawText non-empty', r.rawText.length > 0);
}

// ── Test 6: Confidence medium when total doesn't reconcile ───────────────────
{
  const annotations = makeAnnotations([
    word('Pizza', 10, 20), word('$10.00', 200, 20),
    word('Burger', 10, 45), word('$8.00', 200, 45),
    word('Salad', 10, 70), word('$6.00', 200, 70),
    word('Total', 10, 100), word('$30.00', 200, 100), // doesn't match 24.00 sum
  ]);
  const r = parseReceiptText(annotations);
  check('medium-confidence: items found', r.items.length === 3);
  check('medium-confidence: confidence not high', r.confidence !== 'high', `got ${r.confidence}`);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`parser: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
