import { motion, useScroll, useTransform } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { useRef } from 'react';

interface SupportCardProps {
  title: string;
  description: string;
  gradient: string;
  backgroundImage?: string;
  onClick: () => void;
  index: number;
  id: string;
}

export function SupportCard({ title, description, gradient, backgroundImage, onClick, index, id }: SupportCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ["start end", "end start"]
  });

  // Parallax effect: background moves slower than foreground
  const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "15%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "5%"]);

  return (
    <motion.div
      ref={cardRef}
      className="relative"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        delay: index * 0.08,
        type: "spring",
        stiffness: 260,
        damping: 20
      }}
    >
      <motion.button
        layoutId={`card-${id}`}
        onClick={onClick}
        className="relative w-full h-[520px] rounded-[32px] overflow-hidden touch-manipulation"
        style={{
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.18), 0 4px 12px rgba(0, 0, 0, 0.08)'
        }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        transition={{ 
          type: "spring",
          stiffness: 400,
          damping: 25
        }}
      >
        {/* Background gradient with parallax */}
        <motion.div
          layoutId={`card-background-${id}`}
          className="absolute inset-0"
          style={{
            background: gradient,
            y: backgroundY
          }}
        />

        {/* Background image (if provided) */}
        {backgroundImage && (
          <motion.div
            layoutId={`card-image-${id}`}
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${backgroundImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center top',
              backgroundRepeat: 'no-repeat'
            }}
          />
        )}

        {/* Bottom white gradient overlay for legibility */}
        <motion.div 
          layoutId={`card-overlay-${id}`}
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.2) 40%, rgba(255, 255, 255, 0.6) 70%, rgba(255, 255, 255, 1) 100%)'
          }}
        />

        {/* Content with parallax */}
        <motion.div
          className="absolute inset-x-0 bottom-0 px-6 pb-6 flex flex-col"
          style={{ y: contentY }}
        >
          <motion.h2 
            layoutId={`card-title-${id}`}
            className="text-[26px] leading-tight mb-3 text-left" 
            style={{ fontWeight: 600, color: '#0B0B0C' }}
          >
            {title}
          </motion.h2>
          <motion.p 
            layoutId={`card-description-${id}`}
            className="text-[15px] leading-snug line-clamp-2 mb-5 text-left" 
            style={{ fontWeight: 400, color: '#55595F' }}
          >
            {description}
          </motion.p>
          
          {/* Primary button */}
          <motion.div
            initial={{ opacity: 1 }}
            className="inline-flex items-center gap-2 h-12 px-6 rounded-full self-start"
            style={{
              backgroundColor: '#0B0B0C',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: '15px',
              boxShadow: '0 8px 20px rgba(0, 0, 0, 0.25)'
            }}
          >
            <span>Get Support</span>
            <ArrowRight size={18} strokeWidth={2.5} />
          </motion.div>
        </motion.div>
      </motion.button>
    </motion.div>
  );
}