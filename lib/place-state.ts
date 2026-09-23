/**
 * The single owner of the `?place=` URL parameter (audit A06).
 *
 * One module-level store: every community selector (orbit, postcard,
 * choropleth, explorer) subscribes to it instead of writing URL state on its
 * own. Behaviour:
 *  - `place` values are validated against a registry; invalid values fall
 *    back to no selection rather than silently substituting a municipality
 *    (`?place=durham` previously reloaded as Ajax);
 *  - unrelated query parameters and the #anchor are always preserved;
 *  - user selections push history (Back/Forward work); programmatic sync
 *    replaces it;
 *  - popstate re-reads the URL so all selectors follow the browser history.
 *
 * The pure helpers (buildPlaceUrl, validatePlace) are DOM-free and covered
 * by tests/data/place-state.test.ts.
 */

export type PlaceKind = "region" | "municipality" | "ward";

export interface PlaceSelection {
  id: string;
  kind: PlaceKind;
  /** Parent municipality id for wards. */
  municipality?: string;
}

export interface PlaceRegistry {
  /** Region-level ids (usually ["durham"]). */
  regions: string[];
  municipalities: string[];
  wards: { id: string; municipality: string }[];
}

/** Validate a raw `place` value. Returns null for unknown/absent values —
 *  never a silent substitute. */
export function validatePlace(raw: string | null, registry: PlaceRegistry): PlaceSelection | null {
  if (!raw) return null;
  if (registry.regions.includes(raw)) return { id: raw, kind: "region" };
  if (registry.municipalities.includes(raw)) return { id: raw, kind: "municipality" };
  const ward = registry.wards.find((w) => w.id === raw);
  if (ward) return { id: ward.id, kind: "ward", municipality: ward.municipality };
  return null;
}

/** Build the URL for a place selection, preserving other params and hash. */
export function buildPlaceUrl(pathname: string, search: string, hash: string, place: string | null): string {
  const params = new URLSearchParams(search);
  if (place) params.set("place", place);
  else params.delete("place");
  const qs = params.toString();
  return `${pathname}${qs ? `?${qs}` : ""}${hash || ""}`;
}

// --------------------------------------------------------------------------
// Client store (browser only)
// --------------------------------------------------------------------------

let currentRaw: string | null = null;
let initialized = false;
const listeners = new Set<(raw: string | null) => void>();

const readFromLocation = (): string | null => {
  try {
    return new URLSearchParams(window.location.search).get("place");
  } catch {
    return null;
  }
};

function ensureInit(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  currentRaw = readFromLocation();
  window.addEventListener("popstate", () => {
    const next = readFromLocation();
    if (next !== currentRaw) {
      currentRaw = next;
      for (const fn of listeners) fn(next);
    }
  });
}

export function getPlaceRaw(): string | null {
  ensureInit();
  return currentRaw;
}

/** Select a place (or null to clear). Reads as a user action by default:
 *  pushes a history entry. Pass `push: false` for transient synchronization. */
export function selectPlace(place: string | null, opts: { push?: boolean } = {}): void {
  ensureInit();
  const url = buildPlaceUrl(window.location.pathname, window.location.search, window.location.hash, place);
  if (opts.push !== false) window.history.pushState({ place }, "", url);
  else window.history.replaceState({ place }, "", url);
  currentRaw = place;
  for (const fn of listeners) fn(place);
}

export function subscribePlace(fn: (raw: string | null) => void): () => void {
  ensureInit();
  listeners.add(fn);
  fn(currentRaw);
  return () => listeners.delete(fn);
}
