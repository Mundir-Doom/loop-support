export type SenderType = "visitor" | "agent" | "system";

export interface SupportMessage {
  id: string;
  ticketId: number;
  sessionId: string;
  sender: SenderType;
  body: string | null;
  createdAt: string;
}

export interface SupportTicket {
  id: number;
  sessionId: string;
  status: "open" | "claimed" | "closed";
  category: string | null;
  priority: number;
  assignedAgentId: number | null;
  contactName: string | null;
  contactEmail: string | null;
  createdAt: string;
  claimedAt: string | null;
  closedAt: string | null;
}

export interface SupportSession {
  sessionId: string;
}

export interface TicketFormInput {
  name: string;
  email: string;
  issue: string;
  priority: "low" | "medium" | "high";
  category?: string;
}

export interface SupportState {
  session?: SupportSession;
  ticket?: SupportTicket;
  messages: SupportMessage[];
  isInitializing: boolean;
  isSending: boolean;
  isSubmittingTicket: boolean;
  isTyping: boolean;
  isConnected: boolean;
  error?: string;
}

export interface ConversationSnapshot {
  ticket?: SupportTicket;
  messages: SupportMessage[];
}
