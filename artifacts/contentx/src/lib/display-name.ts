// Display-layer name formatting for auto-generated entity names.
//
// Auto-generated names look like "Negotiators vslice-1786683678021-py92x4 #10":
// a human prefix, a machine slug (<word>-<timestamp>-<hash>), and an index.
// The timestamp makes names overflow cards/labels/selects without helping a
// human tell them apart — the short hash and index already do that. We shorten
// purely at the display layer (backend names are untouched); the full original
// name stays available via tooltips and detail views.

// <word>-<10+ digit timestamp>-<hash>, e.g. "vslice-1786683678021-py92x4"
const MACHINE_SLUG_RE = /\b([A-Za-z0-9]+)-(\d{10,})-([A-Za-z0-9]{3,})\b/g;
// Full UUIDs embedded in names — first 8 chars are enough to distinguish.
const UUID_RE = /\b([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

export const DEFAULT_MAX_DISPLAY_LENGTH = 36;

/**
 * Shorten an auto-generated name for display: drop timestamp segments from
 * machine slugs (keeping prefix + short hash), abbreviate UUIDs, and finally
 * ellipsize if the result is still too long. Idempotent and safe on
 * human-authored names (returns them unchanged).
 */
export function formatDisplayName(name: string | null | undefined, maxLength: number = DEFAULT_MAX_DISPLAY_LENGTH): string {
  if (!name) return "";
  let display = name
    .replace(MACHINE_SLUG_RE, (_m, prefix: string, _ts: string, hash: string) => `${prefix}·${hash}`)
    .replace(UUID_RE, (_m, head: string) => head)
    .replace(/\s+/g, " ")
    .trim();
  if (display.length > maxLength) {
    display = display.slice(0, maxLength - 1).trimEnd() + "…";
  }
  return display;
}

/** True when the display form differs from the original (so a tooltip/full-name line is warranted). */
export function isNameShortened(name: string | null | undefined, maxLength: number = DEFAULT_MAX_DISPLAY_LENGTH): boolean {
  if (!name) return false;
  return formatDisplayName(name, maxLength) !== name;
}
