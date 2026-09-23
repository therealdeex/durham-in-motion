"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { MapGeom } from "@/lib/od-map";
import type { BroadPurpose, DayStoryFile } from "@/lib/stories/types";
import { nearestBinIndex } from "@/lib/stories/selectors";
import { StickyVisualization } from "../StickyVisualization";
import { StoryBeat } from "../primitives";
import { StoryTimeline } from "../StoryTimeline";
import { DayPanel, type DayFilter } from "./DayPanel";

export interface BeatSpec {
  id: string;
  /** Minutes since 04:00 the clock should show while this beat is active. */
  minutes: number;
  kicker?: string;
  title: string;
  body: ReactNode;
}

const PURPOSE_FILTERS: { key: BroadPurpose; label: string }[] = [
  { key: "Home-Based Work", label: "Work" },
  { key: "Home-based School", label: "School" },
  { key: "Home-based Discretionary", label: "Discretionary" },
];
const MODE_FILTERS = ["drive", "transit", "walk", "cycle"] as const;

const PLAY_STEP_MS = 850;

/**
 * A Day in Durham — the guided scrollytelling experience plus the unlocked
 * exploration mode. The clock is the single source of time: guided mode binds
 * it to scroll position, explore mode to the scrubber. Filters affect only
 * the volume curve (the map has no mode/purpose dimension in the extracts).
 */
