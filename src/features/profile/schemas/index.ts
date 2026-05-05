import { z } from 'zod';

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Username must be at least 3 characters.')
  .max(30, 'Username must be 30 characters or fewer.')
  .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers, and underscores only.');

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'Display name must be at least 2 characters.')
  .max(32, 'Display name must be 32 characters or fewer.');

export const bioSchema = z
  .string()
  .trim()
  .max(280, 'Bio must be 280 characters or fewer.')
  .optional();

export const createProfileSchema = z.object({
  displayName: displayNameSchema,
  username: usernameSchema,
  bio: bioSchema,
  avatarUri: z.string().optional(),
});

export const updateProfileSchema = z.object({
  displayName: displayNameSchema.optional(),
  username: usernameSchema.optional(),
  bio: bioSchema,
  defaultPostVisibility: z.enum(['friends', 'hangout_only', 'selected']).optional(),
  defaultCalendarVisibility: z.enum(['friends', 'private', 'selected']).optional(),
});

export type CreateProfileInput = z.infer<typeof createProfileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
