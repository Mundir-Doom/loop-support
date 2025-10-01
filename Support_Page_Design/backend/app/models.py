from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from .database import Base


class SupportSession(Base):
    __tablename__ = "support_sessions"

    id = Column(String, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_seen_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    locale = Column(String, nullable=True)
    user_agent = Column(Text, nullable=True)
    referer = Column(Text, nullable=True)

    tickets = relationship("SupportTicket", back_populates="session", cascade="all, delete-orphan")


class SupportAgent(Base):
    __tablename__ = "agents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    tg_chat_id = Column(BigInteger, unique=True, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    tickets = relationship("SupportTicket", back_populates="agent")


class SupportTicket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("support_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String, default="open", nullable=False)
    category = Column(String, nullable=True)
    priority = Column(Integer, default=0, nullable=False)
    contact_name = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    assigned_agent_id = Column(Integer, ForeignKey("agents.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    claimed_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)

    session = relationship("SupportSession", back_populates="tickets")
    agent = relationship("SupportAgent", back_populates="tickets")
    messages = relationship("SupportMessage", back_populates="ticket", cascade="all, delete-orphan")


class SupportMessage(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(String, ForeignKey("support_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    sender = Column(String, nullable=False)
    body = Column(Text, nullable=True)
    tg_message_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    ticket = relationship("SupportTicket", back_populates="messages")


PRIORITY_MAP = {
    "low": 0,
    "medium": 1,
    "high": 2,
}


