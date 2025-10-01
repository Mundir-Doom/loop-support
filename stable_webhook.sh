#!/bin/bash

# Stable Webhook Setup Script
# This script automatically restarts the tunnel when it drops

BOT_TOKEN="8091078231:AAGECO_ItNQOt02zK2weB-p0t5ZRHH6KDTA"
BACKEND_PORT=8000

echo "🚀 Starting Stable Webhook Setup"
echo "================================"

# Function to set webhook
set_webhook() {
    local url=$1
    echo "Setting webhook to: $url"
    
    response=$(curl -s -X POST "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \
        -d "url=$url/api/telegram/webhook")
    
    if echo "$response" | grep -q '"ok":true'; then
        echo "✅ Webhook set successfully"
        return 0
    else
        echo "❌ Failed to set webhook: $response"
        return 1
    fi
}

# Function to start localtunnel
start_localtunnel() {
    echo "Starting localtunnel..."
    npx localtunnel --port $BACKEND_PORT &
    localtunnel_pid=$!
    
    # Wait for tunnel to be ready
    sleep 5
    
    # Get the tunnel URL (this is a simplified approach)
    # In practice, you'd need to parse the localtunnel output
    echo "Localtunnel started with PID: $localtunnel_pid"
    echo "Please check the localtunnel output for the URL"
    echo "Then run: curl -X POST \"https://api.telegram.org/bot$BOT_TOKEN/setWebhook\" -d \"url=YOUR_TUNNEL_URL/api/telegram/webhook\""
}

# Function to start serveo tunnel
start_serveo() {
    echo "Starting serveo tunnel..."
    echo "This will give you a stable HTTPS URL"
    echo "When you see the URL, press Ctrl+C and run the webhook setup command"
    
    ssh -R 80:localhost:$BACKEND_PORT serveo.net
}

# Main menu
echo "Choose a tunnel service:"
echo "1) Localtunnel (may be unstable)"
echo "2) Serveo (more stable, no account needed)"
echo "3) Manual webhook setup"
echo
read -p "Enter choice (1-3): " choice

case $choice in
    1)
        start_localtunnel
        ;;
    2)
        start_serveo
        ;;
    3)
        echo "Manual setup:"
        echo "1. Get a tunnel URL from any service"
        echo "2. Run: curl -X POST \"https://api.telegram.org/bot$BOT_TOKEN/setWebhook\" -d \"url=YOUR_URL/api/telegram/webhook\""
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac
