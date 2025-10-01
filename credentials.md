Project URL (https://frrkvrzqyjyjhcqueqic.supabase.co)
	•	anon public key – eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZycmt2cnpxeWp5amhjcXVlcWljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDQ4MzgsImV4cCI6MjA3NDgyMDgzOH0.Vac3cZKrenLvCMHr-P3CYmhI59qu5SkPokCThoZA42Y

	•	service_role key – eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZycmt2cnpxeWp5amhjcXVlcWljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTI0NDgzOCwiZXhwIjoyMDc0ODIwODM4fQ.a_SsWvaZHU0Gr4vkBjq_sH7n17kQ6FOyd8q5IFL9DYI

    JWT secret – 



telegram ; 
Bot token : 8091078231:AAGECO_ItNQOt02zK2weB-p0t5ZRHH6KDTA
To get the group chat_id, send any message in the group and read your bot’s Update payload (you’ll see update.message.chat.id) after you set the webhook below. The Update format is in the Bot API spec
Making requests

All queries to the Telegram Bot API must be served over HTTPS and need to be presented in this form: https://api.telegram.org/bot<token>/METHOD_NAME. Like this for example
https://core.telegram.org/bots/api#authorizing-your-bot
You’ll later set a webhook so Telegram posts updates to your Supabase Function URL.  

2) Local tools
	•	Supabase CLI (to deploy functions): npm i -g supabase (see quickstart).  ￼

3) Supabase project: DB + Realtime

A) Run the minimal schema

Create tables for support_sessions, tickets, messages, agents (the same schema I gave you earlier works).
Enable RLS and add select policies so the visitor (by session_id claim) can read only their own rows.
React will subscribe to the messages table via Realtime Postgres Changes.  ￼

Tip: Supabase Realtime’s Postgres Changes lets you stream inserts to the client; it respects your JWT/RLS.  ￼

4) Supabase Edge Functions you’ll create

You’ll create three functions (TypeScript/Deno). All secrets go in Dashboard → Functions → Variables.
	1.	session-new (no auth required):
	•	Inserts a row in support_sessions and mints a JWT with claim { session_id } using your project JWT secret.
	•	Return { session_id, access_token } to the React widget.
Deploy with --no-verify-jwt (public).  ￼
	2.	visitor-send (requires Authorization: Bearer <visitor_token>):
	•	Verifies token, finds/creates an open ticket, inserts the visitor’s message.
	•	If ticket is unclaimed → posts a Claim/Pass message to your Support group (Telegram sendMessage + reply_markup.inline_keyboard).
	•	If claimed → forwards text to the assigned agent’s tg_chat_id.
(You’ll call this from React on every send.)
	3.	tg-webhook (public – Telegram calls it):
	•	Handles inline keyboard clicks (callback_query → CLAIM#<ticket_id>), assigns the ticket.
	•	Saves agent messages (from update.message) into messages; the web client receives them via Realtime.
	•	For media: use Telegram getFile to resolve a file_id → download URL, then upload to your storage (optional).  ￼

    5) Configure function secrets (env) in the Dashboard

Set these Function variables (used by session-new, visitor-send, tg-webhook):
SUPABASE_URL = https://<PROJECT-REF>.supabase.co
SUPABASE_SERVICE_ROLE_KEY = <service_role key>
JWT_SECRET = <project JWT secret>

TELEGRAM_BOT_TOKEN = 123456:ABC...
SUPPORT_GROUP_CHAT_ID = -1001234567890  # your Telegram group id

7) Point Telegram to your webhook

Replace <FUNC_URL> with your tg-webhook function URL
curl -X POST \
  "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"<FUNC_URL>"}'

  •	Telegram will POST every Update (messages, button clicks) to this URL.
	•	setWebhook requirements & behavior are in the official Bot API.  ￼

Sending messages / buttons (what your function will call):
	•	sendMessage with reply_markup.inline_keyboard to show Claim/Pass.
	•	Agent button taps come as callback_query (you’ll read data: "CLAIM#<id>"). All documented on the same Bot API page.  ￼

Media from agents (optional):
	•	Call getFile to turn a file_id into a temporary download URL (https://api.telegram.org/file/bot<TOKEN>/<file_path>), then re-host.  ￼

    8) React app wiring (client side)
    npm i @supabase/supabase-js
    On load, call session-new (no auth) → store access_token + session_id in localStorage.
	3.	Create Supabase client using project URL + anon key.
Attach the visitor token as the Authorization header when you query or subscribe (the token carries session_id used by your RLS policies). Then subscribe to messages (filtered by session_id) using Realtime Postgres Changes.  ￼
	4.	On send, call your visitor-send Edge Function (fetch POST with Authorization: Bearer <access_token>). You can also use supabase.functions.invoke('visitor-send', { headers, body }).  ￼

9) Quick smoke test
	1.	Open your site → the widget calls session-new and receives a token.
	2.	Type “hello” → visitor-send inserts a message and posts a Claim/Pass in your Telegram Support group.
	3.	Tap Claim in Telegram → tg-webhook assigns the ticket and DMs the agent.
	4.	Agent replies in Telegram → tg-webhook writes it to messages → your React widget sees it live via Realtime.


JWT Signing Keys
STANDBY KEY- c978e853-ef46-40f4-971f-ea9eb9b9377f - ECC (P-256)
CURRENT KEY - 93c8307c-7a29-4cfd-b1e9-e07fe7f4f63c - Legacy HS256 (Shared Secret)


API KEYS
Publishable key - sb_publishable_a3KRneIqRt8sEOP1nkhOyg_eejqeM8a
Secret keys - sb_secret_iIkk4SU0NARB_RvnBSS5lg_RA-o_tRF

supabase postgree db pass
am8HkXHhJHyzdiuH