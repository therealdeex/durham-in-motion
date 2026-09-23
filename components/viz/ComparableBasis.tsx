import { fmtInt, fmtPct } from "@/lib/format";
import type { OdFlows } from "@/lib/types";

interface Basis {
  label: string;
  share: number | null;
  trips: number | null;
}

/**
 * “The comparable 2022 picture” — a like-for-like 2016 ↔ 2022 mode
 * comparison using the excl2016 = 0 extract, clearly flagged. Server
 * component: static bars, no client JS.
 */
export function ComparableBasis({
  year2016,
  comparable,
}: {
  year2016: { transit: number | null; walk: number | null; autoDriver: number | null; tripsTotal: number | null };
  comparable: OdFlows["comparable2022"];
}) {
  const rows: { key: string; label: string; color: string; then: Basis; now: Basis; note: string }[] = [
    {
      key: "transit",
      label: "Transit",
      color: "var(--color-transit)",
      then: { label: "2016", share: year2016.transit, trips: year2016.transit !== null && year2016.tripsTotal !== null ? year2016.transit * year2016.tripsTotal : null },
      now: { label: "2022 (comparable)", share: comparable.groups.transit! / comparable.total, trips: comparable.groups.transit! },
      note: "Local transit, GO rail, and combined GO + local trips.",
    },
    {
      key: "walk",
      label: "Walking",
      color: "var(--color-walk)",
      then: { label: "2016", share: year2016.walk, trips: year2016.walk !== null && year2016.tripsTotal !== null ? year2016.walk * year2016.tripsTotal : null },
      now: { label: "2022 (comparable)", share: comparable.groups.walk! / comparable.total, trips: comparable.groups.walk! },
      note: "Roughly held its comparable share; the full-basis 2022 figure (8.3%) is not comparable.",
    },
    {
      key: "drive",
      label: "Car driver",
      color: "var(--color-auto-driver)",
      then: { label: "2016", share: year2016.autoDriver, trips: year2016.autoDriver !== null && year2016.tripsTotal !== null ? year2016.autoDriver * year2016.tripsTotal : null },
      now: { label: "2022 (comparable)", share: comparable.groups.drive! / comparable.total, trips: comparable.groups.drive! },
      note: "The dominant mode barely moved on either basis.",
    },
  ];

  return (
    <div className="mt-14 rounded-xl border border-night-line bg-night-soft p-5 md:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-walk">The comparable 2022 picture</p>
      <h3 className="mt-3 max-w-[26ch] font-display text-[clamp(1.5rem,3vw,2.2rem)] font-semibold leading-tight text-chalk">
        Transit had not yet returned to its 2016 share
      </h3>
      <p className="prose-story mt-4">
        Because 2022 collected trips differently, this site never places 2022 trip counts on a line
        with earlier cycles. But the survey includes a flag (<code className="rounded bg-night px-1">excl2016&nbsp;=&nbsp;0</code>)
        that puts 2022 on the <strong>older, comparable basis</strong> — a like-for-like series.
        On that basis, transit represented a smaller share of Durham trips in 2022 than in 2016.
        The 2022 survey reflects a post-pandemic travel environment; the survey alone can&apos;t say why.
      </p>

      <div className="mt-7 space-y-6">
        {rows.map((r) => (
          <div key={r.key}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-chalk">{r.label}</p>
              <p className="text-xs text-chalk-dim">{r.note}</p>
            </div>
            {[r.then, r.now].map((side) => (
              <div key={side.label} className="mt-2 flex items-center gap-3">
                <span className="w-28 shrink-0 text-right text-xs tabular-nums text-chalk-dim">{side.label}</span>
                <div className="h-5 flex-1 overflow-hidden rounded bg-night">
                  <div
                    className="h-full rounded-r transition-[width] duration-700"
                    style={{ width: `${(side.share ?? 0) * 100}%`, backgroundColor: r.color, opacity: side.label === "2016" ? 0.55 : 1 }}
                  />
                </div>
                <span className="w-24 shrink-0 text-sm font-semibold tabular-nums text-chalk">
                  {fmtPct(side.share)}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs leading-relaxed text-chalk-dim">
        2016: {fmtInt(year2016.tripsTotal)} weekday trips (public TTS summary). 2022 comparable basis:{" "}
        {fmtInt(comparable.total)} weekday trips (2022 TTS, DMG iDRS, filter “exclude for comparisons
        with 2016 or earlier” = 0). Bars are drawn to the same scale. Comparability caveats for
        pre-2022 cycles still apply.
      </p>
    </div>
  );
}
