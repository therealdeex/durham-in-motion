"use client";

import dynamic from "next/dynamic";
import type { MunicipalityProfile, Profile } from "@/lib/types";

/**
 * Client-only lazy wrapper: MapLibre is a heavy dependency and the map sits
 * below the fold, so it is excluded from the initial bundle entirely.
 */
const MapChapter = dynamic(() => import("./MapChapter").then((m) => m.MapChapter), {
  ssr: false,
  loading: () => (
    <div
      className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]"
      aria-busy="true"
      aria-label="Loading map"
    >
      <div>
        <div className="mb-4 flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="h-8 w-28 animate-pulse rounded-full bg-night-soft" />
          ))}
        </div>
        <div className="h-[420px] animate-pulse rounded-xl border border-night-line bg-night-soft md:h-[560px]" />
      </div>
      <div className="hidden lg:block" />
    </div>
  ),
});

export function MapSection({ region, municipalities }: { region: Profile; municipalities: MunicipalityProfile[] }) {
  return <MapChapter region={region} municipalities={municipalities} />;
}
