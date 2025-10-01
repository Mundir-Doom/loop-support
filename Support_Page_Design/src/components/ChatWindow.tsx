import { motion, useMotionValue, useTransform, PanInfo } from "motion/react";
import { X, Send, RotateCcw } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { SupportMessage } from "../modules/support";
import { TypingIndicator } from "./TypingIndicator";

interface ChatWindowProps {
  onClose: () => void;
  messages: SupportMessage[];
  onSend: (text: string) => Promise<void>;
  onRefresh?: () => void | Promise<void>;
  onStartNewConversation?: () => Promise<void>;
  onOpenTicket?: () => void;
  onCloseTicket?: () => Promise<void>;
  isLoading: boolean;
  isSending: boolean;
  isTyping?: boolean;
  isConnected?: boolean;
  error?: string;
  ticketStatus?: "open" | "claimed" | "closed";
  ticketId?: number;
}

function formatStatus(status?: "open" | "claimed" | "closed") {
  if (!status) return "No ticket";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function ChatWindow({
  onClose,
  messages,
  onSend,
  onRefresh,
  onStartNewConversation,
  onOpenTicket,
  onCloseTicket,
  isLoading,
  isSending,
  isTyping,
  isConnected,
  error,
  ticketStatus,
  ticketId
}: ChatWindowProps) {
  const y = useMotionValue(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [localError, setLocalError] = useState<string | undefined>(undefined);
  const [isClosingTicket, setIsClosingTicket] = useState(false);

  const backdropOpacity = useTransform(y, [0, 300], [1, 0]);

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [messages]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [sortedMessages]);

  const handleDragEnd = (_event: any, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose();
    }
  };

  const hasTicket = typeof ticketStatus === "string" && ticketStatus.length > 0;
  const isTicketActive = ticketStatus === "open" || ticketStatus === "claimed";
  const inputDisabled = !isTicketActive || isSending;
  const placeholder = !hasTicket
    ? "Open a ticket to start chatting"
    : ticketStatus === "closed"
      ? "Ticket is closed"
      : "Type your message...";

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inputValue.trim()) return;
    if (!isTicketActive) {
      setLocalError("Open a ticket to start chatting with our team.");
      return;
    }

    try {
      setLocalError(undefined);
      await onSend(inputValue);
      setInputValue("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send message";
      setLocalError(message);
    }
  };

  const handleStartNewConversation = async () => {
    if (!onStartNewConversation) return;

    try {
      setLocalError(undefined);
      await onStartNewConversation();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start new conversation";
      setLocalError(message);
    }
  };

  const handleCloseTicket = async () => {
    if (!onCloseTicket) return;
    try {
      setLocalError(undefined);
      setIsClosingTicket(true);
      await onCloseTicket();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to close ticket";
      setLocalError(message);
    } finally {
      setIsClosingTicket(false);
    }
  };

  const activeError = localError ?? error;
  const ticketLabel = hasTicket
    ? `Ticket #${ticketId ?? "—"} • ${formatStatus(ticketStatus)}`
    : "No ticket opened yet";

  const renderConversation = () => {
    if (!hasTicket) {
      return null;
    }

    if (sortedMessages.length === 0) {
      return (
        <div style={{ color: "#55595F", fontSize: "14px" }}>
          {ticketStatus === "closed" ? (
            <div className="text-center space-y-4">
              <div style={{ color: "#55595F", fontSize: "14px" }} className="flex flex-col items-center gap-3">
                This conversation has been closed. Start a new conversation to continue chatting.
              </div>
              <motion.button
                onClick={handleStartNewConversation}
                className="w-full h-12 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: "#0B0B0C",
                  color: "#FFFFFF",
                  fontSize: "15px",
                  fontWeight: 500
                }}
                disabled={isLoading}
                whileHover={{ scale: isLoading ? 1 : 1.02 }}
                whileTap={{ scale: isLoading ? 1 : 0.98 }}
              >
                {isLoading ? "Starting..." : "Start New Conversation"}
              </motion.button>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center gap-3">
              <p>Ticket created! Send your first message when you're ready.</p>
            </div>
          )}
        </div>
      );
    }

    return (
      <>
        {sortedMessages.map((message) => (
          <div
            key={`${message.id}-${message.createdAt}`}
            className={`flex ${message.sender === "visitor" ? "justify-end" : "justify-start"} mb-4`}
          >
            <div
              className="max-w-[75%] px-4 py-3 rounded-2xl"
              style={{
                backgroundColor:
                  message.sender === "visitor"
                    ? "#0B0B0C"
                    : message.sender === "agent"
                    ? "rgba(11, 11, 12, 0.06)"
                    : "rgba(11, 11, 12, 0.04)",
                color: message.sender === "visitor" ? "#FFFFFF" : "#0B0B0C",
                fontSize: "15px",
                lineHeight: "1.4"
              }}
            >
              {message.body}
            </div>
          </div>
        ))}
        {isTyping && <TypingIndicator />}
      </>
    );
  };

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{
        duration: 0.3,
        ease: [0.32, 0.72, 0, 1]
      }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.35)",
          opacity: backdropOpacity
        }}
        onClick={onClose}
      />

      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.2 }}
        onDragEnd={handleDragEnd}
        style={{ y }}
        className="relative w-full bg-white touch-pan-y flex flex-col"
        style={{
          borderTopLeftRadius: "24px",
          borderTopRightRadius: "24px",
          boxShadow: "0 -4px 24px rgba(0, 0, 0, 0.15)",
          height: "80vh",
          maxHeight: "700px"
        }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{
          duration: 0.3,
          ease: [0.32, 0.72, 0, 1]
        }}
      >
        <div className="pt-3 pb-2 flex justify-center">
          <div
            className="w-10 h-1 rounded-full"
            style={{ backgroundColor: "rgba(11, 11, 12, 0.15)" }}
          />
        </div>

        <div className="px-6 pb-2 pt-2 flex items-center justify-between border-b" style={{ borderColor: "rgba(0, 0, 0, 0.1)" }}>
          <div>
            <div className="flex items-center gap-2">
              <h3 style={{ fontSize: "20px", fontWeight: 600, color: "#0B0B0C" }}>
                Live Chat
              </h3>
              <motion.div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: isConnected ? "#10B981" : "#EF4444",
                  boxShadow: isConnected 
                    ? "0 0 8px rgba(16, 185, 129, 0.4)" 
                    : "0 0 8px rgba(239, 68, 68, 0.4)"
                }}
                animate={{
                  scale: isConnected ? [1, 1.1, 1] : 1,
                  opacity: isConnected ? [1, 0.7, 1] : 1
                }}
                transition={{
                  duration: 2,
                  repeat: isConnected ? Infinity : 0,
                  ease: "easeInOut"
                }}
              />
            </div>
            <p style={{ fontSize: "13px", fontWeight: 400, color: "#55595F" }}>
              {isConnected ? "Connected" : "Disconnected"} • {ticketLabel}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={() => void onRefresh()}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "rgba(11, 11, 12, 0.06)" }}
                title="Refresh messages"
              >
                <RotateCcw size={16} strokeWidth={2.5} style={{ color: "#0B0B0C" }} />
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "rgba(11, 11, 12, 0.06)" }}
            >
              <X size={18} strokeWidth={2.5} style={{ color: "#0B0B0C" }} />
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {isLoading && sortedMessages.length === 0 ? (
            <div style={{ color: "#55595F", fontSize: "14px" }} className="flex flex-col items-center gap-3">
              Preparing your session…
            </div>
          ) : (
            renderConversation()
          )}
        </div>

        {activeError && (
          <div className="px-6 text-sm" style={{ color: "#E5484D" }}>
            {activeError}
          </div>
        )}

        <div className="px-6 py-4 border-t" style={{ borderColor: "rgba(0, 0, 0, 0.1)" }}>
          {!hasTicket ? (
            <div className="text-center space-y-4">
              <div style={{ color: "#55595F", fontSize: "14px" }} className="flex flex-col items-center gap-3">
                Open a ticket to start a conversation with our support team.
              </div>
              {onOpenTicket && (
                <motion.button
                  onClick={onOpenTicket}
                  className="w-full h-12 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: "#0B0B0C",
                    color: "#FFFFFF",
                    fontSize: "15px",
                    fontWeight: 500
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Open Ticket
                </motion.button>
              )}
            </div>
          ) : ticketStatus === "closed" ? (
            <div className="text-center space-y-4">
              <div style={{ color: "#55595F", fontSize: "14px" }} className="flex flex-col items-center gap-3">
                This conversation has been closed. Start a new conversation to continue chatting.
              </div>
              <motion.button
                onClick={handleStartNewConversation}
                className="w-full h-12 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: "#0B0B0C",
                  color: "#FFFFFF",
                  fontSize: "15px",
                  fontWeight: 500
                }}
                disabled={isLoading}
                whileHover={{ scale: isLoading ? 1 : 1.02 }}
                whileTap={{ scale: isLoading ? 1 : 0.98 }}
              >
                {isLoading ? "Starting..." : "Start New Conversation"}
              </motion.button>
            </div>
          ) : (
            <div className="space-y-3">
              {onCloseTicket && (
                <motion.button
                  onClick={handleCloseTicket}
                  className="w-full h-11 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: "rgba(11, 11, 12, 0.06)",
                    color: "#0B0B0C",
                    fontSize: "14px",
                    fontWeight: 500
                  }}
                  disabled={isClosingTicket}
                  whileHover={{ scale: isClosingTicket ? 1 : 1.02 }}
                  whileTap={{ scale: isClosingTicket ? 1 : 0.98 }}
                >
                  {isClosingTicket ? "Closing…" : "Close Ticket"}
                </motion.button>
              )}

              <form onSubmit={handleSend} className="flex gap-3">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  placeholder={placeholder}
                  className="flex-1 h-12 px-4 rounded-full"
                  style={{
                    backgroundColor: inputDisabled ? "rgba(11, 11, 12, 0.08)" : "rgba(11, 11, 12, 0.06)",
                    border: inputDisabled ? "1px solid rgba(11, 11, 12, 0.15)" : "1px solid rgba(0, 0, 0, 0.1)",
                    fontSize: "16px",
                    color: inputDisabled ? "rgba(11, 11, 12, 0.4)" : "#0B0B0C",
                    cursor: inputDisabled ? "not-allowed" : "text"
                  }}
                  disabled={inputDisabled}
                />
                <motion.button
                  type="submit"
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: inputDisabled ? "rgba(11, 11, 12, 0.35)" : "#0B0B0C",
                    color: "#FFFFFF",
                    cursor: inputDisabled ? "not-allowed" : "pointer"
                  }}
                  disabled={inputDisabled}
                  whileHover={{ scale: inputDisabled ? 1 : 1.05 }}
                  whileTap={{ scale: inputDisabled ? 1 : 0.95 }}
                >
                  <Send size={18} strokeWidth={2.5} />
                </motion.button>
              </form>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
