import {
  emailSchema,
  passwordSchema,
  signInSchema,
  signUpSchema,
  verifyEmailSchema,
} from '../index';

describe('emailSchema', () => {
  it('accepts valid emails and lowercases them', () => {
    const result = emailSchema.parse('Foo@Bar.COM');
    expect(result).toBe('foo@bar.com');
  });

  it('rejects invalid emails', () => {
    expect(() => emailSchema.parse('not-an-email')).toThrow();
    expect(() => emailSchema.parse('@bar.com')).toThrow();
    expect(() => emailSchema.parse('foo@')).toThrow();
  });

  it('trims whitespace', () => {
    expect(emailSchema.parse('  foo@bar.com  ')).toBe('foo@bar.com');
  });
});

describe('passwordSchema', () => {
  it('accepts strong passwords', () => {
    expect(passwordSchema.parse('hunter2hunter2')).toBe('hunter2hunter2');
  });

  it('rejects too-short passwords', () => {
    expect(() => passwordSchema.parse('short1')).toThrow(/at least 10/i);
  });

  it('rejects passwords without a number', () => {
    expect(() => passwordSchema.parse('alllettersnonum')).toThrow(/number/i);
  });

  it('rejects passwords without a letter', () => {
    expect(() => passwordSchema.parse('1234567890')).toThrow(/letter/i);
  });
});

describe('signInSchema', () => {
  it('accepts valid input', () => {
    const result = signInSchema.parse({
      email: 'foo@bar.com',
      password: 'anything',
    });
    expect(result.email).toBe('foo@bar.com');
  });

  it('does not validate password strength on sign-in', () => {
    // Sign in should accept any non-empty password (legacy users may have weaker ones)
    expect(() =>
      signInSchema.parse({ email: 'foo@bar.com', password: 'x' }),
    ).not.toThrow();
  });
});

describe('signUpSchema', () => {
  const valid = {
    email: 'foo@bar.com',
    password: 'hunter2hunter2',
    confirmPassword: 'hunter2hunter2',
    age18Confirmed: true,
  };

  it('accepts valid input', () => {
    expect(() => signUpSchema.parse(valid)).not.toThrow();
  });

  it('rejects mismatched confirmation', () => {
    expect(() =>
      signUpSchema.parse({ ...valid, confirmPassword: 'different11' }),
    ).toThrow(/match/i);
  });

  it('requires age confirmation', () => {
    expect(() => signUpSchema.parse({ ...valid, age18Confirmed: false })).toThrow(
      /18/,
    );
  });
});

describe('verifyEmailSchema', () => {
  it('accepts a 6-digit code', () => {
    expect(() =>
      verifyEmailSchema.parse({ email: 'foo@bar.com', token: '123456' }),
    ).not.toThrow();
  });

  it('rejects non-numeric codes', () => {
    expect(() =>
      verifyEmailSchema.parse({ email: 'foo@bar.com', token: 'abcdef' }),
    ).toThrow();
  });

  it('rejects wrong length', () => {
    expect(() =>
      verifyEmailSchema.parse({ email: 'foo@bar.com', token: '12345' }),
    ).toThrow();
  });
});
