"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type MapGeoJSONFeature } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { fmtPct, fmtX, fmtInt } from "@/lib/format";
import type { MunicipalityProfile, Profile } from "@/lib/types";

type MetricId = "transit" | "vehicles" | "zeroVehicle" | "walk" | "workAtHome" | "toronto";

interface MetricDef {
  id: MetricId;
  label: string;
  short: string;
  unit: "percent" | "vehicles";
  /** value in [0,1] shares or vehicles/hh; domain fixed per metric */
  domain: [number, number];
  get: (p: MunicipalityProfile | Profile) => number | null;
  format: (v: number | null) => string;
  sentence: (p: MunicipalityProfile, r: Profile) => string;
  colors: [string, string, string, string, string];
}

const METRICS: MetricDef[] = [
  {
    id: "transit",
    label: "Transit share of weekday trips",
    short: "Transit share",
    unit: "percent",
    domain: [0, 0.05],
    get: (p) => p.modeShares.transit.value,
    format: (v) => fmtPct(v),
    sentence: (p, r) => {
      const t = p.modeShares.transit;
      if (t.value === null) return `Transit's share here was too small to report reliably. Region-wide it is ${fmtPct(r.modeShares.transit.value)}.`;
      const rT = r.modeShares.transit.value ?? 0;
      if (t.value >= rT * 1.15) return `Transit carries ${fmtPct(t.value)} of weekday trips here — noticeably above the regional ${fmtPct(rT)}.`;
      if (t.value <= rT * 0.6) return `Transit carries ${fmtPct(t.value)} of weekday trips here — well below the regional ${fmtPct(rT)}.`;
      return `Transit carries ${fmtPct(t.value)} of weekday trips here, close to the regional ${fmtPct(rT)}.`;
    },
    colors: ["#1d2f33", "#175e56", "#0f8b7f", "#5cc9b6", "#c9f5e8"],
  },
  {
    id: "vehicles",
    label: "Vehicles per household",
    short: "Vehicles / household",
    unit: "vehicles",
    domain: [1.4, 2.2],
    get: (p) => p.avgVehiclesPerHousehold,
    format: (v) => (v === null ? "suppressed" : fmtX(v)),
    sentence: (p, r) => {
      if (p.avgVehiclesPerHousehold === null) return "Household vehicle ownership here was too small to report reliably.";
      if (r.avgVehiclesPerHousehold !== null && p.avgVehiclesPerHousehold >= r.avgVehiclesPerHousehold + 0.15)
        return `Households here own ${fmtX(p.avgVehiclesPerHousehold)} vehicles on average — among the highest in Durham (region ${fmtX(r.avgVehiclesPerHousehold)}).`;
      if (r.avgVehiclesPerHousehold !== null && p.avgVehiclesPerHousehold <= r.avgVehiclesPerHousehold - 0.15)
        return `Households here own ${fmtX(p.avgVehiclesPerHousehold)} vehicles on average — among the lowest in Durham (region ${fmtX(r.avgVehiclesPerHousehold)}).`;
      return `Households here own ${fmtX(p.avgVehiclesPerHousehold)} vehicles on average (region ${fmtX(r.avgVehiclesPerHousehold)}).`;
    },
    colors: ["#33261d", "#7d4a2a", "#b06c35", "#d99a55", "#f7d8a8"],
  },
  {
    id: "zeroVehicle",
    label: "Households with no vehicle",
    short: "No-vehicle households",
    unit: "percent",
    domain: [0, 0.09],
    get: (p) => p.zeroVehicleHouseholdShare.value,
    format: (v) => fmtPct(v),
    sentence: (p) => {
      const z = p.zeroVehicleHouseholdShare;
      if (z.value === null) return "The no-vehicle share here was too small to report reliably.";
      return `${fmtPct(z.value)} of households here have no vehicle — roughly 1 in ${Math.max(2, Math.round(1 / z.value))}.`;
    },
    colors: ["#25172e", "#4c2d63", "#784491", "#a76fc0", "#e3c8f0"],
  },
  {
    id: "walk",
    label: "Walking share of weekday trips",
    short: "Walking share",
    unit: "percent",
    domain: [0.02, 0.11],
    get: (p) => p.modeShares.walk.value,
    format: (v) => fmtPct(v),
    sentence: (p, r) => {
      const w = p.modeShares.walk;
      if (w.value === null) return "Walking here was too small to report reliably.";
      const rw = r.modeShares.walk.value ?? 0;
      return `${fmtPct(w.value)} of weekday trips here are on foot${w.value > rw ? " — above the regional share" : ` (region ${fmtPct(rw)})`}.`;
    },
    colors: ["#3a2c12", "#7d5c1c", "#b58a24", "#e0b445", "#fbe9b1"],
  },
  {
    id: "workAtHome",
    label: "Usually work at home (share of employed)",
    short: "Work at home",
    unit: "percent",
    domain: [0.06, 0.18],
    get: (p) => p.workAtHomeShare.value,
    format: (v) => fmtPct(v),
    sentence: (p, r) => {
      const w = p.workAtHomeShare;
      if (w.value === null) return "Home-based work was not reported reliably here.";
      return `${fmtPct(w.value)} of employed residents here usually work at home (region ${fmtPct(r.workAtHomeShare.value)}).`;
    },
    colors: ["#1c2b3a", "#2c5468", "#3f7f95", "#67b0c2", "#bfe2ea"],
  },
  {
    id: "toronto",
    label: "Workers commuting to Toronto",
    short: "Commute to Toronto",
    unit: "percent",
    domain: [0.1, 0.42],
    get: (p) => p.torontoWorkShare.value,
    format: (v) => fmtPct(v, 0),
    sentence: (p) => {
      const t = p.torontoWorkShare;
      if (t.value === null) return "Commuting destinations were not reported reliably here.";
      return t.value >= 0.3
        ? `About ${fmtPct(t.value, 0)} of workers with a usual workplace commute to Toronto — one of the strongest cross-boundary flows in Durham.`
        : `About ${fmtPct(t.value, 0)} of workers with a usual workplace commute to Toronto; most people here work closer to home.`;
    },
    colors: ["#2e1f1f", "#5e3230", "#94473f", "#c26f5c", "#efc3ae"],
  },
];

