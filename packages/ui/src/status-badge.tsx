import * as React from "react";

export type BadgeTier =
  | "neutral"
  | "info"
  | "generating"
  | "active"
  | "warning"
  | "success"
  | "error";

export type AnyStatus = string;

export interface StatusBadgeProps {
  status: AnyStatus;
  tier: BadgeTier;
  className?: string;
}

/**
 * StatusBadge
 * Enhance existing component.
 * Monospace chip, uppercase, leading 5px dot.
 * Dot pulses only on info and generating.
 */
export function StatusBadge({ status, tier, className = "" }: StatusBadgeProps) {
  const isPulsing = tier === "info" || tier === "generating";

  const getLabel = (s: string) => {
    switch (s) {
      case "clarification_needed": return "Needs input";
      case "prd_generating": return "Generating spec";
      case "tasks_generating": return "Generating tasks";
      case "analyzing": return "Analyzing";
      default: return s.replace(/_/g, " ");
    }
  };

  const displayStatus = getLabel(status);

  return (
    <span
      className={`badge badge--${tier} ${className}`}
      title={`Status: ${status}`}
    >
      <span className={`badge__dot ${isPulsing ? "badge__dot--pulse" : ""}`} />
      {displayStatus}
    </span>
  );
}