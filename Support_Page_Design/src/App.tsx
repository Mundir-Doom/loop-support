import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { SupportCard } from "./components/SupportCard";
import { ExpandedCard } from "./components/ExpandedCard";
import marketingBg from "figma:asset/1b3d3e279b26f64879bc68b6b00992f0c2f372e2.png";
import salesBg from "figma:asset/2302151c517efebea1d55362ce28f3214ff746cc.png";
import technicalBg from "figma:asset/39c08f6b5f5448d460f0f3185fe17e46dd653020.png";
import developerBg from "figma:asset/0d961142b622ac52cec4f149ceb19aadfa1e9900.png";
import { useSupport } from "./modules/support";

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
    gradient: "linear-gradient(135deg, #FFDDE1 0%, #BAC8FF 100%)",
    backgroundImage: marketingBg
  },
  {
    id: "sales",
    title: "Sales",
    description: "Connect with our sales team for pricing, demos, and custom solutions for your business.",
    gradient: "linear-gradient(135deg, #D4FC79 0%, #96E6A1 100%)",
    backgroundImage: salesBg
  },
  {
    id: "technical",
    title: "Technical",
    description: "Receive technical support for troubleshooting, integrations, and platform issues.",
    gradient: "linear-gradient(135deg, #C9FFBF 0%, #FFAFBD 100%)",
    backgroundImage: technicalBg
  },
  {
    id: "developer",
    title: "Developer",
    description: "Access API documentation, SDK support, and developer resources for building integrations.",
    gradient: "linear-gradient(135deg, #89F7FE 0%, #66A6FF 100%)",
    backgroundImage: developerBg
  }
];

export default function App() {
  const [expandedCard, setExpandedCard] = useState<SupportSection | null>(null);
  const support = useSupport();

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
              onClick={() => {
                setExpandedCard(section);
                void support.refreshAll();
              }}
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
            support={{
              messages: support.messages,
              isLoading: support.isInitializing,
              isSending: support.isSending,
              isSubmittingTicket: support.isSubmittingTicket,
              isConnected: support.isConnected,
              error: support.error,
              refresh: support.refreshAll,
              sendMessage: support.sendChatMessage,
              submitTicket: support.submitTicket,
              startNewConversation: support.startNewConversation,
              closeTicket: support.closeTicket,
              ticketStatus: support.ticket?.status,
              ticketId: support.ticket?.id
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
