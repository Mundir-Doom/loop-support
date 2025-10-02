from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import asc, desc, select

# Load environment variables
load_dotenv()

from .database import Base, engine, session_scope
from .models import PRIORITY_MAP, SupportMessage, SupportSession, SupportTicket
from .schemas import (
    ConversationResponse,
    MessageCreateRequest,
    MessageResponse,
    SessionCreateRequest,
    SessionResponse,
    SupportMessageSchema,
    SupportTicketSchema,
)
from .telegram import telegram_service

app = FastAPI(title="Support Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

# Serve frontend static files (mounted early), but register SPA catch-all AFTER API routes
frontend_path = Path(__file__).parent.parent.parent / "build"
if frontend_path.exists():
    app.mount("/static", StaticFiles(directory=frontend_path), name="static")


def _serialize_ticket(ticket: Optional[SupportTicket]) -> Optional[SupportTicketSchema]:
    if ticket is None:
        return None
    return SupportTicketSchema(
        id=ticket.id,
        sessionId=ticket.session_id,
        status=ticket.status,
        category=ticket.category,
        priority=ticket.priority,
        assignedAgentId=ticket.assigned_agent_id,
        contactName=ticket.contact_name,
        contactEmail=ticket.contact_email,
        createdAt=ticket.created_at,
        claimedAt=ticket.claimed_at,
        closedAt=ticket.closed_at,
    )


def _serialize_messages(messages: List[SupportMessage]) -> List[SupportMessageSchema]:
    return [
        SupportMessageSchema(
            id=msg.id,
            ticketId=msg.ticket_id,
            sessionId=msg.session_id,
            sender=msg.sender,
            body=msg.body,
            createdAt=msg.created_at,
        )
        for msg in messages
    ]


@app.get("/api")
async def api_root():
    return {
        "message": "Support API",
        "version": "0.1.0",
        "endpoints": [
            "GET /api/health",
            "POST /api/session",
            "GET /api/session/{session_id}",
            "POST /api/session/{session_id}/messages"
        ]
    }


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}


@app.post("/api/session", response_model=SessionResponse)
async def create_session(payload: SessionCreateRequest) -> SessionResponse:
    session_id = str(uuid4())
    now = datetime.utcnow()

    with session_scope() as db:
        support_session = SupportSession(
            id=session_id,
            created_at=now,
            last_seen_at=now,
            locale=payload.locale,
            user_agent=payload.user_agent,
            referer=payload.referer,
        )
        db.add(support_session)

    return SessionResponse(session_id=session_id)


@app.get("/api/session/{session_id}", response_model=ConversationResponse)
async def get_conversation(session_id: str) -> ConversationResponse:
    print(f"DEBUG: Fetching conversation for session {session_id}")
    with session_scope() as db:
        session = db.get(SupportSession, session_id)
        if session is None:
            print(f"DEBUG: Session {session_id} not found when fetching conversation")
            raise HTTPException(status_code=404, detail="Session not found")

        session.last_seen_at = datetime.utcnow()

        ticket_stmt = (
            select(SupportTicket)
            .where(SupportTicket.session_id == session_id)
            .order_by(desc(SupportTicket.created_at))
        )
        ticket = db.execute(ticket_stmt).scalars().first()

        messages_stmt = (
            select(SupportMessage)
            .where(SupportMessage.session_id == session_id)
            .order_by(asc(SupportMessage.created_at))
        )
        messages = db.execute(messages_stmt).scalars().all()

        return ConversationResponse(
            ticket=_serialize_ticket(ticket),
            messages=_serialize_messages(messages),
        )


