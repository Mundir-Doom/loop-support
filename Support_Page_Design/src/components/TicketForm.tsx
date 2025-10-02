import { motion, useMotionValue, useTransform, PanInfo } from "motion/react";
import { X } from "lucide-react";
import { FormEvent, useState } from "react";
import type { TicketFormInput } from "../modules/support";

interface TicketFormProps {
  onClose: () => void;
  onSubmit: (data: TicketData) => Promise<void>;
  isSubmitting?: boolean;
  error?: string;
}

export type TicketData = TicketFormInput;

export function TicketForm({ onClose, onSubmit, isSubmitting = false, error }: TicketFormProps) {
  const y = useMotionValue(0);
  const [formData, setFormData] = useState<TicketData>({
    name: "",
    email: "",
    issue: "",
    priority: "medium"
  });
  const [formError, setFormError] = useState<string | undefined>(undefined);

  const handleDragEnd = (_event: any, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose();
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(undefined);
    try {
      await onSubmit(formData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit ticket";
      setFormError(message);
    }
  };

  const activeError = formError ?? error;

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
          opacity: useTransform(y, [0, 300], [1, 0])
        }}
        onClick={onClose}
      />

      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.2 }}
        onDragEnd={handleDragEnd}
        className="relative w-full bg-white touch-pan-y"
        style={{
          y,
          borderTopLeftRadius: "24px",
          borderTopRightRadius: "24px",
          boxShadow: "0 -4px 24px rgba(0, 0, 0, 0.15)",
          maxHeight: "90vh"
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

        <div className="px-6 pb-4 pt-2 flex items-center justify-between border-b" style={{ borderColor: "rgba(0, 0, 0, 0.1)" }}>
          <h3 style={{ fontSize: "20px", fontWeight: 600, color: "#0B0B0C" }}>
            Open Support Ticket
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "rgba(11, 11, 12, 0.06)" }}
          >
            <X size={18} strokeWidth={2.5} style={{ color: "#0B0B0C" }} />
          </button>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: "calc(90vh - 120px)" }}>
          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
            <div>
              <label
                htmlFor="name"
                className="block mb-2"
                style={{ fontSize: "14px", fontWeight: 600, color: "#0B0B0C" }}
              >
                Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                className="w-full h-12 px-4 rounded-xl"
                style={{
                  backgroundColor: "rgba(11, 11, 12, 0.06)",
                  border: "1px solid rgba(0, 0, 0, 0.1)",
                  fontSize: "16px",
                  color: "#0B0B0C"
                }}
                placeholder="Enter your name"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block mb-2"
                style={{ fontSize: "14px", fontWeight: 600, color: "#0B0B0C" }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                className="w-full h-12 px-4 rounded-xl"
                style={{
                  backgroundColor: "rgba(11, 11, 12, 0.06)",
                  border: "1px solid rgba(0, 0, 0, 0.1)",
                  fontSize: "16px",
                  color: "#0B0B0C"
                }}
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label
                htmlFor="issue"
                className="block mb-2"
                style={{ fontSize: "14px", fontWeight: 600, color: "#0B0B0C" }}
              >
                Issue Description
              </label>
              <textarea
                id="issue"
                required
                value={formData.issue}
                onChange={(event) => setFormData({ ...formData, issue: event.target.value })}
                className="w-full h-32 px-4 py-3 rounded-xl resize-none"
                style={{
                  backgroundColor: "rgba(11, 11, 12, 0.06)",
                  border: "1px solid rgba(0, 0, 0, 0.1)",
                  fontSize: "16px",
                  color: "#0B0B0C"
                }}
                placeholder="Describe your issue..."
              />
            </div>

            <div>
              <label
                className="block mb-2"
                style={{ fontSize: "14px", fontWeight: 600, color: "#0B0B0C" }}
              >
                Priority
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(["low", "medium", "high"] as const).map((priority) => (
                  <button
                    key={priority}
                    type="button"
                    onClick={() => setFormData({ ...formData, priority })}
                    className="h-12 rounded-full capitalize transition-all flex items-center justify-center"
                    style={{
                      backgroundColor:
                        formData.priority === priority
                          ? "#0B0B0C"
                          : "rgba(11, 11, 12, 0.06)",
                      color: formData.priority === priority ? "#FFFFFF" : "#0B0B0C",
                      fontSize: "15px",
                      fontWeight: 600,
                      border: "1px solid rgba(0, 0, 0, 0.1)"
                    }}
                  >
                    {priority}
                  </button>
                ))}
              </div>
            </div>

            {activeError && (
              <div style={{ color: "#E5484D", fontSize: "14px" }}>
                {activeError}
              </div>
            )}

            <motion.button
              type="submit"
              className="w-full h-12 rounded-full mt-6 flex items-center justify-center"
              style={{
                backgroundColor: isSubmitting ? "rgba(11, 11, 12, 0.35)" : "#0B0B0C",
                color: "#FFFFFF",
                fontSize: "15px",
                fontWeight: 600,
                boxShadow: "0 8px 20px rgba(0, 0, 0, 0.25)"
              }}
              disabled={isSubmitting}
              whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
              whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
              transition={{
                duration: 0.2,
                ease: [0.32, 0.72, 0, 1]
              }}
            >
              {isSubmitting ? "Submitting…" : "Submit Ticket"}
            </motion.button>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
}
