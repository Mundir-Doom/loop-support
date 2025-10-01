 important :
 keep design & logic separate
	•	Treat the exported React components as UI-only (just styling/layout).
	•	Keep your business logic (Supabase calls, Telegram API, session management) in separate hooks/containers.
	•	That way, when you re-export from Figma, you only swap the dumb UI component and don’t break your app 

    0) What we’re building

Flow:
Visitor (React widget) ⇄ Supabase (DB + Realtime + Edge Functions) ⇄ Telegram Bot ⇄ Agents on Telegram
	•	Anonymous visitor session via a signed custom JWT (no email/login).
	•	Messages stored in Postgres; RLS ensures each visitor only sees their thread.
	•	Edge Functions:
	•	session-new: mint visitor token + create session.
	•	visitor-send: insert visitor message, auto-create ticket, notify/route to Telegram.
	•	tg-webhook: receive agent replies & button claims from Telegram, save & fan-out.
	•	Realtime feed into the React widget.

1) Supabase project setup
	1.	Create a Supabase project. Grab:

	•	SUPABASE_URL
	•	SUPABASE_ANON_KEY
	•	SUPABASE_SERVICE_ROLE_KEY
	•	JWT secret (Settings → API → JWT secret). We’ll use it to mint visitor tokens.

	2.	SQL schema (run in SQL Editor)
    -- Enable needed extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Sessions (anonymous)
create table public.support_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  locale text,
  user_agent text,
  referer text
);

-- Agents (Telegram specialists)
create table public.agents (
  id bigserial primary key,
  name text not null,
  tg_chat_id bigint unique,          -- Telegram DM chat id for the agent
  tg_username text,
  skills text[] default '{}',
  is_online boolean default true
);

-- Tickets (one open ticket per session at a time is fine to start)
create table public.tickets (
  id bigserial primary key,
  session_id uuid not null references public.support_sessions(id) on delete cascade,
  status text not null default 'open' check (status in ('open','claimed','closed')),
  category text,
  priority int not null default 0,
  assigned_agent_id bigint references public.agents(id),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  closed_at timestamptz
);

-- Messages (persist everything + Telegram linkage)
create table public.messages (
  id bigserial primary key,
  ticket_id bigint not null references public.tickets(id) on delete cascade,
  session_id uuid not null references public.support_sessions(id) on delete cascade,
  sender text not null check (sender in ('visitor','agent','system')),
  body text,
  media_url text,
  tg_message_id text,     -- optional: Telegram message id string
  created_at timestamptz not null default now()
);

-- Helpful index
create index on public.messages (ticket_id, created_at);
create index on public.tickets (session_id, status);

-- RLS: ON by default, we’ll add precise policies
alter table public.support_sessions enable row level security;
alter table public.tickets enable row level security;
alter table public.messages enable row level security;

-- ========== RLS POLICIES ==========
-- We will embed a custom claim "session_id" inside the JWT we mint for the visitor.
-- Helper expression:
--   (current_setting('request.jwt.claims', true)::jsonb->>'session_id')

-- Sessions: visitor can only read their own (no inserts/updates from client)
create policy "session_select_own"
on public.support_sessions for select
to authenticated
using ( id::text = (current_setting('request.jwt.claims', true)::jsonb->>'session_id') );

-- Tickets: visitor can read only their tickets
create policy "ticket_select_by_session"
on public.tickets for select
to authenticated
using ( session_id::text = (current_setting('request.jwt.claims', true)::jsonb->>'session_id') );

-- Messages: visitor can read only their messages (by session)
create policy "messages_select_by_session"
on public.messages for select
to authenticated
using ( session_id::text = (current_setting('request.jwt.claims', true)::jsonb->>'session_id') );

-- IMPORTANT: We do NOT add INSERT policies for the visitor.
-- All inserts will go through Edge Functions with the Service Role.

Why: This keeps client reads simple (Realtime works), and all writes pass through your server logic (Edge Functions) so you can route/notify/validate.

2) Edge Function: session-new (mint anonymous token)
	•	Generates a session_id (uuid)
	•	Inserts a row into support_sessions
	•	Signs a JWT with claim { session_id, role:'authenticated' } valid for ~30 days
	•	Returns { session_id, access_token }

File: supabase/functions/session-new/index.ts

// deno.json: { "imports": { "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2" } }
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const jwtSecret   = Deno.env.get("JWT_SECRET")!; // same as your Supabase JWT secret

