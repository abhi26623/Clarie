import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

export interface PipelineStageProps {
  id: string;
  label: string;
  count: number;
}

export interface PipelineStripProps {
  stages: PipelineStageProps[];
  activeStageId: string;
  onStageClick: (id: string) => void;
  className?: string;
}

/**
 * PipelineStrip
 * Horizontal bar with stages.
 * Active stage gets a sliding underline (snaps on reduced-motion).
 * Count change is animated without layout shift.
 */
export function PipelineStrip({
  stages,
  activeStageId,
  onStageClick,
  className = "",
}: PipelineStripProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className={`pipeline-strip ${className}`}>
      {stages.map((stage) => {
        const isActive = stage.id === activeStageId;
        return (
          <button
            key={stage.id}
            className={`pipeline-stage ${
              isActive ? "pipeline-stage--active" : ""
            }`}
            onClick={() => onStageClick(stage.id)}
            type="button"
          >
            <span>{stage.label}</span>
            <motion.span
              className="pipeline-stage__count"
              key={stage.count}
              initial={{ scale: shouldReduceMotion ? 1 : 0.8 }}
              animate={{ scale: 1 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.15 }}
            >
              {stage.count}
            </motion.span>
            {isActive && (
              <motion.div
                layoutId="pipeline-active-indicator"
                className="pipeline-stage__indicator"
                transition={{ duration: shouldReduceMotion ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
