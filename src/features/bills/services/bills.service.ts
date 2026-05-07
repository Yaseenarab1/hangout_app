import { supabase } from '@/services/supabase/client';
import type { Bill, BillShare, UserBalance, CreateBillParams } from '../types';
import { BILL_RECEIPT_BUCKET } from '../types';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

const db = () => supabase as any;

const BILL_SELECT = `
  id, hangout_id, payer_id, amount_cents, currency, description,
  paid_at, receipt_storage_path, created_by, created_at, updated_at,
  voided_at, voided_by, void_reason,
  payer:profiles!bills_payer_id_fkey(id, display_name, avatar_url),
  creator:profiles!bills_created_by_fkey(id, display_name, avatar_url)
`;

const SHARE_SELECT = `
  id, bill_id, user_id, amount_cents, split_method, weight,
  settled_at, settled_by, settle_note, created_at,
  user:profiles!bill_shares_user_id_fkey(id, display_name, avatar_url)
`;

export async function fetchBills(hangoutId: string): Promise<Bill[]> {
  const { data, error } = await db()
    .from('bills')
    .select(BILL_SELECT)
    .eq('hangout_id', hangoutId)
    .order('paid_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Bill[];
}

export async function fetchBill(billId: string): Promise<Bill> {
  const { data: bill, error: billError } = await db()
    .from('bills')
    .select(BILL_SELECT)
    .eq('id', billId)
    .single();

  if (billError) throw billError;

  const { data: shares, error: sharesError } = await db()
    .from('bill_shares')
    .select(SHARE_SELECT)
    .eq('bill_id', billId)
    .order('amount_cents', { ascending: false });

  if (sharesError) throw sharesError;

  const b = bill as Bill;
  b.shares = (shares ?? []) as BillShare[];

  if (b.receipt_storage_path) {
    const { data: signed } = await supabase.storage
      .from(BILL_RECEIPT_BUCKET)
      .createSignedUrl(b.receipt_storage_path, 3600);
    if (signed?.signedUrl) b.receiptSignedUrl = signed.signedUrl;
  }

  return b;
}

export async function fetchBillShares(billId: string): Promise<BillShare[]> {
  const { data, error } = await db()
    .from('bill_shares')
    .select(SHARE_SELECT)
    .eq('bill_id', billId);
  if (error) throw error;
  return (data ?? []) as BillShare[];
}

export async function createBill(params: CreateBillParams): Promise<Bill> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const { data: bill, error: billError } = await db()
    .from('bills')
    .insert({
      hangout_id: params.hangout_id,
      payer_id: params.payer_id,
      amount_cents: params.amount_cents,
      description: params.description,
      paid_at: params.paid_at ?? new Date().toISOString(),
      receipt_storage_path: params.receipt_storage_path ?? null,
      created_by: auth.user.id,
    })
    .select(BILL_SELECT)
    .single();

  if (billError) throw billError;

  const shareRows = params.shares.map((s) => ({
    bill_id: (bill as any).id,
    user_id: s.user_id,
    amount_cents: s.amount_cents,
    split_method: s.split_method,
    weight: s.weight ?? null,
  }));

  const { error: sharesError } = await db()
    .from('bill_shares')
    .insert(shareRows);

  if (sharesError) throw sharesError;

  return bill as Bill;
}

export async function settleShare(
  shareId: string,
  note?: string,
): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const { error } = await db()
    .from('bill_shares')
    .update({
      settled_at: new Date().toISOString(),
      settled_by: auth.user.id,
      settle_note: note ?? null,
    })
    .eq('id', shareId);

  if (error) throw error;
}

export async function voidBill(billId: string, reason?: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const { error } = await db()
    .from('bills')
    .update({
      voided_at: new Date().toISOString(),
      voided_by: auth.user.id,
      void_reason: reason ?? null,
    })
    .eq('id', billId);

  if (error) throw error;
}

export async function fetchUserBalance(
  hangoutId: string,
  userId: string,
): Promise<UserBalance | null> {
  const { data, error } = await db()
    .from('v_user_balances')
    .select('hangout_id, user_id, paid_cents, owed_cents, net_cents')
    .eq('hangout_id', hangoutId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data as UserBalance | null;
}

export async function fetchHangoutBalances(hangoutId: string): Promise<UserBalance[]> {
  const { data, error } = await db()
    .from('v_user_balances')
    .select('hangout_id, user_id, paid_cents, owed_cents, net_cents')
    .eq('hangout_id', hangoutId);

  if (error) throw error;
  return (data ?? []) as UserBalance[];
}

export async function uploadReceipt(
  hangoutId: string,
  billId: string,
  localUri: string,
): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const photoId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const storagePath = `${hangoutId}/${billId}/${photoId}.jpg`;

  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const buffer = decode(base64);

  const { error } = await supabase.storage
    .from(BILL_RECEIPT_BUCKET)
    .upload(storagePath, buffer, { contentType: 'image/jpeg', upsert: false });

  if (error) throw error;
  return storagePath;
}
