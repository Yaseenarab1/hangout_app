/**
 * Pure formatting functions. No I/O, no React, fully testable.
 */

/**
 * Format a relative timestamp as "just now", "5m ago", "2h ago", "3d ago", or a date.
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 30) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;

  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Format cents as currency.
 *   formatCurrency(1234, 'USD') === '$12.34'
 */
export function formatCurrency(amountCents: number, currency = 'USD', locale?: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amountCents / 100);
}

/**
 * Format a number of meters as a human distance string.
 *   formatDistance(900)   → '0.6 mi'
 *   formatDistance(15000) → '9.3 mi'
 */
export function formatDistance(meters: number, unit: 'imperial' | 'metric' = 'imperial'): string {
  if (unit === 'metric') {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  }
  // imperial
  const miles = meters / 1609.344;
  if (miles < 0.1) {
    const feet = Math.round(meters * 3.28084);
    return `${feet} ft`;
  }
  return `${miles.toFixed(1)} mi`;
}

/**
 * Truncate a string to maxChars, adding an ellipsis if truncated.
 */
export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1).trimEnd()}…`;
}

/**
 * Get a 1- or 2-letter initial for an avatar fallback.
 */
export function initialFor(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

/**
 * Hash a user ID into one of N color slots so the same user always gets the same fallback color.
 */
export function colorSlotFor(id: string, slots: number): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0; // 32-bit
  }
  return Math.abs(hash) % slots;
}
