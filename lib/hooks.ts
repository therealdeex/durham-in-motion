"use client";

import { useEffect, useState } from "react";

/** Reactive media-query hook for responsive SVG geometry. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);
  return matches;
}

export const useIsNarrow = () => useMediaQuery("(max-width: 640px)");
