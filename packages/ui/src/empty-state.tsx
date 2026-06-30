import * as React from "react";
import { LucideIcon } from "lucide-react";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  actionLabel: string;
  onAction?: () => void;
  className?: string;
}

/**
 * EmptyState
 * One Lucide icon, one warm line, one primary CTA.
 * Never apologetic, never blank.
 */
export function EmptyState({
  icon: Icon,
  title,
  actionLabel,
  onAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`empty-state ${className}`}>
      <Icon size={24} className="empty-state__icon" strokeWidth={1.5} />
      <h3 className="empty-state__title">{title}</h3>
      <button className="btn btn-primary" onClick={onAction} type="button">
        {actionLabel}
      </button>
    </div>
  );
}