@app.post("/api/session/{session_id}/messages")
async def create_message(session_id: str, payload: dict):
    """Create a message and send Telegram notification"""
    try:
        print(f"DEBUG: Starting message creation for session {session_id}")
        print(f"DEBUG: Payload: {payload}")
        
        # Validate input
        if not payload.get("body", "").strip():
            raise HTTPException(status_code=400, detail="Message body is required")
        
        # Database operations
        with session_scope() as db:
            print(f"DEBUG: Checking session {session_id}")
            session = db.get(SupportSession, session_id)
            if session is None:
                raise HTTPException(status_code=404, detail="Session not found")
            
            session.last_seen_at = datetime.utcnow()
            
            print(f"DEBUG: Looking for existing ticket")
            ticket_stmt = (
                select(SupportTicket)
                .where(SupportTicket.session_id == session_id)
                .where(SupportTicket.status.in_(["open", "claimed"]))
                .order_by(desc(SupportTicket.created_at))
            )
            ticket = db.execute(ticket_stmt).scalars().first()
            
            is_new_ticket = ticket is None
            
            if is_new_ticket:
                print(f"DEBUG: Creating new ticket")
                ticket = SupportTicket(
                    session_id=session_id,
                    status="open",
                    category=payload.get("category"),
                    priority=PRIORITY_MAP.get((payload.get("priority") or "low").lower(), 0),
                    contact_name=payload.get("contact_name"),
                    contact_email=payload.get("contact_email"),
                    created_at=datetime.utcnow(),
                )
                db.add(ticket)
                db.flush()
                print(f"DEBUG: New ticket created with ID {ticket.id}")
            else:
                print(f"DEBUG: Using existing ticket {ticket.id}")
            
            print(f"DEBUG: Creating message")
            message = SupportMessage(
                ticket_id=ticket.id,
                session_id=session_id,
                sender="visitor",
                body=payload.get("body", "").strip(),
                created_at=datetime.utcnow(),
            )
            db.add(message)
            db.commit()
            print(f"DEBUG: Message {message.id} created successfully")
        
            # Capture values before closing session
            ticket_id = ticket.id
            ticket_category = ticket.category
            ticket_assigned_agent_id = ticket.assigned_agent_id
            message_id = message.id
        
        # Send Telegram notification (outside session)
        # Always notify for new tickets OR tickets without assigned agents
        should_notify = is_new_ticket or ticket_assigned_agent_id is None
        
        print(f"DEBUG: Notification check - is_new_ticket: {is_new_ticket}, assigned_agent_id: {ticket_assigned_agent_id}, should_notify: {should_notify}")
        
        if should_notify:
            print(f"DEBUG: Sending Telegram notification for ticket {ticket_id}")
            try:
                result = await telegram_service.notify_new_ticket(
                    ticket_id=ticket_id,
                    category=ticket_category or payload.get("category") or "General",
                    message_body=payload.get("body", "").strip()
                )
                print(f"DEBUG: Telegram notification result: {result}")
            except Exception as e:
                print(f"DEBUG: Telegram notification failed: {e}")
                import traceback
                traceback.print_exc()
        else:
            print(f"DEBUG: Ticket {ticket_id} already assigned to agent {ticket_assigned_agent_id}, notifying assigned agent")
            # Notify the assigned agent about the new visitor message
            try:
                # Get agent's Telegram chat ID
                with session_scope() as db:
                    from .models import SupportAgent
                    agent_stmt = select(SupportAgent).where(SupportAgent.id == ticket_assigned_agent_id)
                    agent = db.execute(agent_stmt).scalars().first()
                    
                    if agent:
                        await telegram_service.notify_customer_message(
                            str(agent.tg_chat_id),
                            ticket_id,
                            payload.get("body", "").strip()
                        )
                        print(f"DEBUG: Notified agent {agent.name} about new visitor message")
                    else:
                        print(f"DEBUG: Agent with ID {ticket_assigned_agent_id} not found")
            except Exception as e:
                print(f"DEBUG: Failed to notify assigned agent: {e}")
                import traceback
                traceback.print_exc()
        
        return {"ok": True, "ticket_id": ticket_id, "message_id": message_id}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"DEBUG: Unexpected error in create_message: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/telegram/webhook")
