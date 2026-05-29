// supabase/functions/availability-page/index.ts
//
// Web availability form — anyone with the link can fill in their free times.
// GET  ?id=SESSION_ID               → render the availability grid
// POST ?id=SESSION_ID  (form)       → save guest response, redirect with success
// POST ?id=SESSION_ID  (JSON)       → save response, return JSON (for future app use)

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtHour(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#09090b;color:#fafafa;min-height:100vh}
.wrap{max-width:520px;margin:0 auto;padding:0 0 40px}
.hero{background:#18181b;padding:28px 20px 20px;border-bottom:1px solid #27272a}
.hero h1{font-size:22px;font-weight:800;letter-spacing:-0.5px}
.hero p{font-size:13px;color:#a1a1aa;margin-top:6px;line-height:1.5}
.section{padding:20px}
.label{font-size:11px;font-weight:700;letter-spacing:.7px;color:#71717a;margin-bottom:10px;text-transform:uppercase}
input[type=text]{width:100%;background:#18181b;border:1.5px solid #27272a;border-radius:12px;padding:14px 16px;font-size:15px;color:#fafafa;outline:none;-webkit-appearance:none}
input[type=text]:focus{border-color:#8B5CF6}
input[type=text]::placeholder{color:#52525b}
.grid-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px}
.grid{display:grid;gap:3px;min-width:max-content}
.col-header{font-size:11px;font-weight:700;color:#a1a1aa;text-align:center;padding:0 2px 8px;white-space:nowrap}
.row-label{font-size:10px;color:#52525b;text-align:right;padding-right:8px;line-height:32px;white-space:nowrap;min-width:44px}
.slot{width:48px;height:32px;border-radius:6px;background:#27272a;border:none;cursor:pointer;transition:background .12s}
.slot:hover{background:#3f3f46}
.slot.selected{background:#8B5CF6}
.slot-wrap{display:contents}
.who-bar{margin-top:2px;display:flex;gap:2px;align-items:center;justify-content:center}
.who-dot{width:6px;height:6px;border-radius:3px;background:#22c55e;opacity:.7}
.submit-btn{display:block;width:100%;background:#8B5CF6;color:#fff;border:none;border-radius:14px;padding:16px;font-size:16px;font-weight:700;cursor:pointer;margin-top:4px;-webkit-appearance:none}
.submit-btn:active{opacity:.85}
.success{text-align:center;padding:48px 24px}
.success .icon{font-size:56px;margin-bottom:16px}
.success h2{font-size:22px;font-weight:800;margin-bottom:8px}
.success p{font-size:14px;color:#a1a1aa;line-height:1.6}
.responses-section{margin-top:8px}
.resp-chip{display:inline-flex;align-items:center;gap:6px;background:#18181b;border:1px solid #27272a;border-radius:20px;padding:5px 12px;margin:3px;font-size:12px;font-weight:600;color:#d4d4d8}
.resp-chip .dot{width:8px;height:8px;border-radius:4px;background:#8B5CF6;flex-shrink:0}
`;

function buildGrid(
  dates: string[],
  startHour: number,
  endHour: number,
  responses: Array<{ guest_name: string | null; available: string[] }>,
  selectedSlots: Set<string>,
): string {
  const hours: number[] = [];
  for (let h = startHour; h < endHour; h++) hours.push(h);
  const numCols = dates.length;

  // count how many people are available per slot
  const counts: Record<string, number> = {};
  for (const r of responses) {
    for (const slot of r.available) {
      counts[slot] = (counts[slot] ?? 0) + 1;
    }
  }

  const totalRespondents = responses.length;
  const maxCount = totalRespondents || 1;

  const colStyle = `grid-template-columns: 44px repeat(${numCols}, 48px)`;

  let html = `<div class="grid-wrap"><div class="grid" style="${colStyle}">`;
  // header row
  html += `<div></div>`; // empty corner
  for (const d of dates) {
    html += `<div class="col-header">${esc(fmtDate(d))}</div>`;
  }
  // hour rows
  for (const h of hours) {
    html += `<div class="row-label">${esc(fmtHour(h))}</div>`;
    for (const d of dates) {
      const slot = `${d}:${String(h).padStart(2, '0')}`;
      const count = counts[slot] ?? 0;
      const pct = count / maxCount;
      const isSelected = selectedSlots.has(slot);
      // Color: empty=dark, has-responses=green tint, fully-selected=bright green
      let bg = '#27272a';
      if (count > 0) {
        const greenInt = Math.round(pct * 160);
        bg = isSelected ? '#8B5CF6' : `rgb(${30 - greenInt / 8},${100 + greenInt},${30 - greenInt / 8})`;
      }
      if (isSelected) bg = '#8B5CF6';
      html += `<button type="button" class="slot${isSelected ? ' selected' : ''}" data-slot="${esc(slot)}" style="background:${bg}" onclick="toggleSlot(this,'${esc(slot)}')" title="${count > 0 ? `${count}/${totalRespondents} free` : 'No one yet'}"></button>`;
    }
  }
  html += `</div></div>`;
  return html;
}

function renderPage(
  sessionId: string,
  title: string,
  dates: string[],
  startHour: number,
  endHour: number,
  responses: Array<{ guest_name: string | null; available: string[] }>,
  success?: string,
): string {
  const grid = buildGrid(dates, startHour, endHour, responses, new Set());
  const respondentNames = responses
    .filter(r => r.guest_name || r.available.length > 0)
    .map(r => r.guest_name ?? 'App user');

  const respondentsHtml = respondentNames.length > 0
    ? `<div class="responses-section">${respondentNames.map(n => `<span class="resp-chip"><span class="dot"></span>${esc(n)}</span>`).join('')}</div>`
    : '';

  const successHtml = success
    ? `<div class="success"><div class="icon">✅</div><h2>You're in!</h2><p>Your availability has been saved.<br>The organizer will pick the best time.</p></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>${esc(title)}</title>
<meta name="theme-color" content="#09090b">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="Fill in when you're free — no app needed.">
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
  <div class="hero">
    <h1>${esc(title)}</h1>
    <p>Tap the times when you're free. Green = others are free too.</p>
  </div>

  ${successHtml}

  ${!success ? `
  <form method="POST" action="?id=${esc(sessionId)}" id="form">
    <input type="hidden" name="slots" id="slots-input" value="">

    <div class="section">
      <div class="label">Your name</div>
      <input type="text" name="name" placeholder="Enter your name" required autocomplete="off" autocorrect="off" spellcheck="false">
    </div>

    <div class="section">
      <div class="label">When are you free? (tap to select)</div>
      ${grid}
    </div>

    ${respondentNames.length > 0 ? `
    <div class="section">
      <div class="label">${respondentNames.length} ${respondentNames.length === 1 ? 'person' : 'people'} filled in</div>
      ${respondentsHtml}
    </div>` : ''}

    <div class="section">
      <button type="submit" class="submit-btn">Save my availability →</button>
    </div>
  </form>
  ` : `
  ${respondentNames.length > 0 ? `
  <div class="section">
    <div class="label">${respondentNames.length} ${respondentNames.length === 1 ? 'person' : 'people'} filled in</div>
    ${respondentsHtml}
  </div>` : ''}
  `}
</div>
<script>
const selected = new Set();
function toggleSlot(btn, slot) {
  if (selected.has(slot)) {
    selected.delete(slot);
    btn.classList.remove('selected');
    btn.style.background = btn.dataset.orig || '#27272a';
  } else {
    selected.add(slot);
    btn.dataset.orig = btn.style.background;
    btn.style.background = '#8B5CF6';
    btn.classList.add('selected');
  }
  document.getElementById('slots-input').value = [...selected].join(',');
}
document.getElementById('form')?.addEventListener('submit', function(e) {
  document.getElementById('slots-input').value = [...selected].join(',');
});
</script>
</body>
</html>`;
}

serve(async (req) => {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('id');

  if (!sessionId) {
    return new Response('Missing session id', { status: 400 });
  }

  // Fetch session
  const { data: session, error: sErr } = await supabase
    .from('availability_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (sErr || !session) {
    return new Response('Session not found', { status: 404 });
  }

  // Fetch existing responses
  const { data: responses } = await supabase
    .from('availability_responses')
    .select('guest_name, available, user_id')
    .eq('session_id', sessionId);

  const respList = (responses ?? []) as Array<{
    guest_name: string | null;
    user_id: string | null;
    available: string[];
  }>;

  // POST — save guest response
  if (req.method === 'POST') {
    const ct = req.headers.get('content-type') ?? '';
    let name = '';
    let slots: string[] = [];

    if (ct.includes('application/json')) {
      const body = await req.json();
      name = (body.name ?? '').trim();
      slots = Array.isArray(body.slots) ? body.slots : (body.slots ?? '').split(',').filter(Boolean);
    } else {
      const form = await req.formData();
      name = ((form.get('name') as string) ?? '').trim();
      const slotsRaw = (form.get('slots') as string) ?? '';
      slots = slotsRaw.split(',').filter(Boolean);
    }

    if (!name) {
      return new Response(
        renderPage(sessionId, session.title, session.dates, session.start_hour, session.end_hour, respList),
        { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
      );
    }

    await supabase.from('availability_responses').insert({
      session_id: sessionId,
      user_id: null,
      guest_name: name,
      available: slots,
    });

    if (ct.includes('application/json')) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Re-fetch responses for success page
    const { data: updatedResponses } = await supabase
      .from('availability_responses')
      .select('guest_name, available, user_id')
      .eq('session_id', sessionId);

    return new Response(
      renderPage(
        sessionId,
        session.title,
        session.dates,
        session.start_hour,
        session.end_hour,
        (updatedResponses ?? []) as typeof respList,
        'true',
      ),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }

  // GET — render form
  return new Response(
    renderPage(sessionId, session.title, session.dates, session.start_hour, session.end_hour, respList),
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
});
