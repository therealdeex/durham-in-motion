"use client";

import { useMemo, useState } from "react";
import { usePlace } from "@/lib/use-place";
import type { MapGeom } from "@/lib/od-map";
import type { OdFlows, Profile, MunicipalityProfile, WardsFile } from "@/lib/types";
import { Postcard } from "./Postcard";
import { OrbitPanel } from "./OrbitPanel";
import { ChoroplethPanel } from "./ChoroplethPanel";
import { RankPanel } from "./RankPanel";

type TabId = "snapshot" | "destinations" | "map" | "compare";

const TABS: { id: TabId; label: string }[] = [
  { id: "snapshot", label: "Snapshot" },
  { id: "destinations", label: "Destinations" },
  { id: "map", label: "Map" },
  { id: "compare", label: "Compare" },
];

/**
 * “Find your community” — ONE community workspace (consolidates the former
 * orbit, choropleth, postcard and ranking chapters). All panels share the
 * single `?place=` URL state (region / municipality / ward), so a selection
 * made anywhere updates everything, survives refresh, works with the
 * browser's Back/Forward, and deep-links (`?place=durham`, `?place=whitby`,
 * `?place=oshawa-ward-2`). Anchors and unrelated parameters are preserved.
 */
export function CommunityExplorer({
  geom,
  region,
  municipalities,
  wards,
  od,
}: {
  geom: MapGeom;
  region: Profile;
  municipalities: MunicipalityProfile[];
  wards: WardsFile["wards"];
  od: OdFlows;
}) {
  const registry = useMemo(
    () => ({
      regions: ["durham"],
      municipalities: municipalities.map((m) => m.geographyId),
      wards: wards.map((w) => ({ id: w.geographyId, municipality: w.municipality ?? "" })),
    }),
    [municipalities, wards],
  );
  const { selection, select } = usePlace(registry);
  const [tab, setTab] = useState<TabId>("snapshot");

  // Resolved profiles for the current selection. A ward resolves to itself
  // for the snapshot; OD views use its parent municipality with an explicit
  // label (there is no ward-level OD data, and none is pretended to exist).
  const { profile, parentMunicipality } = useMemo(() => {
    if (!selection) return { profile: null as Profile | null, parentMunicipality: null as MunicipalityProfile | null };
    if (selection.kind === "region") return { profile: region, parentMunicipality: null };
    if (selection.kind === "municipality") {
      const m = municipalities.find((x) => x.geographyId === selection.id) ?? null;
      return { profile: m, parentMunicipality: m };
    }
    const w = wards.find((x) => x.geographyId === selection.id) ?? null;
    const parent = municipalities.find((x) => x.geographyId === w?.municipality) ?? null;
    return { profile: w, parentMunicipality: parent };
  }, [selection, region, municipalities, wards]);

  const odMunicipality = useMemo(
    () => od.profiles.find((p) => p.id === (selection?.kind === "region" ? null : parentMunicipality?.geographyId)) ?? null,
    [od, selection, parentMunicipality],
  );

  const selectedMuniId =
    selection === null ? null : selection.kind === "region" ? null : parentMunicipality?.geographyId ?? null;

  return (
    <div>
      {/* ---- place selector ---- */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <label
            htmlFor="place-select"
            className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint"
          >
            Choose your community
          </label>
          <select
            id="place-select"
            value={selection?.id ?? ""}
            onChange={(e) => select(e.target.value || null)}
            className="w-full rounded-lg border border-line bg-paper px-4 py-3 text-base font-medium text-ink shadow-sm md:max-w-md"
          >
            <option value="">Pick a community…</option>
            <optgroup label="Region">
              <option value="durham">Durham Region overall</option>
            </optgroup>
            <optgroup label="Area municipalities">
              {municipalities.map((m) => (
                <option key={m.geographyId} value={m.geographyId}>
                  {m.geographyName}
                </option>
              ))}
            </optgroup>
            {municipalities.map((m) => {
              const muniWards = wards.filter((w) => w.municipality === m.geographyId);
              if (muniWards.length === 0) return null;
              return (
                <optgroup key={m.geographyId} label={`${m.geographyName} wards`}>
                  {muniWards.map((w) => (
                    <option key={w.geographyId} value={w.geographyId}>
                      {w.geographyName}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
          <p className="mt-2 text-xs leading-relaxed text-ink-faint">
            The link in your address bar points directly at this community — share it as-is. Ward
            figures come from the 2022 survey; several small categories are suppressed or not
            computable rather than zero.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick community picks">
          {od.profiles.map((p) => {
            const active = selectedMuniId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                onClick={() => select(active ? null : p.id)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  active ? "border-ink bg-ink text-paper" : "border-line bg-paper hover:border-ink"
                }`}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- tabs ---- */}
      <div className="mt-6 flex flex-wrap gap-1.5 border-b border-line" role="tablist" aria-label="Community views">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`panel-${t.id}`}
              id={`tab-${t.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  const idx = TABS.findIndex((x) => x.id === tab);
                  const next = TABS[(idx + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length]!;
                  setTab(next.id);
                  document.getElementById(`tab-${next.id}`)?.focus();
                }
              }}
              className={`-mb-px rounded-t-lg border-x border-t px-4 py-2 text-sm font-semibold transition-colors ${
                active
                  ? "border-line bg-white text-ink"
                  : "border-transparent text-ink-soft hover:border-line hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div
        id="panel-snapshot"
        role="tabpanel"
        aria-labelledby="tab-snapshot"
        hidden={tab !== "snapshot"}
        className="pt-6"
      >
        {tab === "snapshot" &&
          (profile ? (
            <Postcard profile={profile} region={region} municipalityProfile={parentMunicipality} />
          ) : (
            <EmptyState />
          ))}
      </div>
      <div
        id="panel-destinations"
        role="tabpanel"
        aria-labelledby="tab-destinations"
        hidden={tab !== "destinations"}
        className="pt-6"
      >
        {tab === "destinations" && (
          <OrbitPanel
            geom={geom}
            selection={selection}
            regionOd={od.regionProfile}
            municipalityOd={odMunicipality}
            wardParentName={selection?.kind === "ward" ? parentMunicipality?.geographyName ?? null : null}
            displayFloor={od.display.floor}
          />
        )}
      </div>
      <div id="panel-map" role="tabpanel" aria-labelledby="tab-map" hidden={tab !== "map"} className="pt-6">
        {tab === "map" && (
          <ChoroplethPanel
            geom={geom}
            region={region}
            municipalities={municipalities}
            selectedId={selectedMuniId}
            onSelect={(id) => select(id)}
          />
        )}
      </div>
      <div
        id="panel-compare"
        role="tabpanel"
        aria-labelledby="tab-compare"
        hidden={tab !== "compare"}
        className="pt-6"
      >
        {tab === "compare" && (
          <RankPanel region={region} municipalities={municipalities} wards={wards} selectedId={selection?.id ?? null} />
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <p className="rounded-xl border border-dashed border-line px-5 py-10 text-center text-ink-soft">
      Pick a community above — or share a link like{" "}
      <code className="rounded bg-paper-dim px-1.5 py-0.5 text-xs">?place=whitby</code> or{" "}
      <code className="rounded bg-paper-dim px-1.5 py-0.5 text-xs">?place=oshawa-ward-2</code>.
    </p>
  );
}
