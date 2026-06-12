import React, { createContext, useContext, useState } from 'react';
import type { Bill, BillDraft, BillItem, BillParticipant } from '../types';
import { useSession } from '@/features/auth';

type BillDraftContextValue = {
  draft: BillDraft;
  setField: <K extends keyof BillDraft>(key: K, value: BillDraft[K]) => void;
  resetDraft: (partial?: Partial<BillDraft>) => void;
  loadFromBill: (bill: Bill) => void;
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

  function loadFromBill(bill: Bill) {
    const items: BillItem[] = (bill.items ?? []).map((item) => ({
      id: item.id,
      description: item.description,
      amount_cents: item.amount_cents,
      quantity: item.quantity,
      source: 'manual' as const,
      position: item.position,
    }));

    const seen = new Set<string>();
    const participants: BillParticipant[] = [];
    for (const s of bill.shares ?? []) {
      const key = s.user_id ?? `guest:${s.guest_participant_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (s.user_id) {
        participants.push({
          type: 'user',
          id: s.user_id,
          display_name: s.user?.display_name ?? 'Unknown',
          avatar_url: s.user?.avatar_url ?? null,
        });
      } else {
        participants.push({
          type: 'guest',
          tempId: `guest-${s.guest_participant_id ?? Date.now()}`,
          name: s.guest_name ?? 'Guest',
        });
      }
    }

    // Default: assign every item to every participant
    const assignments: Record<string, Record<string, number>> = {};
    items.forEach((_, i) => {
      const row: Record<string, number> = {};
      for (const p of participants) {
        const pKey = p.type === 'user' ? `user:${p.id}` : `guest:${p.tempId}`;
        row[pKey] = 1;
      }
      assignments[String(i)] = row;
    });

    setDraft({
      billId: bill.id,
      mode: 'itemized',
      hangoutId: bill.hangout_id ?? undefined,
      payerId: bill.payer_id,
      description: bill.description,
      paidAt: bill.paid_at,
      items,
      taxCents: bill.tax_cents ?? 0,
      tipCents: bill.tip_cents ?? 0,
      participants,
      assignments,
    });
  }

  return (
    <BillDraftContext.Provider
      value={{ draft, setField, resetDraft, loadFromBill, setItems, setParticipants, setAssignment, clearAssignment, setItemAssignees }}
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