const colorFor = (m: MetricDef, v: number | null): string => {
  if (v === null) return "#39424a"; // suppressed / neutral
  const [lo, hi] = m.domain;
  const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  const stops = m.colors;
  const idx = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(idx));
  return mixHex(stops[i], stops[i + 1], idx - i);
};

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, "0")}`;
}

/**
 * Chapter 3 — Durham Is Not One Place.
 * Choropleth of the eight area municipalities with a metric switcher and a
 * detail card for the selected community.
 */
export function MapChapter({
  region,
  municipalities,
}: {
  region: Profile;
  municipalities: MunicipalityProfile[];
}) {
  const [metric, setMetric] = useState<MetricDef>(METRICS[0]);
  const [selected, setSelected] = useState<string | null>("ajax");
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const selectedProfile = useMemo(
    () => municipalities.find((m) => m.geographyId === selected) ?? null,
    [municipalities, selected],
  );

  // Current style inputs, readable from the async map-load closure.
  const styleInputs = useRef({ metric, municipalities });
  styleInputs.current = { metric, municipalities };
  const applyColors = (map: maplibregl.Map) => {
    const { metric: m, municipalities: ms } = styleInputs.current;
    const expr: unknown[] = ["match", ["get", "id"]];
    for (const prof of ms) expr.push(prof.geographyId, colorFor(m, m.get(prof)));
    expr.push("#39424a");
    map.setPaintProperty("district-fill", "fill-color", expr);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let map: maplibregl.Map | null = null;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/data/planning-districts.geojson");
        if (!res.ok) throw new Error(`geojson ${res.status}`);
        const geojson = await res.json();
        if (cancelled) return;

        map = new maplibregl.Map({
          container: el,
          style: {
            version: 8,
            sources: {},
            layers: [{ id: "bg", type: "background", paint: { "background-color": "#0f1418" } }],
          },
          center: [-78.88, 44.13],
          zoom: 8.4,
          attributionControl: false,
          interactive: true,
          // Static export, no worker bundle config needed in v5
        });
        mapRef.current = map;
        map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");

        map.on("load", () => {
          if (cancelled || !map) return;
          map.addSource("districts", { type: "geojson", data: geojson, generateId: true });
          map.addLayer({
            id: "district-fill",
            type: "fill",
            source: "districts",
            paint: {
              "fill-color": "#1d2f33",
              "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.95, 0.88],
            },
          });
          map.addLayer({
            id: "district-line",
            type: "line",
            source: "districts",
            paint: { "line-color": "#0f1418", "line-width": 1.6 },
          });
          map.addLayer({
            id: "district-selected-line",
            type: "line",
            source: "districts",
            paint: { "line-color": "#f5b043", "line-width": 3 },
            filter: ["==", ["get", "id"], ""],
          });

          applyColors(map);

          // hover state
          let hovered: string | null = null;
          map.on("mousemove", "district-fill", (e) => {
            map!.getCanvas().style.cursor = "pointer";
            const f = e.features?.[0] as MapGeoJSONFeature | undefined;
            if (f && hovered !== f.id) {
              if (hovered !== null) map!.setFeatureState({ source: "districts", id: hovered }, { hover: false });
              hovered = String(f.id);
              map!.setFeatureState({ source: "districts", id: hovered }, { hover: true });
            }
          });
          map.on("mouseleave", "district-fill", () => {
            map!.getCanvas().style.cursor = "";
            if (hovered !== null) map!.setFeatureState({ source: "districts", id: hovered }, { hover: false });
            hovered = null;
          });

          map.on("click", "district-fill", (e) => {
            const f = e.features?.[0] as MapGeoJSONFeature | undefined;
            if (f?.properties?.id) setSelected(String(f.properties.id));
          });

          // keyboard: focusable canvas handled below
          setReady(true);
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // Recolor on metric change (post-load).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    applyColors(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric, municipalities, ready]);

  // Highlight the selected municipality.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setFilter("district-selected-line", ["==", ["get", "id"], selected ?? ""]);
  }, [selected, ready]);

  return (
    <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div className="min-w-0">
        {/* Metric switcher */}
        <div role="tablist" aria-label="Map measure" className="mb-4 flex flex-wrap gap-2">
          {METRICS.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={metric.id === m.id}
              onClick={() => setMetric(m)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                metric.id === m.id
                  ? "border-walk bg-walk/15 text-walk"
                  : "border-night-line text-chalk-dim hover:border-chalk-dim hover:text-chalk"
              }`}
            >
              {m.short}
            </button>
          ))}
        </div>

        <div
          ref={containerRef}
          className="h-[420px] overflow-hidden rounded-xl border border-night-line md:h-[560px]"
          role="application"
          aria-label={`Choropleth map of Durham Region municipalities showing ${metric.label}. Use the list below to read values per municipality.`}
          tabIndex={0}
        />

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-chalk-dim">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span aria-hidden className="flex overflow-hidden rounded">
              {metric.colors.map((c) => (
                <span key={c} className="h-2.5 w-8" style={{ backgroundColor: c }} />
              ))}
            </span>
            <span className="min-w-0">
              {metric.format(metric.domain[0])} → {metric.format(metric.domain[1])}
              {metric.unit === "percent" ? " of trips" : " per household"}
            </span>
          </div>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: "#39424a" }} />
            suppressed
          </span>
        </div>
      </div>

      {/* Selection card */}
      <div className="flex min-w-0 flex-col gap-4">
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-chalk-dim">
            Choose a community
          </legend>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-2">
            {municipalities.map((m) => (
              <button
                key={m.geographyId}
                onClick={() => setSelected(m.geographyId)}
                aria-pressed={selected === m.geographyId}
                className={`rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors ${
                  selected === m.geographyId
                    ? "border-walk bg-walk/10 text-chalk"
                    : "border-night-line text-chalk-dim hover:border-chalk-dim hover:text-chalk"
                }`}
              >
                {m.geographyName}
              </button>
            ))}
          </div>
        </fieldset>

        {selectedProfile && (
          <article className="rounded-xl border border-night-line bg-night-soft p-5" aria-live="polite">
            <h4 className="font-display text-2xl text-chalk">{selectedProfile.geographyName}</h4>
            <p className="mt-1 text-xs text-chalk-dim">
              Planning District · ID {selectedProfile.geographyId} · {fmtInt(selectedProfile.persons)} residents ·{" "}
              {fmtInt(selectedProfile.households)} households
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-chalk">{metric.sentence(selectedProfile, region)}</p>

            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-night-line p-3">
                <dt className="text-xs text-chalk-dim">Transit share</dt>
                <dd className="mt-0.5 font-display text-xl text-chalk">{fmtPct(selectedProfile.modeShares.transit.value)}</dd>
              </div>
              <div className="rounded-lg border border-night-line p-3">
                <dt className="text-xs text-chalk-dim">Vehicles / household</dt>
                <dd className="mt-0.5 font-display text-xl text-chalk">{selectedProfile.avgVehiclesPerHousehold === null ? "suppressed" : fmtX(selectedProfile.avgVehiclesPerHousehold)}</dd>
              </div>
              <div className="rounded-lg border border-night-line p-3">
                <dt className="text-xs text-chalk-dim">Walk + cycle</dt>
                <dd className="mt-0.5 font-display text-xl text-chalk">
                  {fmtPct((selectedProfile.modeShares.walk.value ?? 0) + (selectedProfile.modeShares.bicycle.value ?? 0))}
                </dd>
              </div>
              <div className="rounded-lg border border-night-line p-3">
                <dt className="text-xs text-chalk-dim">Work at home</dt>
                <dd className="mt-0.5 font-display text-xl text-chalk">{fmtPct(selectedProfile.workAtHomeShare.value)}</dd>
              </div>
            </dl>
            {selectedProfile.modeSuppressed && (
              <p className="mt-3 text-xs text-chalk-dim">
                Some trip categories in this community had fewer than four survey records and are excluded —
                shares are computed only from reported trips.
              </p>
            )}
          </article>
        )}

        {failed && (
          <p className="rounded-lg border border-accent/40 bg-accent/10 p-4 text-sm text-chalk">
            The map could not be loaded. All values remain available in the community list and the
            explorer below.
          </p>
        )}
      </div>
    </div>
  );
}
