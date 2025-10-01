#!/usr/bin/env python3
"""
Manual Telegram Message Processor
Use this when the webhook is not working properly
"""

import subprocess
import json
import sys

BOT_TOKEN = "8091078231:AAGECO_ItNQOt02zK2weB-p0t5ZRHH6KDTA"
WEBHOOK_URL = "http://localhost:8000/api/telegram/webhook"
AGENT_CHAT_ID = 304154647

def get_pending_messages():
    """Get pending messages from Telegram"""
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/getUpdates"
    
    try:
        result = subprocess.run(['curl', '-s', url], capture_output=True, text=True)
        data = json.loads(result.stdout)
        
        if not data.get('ok'):
            print(f"Error getting updates: {data}")
            return []
        
        updates = data.get('result', [])
        agent_messages = []
        
        for update in updates:
            if 'message' in update:
                message = update['message']
                from_user = message.get('from', {})
                if from_user.get('id') == AGENT_CHAT_ID:
                    agent_messages.append(update)
        
        return agent_messages
    except Exception as e:
        print(f"Error getting updates: {e}")
        return []

def process_message(update):
    """Process a single message update"""
    print(f"Processing message: {update['message'].get('text', 'No text')}")
    
    try:
        # Convert update to JSON string
        update_json = json.dumps(update)
        
        # Send to webhook
        result = subprocess.run([
            'curl', '-s', '-X', 'POST', WEBHOOK_URL,
            '-H', 'Content-Type: application/json',
            '-d', update_json
        ], capture_output=True, text=True)
        
        response_data = json.loads(result.stdout)
        
        if response_data.get('ok'):
            print("✅ Message processed successfully")
        else:
            print(f"❌ Error processing message: {response_data}")
        
        return response_data
    except Exception as e:
        print(f"❌ Error processing message: {e}")
        return {"ok": False, "error": str(e)}

def main():
    print("🤖 Telegram Message Processor")
    print("=" * 40)
    
    # Get pending messages
    messages = get_pending_messages()
    
    if not messages:
        print("No new messages from agent")
        return
    
    print(f"Found {len(messages)} messages from agent")
    
    # Process each message
    for i, message in enumerate(messages, 1):
        print(f"\n--- Processing message {i} ---")
        process_message(message)
    
    print(f"\n✅ Processed {len(messages)} messages")

if __name__ == "__main__":
    main()