async def telegram_webhook(update: dict):
    """Handle Telegram webhook updates (messages, button clicks, etc.)"""
    try:
        print(f"DEBUG: Received webhook update: {json.dumps(update, indent=2)}")
        # Handle callback queries (button clicks)
        if "callback_query" in update:
            callback = update["callback_query"]
            callback_data = callback.get("data", "")
            from_user = callback["from"]
            message = callback.get("message")
            callback_id = callback.get("id")
            
            if callback_data.startswith("CLAIM#"):
                ticket_id = int(callback_data.split("#")[1])
                agent_telegram_id = from_user["id"]
                
                with session_scope() as db:
                    # Find or create agent
                    from .models import SupportAgent
                    agent_stmt = select(SupportAgent).where(SupportAgent.tg_chat_id == agent_telegram_id)
                    agent = db.execute(agent_stmt).scalars().first()
                    
                    if not agent:
                        # Create new agent
                        agent = SupportAgent(
                            name=from_user.get("first_name", "Unknown"),
                            tg_chat_id=agent_telegram_id,
                            is_active=True,
                            created_at=datetime.utcnow()
                        )
                        db.add(agent)
                        db.flush()
                    
                    # Assign ticket to agent
                    ticket_stmt = select(SupportTicket).where(SupportTicket.id == ticket_id)
                    ticket = db.execute(ticket_stmt).scalars().first()
                    
                    if ticket and not ticket.assigned_agent_id:
                        ticket.assigned_agent_id = agent.id
                        ticket.status = "claimed"
                        ticket.claimed_at = datetime.utcnow()
                        db.commit()

                        # Remove claim buttons from group message
                        if message:
                            await telegram_service.remove_claim_buttons(message["message_id"])

                        # Notify agent they're assigned
                        await telegram_service.notify_agent_assigned(
                            str(agent_telegram_id), 
                            ticket_id
                        )
                        if callback_id:
                            await telegram_service.answer_callback(callback_id, "Ticket claimed")
                    else:
                        if callback_id:
                            await telegram_service.answer_callback(callback_id, "Already claimed", show_alert=True)

            elif callback_data.startswith("PASS#"):
                if message:
                    await telegram_service.remove_claim_buttons(message["message_id"])
                if callback_id:
                    await telegram_service.answer_callback(callback_id, "Passed")

            elif callback_data.startswith("CLOSE#"):
                ticket_id = int(callback_data.split("#")[1])
                agent_telegram_id = from_user["id"]

                with session_scope() as db:
                    from .models import SupportAgent

                    agent_stmt = select(SupportAgent).where(SupportAgent.tg_chat_id == agent_telegram_id)
                    agent = db.execute(agent_stmt).scalars().first()

                    ticket = db.get(SupportTicket, ticket_id)

                    if not agent or not ticket or ticket.assigned_agent_id != agent.id:
                        if callback_id:
                            await telegram_service.answer_callback(callback_id, "You can't close this ticket", show_alert=True)
                    else:
                        ticket.status = "closed"
                        ticket.closed_at = datetime.utcnow()
                        db.commit()

                        if callback_id:
                            await telegram_service.answer_callback(callback_id, "Ticket closed")

                        await telegram_service.send_message(
                            str(agent_telegram_id),
                            f"✅ <b>Ticket #{ticket_id} closed successfully!</b>"
                        )

                        await telegram_service.send_message(
                            telegram_service.support_group_id,
                            f"✅ <b>Ticket #{ticket_id} closed</b> • {ticket.category or 'General'}"
                        )

        # Handle direct messages from agents
        elif "message" in update:
            message = update["message"]
            from_user = message["from"]
            text = message.get("text", "")
            agent_telegram_id = from_user["id"]
            
            with session_scope() as db:
                from .models import SupportAgent
                
                # Find agent
                agent_stmt = select(SupportAgent).where(SupportAgent.tg_chat_id == agent_telegram_id)
                agent = db.execute(agent_stmt).scalars().first()
                
                if not agent:
                    return {"ok": True}
                
                # Handle commands
                if text.startswith("/close"):
                    try:
                        # Parse ticket ID from command: /close_3 or /close 3
                        if "_" in text:
                            ticket_id = int(text.split("_")[1])
                        else:
                            ticket_id = int(text.split()[1])
                        
                        # Find and close the ticket
                        ticket = db.get(SupportTicket, ticket_id)
                        if ticket and ticket.assigned_agent_id == agent.id:
                            ticket.status = "closed"
                            ticket.closed_at = datetime.utcnow()
                            db.commit()
                            
                            # Notify agent
                            await telegram_service.send_message(
                                str(agent_telegram_id),
                                f"✅ <b>Ticket #{ticket_id} closed successfully!</b>\n\n"
                                f"Category: {ticket.category or 'General'}\n"
                                f"Status: Resolved"
                            )
                            
                            # Notify support group
                            await telegram_service.send_message(
                                telegram_service.support_group_id,
                                f"✅ <b>Ticket #{ticket_id} closed</b> by {agent.name} • {ticket.category or 'General'}"
                            )
                        else:
                            await telegram_service.send_message(
                                str(agent_telegram_id),
                                f"❌ Cannot close ticket #{ticket_id}. Either it doesn't exist or it's not assigned to you."
                            )
                    except (ValueError, IndexError):
                        await telegram_service.send_message(
                            str(agent_telegram_id),
                            "❌ Invalid command. Use: /close_123 or /close 123"
                        )
                
                # Handle help command
                elif text.startswith("/help"):
                    await telegram_service.send_message(
                        str(agent_telegram_id),
                        "🤖 <b>Agent Commands:</b>\n\n"
                        "• Send regular messages to reply to customers\n"
                        "• <code>/close_123</code> - Close ticket #123\n"
                        "• <code>/close 123</code> - Close ticket #123\n"
                        "• <code>/help</code> - Show this help message"
                    )
                
                # Handle regular messages (responses to customers)
                elif text and not text.startswith("/"):
                    # Find most recent claimed ticket for this agent
                    ticket_stmt = (
                        select(SupportTicket)
                        .where(SupportTicket.assigned_agent_id == agent.id)
                        .where(SupportTicket.status == "claimed")
                        .order_by(desc(SupportTicket.claimed_at))
                    )
                    ticket = db.execute(ticket_stmt).scalars().first()
                    
                    if ticket:
                        # Save agent's reply
                        reply_message = SupportMessage(
                            ticket_id=ticket.id,
                            session_id=ticket.session_id,
                            sender="agent",
                            body=text,
                            created_at=datetime.utcnow(),
                            tg_message_id=str(message["message_id"])
                        )
                        db.add(reply_message)
                        db.commit()
                        
                        # Confirm message sent
                        await telegram_service.send_message(
                            str(agent_telegram_id),
                            f"📨 Message sent to customer (Ticket #{ticket.id})"
                        )
                    else:
                        await telegram_service.send_message(
                            str(agent_telegram_id),
                            "❌ No active ticket assigned to you. Claim a ticket first."
                        )
        
        return {"ok": True}
        
    except Exception as e:
        print(f"Telegram webhook error: {e}")
        return {"ok": False}


