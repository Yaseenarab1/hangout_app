// Pure parser for Google Cloud Vision TEXT_DETECTION response.
// No I/O — fully unit-testable.

export type VisionVertex = { x?: number; y?: number };
export type VisionBoundingPoly = { vertices: VisionVertex[] };
export type VisionEntityAnnotation = {
  description: string;
  boundingPoly: VisionBoundingPoly;
};

export type ParsedItem = {
  description: string;
  amountCents: number;
  quantity: number;
  position: number; // top-y of bounding box, px
};

export type ParsedReceipt = {
  items: ParsedItem[];
  subtotalCents: number | null;
  taxCents: number | null;
  tipCents: number | null;
  totalCents: number | null;
  confidence: 'high' | 'medium' | 'low';
  rawText: string;
};

// Matches prices like: $12.50  12.50  12,50  1,234.56
const PRICE_RE = /\$?\d{1,3}(?:[,\.]\d{3})*(?:[,\.]\d{2})/;

// Keywords that mark lines to exclude from items (tax, tip, total, subtotal, fees, etc.)
const SUMMARY_KEYWORDS = /\b(tax|tip|gratuity|service\s+(fee|charge)|delivery\s+fee|bag\s+fee|convenience\s+fee|surcharge|other\s+(fee|charge)|fees?\s*&?\s*charges?|total|subtotal|sub\s*total|amount\s+due|balance\s+due|change|cash|card|visa|master|amex|debit|credit|thank\s+you)\b/i;

function parseCents(raw: string): number | null {
  const s = raw
    .trim()
    .replace(/[$€£]/g, '')
    .replace(/,(\d{2})$/, '.$1')  // European: 12,50 → 12.50
    .replace(/,/g, '');           // Remove thousands separator
  const n = parseFloat(s);
  if (isNaN(n) || !isFinite(n)) return null;
  return Math.round(n * 100);
}

function topY(ann: VisionEntityAnnotation): number {
  const ys = ann.boundingPoly.vertices.map((v) => v.y ?? 0);
  return Math.min(...ys);
}

function leftX(ann: VisionEntityAnnotation): number {
  const xs = ann.boundingPoly.vertices.map((v) => v.x ?? 0);
  return Math.min(...xs);
}

function rightX(ann: VisionEntityAnnotation): number {
  const xs = ann.boundingPoly.vertices.map((v) => v.x ?? 0);
  return Math.max(...xs);
}

// Group annotations into horizontal lines (within LINE_GAP_PX of each other).
const LINE_GAP_PX = 12;

function groupIntoLines(
  annotations: VisionEntityAnnotation[],
): VisionEntityAnnotation[][] {
  // Skip the first annotation — Vision puts the entire receipt text there.
  const words = annotations.slice(1);
  // Sort by top-Y then left-X
  const sorted = [...words].sort((a, b) => {
    const dy = topY(a) - topY(b);
    return Math.abs(dy) < LINE_GAP_PX ? leftX(a) - leftX(b) : dy;
  });

  const lines: VisionEntityAnnotation[][] = [];
  let currentLine: VisionEntityAnnotation[] = [];
  let lineY = -Infinity;

  for (const word of sorted) {
    const y = topY(word);
    if (y - lineY > LINE_GAP_PX && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = [];
    }
    currentLine.push(word);
    lineY = y;
  }
  if (currentLine.length > 0) lines.push(currentLine);

  return lines;
}

// Extract "2x" or "2 x" quantity prefix from a description.
function extractQuantity(text: string): { qty: number; rest: string } {
  const m = text.match(/^(\d+)\s*[xX×]\s*/);
  if (m) return { qty: parseInt(m[1]!, 10), rest: text.slice(m[0].length) };
  return { qty: 1, rest: text };
}

