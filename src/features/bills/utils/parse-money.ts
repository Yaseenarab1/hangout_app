/**
 * Robust money string → cents parser.
 * Handles: "$12.50", "12.50", "12,50", "1,234.56", "$1.234,56", "(3.00)" (negative)
 * Returns null if the string cannot be parsed as a non-negative number.
 * Negative values (discounts) are returned as negative cents.
 */
export function parseMoney(raw: string): number | null {
  if (!raw || typeof raw !== 'string') return null;

  let s = raw.trim();
  const isNegative = s.startsWith('(') && s.endsWith(')') || s.startsWith('-');
  s = s.replace(/[()\-]/g, '').trim();
  s = s.replace(/[$€£¥₹]/g, '').trim();

  // Detect format: European (1.234,56) vs US (1,234.56)
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma > lastDot) {
    // European: comma is decimal separator → 1.234,56
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // US: dot is decimal separator → 1,234.56
    s = s.replace(/,/g, '');
  }

  const n = parseFloat(s);
  if (isNaN(n) || !isFinite(n)) return null;

  const cents = Math.round(n * 100);
  return isNegative ? -cents : cents;
}
