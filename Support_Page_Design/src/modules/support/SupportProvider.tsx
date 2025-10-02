import React, { ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { fetchConversation, submitTicket as submitTicketApi, sendVisitorMessage, closeTicket as closeTicketApi, ApiError } from "./api";
import { useSupportSession } from "./useSupportSession";
import { ConversationSnapshot, SupportMessage, SupportState, SupportTicket, TicketFormInput } from "./types";

interface SupportContextValue extends SupportState {
  isSessionLoading: boolean;
  sendChatMessage: (text: string) => Promise<void>;
  submitTicket: (input: TicketFormInput) => Promise<void>;
  refreshAll: () => Promise<void>;
  startNewConversation: () => Promise<void>;
  closeTicket: () => Promise<void>;
}

const SupportContext = createContext<SupportContextValue | undefined>(undefined);

function mapSnapshot(snapshot: ConversationSnapshot): { ticket?: SupportTicket; messages: SupportMessage[] } {
  const messages = (snapshot.messages ?? []).map((message) => ({
    ...message,
    id: String(message.id)
  }));
  return {
    ticket: snapshot.ticket,
    messages: messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  };
}

const initialState: SupportState = {
  messages: [],
  isInitializing: true,
  isSending: false,
  isSubmittingTicket: false,
  isTyping: false,
  isConnected: false
};

export function SupportProvider({ children }: { children: ReactNode }) {
  const { session, isLoading: isSessionLoading, error: sessionError, refresh, reset } = useSupportSession();
  const [state, setState] = useState<SupportState>(() => ({ ...initialState }));
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const setError = useCallback((message?: string) => {
    setState((prev) => ({ ...prev, error: message }));
  }, []);

  const ensureSession = useCallback(async () => {
    if (session) {
      return session;
    }
    const refreshed = await refresh();
    if (!refreshed) {
      throw new Error("Support session unavailable");
    }
    return refreshed;
  }, [session, refresh]);

  const loadConversation = useCallback(async () => {
    if (!session) {
      setState((prev) => ({ ...prev, ticket: undefined, messages: [], isInitializing: false, isConnected: false }));
      return;
    }

    setState((prev) => ({
      ...prev,
      isInitializing: true,
      error: undefined
    }));

    try {
      const snapshot = await fetchConversation(session.sessionId);
      const mapped = mapSnapshot(snapshot);
      setState((prev) => ({
        ...prev,
        ticket: mapped.ticket,
        messages: mapped.messages,
        isInitializing: false,
        isConnected: true,
        error: undefined
      }));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        reset();
        await refresh();
        return;
      }
      const message = error instanceof Error ? error.message : "Failed to load conversation";
      setState((prev) => ({
        ...prev,
        ticket: undefined,
        messages: [],
        isInitializing: false,
        isConnected: false,
        error: message
      }));
    }
  }, [session, reset, refresh]);

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const interval = setInterval(async () => {
      if (!stateRef.current.isSending && !stateRef.current.isSubmittingTicket) {
        const previousMessages = stateRef.current.messages;
        const previousAgentMessageCount = previousMessages.filter(m => m.sender === "agent").length;
        
        await loadConversation();
        
        // Check if new agent messages arrived
        const currentMessages = stateRef.current.messages;
        const currentAgentMessageCount = currentMessages.filter(m => m.sender === "agent").length;
        
        // If we received a new agent message, stop typing
        if (currentAgentMessageCount > previousAgentMessageCount && stateRef.current.isTyping) {
          setState((prev) => ({ ...prev, isTyping: false }));
        }
      }
    }, 1500);

    return () => {
      clearInterval(interval);
    };
  }, [session, loadConversation]);

  const refreshAll = useCallback(async () => {
    await loadConversation();
  }, [loadConversation]);

  const sendChatMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const activeSession = await ensureSession();
      const currentMessageCount = stateRef.current.messages.length;
      
      setState((prev) => ({ ...prev, isSending: true, error: undefined }));

      try {
        await sendVisitorMessage(activeSession.sessionId, {
          body: trimmed,
          category: stateRef.current.ticket?.category ?? null
        });
        
        // Start typing indicator if we have an assigned agent (ticket is claimed)
        const hasAssignedAgent = stateRef.current.ticket?.status === "claimed";
        if (hasAssignedAgent) {
          setState((prev) => ({ ...prev, isTyping: true }));
        }
        
        await loadConversation();
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          reset();
          await refresh();
        } else {
          const message = error instanceof Error ? error.message : "Failed to send message";
          setError(message);
        }
        throw error;
      } finally {
        setState((prev) => ({ ...prev, isSending: false }));
      }
    },
    [ensureSession, loadConversation, refresh, reset, setError]
  );

  const submitTicket = useCallback(
    async (input: TicketFormInput) => {
      const activeSession = await ensureSession();
      setState((prev) => ({ ...prev, isSubmittingTicket: true, error: undefined }));
      try {
        await submitTicketApi(activeSession.sessionId, input);
        await loadConversation();
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          reset();
          await refresh();
        } else {
          const message = error instanceof Error ? error.message : "Failed to submit ticket";
          setError(message);
        }
        throw error;
      } finally {
        setState((prev) => ({ ...prev, isSubmittingTicket: false }));
      }
    },
    [ensureSession, loadConversation, refresh, reset, setError]
  );

  const startNewConversation = useCallback(async () => {
    try {
      reset();
      const freshSession = await refresh();
      if (!freshSession) {
        throw new Error("Unable to start a new conversation");
      }
      setState({ ...initialState, isInitializing: false, messages: [], ticket: undefined, error: undefined });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start new conversation";
      setError(message);
      throw error;
    }
  }, [refresh, reset, setError]);

  const closeTicket = useCallback(async () => {
    const currentTicket = stateRef.current.ticket;
    if (!currentTicket) {
      throw new Error("No active ticket to close");
    }

    try {
      setState((prev) => ({ ...prev, isSubmittingTicket: true, error: undefined }));
      await closeTicketApi(currentTicket.id);
      await loadConversation();
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        reset();
        await refresh();
      } else {
        const message = error instanceof Error ? error.message : "Failed to close ticket";
        setError(message);
      }
      throw error;
    } finally {
      setState((prev) => ({ ...prev, isSubmittingTicket: false }));
    }
  }, [loadConversation, refresh, reset, setError]);

  const contextValue: SupportContextValue = {
    session,
    ticket: state.ticket,
    messages: state.messages,
    isInitializing: state.isInitializing || isSessionLoading,
    isSending: state.isSending,
    isSubmittingTicket: state.isSubmittingTicket,
    isTyping: state.isTyping,
    isConnected: state.isConnected,
    error: state.error ?? sessionError,
    isSessionLoading,
    sendChatMessage,
    submitTicket,
    refreshAll,
    startNewConversation,
    closeTicket
  };

  return <SupportContext.Provider value={contextValue}>{children}</SupportContext.Provider>;
}

export function useSupport() {
  const ctx = useContext(SupportContext);
  if (!ctx) {
    throw new Error("useSupport must be used within a SupportProvider");
  }
  return ctx;
}