@app.post("/api/tickets/{ticket_id}/close")
async def close_ticket(ticket_id: int):
    """Close a support ticket"""
    try:
        with session_scope() as db:
            ticket = db.get(SupportTicket, ticket_id)
            if not ticket:
                raise HTTPException(status_code=404, detail="Ticket not found")
            
            if ticket.status == "closed":
                return {"ok": True, "message": "Ticket already closed", "ticket_id": ticket_id}
            
            # Close the ticket
            ticket.status = "closed"
            ticket.closed_at = datetime.utcnow()
            db.commit()
            
            # Send notification to Telegram
            try:
                if ticket.assigned_agent_id:
                    # Find the agent
                    from .models import SupportAgent
                    agent_stmt = select(SupportAgent).where(SupportAgent.id == ticket.assigned_agent_id)
                    agent = db.execute(agent_stmt).scalars().first()
                    
                    if agent:
                        await telegram_service.send_message(
                            str(agent.tg_chat_id),
                            f"✅ <b>Ticket #{ticket_id} has been closed</b>\n\n"
                            f"Category: {ticket.category or 'General'}\n"
                            f"Thank you for your help!"
                        )
                
                # Also notify support group
                await telegram_service.send_message(
                    telegram_service.support_group_id,
                    f"✅ <b>Ticket #{ticket_id} closed</b> • {ticket.category or 'General'}"
                )
            except Exception as e:
                print(f"Failed to send close notification: {e}")
        
        return {"ok": True, "message": "Ticket closed successfully", "ticket_id": ticket_id}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/session/{session_id}/new-ticket")
