import { parseMoney } from '../parse-money';

type Case = [string, number | null];

const cases: Case[] = [
  // Standard US format
  ['$12.50', 1250],
  ['12.50', 1250],
  ['0.99', 99],
  ['100.00', 10000],
  // Thousands separator
  ['1,234.56', 123456],
  ['$1,234.56', 123456],
  // European format (comma decimal)
  ['12,50', 1250],
  ['1.234,56', 123456],
  // Negative / discount
  ['-3.00', -300],
  ['(3.00)', -300],
  ['($3.00)', -300],
  // Zero
  ['0.00', 0],
  ['$0', 0],
  // Rounding
  ['0.005', 1], // rounds to 1 cent
  // Invalid
  ['', null],
  ['abc', null],
  ['$', null],
];

let passed = 0;
let failed = 0;

for (const [input, expected] of cases) {
  const result = parseMoney(input);
  if (result === expected) {
    passed++;
  } else {
    console.error(`FAIL parseMoney(${JSON.stringify(input)}): expected ${expected}, got ${result}`);
    failed++;
  }
}

console.log(`parseMoney: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
