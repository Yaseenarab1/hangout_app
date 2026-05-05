import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { friendlyErrorMessage, logError } from '@/services/errors';
import { toast } from '@/stores/ui.store';
import { hangoutKeys } from '@/features/hangouts';
import { pollKeys } from '@/features/polls';
import {
  createFoodHangout,
  createRestaurantPoll,
  listMyCustomRestaurants,
  saveCustomRestaurant,
  deleteCustomRestaurant,
  type UserCustomRestaurant,
} from '../services/food.service';
import type {
  CreateFoodHangoutInput,
  CreateRestaurantPollInput,
} from '../schemas';

const customRestaurantKeys = {
  list: ['customRestaurants', 'list'] as const,
};

export function useCreateFoodHangout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFoodHangoutInput) => createFoodHangout(input),
    onSuccess: ({ hangoutId }) => {
      qc.invalidateQueries({ queryKey: hangoutKeys.list() });
      qc.invalidateQueries({ queryKey: hangoutKeys.detail(hangoutId) });
      qc.invalidateQueries({ queryKey: pollKeys.byHangout(hangoutId) });
      toast.success('Hangout created!');
    },
    onError: (error) => {
      logError(error, { where: 'createFoodHangout' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useCreateRestaurantPoll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRestaurantPollInput) => createRestaurantPoll(input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: pollKeys.byHangout(vars.hangoutId) });
      qc.invalidateQueries({ queryKey: hangoutKeys.detail(vars.hangoutId) });
      toast.success('Restaurant poll started.');
    },
    onError: (error) => {
      logError(error, { where: 'createRestaurantPoll' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export function useMyCustomRestaurants() {
  return useQuery({
    queryKey: customRestaurantKeys.list,
    queryFn: listMyCustomRestaurants,
    staleTime: 60 * 1000,
  });
}

export function useSaveCustomRestaurant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveCustomRestaurant,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customRestaurantKeys.list });
    },
    onError: (error) => {
      logError(error, { where: 'saveCustomRestaurant' });
    },
  });
}

export function useDeleteCustomRestaurant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCustomRestaurant(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customRestaurantKeys.list });
    },
    onError: (error) => {
      logError(error, { where: 'deleteCustomRestaurant' });
      toast.error(friendlyErrorMessage(error));
    },
  });
}

export type { UserCustomRestaurant };
