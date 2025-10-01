import { motion } from "motion/react";

export function TypingIndicator() {
  return (
    <div className="flex justify-start mb-4">
      <div
        className="max-w-[75%] px-4 py-3 rounded-2xl flex items-center space-x-1"
        style={{
          backgroundColor: "rgba(11, 11, 12, 0.06)",
          color: "#0B0B0C",
          fontSize: "15px",
          lineHeight: "1.4"
        }}
      >
        <span className="text-sm opacity-70 mr-2">Agent is typing</span>
        <div className="flex space-x-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: "#0B0B0C" }}
              animate={{
                y: [0, -4, 0],
                opacity: [0.4, 1, 0.4]
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut"
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