async def create_new_ticket(session_id: str):
    """Create a new ticket for a session (when previous ticket is closed)"""
    try:
        with session_scope() as db:
            session = db.get(SupportSession, session_id)
            if not session:
                raise HTTPException(status_code=404, detail="Session not found")
            
            # Close all previous tickets for this session before creating a new one
            prev_tickets_stmt = (
                select(SupportTicket)
                .where(SupportTicket.session_id == session_id)
                .order_by(desc(SupportTicket.created_at))
            )
            prev_tickets = db.execute(prev_tickets_stmt).scalars().all()
            for t in prev_tickets:
                if t.status != "closed":
                    t.status = "closed"
                    t.closed_at = datetime.utcnow()
            
            # Create a new ticket
            new_ticket = SupportTicket(
                session_id=session_id,
                status="open",
                category=None,
                priority=0,
                created_at=datetime.utcnow(),
            )
            db.add(new_ticket)
            db.commit()
            
            # Notify support group about new ticket
            try:
                await telegram_service.send_message(
                    telegram_service.support_group_id,
                    f"🆕 <b>New Ticket #{new_ticket.id}</b> • General\n"
                    f"Customer started a new conversation\n"
                    f"Available for claiming."
                )
            except Exception as e:
                print(f"Failed to send new ticket notification: {e}")
            
            return {
                "ok": True, 
                "message": "New ticket created successfully", 
                "ticket_id": new_ticket.id
            }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tickets/{ticket_id}/reopen")
async def reopen_ticket(ticket_id: int):
    """Reopen a closed support ticket"""
    try:
        with session_scope() as db:
            ticket = db.get(SupportTicket, ticket_id)
            if not ticket:
                raise HTTPException(status_code=404, detail="Ticket not found")
            
            if ticket.status != "closed":
                return {"ok": True, "message": "Ticket is not closed", "ticket_id": ticket_id}
            
            # Reopen the ticket
            ticket.status = "open"
            ticket.closed_at = None
            ticket.assigned_agent_id = None  # Unassign agent
            db.commit()
            
            # Send notification to support group
            try:
                await telegram_service.send_message(
                    telegram_service.support_group_id,
                    f"🔄 <b>Ticket #{ticket_id} reopened</b> • {ticket.category or 'General'}\n"
                    f"Available for claiming again."
                )
            except Exception as e:
                print(f"Failed to send reopen notification: {e}")
        
        return {"ok": True, "message": "Ticket reopened successfully", "ticket_id": ticket_id}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/setup/telegram-webhook")
async def setup_telegram_webhook(webhook_url: str, drop_pending: bool = False):
    """Set the Telegram webhook URL"""
    try:
        # Optionally drop pending updates if backlog built up
        if drop_pending:
            try:
                import httpx
                async with httpx.AsyncClient() as client:
                    await client.post(
                        f"https://api.telegram.org/bot{telegram_service.bot_token}/deleteWebhook",
                        params={"drop_pending_updates": True}
                    )
            except Exception:
                pass

        success = await telegram_service.set_webhook(webhook_url)
        return {
            "ok": success,
            "message": "Webhook set successfully" if success else "Failed to set webhook",
            "webhook_url": webhook_url
        }
    except Exception as e:
        return {"ok": False, "message": f"Error setting webhook: {e}"}


@app.post("/api/session/{session_id}/messages-simple")
async def create_message_simple(session_id: str, body: dict):
    """Simple message creation for debugging"""
    try:
        print(f"DEBUG: Simple message creation for session {session_id}")
        print(f"DEBUG: Body: {body}")
        
        # Just return success without doing anything
        return {"success": True, "session_id": session_id, "body": body}
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Simple message error: {error_details}")
        return {"success": False, "error": str(e)}


@app.post("/api/test/message")
async def test_message_creation(session_id: str = "bd205337-c9e8-41de-b561-360c9dc2ac4a"):
    """Test message creation step by step"""
    try:
        print(f"Step 1: Starting message creation for session {session_id}")
        
        with session_scope() as db:
            print(f"Step 2: Database session created")
            
            # Check if session exists
            session = db.get(SupportSession, session_id)
            if session is None:
                return {"error": "Session not found", "session_id": session_id}
            
            print(f"Step 3: Session found: {session.id}")
            
            # Look for existing ticket
            ticket_stmt = (
                select(SupportTicket)
                .where(SupportTicket.session_id == session_id)
                .where(SupportTicket.status.in_(["open", "claimed"]))
                .order_by(desc(SupportTicket.created_at))
            )
            ticket = db.execute(ticket_stmt).scalars().first()
            
            print(f"Step 4: Existing ticket: {ticket.id if ticket else 'None'}")
            
            if ticket is None:
                print(f"Step 5: Creating new ticket")
                ticket = SupportTicket(
                    session_id=session_id,
                    status="open",
                    category="Test Category",
                    priority=0,
                    contact_name="Test User",
                    contact_email="test@example.com",
                    created_at=datetime.utcnow(),
                )
                db.add(ticket)
                db.flush()
                print(f"Step 6: New ticket created with ID: {ticket.id}")
            
            print(f"Step 7: Creating message")
            message = SupportMessage(
                ticket_id=ticket.id,
                session_id=session_id,
                sender="visitor",
                body="Test message body",
                created_at=datetime.utcnow(),
            )
            db.add(message)
            db.commit()
            print(f"Step 8: Message created with ID: {message.id}")
            
            return {
                "success": True,
                "session_id": session_id,
                "ticket_id": ticket.id,
                "message_id": message.id,
                "steps_completed": 8
            }
            
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error at step: {error_details}")
        return {"success": False, "error": str(e), "traceback": error_details}


