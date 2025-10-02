#!/bin/bash

set -euo pipefail

cd "$(dirname "$0")"

LOG_FILE=/tmp/cloudflared-support.log
HEALTH_URL=http://localhost:8000/api/health

if [ ! -f .env ]; then
  echo "Missing .env in backend. Create it with TELEGRAM_BOT_TOKEN and SUPPORT_GROUP_CHAT_ID." >&2
  exit 1
fi

# Load env
export $(grep -v '^#' .env | xargs)

if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${SUPPORT_GROUP_CHAT_ID:-}" ]; then
  echo "TELEGRAM_BOT_TOKEN or SUPPORT_GROUP_CHAT_ID not set in .env" >&2
  exit 1
fi

cleanup() {
  trap - INT TERM EXIT
  echo "Shutting down..."
  pkill -f "cloudflared tunnel --url" || true
  pkill -f "uvicorn app.main:app" || true
}
trap cleanup INT TERM EXIT

start_backend() {
  # Start backend if not already listening
  if ! curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
    sleep 1
  fi
}

start_tunnel() {
  pkill -f "cloudflared tunnel --url" || true
  rm -f "$LOG_FILE"
  # Prefer HTTP2 to avoid QUIC/UDP blocking on some networks
  cloudflared tunnel --protocol http2 --url http://localhost:8000 \
    --loglevel info --no-autoupdate --logfile "$LOG_FILE" &
}

get_tunnel_url() {
  local url=""
  for _ in $(seq 1 20); do
    url=$(grep -Eo "https://[a-zA-Z0-9.-]+trycloudflare.com" "$LOG_FILE" | head -n1 || true)
    if [ -n "$url" ]; then
      echo "$url"
      return 0
    fi
    sleep 1
  done
  return 1
}

set_webhook() {
  local pub_url=$1
  echo "Setting webhook to: ${pub_url}/api/telegram/webhook"
  curl -fsS -X POST \
    "http://localhost:8000/api/setup/telegram-webhook?webhook_url=${pub_url}/api/telegram/webhook&drop_pending=true" \
    >/dev/null || true
}

check_webhook() {
  # Validate Telegram points to the current tunnel and there are no errors
  local expect_url="$PUBLIC_URL/api/telegram/webhook"
  local info
  info=$(curl -fsS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" || true)
  if [ -z "$info" ]; then
    return 1
  fi
  local url
  url=$(echo "$info" | sed -n 's/.*"url"\s*:\s*"\([^"]*\)".*/\1/p' | head -n1)
  local last_error
  last_error=$(echo "$info" | sed -n 's/.*"last_error_message"\s*:\s*"\([^"]*\)".*/\1/p' | head -n1)
  if [ "$url" != "$expect_url" ] || [ -n "$last_error" ]; then
    echo "Webhook mismatch or error detected. Resetting webhook..."
    set_webhook "$PUBLIC_URL"
  fi
}

start_backend
start_tunnel

PUBLIC_URL=$(get_tunnel_url || echo "")
if [ -z "$PUBLIC_URL" ]; then
  echo "Unable to detect Cloudflare tunnel URL. Check $LOG_FILE" >&2
  exit 1
fi

set_webhook "$PUBLIC_URL"

echo "Ready:\n- Frontend:  http://localhost:5174\n- Backend:   http://localhost:8000\n- Public:    $PUBLIC_URL"

# Watchdog: if tunnel drops or URL rotates, restart and re-set webhook automatically
while true; do
  sleep 5
  # If health fails, try to (re)start backend
  if ! curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    start_backend
  fi

  # Detect tunnel liveness
  if ! pgrep -f "cloudflared tunnel --url" >/dev/null 2>&1; then
    echo "Tunnel not running. Restarting..."
    start_tunnel
    NEW_URL=$(get_tunnel_url || echo "")
    if [ -n "$NEW_URL" ] && [ "$NEW_URL" != "$PUBLIC_URL" ]; then
      PUBLIC_URL="$NEW_URL"
      set_webhook "$PUBLIC_URL"
      echo "New tunnel URL: $PUBLIC_URL"
    fi
  else
    # If URL rotated, reset webhook
    NEW_URL=$(grep -Eo "https://[a-zA-Z0-9.-]+trycloudflare.com" "$LOG_FILE" | head -n1 || true)
    if [ -n "$NEW_URL" ] && [ "$NEW_URL" != "$PUBLIC_URL" ]; then
      PUBLIC_URL="$NEW_URL"
      set_webhook "$PUBLIC_URL"
      echo "Tunnel URL changed: $PUBLIC_URL"
    fi
  fi

  # Periodically validate Telegram webhook points to current URL
  check_webhook || true
done
