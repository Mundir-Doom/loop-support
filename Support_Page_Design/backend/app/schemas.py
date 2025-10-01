from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class SessionCreateRequest(BaseModel):
    locale: Optional[str] = None
    user_agent: Optional[str] = Field(default=None, alias="user_agent")
    referer: Optional[str] = None


class SessionResponse(BaseModel):
    session_id: str


class MessageCreateRequest(BaseModel):
    body: str
    category: Optional[str] = None
    priority: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None


class SupportMessageSchema(BaseModel):
    id: int
    ticketId: int
    sessionId: str
    sender: str
    body: Optional[str]
    createdAt: datetime

    model_config = {"from_attributes": True}


class SupportTicketSchema(BaseModel):
    id: int
    sessionId: str
    status: str
    category: Optional[str]
    priority: int
    assignedAgentId: Optional[int]
    contactName: Optional[str]
    contactEmail: Optional[str]
    createdAt: datetime
    claimedAt: Optional[datetime]
    closedAt: Optional[datetime]

    model_config = {"from_attributes": True}


class ConversationResponse(BaseModel):
    ticket: Optional[SupportTicketSchema] = None
    messages: List[SupportMessageSchema] = []


class MessageResponse(BaseModel):
    ok: bool = True
    ticket_id: int
    message_id: int

