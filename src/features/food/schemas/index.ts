import { z } from 'zod';

const cuisineOptionSchema = z.object({
  label: z.string().trim().min(1).max(100),
  catalogId: z.string().optional(),
  emoji: z.string().optional(),
});

const restaurantOptionSchema = z.object({
  name: z.string().trim().min(1).max(200),
  address: z.string().optional().nullable(),
  placeId: z.string().optional(),
  rating: z.number().nullable().optional(),
  priceLevel: z.number().int().min(0).max(4).nullable().optional(),
  primaryType: z.string().nullable().optional(),
  mapsUrl: z.string().nullable().optional(),
  isCustom: z.boolean().optional(),
});

export const createFoodHangoutSchema = z
  .object({
    hangout: z.object({
      title: z.string().trim().min(1).max(100),
      description: z.string().trim().max(500).optional(),
      startTime: z.string().datetime().optional(),
      locationName: z.string().trim().max(100).optional(),
      locationAddress: z.string().trim().max(200).optional(),
      inviteUserIds: z.array(z.string().uuid()).default([]),
    }),
    flow: z.enum(['cuisine_only', 'cuisine_then_restaurant', 'restaurant_only']),
    votingMethod: z.enum(['simple', 'ranked']).default('simple'),
    voteDeadline: z.string().datetime(),
    cuisineOptions: z.array(cuisineOptionSchema).optional(),
    restaurantOptions: z.array(restaurantOptionSchema).optional(),
  })
  .refine(
    (data) => {
      if (data.flow === 'restaurant_only') {
        return (data.restaurantOptions?.length ?? 0) >= 2;
      }
      return (data.cuisineOptions?.length ?? 0) >= 2;
    },
    {
      message: 'Add at least 2 options to vote on.',
      path: ['cuisineOptions'],
    },
  );

export type CreateFoodHangoutInput = z.infer<typeof createFoodHangoutSchema>;

export const createRestaurantPollSchema = z.object({
  hangoutId: z.string().uuid(),
  voteDeadline: z.string().datetime(),
  votingMethod: z.enum(['simple', 'ranked']).optional(),
  options: z.array(restaurantOptionSchema).min(2, 'Pick at least 2 restaurants.'),
});

export type CreateRestaurantPollInput = z.infer<typeof createRestaurantPollSchema>;
