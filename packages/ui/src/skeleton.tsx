import * as React from "react";

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`feature-card skeleton ${className}`}>
      {/* Badge skeleton */}
      <div className="skeleton pulse" style={{ width: "80px", height: "24px", borderRadius: "var(--radius-pill)" }} />
      
      <div className="feature-card__main" style={{ marginLeft: "var(--space-2)" }}>
        {/* Title skeleton */}
        <div className="skeleton pulse" style={{ width: "60%", height: "20px", marginBottom: "var(--space-1)" }} />
        {/* Meta skeleton */}
        <div className="skeleton pulse" style={{ width: "40%", height: "14px" }} />
      </div>
      
      {/* Action skeleton */}
      <div className="skeleton pulse" style={{ width: "60px", height: "20px" }} />
    </div>
  );
}

export function SkeletonList({ count = 3, className = "" }: { count?: number; className?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }} className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