@app.post("/api/test/db")
async def test_db():
    """Test database operations only"""
    try:
        with session_scope() as db:
            # Create a test session
            session_id = "test-session-123"
            
            # Check if session exists
            session = db.get(SupportSession, session_id)
            if not session:
                session = SupportSession(
                    id=session_id,
                    created_at=datetime.utcnow(),
                    last_seen_at=datetime.utcnow(),
                    locale="en",
                    user_agent="test",
                    referer="test"
                )
                db.add(session)
                db.flush()
            
            # Create a test ticket
            ticket = SupportTicket(
                session_id=session_id,
                status="open",
                category="Test",
                priority=0,
                contact_name="Test User",
                contact_email="test@example.com",
                created_at=datetime.utcnow(),
            )
            db.add(ticket)
            db.flush()
            
            return {"success": True, "ticket_id": ticket.id, "session_id": session_id}
            
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Database test error: {error_details}")
        return {"success": False, "error": str(e), "traceback": error_details}


@app.post("/api/test/message-with-debug")
async def test_message_with_debug():
    """Test message creation with debug info returned in response"""
    try:
        # Create session
        session_id = f"debug-{datetime.utcnow().strftime('%H%M%S')}"
        with session_scope() as db:
            session = SupportSession(
                id=session_id,
                created_at=datetime.utcnow(),
                last_seen_at=datetime.utcnow(),
                locale="en",
                user_agent="debug",
                referer="debug"
            )
            db.add(session)
            db.commit()
        
        # Create message
        payload = {
            "body": "🔍 Debug test with response feedback",
            "category": "Debug",
            "contact_name": "Debug User",
            "contact_email": "debug@test.com"
        }
        
        debug_info = []
        
        with session_scope() as db:
            session = db.get(SupportSession, session_id)
            session.last_seen_at = datetime.utcnow()
            
            # Look for existing ticket
            ticket_stmt = (
                select(SupportTicket)
                .where(SupportTicket.session_id == session_id)
                .where(SupportTicket.status.in_(["open", "claimed"]))
                .order_by(desc(SupportTicket.created_at))
            )
            ticket = db.execute(ticket_stmt).scalars().first()
            
            is_new_ticket = ticket is None
            debug_info.append(f"is_new_ticket: {is_new_ticket}")
            
            if is_new_ticket:
                ticket = SupportTicket(
                    session_id=session_id,
                    status="open",
                    category=payload.get("category"),
                    priority=PRIORITY_MAP.get((payload.get("priority") or "low").lower(), 0),
                    contact_name=payload.get("contact_name"),
                    contact_email=payload.get("contact_email"),
                    created_at=datetime.utcnow(),
                )
                db.add(ticket)
                db.flush()
            
            message = SupportMessage(
                ticket_id=ticket.id,
                session_id=session_id,
                sender="visitor",
                body=payload.get("body", "").strip(),
                created_at=datetime.utcnow(),
            )
            db.add(message)
            db.commit()
            
            # Capture values
            ticket_id = ticket.id
            ticket_category = ticket.category
            ticket_assigned_agent_id = ticket.assigned_agent_id
            message_id = message.id
        
        # Test notification
        should_notify = is_new_ticket or ticket_assigned_agent_id is None
        debug_info.append(f"assigned_agent_id: {ticket_assigned_agent_id}")
        debug_info.append(f"should_notify: {should_notify}")
        
        notification_result = None
        if should_notify:
            try:
                notification_result = await telegram_service.notify_new_ticket(
                    ticket_id=ticket_id,
                    category=ticket_category or "General",
                    message_body=payload.get("body", "").strip()
                )
                debug_info.append(f"notification_sent: True")
                debug_info.append(f"telegram_message_id: {notification_result}")
            except Exception as e:
                debug_info.append(f"notification_error: {str(e)}")
        
        return {
            "success": True,
            "ticket_id": ticket_id,
            "message_id": message_id,
            "debug_info": debug_info,
            "notification_result": notification_result
        }
        
    except Exception as e:
        import traceback
        return {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }


