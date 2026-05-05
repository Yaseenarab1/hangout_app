import { z } from 'zod';

/**
 * Auth schemas. These are the SAME schemas used in:
 *   - Client forms (via React Hook Form + zodResolver)
 *   - Edge Functions (server-side re-validation)
 *
 * Two-layer validation: client for UX, server for security. Both use this file.
 */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address.');

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters.')
  .regex(/[a-zA-Z]/, 'Password must include a letter.')
  .regex(/[0-9]/, 'Password must include a number.')
  .max(128, 'Password is too long.');

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.'),
});

export const signUpSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    age18Confirmed: z
      .boolean()
      .refine((v) => v === true, { message: 'You must be 18 or older to use this app.' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

export const verifyEmailSchema = z.object({
  email: emailSchema,
  token: z
    .string()
    .trim()
    .min(6, 'Enter the 6-digit code.')
    .max(6, 'Enter the 6-digit code.')
    .regex(/^\d{6}$/, 'Code must be 6 digits.'),
});

export const requestPasswordResetSchema = z.object({
  email: emailSchema,
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
