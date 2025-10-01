import { supportConfig } from "./config";
import { ConversationSnapshot, SupportSession, TicketFormInput } from "./types";

export class ApiError extends Error {
  status?: number;
  detail?: unknown;

  constructor(message: string, status?: number, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

interface MessagePayload {
  body: string;
  category?: string | null;
  priority?: "low" | "medium" | "high";
  contact_name?: string | null;
  contact_email?: string | null;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: Record<string, unknown> | null;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body } = options;
  const response = await fetch(`${supportConfig.apiBaseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = typeof payload?.detail === "string"
      ? payload.detail
      : typeof payload?.error === "string"
        ? payload.error
        : `Request to ${path} failed`;
    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

export async function createSupportSession(): Promise<SupportSession> {
  const result = await request<{ session_id: string }>("/session", {
    method: "POST",
    body: {
      locale: navigator?.language,
      user_agent: navigator?.userAgent,
      referer: typeof window !== "undefined" ? window.location.href : undefined
    }
  });

  return {
    sessionId: result.session_id
  };
}

export async function fetchConversation(sessionId: string): Promise<ConversationSnapshot> {
  return request<ConversationSnapshot>(`/session/${sessionId}`);
}

export async function sendVisitorMessage(sessionId: string, payload: MessagePayload) {
  if (!payload.body || payload.body.trim().length === 0) {
    throw new Error("Message body is required");
  }

  return request<{ ok: boolean; ticket_id: number; message_id: number }>(`/session/${sessionId}/messages`, {
    method: "POST",
    body: payload
  });
}

export async function submitTicket(sessionId: string, data: TicketFormInput) {
  const message = data.issue.trim();
  if (!message) {
    throw new Error("Issue description is required");
  }

  return sendVisitorMessage(sessionId, {
    body: message,
    category: data.category ?? supportConfig.defaultCategory,
    priority: data.priority,
    contact_name: data.name,
    contact_email: data.email
  });
}

export async function closeTicket(ticketId: number) {
  if (!ticketId) {
    throw new Error("Ticket id is required");
  }

  return request<{ ok: boolean; ticket_id: number; message: string }>(`/tickets/${ticketId}/close`, {
    method: "POST"
  });
}
