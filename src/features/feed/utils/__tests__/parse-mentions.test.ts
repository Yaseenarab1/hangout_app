import { parseMentions, uniqueMentionedUsernames } from '../parse-mentions';

describe('parseMentions', () => {
  it('returns empty array for empty caption', () => {
    expect(parseMentions('')).toEqual([]);
  });

  it('returns empty array when no mentions', () => {
    expect(parseMentions('Hello world')).toEqual([]);
  });

  it('parses a single mention', () => {
    const result = parseMentions('Hey @Alice123');
    expect(result).toHaveLength(1);
    expect(result[0]!.username).toBe('alice123');
    expect(result[0]!.raw).toBe('@Alice123');
    expect(result[0]!.index).toBe(4);
  });

  it('parses multiple mentions', () => {
    const result = parseMentions('@foo and @bar_baz');
    expect(result).toHaveLength(2);
    expect(result[0]!.username).toBe('foo');
    expect(result[1]!.username).toBe('bar_baz');
  });

  it('lowercases usernames', () => {
    expect(parseMentions('@UPPERCASE')[0]!.username).toBe('uppercase');
  });

  it('ignores mentions shorter than 3 chars', () => {
    expect(parseMentions('@ab')).toHaveLength(0);
    expect(parseMentions('@a')).toHaveLength(0);
  });

  it('parses mention exactly 3 chars', () => {
    expect(parseMentions('@abc')).toHaveLength(1);
  });

  it('ignores mentions longer than 30 chars', () => {
    const long = '@' + 'a'.repeat(31);
    const result = parseMentions(long);
    expect(result[0]!.username.length).toBe(30);
  });

  it('handles mention at start of string', () => {
    const result = parseMentions('@user check this out');
    expect(result[0]!.index).toBe(0);
  });

  it('handles mention adjacent to punctuation', () => {
    const result = parseMentions('Thanks @user!');
    expect(result).toHaveLength(1);
    expect(result[0]!.username).toBe('user');
  });

  it('is idempotent (re-entrant regex)', () => {
    const a = parseMentions('@alice @bob');
    const b = parseMentions('@alice @bob');
    expect(a).toEqual(b);
  });
});

describe('uniqueMentionedUsernames', () => {
  it('deduplicates the same username mentioned twice', () => {
    const result = uniqueMentionedUsernames('@Alice hey @alice');
    expect(result).toEqual(['alice']);
  });

  it('returns multiple unique usernames', () => {
    const result = uniqueMentionedUsernames('@alice and @bob');
    expect(result).toEqual(['alice', 'bob']);
  });

  it('returns empty array for no mentions', () => {
    expect(uniqueMentionedUsernames('no mentions here')).toEqual([]);
  });
});
