import { useMemo, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform } from "motion/react";
import { ArrowRight, X } from "lucide-react";
import { SupportModal } from "./SupportModal";
import { ChatWindow } from "./ChatWindow";
import { TicketForm, TicketData } from "./TicketForm";
import type { SupportMessage } from "../modules/support";

export interface SupportBindings {
  messages: SupportMessage[];
  isLoading: boolean;
  isSending: boolean;
  isSubmittingTicket: boolean;
  isTyping?: boolean;
  isConnected?: boolean;
  error?: string;
  ticketStatus?: "open" | "claimed" | "closed";
  ticketId?: number;
  refresh: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  submitTicket: (data: TicketData) => Promise<void>;
  startNewConversation?: () => Promise<void>;
  closeTicket?: () => Promise<void>;
}

interface ExpandedCardProps {
  title: string;
  description: string;
  gradient: string;
  backgroundImage?: string;
  onClose: () => void;
  id: string;
  support?: SupportBindings;
}

export function ExpandedCard({ title, description, gradient, backgroundImage, onClose, id, support }: ExpandedCardProps) {
  const y = useMotionValue(0);
  const opacity = useTransform(y, [-300, 0, 300], [0, 1, 0]);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showTicketForm, setShowTicketForm] = useState(false);

  const handleDragEnd = (_event: any, info: any) => {
    if (info.offset.y > 150 || info.velocity.y > 500) {
      onClose();
    }
    if (info.offset.y < -150 || info.velocity.y < -500) {
      onClose();
    }
  };

  const supportActions = useMemo(() => {
    const refresh = support?.refresh;
    return {
      openModal: () => {
        setShowSupportModal(true);
        if (refresh) void refresh();
      },
      startChat: () => {
        setShowSupportModal(false);
        setShowChat(true);
        if (refresh) void refresh();
      },
      openTicketForm: () => {
        setShowSupportModal(false);
        setShowTicketForm(true);
      }
    };
  }, [support?.refresh]);

  return (
    <motion.div
      className="fixed inset-0 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
    >
      <motion.div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.30)", opacity }}
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      />

      <motion.div
        layoutId={`card-${id}`}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.2, bottom: 0.2 }}
        onDragEnd={handleDragEnd}
        style={{ y }}
        className="relative w-full h-full overflow-hidden touch-pan-y"
        transition={{
          layout: {
            duration: 0.4,
            ease: [0.32, 0.72, 0, 1]
          }
        }}
      >
        <motion.div
          layoutId={`card-background-${id}`}
          className="absolute inset-0"
          style={{ background: gradient }}
        />

        {backgroundImage && (
          <motion.div
            layoutId={`card-image-${id}`}
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${backgroundImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center top",
              backgroundRepeat: "no-repeat"
            }}
          />
        )}

        <motion.div
          layoutId={`card-overlay-${id}`}
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.2) 40%, rgba(255, 255, 255, 0.6) 70%, rgba(255, 255, 255, 1) 100%)"
          }}
        />

        <motion.button
          onClick={onClose}
          className="absolute top-6 right-6 z-10 w-11 h-11 rounded-full flex items-center justify-center"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)"
          }}
          aria-label="Close"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
        >
          <X size={22} strokeWidth={2.5} style={{ color: "#0B0B0C" }} />
        </motion.button>

        <div className="absolute inset-x-0 bottom-0 px-6 pb-6 flex flex-col">
          <motion.h2
            layoutId={`card-title-${id}`}
            className="text-[32px] leading-tight mb-3 text-left"
            style={{ fontWeight: 600, color: "#0B0B0C" }}
          >
            {title}
          </motion.h2>
          <motion.p
            layoutId={`card-description-${id}`}
            className="text-[16px] leading-relaxed mb-6 text-left"
            style={{ fontWeight: 400, color: "#55595F" }}
          >
            {description}
          </motion.p>

          <motion.button
            onClick={supportActions.openModal}
            className="inline-flex items-center gap-2 h-12 px-6 rounded-full self-start mb-6"
            style={{
              backgroundColor: "#0B0B0C",
              color: "#FFFFFF",
              fontWeight: 600,
              fontSize: "15px",
              boxShadow: "0 8px 20px rgba(0, 0, 0, 0.25)"
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ delay: 0.1, duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
          >
            <span>Get Support</span>
            <ArrowRight size={18} strokeWidth={2.5} />
          </motion.button>

          <motion.div
            className="space-y-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.15, duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
          >
            <motion.button
              className="w-full h-14 rounded-2xl flex items-center px-5"
              style={{ backgroundColor: "rgba(11, 11, 12, 0.06)" }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            >
              <span style={{ color: "#0B0B0C", fontSize: "15px", fontWeight: 500 }}>
                Contact via email
              </span>
            </motion.button>
            <motion.button
              className="w-full h-14 rounded-2xl flex items-center px-5"
              style={{ backgroundColor: "rgba(11, 11, 12, 0.06)" }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            >
              <span style={{ color: "#0B0B0C", fontSize: "15px", fontWeight: 500 }}>
                Schedule a call
              </span>
            </motion.button>
            <motion.button
              className="w-full h-14 rounded-2xl flex items-center px-5"
              style={{ backgroundColor: "rgba(11, 11, 12, 0.06)" }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            >
              <span style={{ color: "#0B0B0C", fontSize: "15px", fontWeight: 500 }}>
                Browse FAQs
              </span>
            </motion.button>
          </motion.div>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {showSupportModal && (
          <SupportModal
            onClose={() => setShowSupportModal(false)}
            onStartChat={supportActions.startChat}
            onOpenTicket={supportActions.openTicketForm}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {showChat && support && (
          <ChatWindow
            onClose={() => setShowChat(false)}
            support={support}
            onOpenTicket={supportActions.openTicketForm}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {showTicketForm && support && (
          <TicketForm
            onClose={() => setShowTicketForm(false)}
            onSubmit={async (data: TicketData) => {
              await support.submitTicket(data);
              try {
                await support.refresh();
              } catch {}
              setShowTicketForm(false);
              setShowChat(true);
            }}
            isSubmitting={support.isSubmittingTicket}
            error={support.error}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
