"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { selectPlace, subscribePlace, validatePlace, type PlaceRegistry, type PlaceSelection } from "./place-state";

/**
 * React binding for the shared `?place=` owner. One subscription per
 * component; user selections push history; invalid URL values yield null
 * (never a silent substitute).
 */
export function usePlace(registry: PlaceRegistry): {
  raw: string | null;
  selection: PlaceSelection | null;
  select: (id: string | null) => void;
} {
  const [raw, setRaw] = useState<string | null>(null);
  useEffect(() => subscribePlace(setRaw), []);
  const selection = useMemo(() => validatePlace(raw, registry), [raw, registry]);
  const select = useCallback((id: string | null) => selectPlace(id), []);
  return { raw, selection, select };
}