@app.post("/api/test/notify")
async def test_notify():
    """Test the notify_new_ticket function directly"""
    try:
        print(f"Testing notify_new_ticket function...")
        result = await telegram_service.notify_new_ticket(
            ticket_id=999,
            category="Test Category",
            message_body="Test message for debugging notification"
        )
        print(f"Notification result: {result}")
        return {"success": True, "result": result}
    except Exception as e:
        print(f"Notification error: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


@app.post("/api/test/telegram")
async def test_telegram():
    """Test Telegram API directly"""
    try:
        print(f"Testing Telegram service...")
        print(f"Bot token configured: {bool(telegram_service.bot_token)}")
        print(f"Support group ID: {telegram_service.support_group_id}")
        
        result = await telegram_service.send_message(
            "-4828761055", 
            "🧪 <b>Test message from FastAPI!</b>\n\nThis is a test to verify the Telegram integration is working."
        )
        print(f"Send message result: {result}")
        return {"success": True, "result": result}
    except Exception as e:
        print(f"Exception in test_telegram: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/setup/info")
async def setup_info():
    """Get setup information"""
    bot_token_configured = bool(os.getenv("TELEGRAM_BOT_TOKEN"))
    group_id_configured = bool(os.getenv("SUPPORT_GROUP_CHAT_ID"))
    
    return {
        "telegram_bot_configured": bot_token_configured,
        "support_group_configured": group_id_configured,
        "webhook_endpoint": "/api/telegram/webhook",
        "setup_instructions": {
            "1": "Set TELEGRAM_BOT_TOKEN environment variable",
            "2": "Set SUPPORT_GROUP_CHAT_ID environment variable", 
            "3": "Call POST /api/setup/telegram-webhook with your webhook URL",
            "4": "Add your bot to your Telegram support group"
        }
    }


@app.get("/")
async def root():
    return {"message": "Support backend running"}


# SPA catch-all must be registered last so API routes take precedence
if frontend_path.exists():
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Don't serve API routes as static files
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        
        # Serve index.html for all non-API routes (SPA routing)
        return FileResponse(frontend_path / "index.html")


# --- Diagnostic endpoint to simulate Telegram "Claim" flow ---
@app.post("/api/test/claim")
async def test_claim(ticket_id: int, agent_tg_id: int):
    """Simulate a Telegram claim callback to verify assignment logic.

    This does not rely on Telegram webhook delivery; it directly exercises the
    same DB assignment path used in the webhook handler.
    """
    try:
        from .models import SupportAgent, SupportTicket

        with session_scope() as db:
            # Ensure agent exists (create if needed)
            agent_stmt = select(SupportAgent).where(SupportAgent.tg_chat_id == agent_tg_id)
            agent = db.execute(agent_stmt).scalars().first()

            if not agent:
                agent = SupportAgent(
                    name="Test Agent",
                    tg_chat_id=agent_tg_id,
                    is_active=True,
                    created_at=datetime.utcnow(),
                )
                db.add(agent)
                db.flush()

            ticket = db.get(SupportTicket, ticket_id)
            if not ticket:
                raise HTTPException(status_code=404, detail="Ticket not found")

            already_claimed = ticket.assigned_agent_id is not None
            if not already_claimed:
                ticket.assigned_agent_id = agent.id
                ticket.status = "claimed"
                ticket.claimed_at = datetime.utcnow()
                db.commit()

        # Notify agent similarly to webhook flow
        await telegram_service.notify_agent_assigned(str(agent_tg_id), ticket_id)

        return {
            "ok": True,
            "ticket_id": ticket_id,
            "agent_tg_id": agent_tg_id,
            "assigned": True,
            "already_claimed": already_claimed,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