function base64url(input: Uint8Array) {
  return btoa(String.fromCharCode(...input))
    .replace(/\+/g, "-").replace(/\//g, "-").replace(/=+$/, "");
}

// Minimal HS256 signer using WebCrypto
async function signHS256(payload: Record<string, unknown>, secret: string) {
  const enc = new TextEncoder();
  const header = { alg: "HS256", typ: "JWT" };
  const encHeader = base64url(enc.encode(JSON.stringify(header)));
  const encPayload = base64url(enc.encode(JSON.stringify(payload)));
  const data = `${encHeader}.${encPayload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return `${data}.${base64url(new Uint8Array(sig))}`;
}

Deno.serve(async (req) => {
  try {
    const { locale, userAgent, referer } = await req.json().catch(() => ({}));

    const supabase = createClient(supabaseUrl, serviceKey);
    // 1) create a session row
    const { data: session, error } = await supabase
      .from("support_sessions")
      .insert({ locale, user_agent: userAgent ?? req.headers.get("user-agent"), referer: referer ?? req.headers.get("referer") })
      .select("id")
      .single();

    if (error) throw error;

    // 2) issue JWT with session_id claim (valid 30 days)
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      aud: "authenticated",
      role: "authenticated",
      session_id: session.id, // <— used in RLS
      iat: now,
      exp: now + 60 * 60 * 24 * 30
    };
    const token = await signHS256(payload, jwtSecret);

    return new Response(JSON.stringify({ session_id: session.id, access_token: token }), {
      headers: { "content-type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 400 });
  }
});

Env vars (Dashboard → Functions)
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=...        # the project JWT secret

Deploy
supabase functions deploy session-new --no-verify-jwt
3) Edge Function: visitor-send (write message + route)
	•	Verifies Authorization: Bearer <visitor_token> (we’ll verify signature)
	•	Finds or creates an open ticket for this session
	•	Inserts the visitor’s message
	•	If newly created ticket → post a Claim/Pass message to the support group on Telegram
	•	If already claimed → forward to the assigned agent’s Telegram DM

File: supabase/functions/visitor-send/index.ts

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const jwtSecret   = Deno.env.get("JWT_SECRET")!;
const tgToken     = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const supportGroupChatId = Deno.env.get("SUPPORT_GROUP_CHAT_ID")!; // e.g., -1001234567890

// very small JWT verify (HS256)
async function verify(token: string, secret: string): Promise<any> {
  const [h, p, s] = token.split(".");
  const data = `${h}.${p}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("HMAC", key, Uint8Array.from(atob(s.replace(/-/g, "+")), c => c.charCodeAt(0)), enc.encode(data));
  if (!valid) throw new Error("Invalid token");
  const json = JSON.parse(atob(p.replace(/-/g, "+")));
  if (json.exp && json.exp < Math.floor(Date.now()/1000)) throw new Error("Token expired");
  return json;
}

async function tg(method: string, body: Record<string, unknown>) {
  await fetch(`https://api.telegram.org/bot${tgToken}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

Deno.serve(async (req) => {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) throw new Error("Missing Authorization");

    const claims = await verify(token, jwtSecret);
    const sessionId: string = claims.session_id;

    const { body, category } = await req.json();

    const supabase = createClient(supabaseUrl, serviceKey);

    // ensure an open ticket
    let { data: ticket } = await supabase
      .from("tickets")
      .select("*")
      .eq("session_id", sessionId)
      .eq("status", "open")
      .maybeSingle();

    let isNew = false;
    if (!ticket) {
      isNew = true;
      const { data: newTicket, error: tErr } = await supabase
        .from("tickets")
        .insert({ session_id: sessionId, category })
        .select("*").single();
      if (tErr) throw tErr;
      ticket = newTicket;
    }

    // insert message
    const { data: msg, error: mErr } = await supabase
      .from("messages")
      .insert({
        ticket_id: ticket!.id,
        session_id: sessionId,
        sender: "visitor",
        body
      })
      .select("id, created_at")
      .single();
    if (mErr) throw mErr;

    // Routing: if unclaimed -> alert support group with buttons
    if (isNew || !ticket!.assigned_agent_id) {
      await tg("sendMessage", {
        chat_id: Number(supportGroupChatId),
        text: `🆕 New ticket #${ticket!.id} • ${category ?? "General"}\n"${(body ?? "").toString().slice(0, 200)}"`,
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Claim", callback_data: `CLAIM#${ticket!.id}` },
            { text: "↩️ Pass",  callback_data: `PASS#${ticket!.id}` }
          ]]
        }
      });
    } else {
      // already claimed: forward to assigned agent
      const { data: agent } = await supabase.from("agents").select("tg_chat_id").eq("id", ticket!.assigned_agent_id).single();
      if (agent?.tg_chat_id) {
        await tg("sendMessage", {
          chat_id: Number(agent.tg_chat_id),
          text: `Visitor #${ticket!.id}: ${body}`
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, ticket_id: ticket!.id, message_id: msg!.id }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 400 });
  }
});

Env vars:
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=...
TELEGRAM_BOT_TOKEN=123456:ABC...
SUPPORT_GROUP_CHAT_ID=-1001234567890

Deploy
supabase functions deploy visitor-send --no-verify-jwt

