export type SplitMethod = 'equal' | 'percent' | 'exact' | 'shares';

export type BillShare = {
  id: string;
  bill_id: string;
  user_id: string;
  amount_cents: number;
  split_method: SplitMethod;
  weight: number | null;
  settled_at: string | null;
  settled_by: string | null;
  settle_note: string | null;
  created_at: string;
  // hydrated
  user?: { id: string; display_name: string; avatar_url: string | null };
};

export type Bill = {
  id: string;
  hangout_id: string;
  payer_id: string;
  amount_cents: number;
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
