import * as React from "react";
import * as ReactDOM from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

/**
 * <Reveal>
 * Fade + slight rise on view.
 * Uses the design motion timing.
 * Respects prefers-reduced-motion.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const shouldReduceMotion = useReducedMotion();
  const yOffset = shouldReduceMotion ? 0 : 4;

  return (
    <motion.div
      initial={{ opacity: 0, y: yOffset }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * <Stagger>
 * Children reveal in a calm cascade.
 * Supports configurable delay/stagger.
 */
export function Stagger({
  children,
  className,
  staggerDelay = 0.05,
}: {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}) {
  const shouldReduceMotion = useReducedMotion();

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : staggerDelay,
      },
    },
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * <SlideOver>
 * Right-side drawer for forms like “New request”.
 * Includes backdrop, close button, Escape close, focus-safe structure.
 * Uses spring/enter motion, but reduced-motion disables movement.
 */
export function SlideOver({
  isOpen,
  onClose,
  title,
  side = "right",
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  side?: "left" | "right";
  children: React.ReactNode;
}) {
  const shouldReduceMotion = useReducedMotion();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLElement | null>(null);

  // SSR-safe portal mount guard — createPortal must not run on the server
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);

  // Focus trap
  React.useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement;
      
      // Move focus into the panel
      // Wait for animation frame so panel is mounted
      requestAnimationFrame(() => {
        panelRef.current?.focus();
      });

      return () => {
        triggerRef.current?.focus();
      };
    }
  }, [isOpen]);

  // Escape to close
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Scroll-lock: freeze body scroll while open.
  // scrollbar-gutter: stable prevents the layout shift when the scrollbar disappears.
  React.useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.style.scrollbarGutter = "stable";
    return () => {
      document.body.style.overflow = prev;
      document.body.style.scrollbarGutter = "";
    };
  }, [isOpen]);

  const panelVariants = {
    hidden: { x: shouldReduceMotion ? 0 : side === "right" ? "100%" : "-100%", opacity: 0 },
    visible: { x: 0, opacity: 1 },
  };

  // Don't render until client-side — createPortal requires document.body
  if (!mounted) return null;

  return ReactDOM.createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "linear" }}
            className="slide-over-overlay"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={panelVariants}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 200,
              duration: shouldReduceMotion ? 0 : undefined,
            }}
            className="slide-over-panel"
            style={{ outline: "none", right: side === "right" ? 0 : "auto", left: side === "left" ? 0 : "auto" }}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

/**
 * <Crossfade>
 * Sequential crossfade for state-machine transitions.
 * Outgoing state fades to 0 before incoming fades in.
 * Includes dynamic height animation to prevent layout gap/collapse.
 */
export function Crossfade({
  stateKey,
  children,
  className,
}: {
  stateKey: string | number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={stateKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
