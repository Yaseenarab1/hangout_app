import { z } from 'zod';

/**
 * Schemas for hangout forms. Client-side validation lives here.
 *
 * Same Zod schemas can be re-used in Edge Functions later for server-side
 * re-validation (defense in depth) — see the security model in
 * docs/05-security-and-privacy.md §7.
 */

export const createHangoutSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Give your hangout a title.')
      .max(100, 'Title must be 100 characters or fewer.'),
    description: z
      .string()
      .trim()
      .max(500, 'Description must be 500 characters or fewer.')
      .optional(),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    locationName: z
      .string()
      .trim()
      .max(100, 'Location name must be 100 characters or fewer.')
      .optional(),
    locationAddress: z
      .string()
      .trim()
      .max(200, 'Address must be 200 characters or fewer.')
      .optional(),
    /** Friend user IDs to invite. */
    inviteUserIds: z.array(z.string().uuid()).default([]),
  })
  .refine(
    (data) =>
      !data.startTime || !data.endTime || data.endTime > data.startTime,
    { message: 'End time must be after start time.', path: ['endTime'] },
  );

export const updateHangoutSchema = z
  .object({
    title: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    startTime: z.string().datetime().nullable().optional(),
    endTime: z.string().datetime().nullable().optional(),
    locationName: z.string().trim().max(100).nullable().optional(),
    locationAddress: z.string().trim().max(200).nullable().optional(),
    status: z
      .enum(['planning', 'scheduled', 'in_progress', 'completed', 'cancelled'])
      .optional(),
  })
  .refine(
    (data) =>
      !data.startTime ||
      !data.endTime ||
      data.endTime === null ||
      data.startTime === null ||
      data.endTime > data.startTime,
    { message: 'End time must be after start time.', path: ['endTime'] },
  );

export type CreateHangoutInput = z.infer<typeof createHangoutSchema>;
export type UpdateHangoutInput = z.infer<typeof updateHangoutSchema>;

export const inviteParticipantsSchema = z.object({
  hangoutId: z.string().uuid(),
  userIds: z.array(z.string().uuid()).min(1, 'Pick at least one friend.'),
});

export type InviteParticipantsInput = z.infer<typeof inviteParticipantsSchema>;

export const updateParticipantSchema = z.object({
  hangoutId: z.string().uuid(),
  userId: z.string().uuid(),
  /** Self can update status (RSVP) and notifications_muted. Host can update role + vote_weight. */
  status: z.enum(['invited', 'accepted', 'declined', 'maybe', 'removed']).optional(),
  role: z.enum(['host', 'co_host', 'guest']).optional(),
  voteWeight: z.number().min(0.5).max(3.0).optional(),
  notificationsMuted: z.boolean().optional(),
});

export type UpdateParticipantInput = z.infer<typeof updateParticipantSchema>;
