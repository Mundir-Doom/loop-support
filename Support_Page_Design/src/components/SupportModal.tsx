import { motion, useMotionValue, useTransform, PanInfo } from 'motion/react';
import { MessageCircle, Ticket } from 'lucide-react';

interface SupportModalProps {
  onClose: () => void;
  onStartChat: () => void;
  onOpenTicket: () => void;
  onStartNewConversation?: () => Promise<void>;
}

export function SupportModal({ onClose, onStartChat, onOpenTicket, onStartNewConversation }: SupportModalProps) {
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 300], [0.35, 0]);

  const handleDragEnd = (_event: any, info: PanInfo) => {
    // Close if dragged down more than 100px or velocity is high enough
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose();
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ 
        duration: 0.3,
        ease: [0.32, 0.72, 0, 1]
      }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0"
        style={{ 
          backgroundColor: 'rgba(0, 0, 0, 0.35)',
          opacity: useTransform(y, [0, 300], [1, 0])
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.2 }}
        onDragEnd={handleDragEnd}
        style={{ y }}
        className="relative w-full bg-white touch-pan-y"
        style={{
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.15)'
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ 
          duration: 0.3,
          ease: [0.32, 0.72, 0, 1]
        }}
      >
        {/* Drag handle */}
        <div className="pt-3 pb-2 flex justify-center">
          <div 
            className="w-10 h-1 rounded-full"
            style={{ backgroundColor: 'rgba(11, 11, 12, 0.15)' }}
          />
        </div>

        {/* Content */}
        <div className="px-6 pb-8 pt-2">
          <h3 className="mb-6" style={{ fontSize: '20px', fontWeight: 600, color: '#0B0B0C' }}>
            How can we help?
          </h3>

          <div className="space-y-3">
            {/* Start Chat Option */}
            <motion.button
              onClick={onStartChat}
              className="w-full h-16 rounded-2xl flex items-center px-5 gap-4"
              style={{ backgroundColor: 'rgba(11, 11, 12, 0.06)' }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ 
                duration: 0.2,
                ease: [0.32, 0.72, 0, 1]
              }}
            >
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#0B0B0C' }}
              >
                <MessageCircle size={20} strokeWidth={2.5} style={{ color: '#FFFFFF' }} />
              </div>
              <div className="flex-1 text-left">
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#0B0B0C' }}>
                  Start Chat
                </div>
                <div style={{ fontSize: '13px', fontWeight: 400, color: '#55595F' }}>
                  Chat with a support agent now
                </div>
              </div>
            </motion.button>

            {/* Open Ticket Option */}
            <motion.button
              onClick={onOpenTicket}
              className="w-full h-16 rounded-2xl flex items-center px-5 gap-4"
              style={{ backgroundColor: 'rgba(11, 11, 12, 0.06)' }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ 
                duration: 0.2,
                ease: [0.32, 0.72, 0, 1]
              }}
            >
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#0B0B0C' }}
              >
                <Ticket size={20} strokeWidth={2.5} style={{ color: '#FFFFFF' }} />
              </div>
              <div className="flex-1 text-left">
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#0B0B0C' }}>
                  Open Ticket
                </div>
                <div style={{ fontSize: '13px', fontWeight: 400, color: '#55595F' }}>
                  Submit a support request
                </div>
              </div>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
