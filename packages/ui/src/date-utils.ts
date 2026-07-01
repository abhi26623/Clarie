/**
 * Safely parses a Drizzle/Postgres naive timestamp string (e.g. "2026-07-01 13:40:20.123")
 * into a UTC Date object, ensuring valid ISO 8601 format for strict browsers like Safari.
 */
export function parseDbTimestamp(dateStrOrObj: string | Date | null | undefined): Date | null {
  if (!dateStrOrObj) return null;
  if (dateStrOrObj instanceof Date) return dateStrOrObj;
  
  // Normalize "YYYY-MM-DD HH:MM:SS.mmm" -> "YYYY-MM-DDTHH:MM:SS.mmm"
  let normalized = dateStrOrObj.replace(" ", "T");
  
  // Check if it already has timezone information
  const hasZ = normalized.endsWith("Z");
  const hasOffset = normalized.includes("+") || normalized.includes("-", 11);
  
  if (!hasZ && !hasOffset) {
    normalized += "Z";
  }
  
  const parsed = new Date(normalized);
  if (isNaN(parsed.getTime())) {
    // Fallback if still invalid
    return new Date(dateStrOrObj);
  }
  return parsed;
}

/**
 * Returns a human-readable relative time string (e.g. "6 hours ago", "just now").
 */
export function formatRelative(dateStrOrObj: string | Date | null | undefined): string {
  if (!dateStrOrObj) return "recently";
  
  try {
    const date = parseDbTimestamp(dateStrOrObj);
    if (!date) return "recently";
    
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    const diffMs = date.getTime() - Date.now();
    const diffMins = Math.round(diffMs / (1000 * 60));
    
    if (Math.abs(diffMins) < 1) return "just now";
    
    if (Math.abs(diffMins) < 60) {
      return rtf.format(diffMins, "minute");
    }
    
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    if (Math.abs(diffHours) < 24) {
      return rtf.format(diffHours, "hour");
    }
    
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    return rtf.format(diffDays, "day");
  } catch {
    return "recently";
  }
}
