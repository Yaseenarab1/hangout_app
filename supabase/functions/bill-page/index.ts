// supabase/functions/bill-page/index.ts
//
// Serves a shareable HTML bill breakdown page.
// GET  ?token=TOKEN            → full bill overview
// GET  ?token=TOKEN&share=ID  → personalized view with pay/dispute actions
// POST body { token, shareId, action: 'pay' | 'dispute', itemId?, reason? }

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cents(n: number): string {
  return '$' + (n / 100).toFixed(2);
}

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#09090b;color:#fafafa;padding:0;min-height:100vh}
.wrap{max-width:480px;margin:0 auto;padding:24px 16px 48px}
h1{font-size:22px;font-weight:700;margin-bottom:4px}
.sub{color:#a1a1aa;font-size:14px;margin-bottom:24px}
.card{background:#18181b;border:1px solid #27272a;border-radius:14px;padding:16px;margin-bottom:12px}
.card h2{font-size:15px;font-weight:600;margin-bottom:12px}
.row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-top:1px solid #27272a;font-size:14px}
.row:first-child{border-top:none}
.row .name{color:#a1a1aa}
.total-row{font-weight:700;font-size:16px;padding-top:12px;border-top:1px solid #3f3f46;margin-top:4px}
.badge{display:inline-block;padding:3px 8px;border-radius:20px;font-size:12px;font-weight:600}
.badge-green{background:#16a34a22;color:#4ade80;border:1px solid #16a34a}
.badge-orange{background:#d9770622;color:#fb923c;border:1px solid #d97706}
.person-card{background:#18181b;border:1px solid #27272a;border-radius:14px;padding:16px;margin-bottom:12px}
.person-name{font-size:17px;font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:8px}
.actions{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}
button,a.btn{padding:10px 18px;border-radius:10px;border:none;font-size:14px;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block}
.btn-primary{background:#8b5cf6;color:#fff}
.btn-outline{background:transparent;border:1px solid #3f3f46;color:#a1a1aa}
.btn-danger{background:transparent;border:1px solid #ef4444;color:#ef4444}
form{margin-top:12px}
input,textarea{width:100%;padding:10px 12px;background:#09090b;border:1px solid #3f3f46;border-radius:8px;color:#fafafa;font-size:14px;margin-top:6px;font-family:inherit}
label{font-size:13px;color:#a1a1aa}
.msg{padding:14px;border-radius:10px;font-size:14px;margin-bottom:16px}
.msg-success{background:#16a34a22;border:1px solid #16a34a;color:#4ade80}
.msg-error{background:#ef444422;border:1px solid #ef4444;color:#f87171}
`;

function htmlShell(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${CSS}</style></head><body><div class="wrap">${body}</div></body></html>`;
}

serve(async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const shareParam = url.searchParams.get('share');

  if (!token) {
    return new Response(htmlShell('Invalid link', '<h1>Invalid link</h1><p class="sub">This link is missing required information.</p>'), {
      status: 400, headers: { 'Content-Type': 'text/html' },
    });
  }

  // ── POST: handle actions ──────────────────────────────────────────────────
  if (req.method === 'POST') {
    let body: Record<string, string> = {};
    try {
      const text = await req.text();
      body = Object.fromEntries(new URLSearchParams(text));
    } catch { /* ignore */ }

    const { token: bodyToken, shareId, action, itemId, reason, name } = body;
    const tok = bodyToken ?? token;

    // Validate token
    const { data: tokenRow } = await supabase.from('bill_share_tokens').select('bill_id, expires_at').eq('token', tok).maybeSingle();
    if (!tokenRow || new Date(tokenRow.expires_at) < new Date()) {
      return new Response(htmlShell('Link expired', '<h1>Link expired</h1>'), { status: 410, headers: { 'Content-Type': 'text/html' } });
    }

    if (action === 'pay' && shareId) {
      await supabase.from('bill_shares').update({ settled_at: new Date().toISOString() }).eq('id', shareId).eq('bill_id', tokenRow.bill_id);
      return Response.redirect(`${url.origin}${url.pathname}?token=${tok}&share=${shareId}&paid=1`, 303);
    }

    if (action === 'dispute' && shareId) {
      await supabase.from('bill_item_disputes').insert({
        bill_id: tokenRow.bill_id,
        item_id: itemId ?? null,
        share_id: shareId,
        name: name ?? 'Anonymous',
        reason: reason ?? null,
      });
      return Response.redirect(`${url.origin}${url.pathname}?token=${tok}&share=${shareId}&disputed=1`, 303);
    }

    return Response.redirect(`${url.origin}${url.pathname}?token=${tok}`, 303);
  }

  // ── GET: render page ──────────────────────────────────────────────────────
  const { data: tokenRow } = await supabase
    .from('bill_share_tokens')
    .select('bill_id, expires_at')
    .eq('token', token)
    .maybeSingle();

  if (!tokenRow || new Date(tokenRow.expires_at) < new Date()) {
    return new Response(htmlShell('Link expired', '<h1>This link has expired.</h1><p class="sub">Ask the bill creator for a new one.</p>'), {
      status: 410, headers: { 'Content-Type': 'text/html' },
    });
  }

  const billId = tokenRow.bill_id;
  const paid = url.searchParams.get('paid') === '1';
  const disputed = url.searchParams.get('disputed') === '1';

  // Fetch bill
  const { data: bill } = await supabase
    .from('bills')
    .select('id, title, total_cents, status, created_at, note')
    .eq('id', billId)
    .maybeSingle();

  if (!bill) {
    return new Response(htmlShell('Bill not found', '<h1>Bill not found.</h1>'), { status: 404, headers: { 'Content-Type': 'text/html' } });
  }

  // Fetch items
  const { data: items } = await supabase
    .from('bill_items')
    .select('id, description, quantity, amount_cents')
    .eq('bill_id', billId)
    .order('created_at');

  // Fetch shares with profile info
  const { data: shares } = await supabase
    .from('bill_shares')
    .select('id, user_id, amount_cents, settled_at, profile:profiles(full_name)')
    .eq('bill_id', billId);

  // Fetch item assignments for the bill
  const { data: assignments } = await supabase
    .from('bill_item_assignments')
    .select('item_id, share_id')
    .in('item_id', (items ?? []).map((i: any) => i.id));

  // Build per-share item map
  const shareItemMap = new Map<string, string[]>();
  for (const a of assignments ?? []) {
    const arr = shareItemMap.get(a.share_id) ?? [];
    arr.push(a.item_id);
    shareItemMap.set(a.share_id, arr);
  }

  const isWhole = !items || items.length === 0;
  const activeShareId = shareParam;

  // ── Build HTML ─────────────────────────────────────────────────────────────
  let html = '';

  if (paid) html += `<div class="msg msg-success">✓ Marked as paid!</div>`;
  if (disputed) html += `<div class="msg msg-success">Dispute sent — the bill creator will be notified.</div>`;

  html += `<h1>${esc(bill.title)}</h1>`;
  html += `<p class="sub">Total: ${cents(bill.total_cents)}</p>`;

  // Item breakdown (if itemized)
  if (!isWhole && items && items.length > 0) {
    html += `<div class="card"><h2>Items</h2>`;
    for (const item of items) {
      html += `<div class="row"><span>${esc(item.description)}${item.quantity > 1 ? ` ×${item.quantity}` : ''}</span><span>${cents(item.amount_cents)}</span></div>`;
    }
    html += `</div>`;
  }

  // Per-person breakdown
  html += `<div class="card"><h2>Who owes what</h2>`;
  for (const share of shares ?? []) {
    const name = (share.profile as any)?.full_name ?? 'Guest';
    const isPaid = !!share.settled_at;
    html += `<div class="row"><span>${esc(name)} <span class="badge ${isPaid ? 'badge-green' : 'badge-orange'}">${isPaid ? 'Paid' : 'Owes'}</span></span><span>${cents(share.amount_cents)}</span></div>`;
  }
  html += `<div class="row total-row"><span>Total</span><span>${cents(bill.total_cents)}</span></div>`;
  html += `</div>`;

  // Personalized section (when share param is present)
  if (activeShareId) {
    const myShare = (shares ?? []).find((s: any) => s.id === activeShareId);
    if (myShare) {
      const myName = (myShare.profile as any)?.full_name ?? 'You';
      const myItems = !isWhole && items
        ? items.filter((item: any) => shareItemMap.get(myShare.id)?.includes(item.id))
        : [];

      html += `<div class="person-card">`;
      html += `<div class="person-name">${esc(myName)} <span class="badge ${myShare.settled_at ? 'badge-green' : 'badge-orange'}">${myShare.settled_at ? 'Paid' : 'Owes ' + cents(myShare.amount_cents)}</span></div>`;

      if (myItems.length > 0) {
        for (const item of myItems) {
          html += `<div class="row"><span>${esc(item.description)}</span><span>${cents(item.amount_cents)}</span></div>`;
        }
      }

      html += `<div class="actions">`;
      if (!myShare.settled_at) {
        html += `<form method="POST" style="display:inline">
          <input type="hidden" name="token" value="${esc(token)}">
          <input type="hidden" name="shareId" value="${esc(myShare.id)}">
          <input type="hidden" name="action" value="pay">
          <button class="btn-primary" type="submit">I've paid ✓</button>
        </form>`;
      }

      if (!isWhole && myItems.length > 0) {
        html += `<details style="width:100%;margin-top:8px">
          <summary style="cursor:pointer;color:#a1a1aa;font-size:14px">Dispute an item</summary>
          <form method="POST" style="margin-top:12px">
            <input type="hidden" name="token" value="${esc(token)}">
            <input type="hidden" name="shareId" value="${esc(myShare.id)}">
            <input type="hidden" name="action" value="dispute">
            <label>Which item?
              <select name="itemId" style="width:100%;padding:10px;background:#09090b;border:1px solid #3f3f46;border-radius:8px;color:#fafafa;margin-top:6px;font-size:14px">
                ${myItems.map((i: any) => `<option value="${esc(i.id)}">${esc(i.description)}</option>`).join('')}
              </select>
            </label>
            <label style="margin-top:10px;display:block">Your name<input type="text" name="name" placeholder="${esc(myName)}" value="${esc(myName)}"></label>
            <label style="margin-top:10px;display:block">Reason (optional)<input type="text" name="reason" placeholder="I didn't have this…"></label>
            <button class="btn-danger" type="submit" style="margin-top:12px">Send dispute</button>
          </form>
        </details>`;
      }

      html += `</div></div>`;
    }
  } else {
    // No share param — show each person with a "This is my row" link
    html += `<p style="font-size:13px;color:#71717a;margin-bottom:12px">Tap your name to mark as paid or dispute an item.</p>`;
    for (const share of shares ?? []) {
      const name = (share.profile as any)?.full_name ?? 'Guest';
      html += `<a class="btn btn-outline" style="display:block;margin-bottom:8px;text-align:center" href="?token=${encodeURIComponent(token)}&share=${encodeURIComponent(share.id)}">I'm ${esc(name)}</a>`;
    }
  }

  html += `<p style="margin-top:24px;font-size:12px;color:#52525b;text-align:center">Powered by Hangout Planner</p>`;

  return new Response(htmlShell(bill.title, html), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});
