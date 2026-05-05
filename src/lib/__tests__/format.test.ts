import {
  formatRelativeTime,
  formatCurrency,
  formatDistance,
  truncate,
  initialFor,
  colorSlotFor,
} from '../format';

describe('formatRelativeTime', () => {
  const now = new Date('2026-04-28T12:00:00Z');

  it("returns 'just now' for under 30 seconds", () => {
    const ts = new Date(now.getTime() - 10_000).toISOString();
    expect(formatRelativeTime(ts, now)).toBe('just now');
  });

  it('returns seconds for 30-59 seconds', () => {
    const ts = new Date(now.getTime() - 45_000).toISOString();
    expect(formatRelativeTime(ts, now)).toBe('45s ago');
  });

  it('returns minutes for under an hour', () => {
    const ts = new Date(now.getTime() - 5 * 60_000).toISOString();
    expect(formatRelativeTime(ts, now)).toBe('5m ago');
  });

  it('returns hours for under a day', () => {
    const ts = new Date(now.getTime() - 3 * 60 * 60_000).toISOString();
    expect(formatRelativeTime(ts, now)).toBe('3h ago');
  });

  it('returns days for under a week', () => {
    const ts = new Date(now.getTime() - 4 * 24 * 60 * 60_000).toISOString();
    expect(formatRelativeTime(ts, now)).toBe('4d ago');
  });
});

describe('formatCurrency', () => {
  it('formats USD cents as dollars', () => {
    expect(formatCurrency(1234, 'USD', 'en-US')).toBe('$12.34');
    expect(formatCurrency(0, 'USD', 'en-US')).toBe('$0.00');
    expect(formatCurrency(100, 'USD', 'en-US')).toBe('$1.00');
  });
});

describe('formatDistance', () => {
  it('formats short imperial distances in feet', () => {
    expect(formatDistance(50)).toMatch(/ft/);
  });
  it('formats long imperial distances in miles', () => {
    expect(formatDistance(15000)).toBe('9.3 mi');
  });
  it('formats short metric distances in meters', () => {
    expect(formatDistance(500, 'metric')).toBe('500 m');
  });
  it('formats long metric distances in kilometers', () => {
    expect(formatDistance(5500, 'metric')).toBe('5.5 km');
  });
});

describe('truncate', () => {
  it('does not truncate short strings', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });
  it('truncates with ellipsis', () => {
    expect(truncate('hello world', 8)).toBe('hello w…');
  });
});

describe('initialFor', () => {
  it('returns first letter of single-word name', () => {
    expect(initialFor('Alice')).toBe('A');
  });
  it('returns first + last initials', () => {
    expect(initialFor('Alice Smith')).toBe('AS');
    expect(initialFor('Alice Marie Smith')).toBe('AS');
  });
  it('handles empty input', () => {
    expect(initialFor('')).toBe('?');
    expect(initialFor('   ')).toBe('?');
  });
});

describe('colorSlotFor', () => {
  it('returns the same slot for the same id', () => {
    expect(colorSlotFor('abc-123', 8)).toBe(colorSlotFor('abc-123', 8));
  });
  it('returns a slot in range', () => {
    for (const id of ['a', 'b', 'long-uuid-string-here', '1234']) {
      const slot = colorSlotFor(id, 8);
      expect(slot).toBeGreaterThanOrEqual(0);
      expect(slot).toBeLessThan(8);
    }
  });
});
