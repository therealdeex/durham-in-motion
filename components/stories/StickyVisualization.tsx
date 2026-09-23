"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Scrollytelling container: a visualization panel that stays pinned while
 * narrative beats scroll past. Reports the active beat id upward.
 *
 * Layout: on large screens the viz is a grid column that stretches to the
 * full section height (so its sticky child pins for the whole scroll); on
 * small screens the viz is an absolutely-positioned layer over the same full
 * height, pinned at the top, with the beat cards scrolling across it — the
 * cards carry their own opaque background.
 */
export function StickyVisualization({
  beats,
  visualization,
  panelHeightClass = "h-[58svh] lg:h-[100svh]",
  onActiveChange,
  children,
}: {
  /** DOM ids of the beat articles, in narrative order. */
  beats: string[];
  /** The pinned visualization (rendered inside the sticky panel). */
  visualization: ReactNode;
  panelHeightClass?: string;
  onActiveChange?: (beatId: string | null) => void;
  /** The scrolling narrative column — it defines the section height. */
  children: ReactNode;
}) {
  const activeRef = useRef<string | null>(null);

  useEffect(() => {
    const setActiveBoth = (id: string | null) => {
      if (activeRef.current === id) return;
      activeRef.current = id;
      onActiveChange?.(id);
    };
    const nodes = beats
      .map((id) => document.getElementById(id))
      .filter((n): n is HTMLElement => n !== null);
    if (nodes.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // the active beat is the topmost entry intersecting the focus band
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveBoth(visible[0].target.id);
      },
      // focus band: the middle of the viewport decides
      { rootMargin: "-35% 0px -45% 0px", threshold: 0 },
    );
    for (const n of nodes) observer.observe(n);
    return () => observer.disconnect();
  }, [beats, onActiveChange]);

  return (
    <div className="relative lg:grid lg:grid-cols-[minmax(0,11fr)_minmax(0,9fr)]">
      <div className="pointer-events-none absolute inset-0 z-10 lg:pointer-events-auto lg:static lg:z-auto">
        <div className={`sticky top-0 flex items-center justify-center ${panelHeightClass}`}>
          <div className="pointer-events-auto relative flex h-full w-full max-w-[680px] flex-col items-center justify-center px-3 py-2 lg:px-6">
            {visualization}
          </div>
        </div>
      </div>
      {/* On small screens the cards slide BEHIND the pinned panel (the classic
          mobile scrolly); on large screens the columns sit side by side. */}
      <div className="relative lg:min-h-[100svh]">{children}</div>
    </div>
  );
}