4) Edge Function: tg-webhook (Telegram → DB → Realtime)
	•	Handles button claims (CLAIM#<id>)
	•	Saves agent messages and relays them to the visitor (DB insert triggers Realtime to the web)

File: supabase/functions/tg-webhook/index.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  try {
    const update = await req.json();

    // 1) Inline button claims
    if (update.callback_query) {
      const cq = update.callback_query;
      const data: string = cq.data || "";
      if (data.startsWith("CLAIM#")) {
        const ticketId = Number(data.split("#")[1]);
        const agentTgId = cq.from.id;

        // find or create agent by tg_chat_id
        let { data: agent } = await supabase.from("agents").select("*").eq("tg_chat_id", agentTgId).maybeSingle();
        if (!agent) {
          const insert = await supabase.from("agents").insert({
            name: cq.from.first_name,
            tg_chat_id: agentTgId,
            tg_username: cq.from.username ?? null,
            is_online: true
          }).select("*").single();
          agent = insert.data!;
        }

        // Assign ticket if unassigned
        await supabase.from("tickets")
          .update({ assigned_agent_id: agent.id, status: 'claimed', claimed_at: new Date().toISOString() })
          .eq("id", ticketId)
          .is("assigned_agent_id", null);

        // Acknowledge by editing markup (optional)
        await fetch(`https://api.telegram.org/bot${Deno.env.get("TELEGRAM_BOT_TOKEN")}/editMessageReplyMarkup`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: cq.message.chat.id,
            message_id: cq.message.message_id,
            reply_markup: { inline_keyboard: [[{ text: `👤 Claimed by @${cq.from.username ?? 'agent'}`, callback_data: "noop" }]] }
          })
        });

        // Tell agent they’re connected
        await fetch(`https://api.telegram.org/bot${Deno.env.get("TELEGRAM_BOT_TOKEN")}/sendMessage`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: agentTgId,
            text: `You're connected to ticket #${ticketId}. Send messages here.`
          })
        });
      }
      return new Response("ok");
    }

    // 2) Agent messages (text only for brevity; extend to photo/document similarly)
    if (update.message) {
      const msg = update.message;
      const fromId = msg.from.id;
      const text = msg.text ?? "";

      // find agent
      const { data: agent } = await supabase.from("agents").select("*").eq("tg_chat_id", fromId).single();
      if (!agent) return new Response("no agent", { status: 200 });

      // find CURRENT claimed ticket for this agent (simple: most recent claimed open ticket)
      const { data: ticket } = await supabase
        .from("tickets")
        .select("*")
        .eq("assigned_agent_id", agent.id)
        .eq("status", "claimed")
        .order("claimed_at", { ascending: false })
        .limit(1)
        .single();

      if (!ticket) return new Response("no ticket", { status: 200 });

      // get session_id for message row
      const sessionId = ticket.session_id;

      // save agent message
      await supabase.from("messages").insert({
        ticket_id: ticket.id,
        session_id: sessionId,
        sender: "agent",
        body: text,
        tg_message_id: String(msg.message_id)
      });

      // (Optional) If you want to also push a toast via Telegram to confirm delivery, you can.
      return new Response("ok");
    }

    return new Response("ignored");
  } catch (e) {
    return new Response(String(e), { status: 400 });
  }
});

Deploy
supabase functions deploy tg-webhook --no-verify-jwt

Set the Telegram webhook once (replace URL with your Supabase Functions endpoint):
curl -X POST \
  "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://<YOUR-PROJECT-REF>.functions.supabase.co/tg-webhook"}'

  6) Telegram bot + group
	1.	In Telegram: @BotFather → /newbot → copy TELEGRAM_BOT_TOKEN.
	2.	Create a Support group, add your bot, get its chat_id (use a helper bot like @RawDataBot or a quick throwaway function to print chat.id). Put that into SUPPORT_GROUP_CHAT_ID.
	3.	Set the webhook (command shown earlier) to your tg-webhook function URL.

7) Basic routing & claiming
	•	New ticket: visitor-send posts a Claim/Pass message to the group.
	•	First agent to tap Claim gets assigned (tickets.assigned_agent_id), and the group message buttons turn into a “Claimed by …” label.
	•	Agent DMs your bot to chat; tg-webhook writes those messages as sender='agent' to the DB.
	•	Visitor sees them live via Realtime.

8) Production notes
	•	Rate limiting: Add a simple counter in Redis/Durable Objects or a Postgres function to drop floods (e.g., 5 msgs/10s per session).
	•	After-hours: If no agent claims in N minutes, auto-reply in group and ask the visitor for an email/phone in the widget.
	•	Media: Extend tg-webhook to handle photo/document (use getFile → download → upload to storage bucket → media_url).
	•	Categories: Add a dropdown in the widget and pass category on the first send to improve routing.
	•	Close ticket: Add a /close button for agents that flips status to closed.

    