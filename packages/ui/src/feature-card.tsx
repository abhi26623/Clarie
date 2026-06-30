import * as React from "react";
import { StatusBadge, BadgeTier } from "./status-badge";
import { ArrowRight, User } from "lucide-react";
import Link from "next/link";

export interface FeatureCardProps {
  id: string;
  title: string;
  submitterName?: string;
  submitterImage?: string | null;
  source?: string;
  timestamp: string | Date;
  status: string;
  statusTier: BadgeTier;
  href: string;
}

/**
 * FeatureCard
 * Dense, quiet, Linear-style row component for feature list.
 */
export function FeatureCard({
  title,
  submitterName = "Unknown",
  source = "Internal",
  timestamp,
  status,
  statusTier,
  href,
}: FeatureCardProps) {
  
  // Format relative timestamp
  const formatRelative = (dateStrOrObj: string | Date) => {
    try {
      const date = typeof dateStrOrObj === "string" ? new Date(dateStrOrObj) : dateStrOrObj;
      const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
      const diffMs = date.getTime() - Date.now();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      
      if (Math.abs(diffDays) < 1) {
        const diffHours = Math.round(diffMs / (1000 * 60 * 60));
        return rtf.format(diffHours, "hour");
      }
      return rtf.format(diffDays, "day");
    } catch {
      return "recently";
    }
  };

  const timeString = formatRelative(timestamp);

  return (
    <Link href={href} className="feature-card">
      <StatusBadge status={status} tier={statusTier} />
      <div className="feature-card__main">
        <span className="feature-card__title">{title}</span>
        <div className="feature-card__meta">
          <span style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
            <User size={12} style={{ opacity: 0.7 }} />
            {submitterName}
          </span>
          <span>•</span>
          <span>{source}</span>
          <span>•</span>
          <span>{timeString}</span>
        </div>
      </div>
      <span className="feature-card__action" style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
        View <ArrowRight size={14} />
      </span>
    </Link>
  );
}
