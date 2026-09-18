import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from '../src';

const valid = { email: 'jane@example.com', password: 'secret123', confirmPassword: 'secret123' };

function fieldErrors(input: unknown) {
  const result = registerSchema.safeParse(input);
  if (result.success) return {};
  const errors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.');
    (errors[key] ??= []).push(issue.message);
  }
  return errors;
}

describe('registerSchema', () => {
  it('accepts a valid payload and normalizes the email', () => {
    const result = registerSchema.parse({ ...valid, email: '  Jane@Example.COM ' });
    expect(result.email).toBe('jane@example.com');
  });

  it('rejects an invalid email', () => {
    expect(fieldErrors({ ...valid, email: 'not-an-email' }).email).toEqual([
      'Enter a valid email address',
    ]);
  });

  it.each([
    ['too short', 'abc123', 'Password must be at least 8 characters'],
    ['too long', `a1${'x'.repeat(71)}`, 'Password must be at most 72 characters'],
    ['no digit', 'abcdefgh', 'Password must contain at least one number'],
    ['no letter', '12345678', 'Password must contain at least one letter'],
  ])('rejects a password that is %s', (_, password, message) => {
    expect(fieldErrors({ ...valid, password, confirmPassword: password }).password).toContain(
      message,
    );
  });

  it('rejects mismatched passwords on the confirmPassword field', () => {
    expect(fieldErrors({ ...valid, confirmPassword: 'secret124' }).confirmPassword).toEqual([
      'Passwords do not match',
    ]);
  });

  it('rejects missing fields', () => {
    const errors = fieldErrors({});
    expect(Object.keys(errors).sort()).toEqual(['confirmPassword', 'email', 'password']);
  });
});

describe('loginSchema', () => {
  it('requires email and password', () => {
    const result = loginSchema.safeParse({ email: '', password: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path[0]).sort()).toEqual(['email', 'password']);
  });

  it('normalizes the email', () => {
    expect(loginSchema.parse({ email: ' A@B.co ', password: 'x' }).email).toBe('a@b.co');
  });
});
