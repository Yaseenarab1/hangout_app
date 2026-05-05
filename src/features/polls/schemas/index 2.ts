import { z } from 'zod';

const optionLabelSchema = z
  .string()
  .trim()
  .min(1, 'Option needs a label.')
  .max(100, 'Option label too long.');

export const createActivityPollSchema = z
  .object({
    title: z.string().trim().min(1).max(100).optional(),
    mode: z.enum(['simple_vote', 'suggest_then_vote']),
    /** 'simple' = one option per voter, 'ranked' = IRV with ranked options */
    votingMethod: z.enum(['simple', 'ranked']).default('simple'),
    voteDeadline: z.string().datetime(),
    suggestDeadline: z.string().datetime().optional(),
    options: z
      .array(
        z.object({
          label: optionLabelSchema,
          catalogId: z.string().optional(),
          emoji: z.string().optional(),
        }),
      )
      .default([]),
  })
  .refine(
    (data) => data.mode === 'suggest_then_vote' || data.options.length >= 2,
    { message: 'Add at least 2 options to vote on.', path: ['options'] },
  )
  .refine(
    (data) =>
      data.mode === 'simple_vote' ||
      (data.suggestDeadline && data.suggestDeadline < data.voteDeadline),
    { message: 'Suggest deadline must be before vote deadline.', path: ['suggestDeadline'] },
  );

export type CreateActivityPollInput = z.infer<typeof createActivityPollSchema>;

export const createActivityHangoutSchema = z.object({
  hangout: z.object({
    title: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).optional(),
    startTime: z.string().datetime().optional(),
    locationName: z.string().trim().max(100).optional(),
    locationAddress: z.string().trim().max(200).optional(),
    inviteUserIds: z.array(z.string().uuid()).default([]),
  }),
  poll: createActivityPollSchema.nullable(),
});

export type CreateActivityHangoutInput = z.infer<typeof createActivityHangoutSchema>;

export const voteSchema = z.object({
  pollId: z.string().uuid(),
  optionId: z.string().uuid(),
});

export type VoteInput = z.infer<typeof voteSchema>;

export const castRankedVoteSchema = z.object({
  pollId: z.string().uuid(),
  /** Option IDs in rank order. Index 0 = first choice. May be partial. */
  rankedOptionIds: z.array(z.string().uuid()),
});

export type CastRankedVoteInput = z.infer<typeof castRankedVoteSchema>;

export const addOptionSchema = z.object({
  pollId: z.string().uuid(),
  label: optionLabelSchema,
  emoji: z.string().optional(),
});

export type AddOptionInput = z.infer<typeof addOptionSchema>;
