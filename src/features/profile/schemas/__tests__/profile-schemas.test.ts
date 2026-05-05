import {
  usernameSchema,
  displayNameSchema,
  bioSchema,
  createProfileSchema,
} from '../index';

describe('usernameSchema', () => {
  it('accepts valid usernames', () => {
    expect(usernameSchema.parse('alice')).toBe('alice');
    expect(usernameSchema.parse('Alice_99')).toBe('alice_99');
    expect(usernameSchema.parse('a_b_c')).toBe('a_b_c');
  });

  it('rejects too short', () => {
    expect(() => usernameSchema.parse('ab')).toThrow(/at least 3/);
  });

  it('rejects too long', () => {
    expect(() => usernameSchema.parse('a'.repeat(31))).toThrow(/30/);
  });

  it('rejects invalid characters', () => {
    expect(() => usernameSchema.parse('alice!')).toThrow();
    expect(() => usernameSchema.parse('alice smith')).toThrow();
    expect(() => usernameSchema.parse('alice@bob')).toThrow();
  });

  it('lowercases the result', () => {
    expect(usernameSchema.parse('ALICE')).toBe('alice');
  });
});

describe('displayNameSchema', () => {
  it('accepts valid names', () => {
    expect(displayNameSchema.parse('Alice')).toBe('Alice');
    expect(displayNameSchema.parse('Alice Marie Smith')).toBe('Alice Marie Smith');
  });

  it('trims whitespace', () => {
    expect(displayNameSchema.parse('  Alice  ')).toBe('Alice');
  });

  it('rejects too short', () => {
    expect(() => displayNameSchema.parse('A')).toThrow();
  });

  it('rejects too long', () => {
    expect(() => displayNameSchema.parse('A'.repeat(33))).toThrow();
  });
});

describe('bioSchema', () => {
  it('accepts up to 280 chars', () => {
    expect(bioSchema.parse('a'.repeat(280))).toBe('a'.repeat(280));
  });

  it('rejects over 280', () => {
    expect(() => bioSchema.parse('a'.repeat(281))).toThrow();
  });

  it('accepts undefined', () => {
    expect(bioSchema.parse(undefined)).toBeUndefined();
  });
});

describe('createProfileSchema', () => {
  it('accepts a complete valid profile', () => {
    expect(() =>
      createProfileSchema.parse({
        displayName: 'Alice',
        username: 'alice99',
        bio: 'a bio',
      }),
    ).not.toThrow();
  });

  it('rejects when username is invalid even if other fields are fine', () => {
    expect(() =>
      createProfileSchema.parse({
        displayName: 'Alice',
        username: 'a',
        bio: '',
      }),
    ).toThrow();
  });
});
