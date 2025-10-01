"""Telegram Bot Integration for Support System"""

import os
import httpx
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime

logger = logging.getLogger(__name__)

# Environment variables
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
SUPPORT_GROUP_CHAT_ID = os.getenv("SUPPORT_GROUP_CHAT_ID", "")

class TelegramService:
    def __init__(self):
        self.bot_token = TELEGRAM_BOT_TOKEN
        self.support_group_id = SUPPORT_GROUP_CHAT_ID
        self.base_url = f"https://api.telegram.org/bot{self.bot_token}"
        
        if not self.bot_token:
            logger.warning("TELEGRAM_BOT_TOKEN not configured")
        if not self.support_group_id:
            logger.warning("SUPPORT_GROUP_CHAT_ID not configured")
    
    async def _make_request(self, method: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Make HTTP request to Telegram API"""
        if not self.bot_token:
            print(f"ERROR: Telegram bot token not configured")
            return None
            
        url = f"{self.base_url}/{method}"
        print(f"Making Telegram API request to: {url}")
        print(f"Request data: {data}")
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=data)
                print(f"Response status: {response.status_code}")
                print(f"Response text: {response.text}")
                response.raise_for_status()
                result = response.json()
                print(f"Parsed response: {result}")
                return result
        except httpx.HTTPError as e:
            print(f"ERROR: Telegram API HTTP error: {e}")
            print(f"Response content: {e.response.text if hasattr(e, 'response') else 'No response'}")
            return None
        except Exception as e:
            print(f"ERROR: Unexpected error calling Telegram API: {e}")
            return None
    
    async def send_message(self, chat_id: str, text: str, reply_markup: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """Send a message to a Telegram chat"""
        data = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML"
        }
        
        if reply_markup:
            data["reply_markup"] = reply_markup
            
        return await self._make_request("sendMessage", data)

    async def answer_callback(self, callback_id: str, text: Optional[str] = None, show_alert: bool = False) -> None:
        if not self.bot_token:
            return

        payload: Dict[str, Any] = {"callback_query_id": callback_id, "show_alert": show_alert}
        if text:
            payload["text"] = text

        await self._make_request("answerCallbackQuery", payload)

    async def edit_message_reply_markup(self, chat_id: str, message_id: int, reply_markup: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """Edit reply markup of an existing message"""
        data = {
            "chat_id": chat_id,
            "message_id": message_id,
            "reply_markup": reply_markup or {"inline_keyboard": []}
        }
        
        return await self._make_request("editMessageReplyMarkup", data)
    
    async def notify_new_ticket(self, ticket_id: int, category: str, message_body: str) -> Optional[int]:
        """Send notification to support group about new ticket with claim/pass buttons"""
        if not self.support_group_id:
            logger.error("Support group chat ID not configured")
            return None
        
        # Truncate message body to reasonable length
        truncated_body = message_body[:200] + "..." if len(message_body) > 200 else message_body
        
        text = f"🆕 <b>New Ticket #{ticket_id}</b>\n" \
               f"📋 Category: {category or 'General'}\n" \
               f"💬 Message: \"{truncated_body}\"\n" \
               f"⏰ Time: {datetime.utcnow().strftime('%H:%M UTC')}"
        
        reply_markup = {
            "inline_keyboard": [[
                {"text": "✅ Claim", "callback_data": f"CLAIM#{ticket_id}"},
                {"text": "↩️ Pass", "callback_data": f"PASS#{ticket_id}"}
            ]]
        }
        
        result = await self.send_message(self.support_group_id, text, reply_markup)
        
        if result and result.get("ok"):
            return result["result"]["message_id"]
        
        return None
    
    async def notify_agent_assigned(self, agent_chat_id: str, ticket_id: int) -> None:
        """Notify agent that they've been assigned to a ticket"""
        text = (
            f"✅ <b>You're connected to Ticket #{ticket_id}</b>\n"
            f"Send your replies here to chat with the visitor."
        )

        reply_markup = {
            "inline_keyboard": [[
                {"text": "📁 Close Ticket", "callback_data": f"CLOSE#{ticket_id}"}
            ]]
        }

        await self.send_message(agent_chat_id, text, reply_markup)
    
    async def notify_customer_message(self, agent_chat_id: str, ticket_id: int, message: str) -> None:
        """Forward customer message to assigned agent"""
        text = f"📨 <b>Customer message (Ticket #{ticket_id}):</b>\n\n{message}"
        await self.send_message(agent_chat_id, text)
    
    async def remove_claim_buttons(self, message_id: int) -> None:
        """Remove claim/pass buttons from a message after it's been claimed"""
        if not self.support_group_id:
            return
            
        await self.edit_message_reply_markup(
            self.support_group_id, 
            message_id, 
            {"inline_keyboard": []}
        )
    
    async def set_webhook(self, webhook_url: str) -> bool:
        """Set Telegram webhook URL"""
        data = {"url": webhook_url}
        result = await self._make_request("setWebhook", data)
        return result is not None and result.get("ok", False)

# Singleton instance
telegram_service = TelegramService()
