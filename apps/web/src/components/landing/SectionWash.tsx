/**
 * SectionWash
 * A single-hue, corner-anchored radial wash in --accent at ≤8% opacity.
 * Sits position:absolute, z-index:0, pointer-events:none — always behind content.
 * Place inside a position:relative section container.
 *
 * corner: which corner the radial is anchored to.
 * size:   spread of the wash (default 80vw — wide enough to be ambient, not a blob).
 * opacity: 0–1, keep ≤0.08 per design rules.
 */
export function SectionWash({
  corner = "top-right",
  size = "80vw",
  opacity = 0.07,
}: {
  corner?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  size?: string;
  opacity?: number;
}) {
  const positions: Record<typeof corner, React.CSSProperties> = {
    "top-left":     { top: 0, left: 0 },
    "top-right":    { top: 0, right: 0 },
    "bottom-left":  { bottom: 0, left: 0 },
    "bottom-right": { bottom: 0, right: 0 },
  };

  // Gradient radiates from the chosen corner outward.
  // Single hue only (oklch 0.32 0.10 148 = --accent).
  // Two-stop: accent at center → transparent. No second hue, no mesh.
  const gradientOrigins: Record<typeof corner, string> = {
    "top-left":     "circle at top left",
    "top-right":    "circle at top right",
    "bottom-left":  "circle at bottom left",
    "bottom-right": "circle at bottom right",
  };

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        ...positions[corner],
        width: size,
        height: size,
        background: `radial-gradient(${gradientOrigins[corner]}, oklch(0.32 0.10 148 / ${opacity}) 0%, transparent 70%)`,
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}
