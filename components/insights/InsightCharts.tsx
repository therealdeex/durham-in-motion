"use client";

import { ChartFrame } from "@/components/ui/ChartFrame";
import { fmtInt, fmtPct } from "@/lib/format";
import { OD_MODE_LABEL } from "@/lib/metrics";
import type { OdModeGroup } from "@/lib/types";

/**
 * Insight visualizations (PR5). Server-fed values from public/data/insights.json —
 * these components only render; every number was computed at build time.
 * Each chart carries its takeaway, universe/denominator, comparable basis,
 * an accessible table, source trail and caveats.
 */

const GROUP_COLOR: Record<OdModeGroup, string> = {
  drive: "var(--color-auto-driver)",
  ride: "var(--color-auto-passenger)",
  transit: "var(--color-transit)",
  walk: "var(--color-walk)",
  cycle: "var(--color-bicycle)",
  schoolBus: "var(--color-school-bus)",
  other: "var(--color-other-misc)",
};
const MODE_ORDER: OdModeGroup[] = ["drive", "ride", "transit", "walk", "cycle", "schoolBus", "other"];

export interface LocalCompositionValues {
  sameMunicipality: { trips: number; share: number; label: string };
  betweenMunicipalities: { trips: number; share: number; label: string };
  outsideInvolving: { trips: number; share: number; label: string };
  totalTrips: number;
}

