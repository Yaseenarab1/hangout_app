import React, { createContext, useContext, useState } from 'react';
import type { BillDraft, BillItem, BillParticipant } from '../types';
import { useSession } from '@/features/auth';

type BillDraftContextValue = {
  draft: BillDraft;
  setField: <K extends keyof BillDraft>(key: K, value: BillDraft[K]) => void;
  resetDraft: (partial?: Partial<BillDraft>) => void;
  setItems: (items: BillItem[]) => void;
  setParticipants: (participants: BillParticipant[]) => void;
  setAssignment: (itemKey: string, participantKey: string, weight: number) => void;
  clearAssignment: (itemKey: string, participantKey: string) => void;
  setItemAssignees: (itemKey: string, assignees: Record<string, number>) => void;
};

const BillDraftContext = createContext<BillDraftContextValue | null>(null);

function makeFreshDraft(payerId: string): BillDraft {
  return {
    mode: 'itemized',
    hangoutId: undefined,
    payerId,
    description: '',
    paidAt: new Date().toISOString(),
    items: [],
    taxCents: 0,
    tipCents: 0,
    participants: [],
    assignments: {},
  };
}

export function BillDraftProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const [draft, setDraft] = useState<BillDraft>(() => makeFreshDraft(user?.id ?? ''));

  function setField<K extends keyof BillDraft>(key: K, value: BillDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function resetDraft(partial?: Partial<BillDraft>) {
    setDraft({ ...makeFreshDraft(user?.id ?? ''), ...partial });
  }

  function setItems(items: BillItem[]) {
    setDraft((prev) => ({ ...prev, items }));
  }

  function setParticipants(participants: BillParticipant[]) {
    setDraft((prev) => ({ ...prev, participants }));
  }

  function setAssignment(itemKey: string, participantKey: string, weight: number) {
    setDraft((prev) => ({
      ...prev,
      assignments: {
        ...prev.assignments,
        [itemKey]: {
          ...(prev.assignments[itemKey] ?? {}),
          [participantKey]: weight,
        },
      },
    }));
  }

  function clearAssignment(itemKey: string, participantKey: string) {
    setDraft((prev) => {
      const itemAssigns = { ...(prev.assignments[itemKey] ?? {}) };
      delete itemAssigns[participantKey];
      return {
        ...prev,
        assignments: { ...prev.assignments, [itemKey]: itemAssigns },
      };
    });
  }

  function setItemAssignees(itemKey: string, assignees: Record<string, number>) {
    setDraft((prev) => ({
      ...prev,
      assignments: { ...prev.assignments, [itemKey]: assignees },
    }));
  }

  return (
    <BillDraftContext.Provider
      value={{ draft, setField, resetDraft, setItems, setParticipants, setAssignment, clearAssignment, setItemAssignees }}
    >
      {children}
    </BillDraftContext.Provider>
  );
}

export function useBillDraft(): BillDraftContextValue {
  const ctx = useContext(BillDraftContext);
  if (!ctx) throw new Error('useBillDraft must be used inside BillDraftProvider');
  return ctx;
}
