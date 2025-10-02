import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform, PanInfo } from "motion/react";
import { RotateCcw, Send, X } from "lucide-react";
import { TypingIndicator } from "./TypingIndicator";
import type { SupportBindings } from "./ExpandedCard";

interface ChatWindowProps {
  onClose: () => void;
  support: SupportBindings;
  onOpenTicket: () => void;
}

function formatStatus(status?: "open" | "claimed" | "closed") {
  if (!status) return "No ticket";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function ChatWindow({ onClose, support, onOpenTicket }: ChatWindowProps) {
  const y = useMotionValue(0);
  const backdropOpacity = useTransform(y, [0, 300], [1, 0]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [localError, setLocalError] = useState<string | undefined>();
  const [isClosingTicket, setIsClosingTicket] = useState(false);

  const sortedMessages = useMemo(() => {
    return [...support.messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [support.messages]);

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

  const hasTicket = typeof support.ticketStatus === "string";
  const isTicketActive = support.ticketStatus === "open" || support.ticketStatus === "claimed";
  const placeholder = !hasTicket
    ? "Open a ticket to start chatting"
    : support.ticketStatus === "closed"
      ? "Ticket is closed"
      : "Type your message...";

  const isInputDisabled = !isTicketActive || support.isSending;
  const errorMessage = localError ?? support.error;
  const showConversation = hasTicket && (sortedMessages.length > 0 || support.isLoading);

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    if (!isTicketActive) {
      setLocalError("Open or reopen a ticket to chat with our team.");
      return;
    }

    try {
      setLocalError(undefined);
      await support.sendMessage(trimmed);
      setInputValue("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send message";
      setLocalError(message);
    }
  };

  const handleStartNewConversation = async () => {
    if (!support.startNewConversation) return;
    try {
      setLocalError(undefined);
      await support.startNewConversation();
      setInputValue("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start new conversation";
      setLocalError(message);
    }
  };

  const handleCloseTicket = async () => {
    if (!support.closeTicket) return;
    try {
      setLocalError(undefined);
      setIsClosingTicket(true);
      await support.closeTicket();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to close ticket";
      setLocalError(message);
    } finally {
      setIsClosingTicket(false);
    }
  };

  const ticketLabel = hasTicket
    ? `Ticket #${support.ticketId ?? "—"} • ${formatStatus(support.ticketStatus)}`
    : "No ticket opened yet";

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
    >
      <motion.div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.35)", opacity: backdropOpacity }}
        onClick={onClose}
      />

      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.2, bottom: 0.2 }}
        onDragEnd={handleDragEnd}
        className="relative w-full bg-white touch-pan-y flex flex-col"
        style={{
          y,
          borderTopLeftRadius: "24px",
          borderTopRightRadius: "24px",
          boxShadow: "0 -4px 24px rgba(0, 0, 0, 0.15)",
          height: "80vh",
          maxHeight: "700px"
        }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      >
        <div className="pt-3 pb-2 flex justify-center">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "rgba(11, 11, 12, 0.15)" }} />
        </div>

        <div className="px-6 pb-4 pt-2 flex items-center justify-between border-b" style={{ borderColor: "rgba(0, 0, 0, 0.1)" }}>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 style={{ fontSize: "20px", fontWeight: 600, color: "#0B0B0C" }}>Live Chat</h3>
              <motion.div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: support.isConnected ? "#10B981" : "#EF4444",
                  boxShadow: support.isConnected
                    ? "0 0 8px rgba(16, 185, 129, 0.4)"
                    : "0 0 8px rgba(239, 68, 68, 0.4)"
                }}
                animate={{
                  scale: support.isConnected ? [1, 1.1, 1] : 1,
                  opacity: support.isConnected ? [1, 0.7, 1] : 1
                }}
                transition={{ duration: 2, repeat: support.isConnected ? Infinity : 0, ease: "easeInOut" }}
              />
            </div>
            <p style={{ fontSize: "13px", fontWeight: 400, color: "#55595F" }}>{ticketLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void support.refresh()}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "rgba(11, 11, 12, 0.06)" }}
              title="Refresh messages"
            >
              <RotateCcw size={16} strokeWidth={2.5} style={{ color: "#0B0B0C" }} />
            </button>
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
          {!showConversation ? (
            <div className="flex flex-col items-center gap-3 text-center" style={{ color: "#55595F", fontSize: "14px" }}>
              {hasTicket
                ? "Ticket created! Send your first message when you're ready."
                : "Open a ticket to start a conversation with our support team."}
            </div>
          ) : (
            <>
              {sortedMessages.map((message) => (
                <div
                  key={`${message.id}-${message.createdAt}`}
                  className={`flex ${message.sender === "visitor" ? "justify-end" : "justify-start"}`}
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
              <AnimatePresence>{support.isTyping && <TypingIndicator />}</AnimatePresence>
            </>
          )}
        </div>

        {errorMessage && (
          <div className="px-6 pb-2" style={{ color: "#E5484D", fontSize: "13px" }}>
            {errorMessage}
          </div>
        )}

        <div className="px-6 py-4 border-t" style={{ borderColor: "rgba(0, 0, 0, 0.1)" }}>
          {!hasTicket ? (
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
          ) : support.ticketStatus === "closed" ? (
            <div className="space-y-4 text-center">
              <div style={{ color: "#55595F", fontSize: "14px" }}>
                This conversation has been closed. Start a new conversation to continue chatting.
              </div>
              {support.startNewConversation && (
                <motion.button
                  onClick={handleStartNewConversation}
                  className="w-full h-12 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: "#0B0B0C",
                    color: "#FFFFFF",
                    fontSize: "15px",
                    fontWeight: 500
                  }}
                  disabled={support.isLoading}
                  whileHover={{ scale: support.isLoading ? 1 : 1.02 }}
                  whileTap={{ scale: support.isLoading ? 1 : 0.98 }}
                >
                  {support.isLoading ? "Starting..." : "Start New Conversation"}
                </motion.button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {support.closeTicket && (
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
                    backgroundColor: isInputDisabled ? "rgba(11, 11, 12, 0.08)" : "rgba(11, 11, 12, 0.06)",
                    border: "1px solid rgba(0, 0, 0, 0.1)",
                    fontSize: "16px",
                    color: isInputDisabled ? "rgba(11, 11, 12, 0.4)" : "#0B0B0C"
                  }}
                  disabled={isInputDisabled}
                />
                <motion.button
                  type="submit"
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: isInputDisabled ? "rgba(11, 11, 12, 0.35)" : "#0B0B0C",
                    color: "#FFFFFF"
                  }}
                  disabled={isInputDisabled}
                  whileHover={{ scale: isInputDisabled ? 1 : 1.05 }}
                  whileTap={{ scale: isInputDisabled ? 1 : 0.95 }}
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