export function LocalCompositionChart({
  values,
  takeaway,
  universe,
  source,
}: {
  values: LocalCompositionValues;
  takeaway: string;
  universe: string;
  source: string;
}) {
  const groups = [values.sameMunicipality, values.betweenMunicipalities, values.outsideInvolving];
  const colors = ["#f5b043", "#0f8b7f", "#98938a"];
  return (
    <ChartFrame
      kicker="What kind of local?"
      title="Three kinds of local travel"
      takeaway={takeaway}
      scope={`${universe} 2022 TTS.`}
      source={source}
      caveats={[
        "The 'outside' group includes trips made entirely outside Durham by members of Durham households.",
        "2022 survey basis (ages 5+, fuller walking capture) — not comparable with pre-2022 trip counts.",
      ]}
      table={
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Composition of weekday trips by Durham households, 2022</caption>
          <thead>
            <tr className="border-b border-night-line text-xs uppercase tracking-wide text-chalk-dim">
              <th scope="col" className="py-1.5 font-medium">Group</th>
              <th scope="col" className="py-1.5 text-right font-medium">Trips</th>
              <th scope="col" className="py-1.5 text-right font-medium">Share</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g, i) => (
              <tr key={g.label} className="border-b border-night-line/40">
                <td className="py-1.5 text-chalk">
                  <span aria-hidden className="mr-2 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: colors[i] }} />
                  {g.label}
                </td>
                <td className="py-1.5 text-right tabular-nums text-chalk-dim">{fmtInt(g.trips)}</td>
                <td className="py-1.5 text-right tabular-nums text-chalk">{fmtPct(g.share)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-night-line">
              <td className="py-1.5 font-semibold text-chalk">All trips</td>
              <td className="py-1.5 text-right tabular-nums text-chalk">{fmtInt(values.totalTrips)}</td>
              <td className="py-1.5 text-right tabular-nums text-chalk">100%</td>
            </tr>
          </tbody>
        </table>
      }
    >
      <div className="space-y-4">
        {groups.map((g, i) => (
          <div key={g.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-chalk">{g.label}</span>
              <span className="tabular-nums text-chalk-dim">
                <span className="font-semibold text-chalk">{fmtPct(g.share)}</span> · {fmtInt(g.trips)}
              </span>
            </div>
            <div className="mt-1 h-4 w-full overflow-hidden rounded bg-night">
              <div
                className="h-full rounded transition-[width] duration-700 motion-reduce:transition-none"
                style={{ width: `${g.share * 100}%`, backgroundColor: colors[i] }}
              />
            </div>
          </div>
        ))}
      </div>
    </ChartFrame>
  );
}

export interface ConcentrationValues {
  intermunicipalTotal: number;
  top3Share: number;
  topPairs: { a: string; b: string; aToB: number; bToA: number; totalTwoWay: number }[];
}

export function ConcentrationChart({
  values,
  takeaway,
  source,
}: {
  values: ConcentrationValues;
  takeaway: string;
  source: string;
}) {
  const pairs = values.topPairs;
  const max = pairs[0]?.totalTwoWay ?? 1;
  return (
    <ChartFrame
      kicker="Concentration"
      title="Three corridors carry most intermunicipal travel"
      takeaway={takeaway}
      scope={`Weekday trips with both endpoints in Durham but in different municipalities, 2022 TTS. Denominator: ${fmtInt(values.intermunicipalTotal)} intermunicipal trips.`}
      source={source}
      caveats={[
        "Origin–destination relationships, not observed road corridors or proof of a transit route's demand.",
        "Two-way totals combine both directions; they are not person counts.",
      ]}
      table={
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Top intermunicipal connections by two-way weekday trips</caption>
          <thead>
            <tr className="border-b border-night-line text-xs uppercase tracking-wide text-chalk-dim">
              <th scope="col" className="py-1.5 font-medium">Connection</th>
              <th scope="col" className="py-1.5 text-right font-medium">A → B</th>
              <th scope="col" className="py-1.5 text-right font-medium">B → A</th>
              <th scope="col" className="py-1.5 text-right font-medium">Two-way</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((p) => (
              <tr key={`${p.a}-${p.b}`} className="border-b border-night-line/40">
                <td className="py-1.5 text-chalk">{p.a} – {p.b}</td>
                <td className="py-1.5 text-right tabular-nums text-chalk-dim">{fmtInt(p.aToB)}</td>
                <td className="py-1.5 text-right tabular-nums text-chalk-dim">{fmtInt(p.bToA)}</td>
                <td className="py-1.5 text-right tabular-nums text-chalk">{fmtInt(p.totalTwoWay)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="space-y-3">
        {pairs.map((p) => (
          <div key={`${p.a}-${p.b}`}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-chalk">{p.a} ↔ {p.b}</span>
              <span className="tabular-nums text-chalk-dim">{fmtInt(p.totalTwoWay)} two-way</span>
            </div>
            <div className="mt-1 h-3 w-full overflow-hidden rounded bg-night">
              <div
                className="h-full rounded bg-[#7fd6cc] transition-[width] duration-700 motion-reduce:transition-none"
                style={{ width: `${(p.totalTwoWay / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
        <p className="text-xs text-chalk-dim">
          Together: {fmtPct(values.top3Share)} of all intermunicipal Durham travel.
        </p>
      </div>
    </ChartFrame>
  );
}

export interface PurposeValues {
  categories: { key: string; label: string; trips: number | null; share: number | null }[];
  totalTrips: number | null;
  reconciliationResidualTrips: number;
}

export function PurposeChart({
  values,
  takeaway,
  source,
}: {
  values: PurposeValues;
  takeaway: string;
  source: string;
}) {
  const max = Math.max(...values.categories.map((c) => c.share ?? 0));
  const colors: Record<string, string> = {
    hbw: "var(--color-transit)",
    hbs: "var(--color-school-bus)",
    hbd: "var(--color-auto-driver)",
    nhb: "#98938a",
  };
  return (
    <ChartFrame
      kicker="Purpose"
      title="Everyday travel serves more than the commute"
      takeaway={takeaway}
      scope={`Weekday trips by Durham residents, 2022 TTS. Denominator: ${fmtInt(values.totalTrips)} resident weekday trips.`}
      source={source}
      caveats={[
        values.reconciliationResidualTrips === 0
          ? "Published purpose categories reconcile with the total."
          : `Rounding note: the published purpose categories sum to ${Math.abs(values.reconciliationResidualTrips)} trips ${values.reconciliationResidualTrips > 0 ? "above" : "below"} the published total; categories are shown as published.`,
        "Non-home-based is not synonymous with non-work; the non-work share is not '100% minus work'.",
        "Trip purposes, not person shares.",
      ]}
      table={
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Weekday trips by purpose, Durham residents 2022</caption>
          <thead>
            <tr className="border-b border-night-line text-xs uppercase tracking-wide text-chalk-dim">
              <th scope="col" className="py-1.5 font-medium">Purpose</th>
              <th scope="col" className="py-1.5 text-right font-medium">Trips</th>
              <th scope="col" className="py-1.5 text-right font-medium">Share</th>
            </tr>
          </thead>
          <tbody>
            {values.categories.map((c) => (
              <tr key={c.key} className="border-b border-night-line/40">
                <td className="py-1.5 text-chalk">{c.label}</td>
                <td className="py-1.5 text-right tabular-nums text-chalk-dim">{fmtInt(c.trips)}</td>
                <td className="py-1.5 text-right tabular-nums text-chalk">{fmtPct(c.share)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="space-y-3">
        {values.categories.map((c) => (
          <div key={c.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-chalk">{c.label}</span>
              <span className="tabular-nums text-chalk-dim">
                <span className="font-semibold text-chalk">{fmtPct(c.share)}</span> · {fmtInt(c.trips)}
              </span>
            </div>
            <div className="mt-1 h-3.5 w-full overflow-hidden rounded bg-night">
              <div
                className="h-full rounded transition-[width] duration-700 motion-reduce:transition-none"
                style={{ width: `${((c.share ?? 0) / max) * 100}%`, backgroundColor: colors[c.key] }}
              />
            </div>
          </div>
        ))}
      </div>
    </ChartFrame>
  );
}

export interface WeekdayValues {
  days: { day: string; persons: number | null }[];
  busiestDay: { day: string; persons: number };
  quietestDay: { day: string; persons: number };
  busiestMinusQuietest: number;
  relativeDifference: number;
  frequency: {
    oneToFourDays: number | null;
    knownZeroToFive: number | null;
    oneToFourShare: number | null;
    exclusivelyHomeOrUnemployed: number | null;
    unknown: number | null;
  };
}

export function WeekdayChart({
  values,
  takeaway,
  source,
}: {
  values: WeekdayValues;
  takeaway: string;
  source: string;
}) {
  const max = Math.max(...values.days.map((d) => d.persons ?? 0));
  return (
    <ChartFrame
      kicker="The week"
      title="There is no single uniform weekday"
      takeaway={takeaway}
      scope="Persons reporting commuting each weekday last week (multiresponse), 2022 TTS. The same person can appear on several days — these are not five exclusive shares."
      source={source}
      caveats={[
        `${values.busiestDay.day} minus ${values.quietestDay.day}: ${fmtInt(values.busiestMinusQuietest)} people (${fmtPct(values.relativeDifference)}).`,
        `The 1–4-day frequency share excludes ${fmtInt(values.frequency.exclusivelyHomeOrUnemployed)} people in the combined exclusively-home/unemployed category and ${fmtInt(values.frequency.unknown)} unknown responses — it is not the share of all employed residents who work hybrid.`,
      ]}
      table={
        <table className="w-full text-left text-sm">
          <caption className="sr-only">People commuting by weekday, and commute-day frequency, 2022</caption>
          <thead>
            <tr className="border-b border-night-line text-xs uppercase tracking-wide text-chalk-dim">
              <th scope="col" className="py-1.5 font-medium">Day</th>
              <th scope="col" className="py-1.5 text-right font-medium">People commuting</th>
            </tr>
          </thead>
          <tbody>
            {values.days.map((d) => (
              <tr key={d.day} className="border-b border-night-line/40">
                <td className="py-1.5 text-chalk">{d.day}</td>
                <td className="py-1.5 text-right tabular-nums text-chalk-dim">{fmtInt(d.persons)}</td>
              </tr>
            ))}
            <tr className="border-t border-night-line">
              <td className="py-1.5 text-chalk">Commuted 1–4 days (of {fmtInt(values.frequency.knownZeroToFive)} with known 0–5-day answers)</td>
              <td className="py-1.5 text-right tabular-nums text-chalk">
                {fmtInt(values.frequency.oneToFourDays)} ({fmtPct(values.frequency.oneToFourShare)})
              </td>
            </tr>
          </tbody>
        </table>
      }
    >
      <div>
        <div className="flex h-40 items-end gap-3" role="img" aria-label={values.days.map((d) => `${d.day}: ${fmtInt(d.persons)} people commuting`).join(", ")}>
          {values.days.map((d) => {
            const h = ((d.persons ?? 0) / max) * 100;
            const isPeak = d.day === values.busiestDay.day;
            return (
              <div key={d.day} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <span className="text-[10px] tabular-nums text-chalk-dim">{fmtInt(d.persons)}</span>
                <div
                  className="w-full rounded-t transition-[height] duration-700 motion-reduce:transition-none"
                  style={{ height: `${Math.max(4, h)}%`, backgroundColor: isPeak ? "var(--color-walk)" : "#4d6f75" }}
                />
                <span className="text-xs text-chalk-dim">{d.day.slice(0, 3)}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-sm text-chalk-dim">
          Among people with a known 0–5-day answer,{" "}
          <strong className="text-chalk">{fmtPct(values.frequency.oneToFourShare)}</strong> commuted 1–4
          days — part-week commuting was the norm for nearly half of them.
        </p>
      </div>
    </ChartFrame>
  );
}

export interface TransitCompareValues {
  region: {
    share2016: number | null;
    share2022Comparable: number;
    tripsChange: number;
  };
  municipalities: {
    id: string;
    name: string;
    share2016: number | null;
    share2022Comparable: number;
    pp: number | null;
    status2016: string;
  }[];
}

export function TransitChangeChart({
  values,
  takeaway,
  source,
}: {
  values: TransitCompareValues;
  takeaway: string;
  source: string;
}) {
  const computable = values.municipalities.filter((m) => m.pp !== null);
  const minShare = 0;
  const maxShare = Math.max(...values.municipalities.map((m) => Math.max(m.share2016 ?? 0, m.share2022Comparable))) * 1.1;
  return (
    <ChartFrame
      kicker="Comparable transit"
      title="The comparable transit decline was region-wide"
      takeaway={takeaway}
      scope={`2016 resident trips (public summary) vs 2022 trips by Durham households on the 2016-comparable basis (excl2016 = 0). Comparable totals moved ${fmtPct(values.region.tripsChange)} region-wide.`}
      source={source}
      caveats={[
        "Harmonized basis only — full-basis 2022 shares never appear in this comparison.",
        "2022 reflects a post-pandemic environment; the survey alone cannot say why.",
        "Brock's 2016 transit components are suppressed in the published summary, so its change is not computable (never guessed).",
      ]}
      table={
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Municipal transit share, 2016 vs 2022 comparable basis</caption>
          <thead>
            <tr className="border-b border-night-line text-xs uppercase tracking-wide text-chalk-dim">
              <th scope="col" className="py-1.5 font-medium">Municipality</th>
              <th scope="col" className="py-1.5 text-right font-medium">2016</th>
              <th scope="col" className="py-1.5 text-right font-medium">2022 (comparable)</th>
              <th scope="col" className="py-1.5 text-right font-medium">Change</th>
            </tr>
          </thead>
          <tbody>
            {values.municipalities.map((m) => (
              <tr key={m.id} className="border-b border-night-line/40">
                <td className="py-1.5 text-chalk">{m.name}</td>
                <td className="py-1.5 text-right tabular-nums text-chalk-dim">
                  {m.share2016 === null ? "not computable" : fmtPct(m.share2016)}
                </td>
                <td className="py-1.5 text-right tabular-nums text-chalk">{fmtPct(m.share2022Comparable)}</td>
                <td className="py-1.5 text-right tabular-nums text-chalk">
                  {m.pp === null ? "—" : `${m.pp >= 0 ? "+" : "−"}${Math.abs(m.pp * 100).toFixed(1)} pp`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="space-y-3">
        {values.municipalities.map((m) => {
          const x2016 = m.share2016 === null ? null : ((m.share2016 - minShare) / (maxShare - minShare)) * 100;
          const x2022 = ((m.share2022Comparable - minShare) / (maxShare - minShare)) * 100;
          return (
            <div key={m.id}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-chalk">{m.name}</span>
                <span className="tabular-nums text-xs text-chalk-dim">
                  {m.share2016 === null ? (
                    <span title={m.status2016}>2016 not computable</span>
                  ) : (
                    <>
                      {fmtPct(m.share2016)} → {fmtPct(m.share2022Comparable)}{" "}
                      <span className="text-walk">({m.pp! >= 0 ? "+" : "−"}{Math.abs(m.pp! * 100).toFixed(1)} pp)</span>
                    </>
                  )}
                </span>
              </div>
              <div className="relative mt-1 h-3 w-full rounded bg-night">
                {x2016 !== null && (
                  <span className="absolute inset-y-0 left-0 rounded bg-[#8fb8c9]" style={{ width: `${x2016}%` }} aria-hidden />
                )}
                <span
                  className="absolute inset-y-0 left-0 rounded bg-[var(--color-transit)]"
                  style={{ width: `${x2022}%` }}
                  aria-hidden
                />
              </div>
            </div>
          );
        })}
        <p className="text-xs text-chalk-dim">
          Light bar 2016, dark bar 2022 comparable basis. {computable.length} of 8 municipalities
          computable; Brock excluded (suppressed 2016 transit cells). Regional contrast:{" "}
          {fmtPct(values.region.share2016)} → {fmtPct(values.region.share2022Comparable)}.
        </p>
      </div>
    </ChartFrame>
  );
}

export function ModeContextLegend({ shares }: { shares: Record<string, number> }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-chalk-dim">
      {MODE_ORDER.map((g) => (
        <li key={g} className="flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: GROUP_COLOR[g]! }} />
          {OD_MODE_LABEL[g]} {fmtPct(shares[g] ?? 0)}
        </li>
      ))}
    </ul>
  );
}
