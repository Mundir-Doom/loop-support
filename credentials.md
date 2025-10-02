# Credentials and Setup (No Supabase)

## Telegram
- Bot token: 8091078231:AAGECO_ItNQOt02zK2weB-p0t5ZRHH6KDTA
- Group chat id: -4828761055 (Loop Support)

## Backend environment (Support_Page_Design/backend/.env)
TELEGRAM_BOT_TOKEN=8091078231:AAGECO_ItNQOt02zK2weB-p0t5ZRHH6KDTA
SUPPORT_GROUP_CHAT_ID=-4828761055

## Start everything with tunnel and webhook
From backend directory:

bash run_with_tunnel.sh

This will:
- Start FastAPI on http://localhost:8000
- Create a Cloudflare tunnel and print a public URL
- Set Telegram webhook to <public_url>/api/telegram/webhook

## Manual webhook (optional)
If you already have a public URL:

curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" -d "url=https://YOUR_PUBLIC_URL/api/telegram/webhook"

## Frontend
- Ensure VITE_API_BASE_URL points to the backend (default used by .env.local):
  - http://localhost:8000/api
- Start Vite on http://localhost:5174

## Notes
- No Supabase is used anymore. All data lives in the FastAPI backend DB.
- Ticket lifecycle is managed via API + Telegram webhook.