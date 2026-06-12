export type SplitMethod = 'equal' | 'percent' | 'exact' | 'shares';
export type BillMode = 'whole' | 'itemized';

export type BillShare = {
  id: string;
  bill_id: string;
  user_id: string | null;
  guest_participant_id: string | null;
  amount_cents: number;
  split_method: SplitMethod;
  weight: number | null;
  settled_at: string | null;
  settled_by: string | null;
  settle_note: string | null;
  created_at: string;
  // hydrated
  user?: { id: string; display_name: string; avatar_url: string | null };
  guest_name?: string;
};

export type StoredBillItem = {
  id: string;
  description: string;
  amount_cents: number;
  quantity: number;
  position: number;
};

export type Bill = {
  id: string;
  hangout_id: string | null;
  payer_id: string;
  mode: BillMode;
  amount_cents: number;
  subtotal_cents: number | null;
  tax_cents: number | null;
  tip_cents: number | null;
  currency: string;
  description: string;
  paid_at: string;
  receipt_storage_path: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  // hydrated
  payer?: { id: string; display_name: string; avatar_url: string | null };
  creator?: { id: string; display_name: string; avatar_url: string | null };
  shares?: BillShare[];
  receiptSignedUrl?: string;
  hangout?: { id: string; title: string };
  items?: StoredBillItem[];
};

export type UserBalance = {
  hangout_id: string;
  user_id: string;
  paid_cents: number;
  owed_cents: number;
  net_cents: number;
};

export type SimplifiedDebt = {
  from_user_id: string;
  to_user_id: string;
  amount_cents: number;
  from_user?: { id: string; display_name: string; avatar_url: string | null };
  to_user?: { id: string; display_name: string; avatar_url: string | null };
};

export type ShareInput = {
  user_id: string;
  amount_cents: number;
  split_method: SplitMethod;
  weight?: number;
};

export type CreateBillParams = {
  hangout_id: string;
  payer_id: string;
  amount_cents: number;
  description: string;
  paid_at?: string;
  receipt_storage_path?: string | null;
  shares: ShareInput[];
};

export const BILL_RECEIPT_BUCKET = 'bill-receipts';

// ── 3E: itemized bills ────────────────────────────────────────────────────────

export type BillItem = {
  id?: string;
  description: string;
  amount_cents: number;
  quantity: number;
  source: 'ocr' | 'manual';
  position?: number;
};

export type GuestParticipant = {
  id?: string;
  tempId: string;
  name: string;
};

export type BillParticipant =
  | { type: 'user'; id: string; display_name: string; avatar_url: string | null }
  | { type: 'guest'; tempId: string; name: string };

export type BillDraft = {
  billId?: string;
  mode: BillMode;
  hangoutId?: string;
  payerId: string;
  description: string;
  paidAt: string;
  items: BillItem[];
  taxCents: number;
  tipCents: number;
  participants: BillParticipant[];
  // itemKey (index as string) → participantKey → weight
  assignments: Record<string, Record<string, number>>;
};

export type ParsedReceiptResult = {
  items: { description: string; amount_cents: number; quantity: number; position: number }[];
  subtotalCents: number | null;
  taxCents: number | null;
  tipCents: number | null;
  totalCents: number | null;
  confidence: 'high' | 'medium' | 'low';
  rawText: string;
};

export type CreateItemizedBillParams = {
  hangout_id?: string;
  payer_id: string;
  description: string;
  paid_at?: string;
  tax_cents: number;
  tip_cents: number;
  items: BillItem[];
  // participantKey → amount_cents
  shares: Array<{ user_id?: string; guest_name?: string; amount_cents: number }>;
};
