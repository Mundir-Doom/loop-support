import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import { SupportCard } from "./components/SupportCard";
import { ExpandedCard, SupportBindings } from "./components/ExpandedCard";
import { useSupport } from "./modules/support";

// Import local assets
import marketingImage from "./assets/1b3d3e279b26f64879bc68b6b00992f0c2f372e2.png";
import salesImage from "./assets/2302151c517efebea1d55362ce28f3214ff746cc.png";
import technicalImage from "./assets/39c08f6b5f5448d460f0f3185fe17e46dd653020.png";
import developerImage from "./assets/0d961142b622ac52cec4f149ceb19aadfa1e9900.png";

interface SupportSection {
  id: string;
  title: string;
  description: string;
  gradient: string;
  backgroundImage?: string;
}

const supportSections: SupportSection[] = [
  {
    id: "marketing",
    title: "Marketing",
    description: "Get help with campaigns, branding, and content strategy from our marketing experts.",
    gradient: "#FFFFFF",
    backgroundImage: marketingImage
  },
  {
    id: "sales",
    title: "Sales",
    description: "Connect with our sales team for pricing, demos, and custom solutions for your business.",
    gradient: "#FFFFFF",
    backgroundImage: salesImage
  },
  {
    id: "technical",
    title: "Technical",
    description: "Receive technical support for troubleshooting, integrations, and platform issues.",
    gradient: "#FFFFFF",
    backgroundImage: technicalImage
  },
  {
    id: "developer",
    title: "Developer",
    description: "Access API documentation, SDK support, and developer resources for building integrations.",
    gradient: "#FFFFFF",
    backgroundImage: developerImage
  }
];

export default function App() {
  const [expandedCard, setExpandedCard] = useState<SupportSection | null>(null);
  const support = useSupport();

  const {
    messages,
    isInitializing,
    isSending,
    isSubmittingTicket,
    isTyping,
    isConnected,
    error,
    ticket,
    refreshAll,
    sendChatMessage,
    submitTicket,
    startNewConversation,
    closeTicket
  } = support;

  const bindings = useMemo<SupportBindings>(() => ({
    messages,
    isLoading: isInitializing,
    isSending,
    isSubmittingTicket,
    isTyping,
    isConnected,
    error,
    ticketStatus: ticket?.status,
    ticketId: ticket?.id,
    refresh: refreshAll,
    sendMessage: sendChatMessage,
    submitTicket,
    startNewConversation,
    closeTicket
  }), [
    messages,
    isInitializing,
    isSending,
    isSubmittingTicket,
    isTyping,
    isConnected,
    error,
    ticket,
    refreshAll,
    sendChatMessage,
    submitTicket,
    startNewConversation,
    closeTicket
  ]);

  useEffect(() => {
    if (!expandedCard) return;
    void refreshAll();
  }, [expandedCard, refreshAll]);

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#F5F6F8" }}
    >
      <div
        className="overflow-y-auto overflow-x-hidden"
        style={{
          WebkitOverflowScrolling: "touch",
          scrollBehavior: "smooth"
        }}
      >
        <div className="max-w-md mx-auto px-5 py-6 md:py-12 space-y-10">
          {supportSections.map((section, index) => (
            <SupportCard
              key={section.id}
              id={section.id}
              title={section.title}
              description={section.description}
              gradient={section.gradient}
              backgroundImage={section.backgroundImage}
              onClick={() => setExpandedCard(section)}
              index={index}
            />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {expandedCard && (
          <ExpandedCard
            id={expandedCard.id}
            title={expandedCard.title}
            description={expandedCard.description}
            gradient={expandedCard.gradient}
            backgroundImage={expandedCard.backgroundImage}
            onClose={() => setExpandedCard(null)}
            support={bindings}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
