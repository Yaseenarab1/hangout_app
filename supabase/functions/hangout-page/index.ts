// supabase/functions/hangout-page/index.ts
//
// Partiful-style public hangout page. Anyone with the link can RSVP.
// GET  ?token=TOKEN         → render hangout page
// POST form submission      → upsert web RSVP, redirect back with success

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#09090b;color:#fafafa;min-height:100vh}
.hero{background:#18181b;padding:32px 20px 24px;border-bottom:1px solid #27272a}
.hero h1{font-size:24px;font-weight:800;margin-bottom:4px}
.hero .host{font-size:14px;color:#a1a1aa;margin-bottom:16px}
.meta{display:flex;flex-direction:column;gap:6px}
.meta-row{display:flex;align-items:center;gap:8px;font-size:14px;color:#d4d4d8}
.wrap{max-width:480px;margin:0 auto}
.section{padding:20px}
.section h2{font-size:16px;font-weight:700;margin-bottom:12px}
.rsvp-form{background:#18181b;border:1px solid #27272a;border-radius:14px;padding:16px;margin-bottom:16px}
.rsvp-form h2{margin-bottom:12px}
input[type=text]{width:100%;padding:10px 12px;background:#09090b;border:1px solid #3f3f46;border-radius:8px;color:#fafafa;font-size:15px;font-family:inherit}
.status-btns{display:flex;gap:8px;margin-top:12px}
.status-btn{flex:1;padding:10px;border-radius:10px;border:1px solid #3f3f46;background:transparent;color:#a1a1aa;font-size:14px;font-weight:600;cursor:pointer}
.status-btn:focus,.status-btn:active,.status-btn.selected{background:#8b5cf6;border-color:#8b5cf6;color:#fff}
button[type=submit]{width:100%;margin-top:12px;padding:12px;background:#8b5cf6;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer}
.attendee{display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid #27272a;font-size:14px}
.attendee:first-child{border-top:none}
.avatar{width:32px;height:32px;border-radius:50%;background:#27272a;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#a1a1aa;flex-shrink:0;overflow:hidden}
.avatar img{width:32px;height:32px;object-fit:cover}
.badge{padding:2px 7px;border-radius:20px;font-size:11px;font-weight:600}
.going{background:#16a34a22;color:#4ade80;border:1px solid #16a34a}
.maybe{background:#d9770622;color:#fb923c;border:1px solid #d97706}
.not-going{background:#ef444422;color:#f87171;border:1px solid #ef4444}
.msg{padding:14px;border-radius:10px;font-size:14px;margin-bottom:16px}
.msg-success{background:#16a34a22;border:1px solid #16a34a;color:#4ade80}
.cover{width:100%;height:200px;object-fit:cover;display:block}
.open-app{display:block;text-align:center;margin-top:24px;color:#8b5cf6;font-size:14px;font-weight:600;text-decoration:none}
`;

function htmlShell(title: string, body: string, ogImage?: string): string {
  const og = ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : '';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="You're invited! RSVP on Hangout Planner.">${og}<style>${CSS}</style></head><body><div class="wrap">${body}</div></body></html>`;
}

function statusLabel(s: string): string {
  if (s === 'going') return 'Going';
  if (s === 'maybe') return 'Maybe';
  return "Can't make it";
}

function statusClass(s: string): string {
  if (s === 'going') return 'going';
  if (s === 'maybe') return 'maybe';
  return 'not-going';
}

serve(async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return new Response(htmlShell('Invalid link', '<div style="padding:32px"><h1>Invalid link</h1></div>'), {
      status: 400, headers: { 'Content-Type': 'text/html' },
    });
  }

  // ── POST: RSVP submission ─────────────────────────────────────────────────
  if (req.method === 'POST') {
    const text = await req.text();
    const body = Object.fromEntries(new URLSearchParams(text));
    const { name, status } = body;

    if (!name?.trim() || !['going', 'maybe', 'not_going'].includes(status)) {
      return Response.redirect(`${url.origin}${url.pathname}?token=${token}&err=1`, 303);
    }

    // Validate token
    const { data: tokenRow } = await supabase
      .from('hangout_share_tokens')
      .select('hangout_id')
      .eq('token', token)
      .maybeSingle();

    if (!tokenRow) {
      return Response.redirect(`${url.origin}${url.pathname}?token=${token}&err=1`, 303);
    }

    await supabase.from('hangout_web_rsvps').insert({
      hangout_id: tokenRow.hangout_id,
      token,
      name: name.trim(),
      status,
    });

    return Response.redirect(`${url.origin}${url.pathname}?token=${token}&rsvpd=1`, 303);
  }

  // ── GET: render page ──────────────────────────────────────────────────────
  const { data: tokenRow } = await supabase
    .from('hangout_share_tokens')
    .select('hangout_id')
    .eq('token', token)
    .maybeSingle();

  if (!tokenRow) {
    return new Response(htmlShell('Invalid link', '<div style="padding:32px"><h1>This link is invalid or expired.</h1></div>'), {
      status: 404, headers: { 'Content-Type': 'text/html' },
    });
  }

  const hangoutId = tokenRow.hangout_id;

  const { data: hangout } = await supabase
    .from('hangouts')
    .select('id, title, description, cover_url, start_time, primary_location_name, primary_location_address')
    .eq('id', hangoutId)
    .maybeSingle();

  if (!hangout) {
    return new Response(htmlShell('Hangout not found', '<div style="padding:32px"><h1>Hangout not found.</h1></div>'), {
      status: 404, headers: { 'Content-Type': 'text/html' },
    });
  }

  // Fetch participants (app users)
  const { data: participants } = await supabase
    .from('hangout_participants')
    .select('status, profile:profiles(full_name, avatar_url)')
    .eq('hangout_id', hangoutId)
    .in('status', ['accepted', 'maybe']);

  // Fetch web RSVPs
  const { data: webRsvps } = await supabase
    .from('hangout_web_rsvps')
    .select('name, status')
    .eq('hangout_id', hangoutId);

  const rsvpd = url.searchParams.get('rsvpd') === '1';
  const err = url.searchParams.get('err') === '1';

  let html = '';

  // Hero
  if (hangout.cover_url) {
    html += `<img class="cover" src="${esc(hangout.cover_url)}" alt="Cover">`;
  }
  html += `<div class="hero"><h1>${esc(hangout.title)}</h1><div class="host">Hangout</div><div class="meta">`;
  if (hangout.start_time) {
    const d = new Date(hangout.start_time);
    html += `<div class="meta-row">📅 ${esc(d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}</div>`;
  }
  if (hangout.primary_location_name) {
    html += `<div class="meta-row">📍 ${esc(hangout.primary_location_name)}</div>`;
  }
  html += `</div></div>`;

  html += `<div class="section">`;

  if (rsvpd) {
    html += `<div class="msg msg-success">✓ You're in! See you there.</div>`;
  }
  if (err) {
    html += `<div class="msg" style="background:#ef444422;border:1px solid #ef4444;color:#f87171">Something went wrong. Please try again.</div>`;
  }

  // RSVP form (only if not already rsvpd in this session)
  if (!rsvpd) {
    html += `<div class="rsvp-form">
      <h2>RSVP</h2>
      <form method="POST">
        <input type="hidden" name="token" value="${esc(token)}">
        <input type="text" name="name" placeholder="Your name" required maxlength="100">
        <div class="status-btns">
          <button type="button" class="status-btn" onclick="pick(this,'going')">Going 🎉</button>
          <button type="button" class="status-btn" onclick="pick(this,'maybe')">Maybe 🤔</button>
          <button type="button" class="status-btn" onclick="pick(this,'not_going')">Can't 😢</button>
        </div>
        <input type="hidden" name="status" id="statusInput" value="">
        <button type="submit">Send RSVP</button>
      </form>
    </div>
    <script>
      function pick(btn,val){
        document.querySelectorAll('.status-btn').forEach(b=>b.classList.remove('selected'));
        btn.classList.add('selected');
        document.getElementById('statusInput').value=val;
      }
    </script>`;
  }

  // Who's going
  const going: string[] = [];
  const maybe: string[] = [];
  for (const p of participants ?? []) {
    const name = (p.profile as any)?.full_name ?? 'Someone';
    if (p.status === 'accepted') going.push(name);
    else maybe.push(name);
  }
  for (const r of webRsvps ?? []) {
    if (r.status === 'going') going.push(r.name);
    else if (r.status === 'maybe') maybe.push(r.name);
  }

  if (going.length > 0 || maybe.length > 0) {
    html += `<h2 style="margin-bottom:12px">${going.length} going · ${maybe.length} maybe</h2>`;
    const all = [
      ...going.map((n) => ({ name: n, status: 'going' })),
      ...maybe.map((n) => ({ name: n, status: 'maybe' })),
    ];
    for (const { name, status } of all) {
      const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
      html += `<div class="attendee"><div class="avatar">${esc(initials)}</div><span style="flex:1">${esc(name)}</span><span class="badge ${statusClass(status)}">${statusLabel(status)}</span></div>`;
    }
  }

  html += `<a class="open-app" href="hangoutplanner://hangout/${esc(hangoutId)}">Open in app →</a>`;
  html += `<p style="margin-top:12px;font-size:12px;color:#52525b;text-align:center">Powered by Hangout Planner</p>`;
  html += `</div>`;

  return new Response(htmlShell(hangout.title, html, hangout.cover_url), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});
