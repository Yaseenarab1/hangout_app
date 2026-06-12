import { supabase } from '@/services/supabase/client';
import { invokeFn } from '@/services/supabase/invoke';
import type {
  Bill,
  BillShare,
  UserBalance,
  CreateBillParams,
  CreateItemizedBillParams,
  ParsedReceiptResult,
} from '../types';
import { BILL_RECEIPT_BUCKET } from '../types';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

const db = () => supabase as any;

const BILL_SELECT = `
  id, hangout_id, payer_id, amount_cents, currency, description, mode,
  paid_at, receipt_storage_path, created_by, created_at, updated_at,
  voided_at, voided_by, void_reason,
  payer:profiles!bills_payer_id_fkey(id, display_name, avatar_url),
  creator:profiles!bills_created_by_fkey(id, display_name, avatar_url)
`;

const SHARE_SELECT = `
  id, bill_id, user_id, guest_participant_id, amount_cents, split_method, weight,
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

  // Fetch items for itemized bills
  if (b.mode === 'itemized') {
    const { data: items } = await db()
      .from('bill_items')
      .select('id, description, amount_cents, quantity, position')
      .eq('bill_id', billId)
      .order('position', { ascending: true });
    b.items = (items ?? []) as Bill['items'];
  }

  // Fetch guest participants and attach names to shares
  const { data: guests } = await db()
    .from('bill_guest_participants')
    .select('id, name')
    .eq('bill_id', billId);
  if (guests && guests.length > 0) {
    const guestMap = new Map<string, string>(
      (guests as { id: string; name: string }[]).map((g) => [g.id, g.name]),
    );
    for (const share of b.shares ?? []) {
      if (share.guest_participant_id) {
        share.guest_name = guestMap.get(share.guest_participant_id) ?? 'Guest';
      }
    }
  }

  // Fetch hangout title if linked
  if (b.hangout_id) {
    const { data: hangout } = await db()
      .from('hangouts')
      .select('id, title')
      .eq('id', b.hangout_id)
      .maybeSingle();
    if (hangout) b.hangout = { id: hangout.id, title: hangout.title };
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
      hangout_id: params.hangout_id || null,
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

export async function scanReceiptImage(imageBase64: string): Promise<ParsedReceiptResult> {
  return invokeFn<ParsedReceiptResult>('scan-receipt', { imageBase64 });
}

export interface CrossHangoutBalance {
  other_user_id: string;
  display_name: string;
  avatar_url: string | null;
  username: string;
  net_cents: number; // positive = they owe you, negative = you owe them
}

export async function fetchCrossHangoutBalances(): Promise<CrossHangoutBalance[]> {
  const { data, error } = await (supabase as any).rpc('get_cross_hangout_balances');
  if (error) throw error;
  return (data ?? []) as CrossHangoutBalance[];
}

export async function fetchMyBills(): Promise<Bill[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  // All bills where I'm the payer or creator (hangout + standalone)
  const { data: payerBills, error: e1 } = await db()
    .from('bills')
    .select(BILL_SELECT + ', hangout:hangouts!bills_hangout_id_fkey(id, title)')
    .or(`payer_id.eq.${auth.user.id},created_by.eq.${auth.user.id}`)
    .is('voided_at', null)
    .order('paid_at', { ascending: false })
    .limit(50);
  if (e1) throw e1;

  // Bills where I have a share but I'm not the payer/creator
  const { data: shareRows, error: e2 } = await db()
    .from('bill_shares')
    .select('bill_id')
    .eq('user_id', auth.user.id);
  if (e2) throw e2;

  const sharedBillIds = (shareRows ?? [])
    .map((r: { bill_id: string }) => r.bill_id)
    .filter(
      (id: string) =>
        !(payerBills ?? []).some((b: { id: string }) => b.id === id),
    );

  let sharedBills: Bill[] = [];
  if (sharedBillIds.length > 0) {
    const { data: shared, error: e3 } = await db()
      .from('bills')
      .select(BILL_SELECT + ', hangout:hangouts!bills_hangout_id_fkey(id, title)')
      .in('id', sharedBillIds)
      .is('voided_at', null)
      .order('paid_at', { ascending: false });
    if (e3) throw e3;
    sharedBills = (shared ?? []) as Bill[];
  }

  const all = [...(payerBills ?? []), ...sharedBills] as Bill[];
  all.sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());
  return all.slice(0, 80);
}

export async function createItemizedBill(params: CreateItemizedBillParams): Promise<Bill> {
  const subtotalCents = params.items.reduce(
    (s, i) => s + i.amount_cents * i.quantity,
    0,
  );
  const totalCents = subtotalCents + params.tax_cents + params.tip_cents;

  const sharesPayload = params.shares.map((s) => ({
    user_id: s.user_id ?? null,
    guest_name: s.guest_name ?? null,
    amount_cents: s.amount_cents,
  }));

  const itemsPayload = params.items.map((item, i) => ({
    description: item.description,
    amount_cents: item.amount_cents,
    quantity: item.quantity,
    source: item.source ?? 'manual',
    position: item.position ?? i,
  }));

  const { data: billId, error: rpcError } = await (supabase as any).rpc(
    'rpc_create_itemized_bill',
    {
      p_hangout_id: params.hangout_id || null,
      p_payer_id: params.payer_id,
      p_amount_cents: totalCents,
      p_subtotal_cents: subtotalCents,
      p_tax_cents: params.tax_cents,
      p_tip_cents: params.tip_cents,
      p_description: params.description,
      p_paid_at: params.paid_at ?? new Date().toISOString(),
      p_shares: sharesPayload,
      p_items: itemsPayload,
    },
  );

  if (rpcError) throw rpcError;

  return fetchBill(billId as string);
}