export function parseReceiptText(annotations: VisionEntityAnnotation[]): ParsedReceipt {
  if (!annotations || annotations.length === 0) {
    return {
      items: [],
      subtotalCents: null,
      taxCents: null,
      tipCents: null,
      totalCents: null,
      confidence: 'low',
      rawText: '',
    };
  }

  const rawText = annotations[0]?.description ?? '';
  const lines = groupIntoLines(annotations);

  const items: ParsedItem[] = [];
  let subtotalCents: number | null = null;
  let taxCents: number | null = null;
  let tipCents: number | null = null;
  let totalCents: number | null = null;

  for (const line of lines) {
    // Combine line text
    const lineText = line.map((w) => w.description).join(' ');

    // Find the rightmost price-like token in the line
    const priceMatches = [...lineText.matchAll(new RegExp(PRICE_RE.source, 'g'))];
    if (priceMatches.length === 0) continue;

    const lastMatch = priceMatches[priceMatches.length - 1]!;
    const priceStr = lastMatch[0];
    const cents = parseCents(priceStr);
    if (cents === null || cents < 0) continue;

    // Build description from words left of the price column
    // Use the rightmost price-word's leftX as the threshold
    const priceWords = line.filter((w) => PRICE_RE.test(w.description));
    const priceWordX = priceWords.length > 0
      ? Math.min(...priceWords.map(leftX))
      : Infinity;
    const descWords = line
      .filter((w) => rightX(w) <= priceWordX + 5 && !PRICE_RE.test(w.description))
      .map((w) => w.description)
      .join(' ')
      .trim();

    const combinedText = descWords || lineText.replace(priceStr, '').trim();
    const lower = combinedText.toLowerCase();

    // Route to summary fields
    // Tax + any extra fees (service fee, delivery fee, bag fee, surcharge, etc.)
    const isTaxLike =
      /\btax\b/.test(lower) ||
      /\bservice\s+(?:fee|charge)\b/.test(lower) ||
      /\bdelivery\s+fee\b/.test(lower) ||
      /\bbag\s+fee\b/.test(lower) ||
      /\bconvenience\s+fee\b/.test(lower) ||
      /\bsurcharge\b/.test(lower) ||
      /\bother\s+(?:fee|charge)\b/.test(lower) ||
      /\bfees?\s*&?\s*charges?\b/.test(lower);
    if (isTaxLike && !/gratuity|tip/.test(lower)) {
      taxCents = (taxCents ?? 0) + cents; // accumulate multiple fees
      continue;
    }
    if (/\btip\b|\bgratuity\b/.test(lower)) {
      if (tipCents === null) tipCents = cents;
      continue;
    }
    if (/\bsubtotal\b|\bsub[\s\-]total\b/.test(lower)) {
      if (subtotalCents === null) subtotalCents = cents;
      continue;
    }
    if (/\btotal\b|\bamount\s+due\b|\bbalance\s+due\b/.test(lower)) {
      // Prefer the LAST total-like line (some receipts have running totals)
      totalCents = cents;
      continue;
    }
    if (SUMMARY_KEYWORDS.test(lower)) continue;
    if (!combinedText || combinedText.length < 1) continue;

    // It's a line item
    const { qty, rest } = extractQuantity(combinedText);
    const description = rest.trim() || combinedText;
    if (!description) continue;

    items.push({
      description,
      amountCents: cents,
      quantity: Math.min(qty, 99),
      position: topY(line[0]!),
    });
  }

  // Confidence
  let confidence: 'high' | 'medium' | 'low';
  const sumItems = items.reduce((s, i) => s + i.amountCents * i.quantity, 0);
  if (items.length >= 3 && totalCents !== null) {
    const reconcileTarget = totalCents;
    const diff = Math.abs(sumItems + (taxCents ?? 0) + (tipCents ?? 0) - reconcileTarget);
    confidence = diff <= reconcileTarget * 0.02 ? 'high' : 'medium';
  } else if (items.length >= 1) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return { items, subtotalCents, taxCents, tipCents, totalCents, confidence, rawText };
}