export function DayExperience({
  file,
  geom,
  beats,
  exploreIntro,
}: {
  file: DayStoryFile;
  geom: MapGeom;
  beats: BeatSpec[];
  exploreIntro: ReactNode;
}) {
  const [phase, setPhase] = useState<"guided" | "explore">("guided");
  const [beatId, setBeatId] = useState<string | null>(beats[0]?.id ?? null);
  const [binIndex, setBinIndex] = useState(nearestBinIndex(file, beats[0]?.minutes ?? 0));
  const [playing, setPlaying] = useState(false);
  const [filter, setFilter] = useState<DayFilter>({ kind: "all" });
  const lastBin = file.bins.length - 1;

  const activeBeat = beats.find((b) => b.id === beatId) ?? beats[0]!;
  const currentBin = phase === "guided" ? nearestBinIndex(file, activeBeat.minutes) : binIndex;

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setBinIndex((i) => (i >= lastBin ? 0 : i + 1));
    }, PLAY_STEP_MS);
    return () => window.clearInterval(id);
  }, [playing, lastBin]);

  const enterExplore = () => {
    setBinIndex(nearestBinIndex(file, activeBeat.minutes));
    setPlaying(false);
    setPhase("explore");
  };

  const setFilterPurpose = (p: BroadPurpose | "all") => {
    setFilter(p === "all" ? { kind: "all" } : { kind: "purpose", value: p });
  };
  const setFilterMode = (m: (typeof MODE_FILTERS)[number] | "all") => {
    setFilter(m === "all" ? { kind: "all" } : { kind: "mode", value: m });
  };

  const guidedBeatIds = beats.map((b) => b.id);

  return (
    <StickyVisualization
      beats={phase === "guided" ? guidedBeatIds : []}
      onActiveChange={setBeatId}
      visualization={
        <DayPanel
          file={file}
          geom={geom}
          binIndex={currentBin}
          filter={filter}
          explore={phase === "explore"}
          onScrubTo={phase === "explore" ? (i) => setBinIndex(i) : undefined}
        />
      }
    >
      {phase === "guided" ? (
        <>
          {beats.map((b) => (
            <StoryBeat key={b.id} id={b.id} kicker={b.kicker} title={b.title}>
              {b.body}
            </StoryBeat>
          ))}

          {/* unlock card */}
          <div className="mx-auto w-full max-w-xl px-6 py-8 md:py-12">
            <div className="rounded-2xl border border-walk/40 bg-gradient-to-b from-night-soft to-night p-6 text-center md:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-walk">The whole day is yours</p>
              <h2 className="mt-3 font-display text-2xl font-semibold leading-tight text-chalk md:text-[2rem]">
                Explore the day
              </h2>
              <div className="prose-story mt-4 space-y-4 text-left">{exploreIntro}</div>
              <button
                type="button"
                onClick={enterExplore}
                className="mt-6 rounded-full bg-walk px-6 py-3 text-sm font-semibold text-night transition-opacity hover:opacity-90"
              >
                Take the controls
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="mx-auto w-full max-w-xl space-y-6 px-6 py-8 md:py-12">
          <div className="rounded-2xl border border-night-line/70 bg-night-soft p-6 md:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-walk">Explore the day</p>
            <div className="mt-4">
              <StoryTimeline
                value={binIndex}
                min={0}
                max={lastBin}
                label="Time of day, 30-minute steps across the survey day"
                playing={playing}
                onPlayToggle={() => setPlaying((p) => !p)}
                onScrub={(v) => {
                  setPlaying(false);
                  setBinIndex(v);
                }}
                marks={[
                  { at: 0, label: "4a" },
                  { at: (4 * 60) / 1440, label: "8a" },
                  { at: (8 * 60) / 1440, label: "12p" },
                  { at: (11 * 60) / 1440, label: "3p" },
                  { at: (13 * 60) / 1440, label: "5p" },
                  { at: (17 * 60) / 1440, label: "9p" },
                  { at: (20 * 60) / 1440, label: "12a" },
                ]}
              />
            </div>

            <div className="mt-5 space-y-3">
              <FilterRow
                label="Trips"
                options={[
                  { key: "all", label: "All trips", active: filter.kind === "all" },
                  ...PURPOSE_FILTERS.map((p) => ({
                    key: p.key,
                    label: p.label,
                    active: filter.kind === "purpose" && filter.value === p.key,
                  })),
                ]}
                onSelect={(k) => setFilterPurpose(k === "all" ? "all" : (k as BroadPurpose))}
              />
              <FilterRow
                label="Modes"
                options={[
                  { key: "all", label: "All modes", active: filter.kind === "all" },
                  ...MODE_FILTERS.map((m) => ({
                    key: m,
                    label: m[0]!.toUpperCase() + m.slice(1),
                    active: filter.kind === "mode" && filter.value === m,
                  })),
                ]}
                onSelect={(k) => setFilterMode(k === "all" ? "all" : (k as (typeof MODE_FILTERS)[number]))}
              />
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-chalk-dim">
              Filters reshape the volume curve. The map shows everyone moving —
              the extracts behind it carry no mode or purpose dimension. Selecting
              a trip filter replaces the mode filter, and vice versa.
            </p>
          </div>

          <div className="rounded-2xl border border-night-line/70 bg-night-soft p-6 md:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-walk">Things to try</p>
            <ul className="prose-story mt-3 list-disc space-y-2.5 pl-5 text-sm">
              <li>
                Park the clock on <strong className="text-chalk">8 a.m.</strong>, then{" "}
                <strong className="text-chalk">3 p.m.</strong> — the afternoon hour is the busier one, and the
                boundary counters flip between them.
              </li>
              <li>
                Follow the <strong className="text-chalk">School</strong> curve: two humps, one just after 8 a.m.
                and one after 3 p.m. — the school day, drawn in trips.
              </li>
              <li>
                Watch <strong className="text-chalk">Oshawa ↔ Whitby</strong> become the strongest corridor when
                the afternoon starts, and the map thin to a few threads by 9 p.m.
              </li>
            </ul>
          </div>

          <div className="flex justify-center pb-4">
            <button
              type="button"
              onClick={() => {
                setPhase("guided");
                setFilter({ kind: "all" });
                setPlaying(false);
              }}
              className="rounded-full border border-night-line px-5 py-2.5 text-sm font-semibold text-chalk-dim transition-colors hover:border-chalk-dim hover:text-chalk"
            >
              ← Back to the guided story
            </button>
          </div>
        </div>
      )}
    </StickyVisualization>
  );
}

function FilterRow({
  label,
  options,
  onSelect,
}: {
  label: string;
  options: { key: string; label: string; active: boolean }[];
  onSelect: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`${label} filter`}>
      <span className="w-10 text-[10px] font-semibold uppercase tracking-[0.16em] text-chalk-dim">{label}</span>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onSelect(o.key)}
          aria-pressed={o.active}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            o.active
              ? "border-walk bg-walk/15 text-walk"
              : "border-night-line text-chalk-dim hover:border-chalk-dim hover:text-chalk"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
