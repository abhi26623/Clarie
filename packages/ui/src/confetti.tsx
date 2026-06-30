import * as React from "react";
import confetti from "canvas-confetti";
import { useReducedMotion } from "framer-motion";

export interface ConfettiCelebrationProps {
  /** 
   * A unique identifier for the event that triggers the confetti.
   * Changing this value will reset the fire state, allowing a new burst.
   */
  triggerKey: string | number | null;
}

/**
 * ConfettiCelebration
 * canvas-confetti wrapper. Respects prefers-reduced-motion.
 * Fires once per triggerKey change.
 */
export function ConfettiCelebration({ triggerKey }: ConfettiCelebrationProps) {
  const shouldReduceMotion = useReducedMotion();
  const [lastFiredKey, setLastFiredKey] = React.useState<string | number | null>(null);

  React.useEffect(() => {
    // Only fire if we are on the client, we have a triggerKey, 
    // it's a new triggerKey, and motion isn't reduced.
    if (typeof window === "undefined") return;
    if (triggerKey === null) return;
    if (triggerKey === lastFiredKey) return;
    if (shouldReduceMotion) return;

    // Fire confetti burst
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#0B462C", "#2E6B49", "#D8D5D0"],
      disableForReducedMotion: true,
    });

    setLastFiredKey(triggerKey);
  }, [triggerKey, lastFiredKey, shouldReduceMotion]);

  // Renders nothing, it's just an effect wrapper
  return null;
}
