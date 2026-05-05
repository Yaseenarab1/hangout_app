import { create } from 'zustand';
import { nanoid } from 'nanoid/non-secure';

/**
 * Centralized UI state — toasts in particular.
 * Any code can call `useUIStore.getState().toast.success('...')` from a non-component
 * context (services, hooks, etc.) without prop-drilling a toast handler.
 */

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export type Toast = {
  id: string;
  kind: ToastKind;
  message: string;
  durationMs: number;
};

type UIStore = {
  toasts: Toast[];
  toast: {
    success: (message: string, durationMs?: number) => void;
    error: (message: string, durationMs?: number) => void;
    info: (message: string, durationMs?: number) => void;
    warning: (message: string, durationMs?: number) => void;
  };
  dismissToast: (id: string) => void;
  dismissAll: () => void;
};

const DEFAULT_DURATIONS: Record<ToastKind, number> = {
  success: 2500,
  error: 4000,
  info: 3000,
  warning: 4000,
};

export const useUIStore = create<UIStore>((set) => {
  const push = (kind: ToastKind, message: string, durationMs?: number): void => {
    const toast: Toast = {
      id: nanoid(),
      kind,
      message,
      durationMs: durationMs ?? DEFAULT_DURATIONS[kind],
    };
    set((state) => ({ toasts: [...state.toasts, toast] }));
  };

  return {
    toasts: [],
    toast: {
      success: (message, ms) => push('success', message, ms),
      error: (message, ms) => push('error', message, ms),
      info: (message, ms) => push('info', message, ms),
      warning: (message, ms) => push('warning', message, ms),
    },
    dismissToast: (id) =>
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
    dismissAll: () => set({ toasts: [] }),
  };
});

// Non-hook accessor for service-layer code
export const toast = {
  success: (m: string, ms?: number): void => useUIStore.getState().toast.success(m, ms),
  error: (m: string, ms?: number): void => useUIStore.getState().toast.error(m, ms),
  info: (m: string, ms?: number): void => useUIStore.getState().toast.info(m, ms),
  warning: (m: string, ms?: number): void => useUIStore.getState().toast.warning(m, ms),
};
