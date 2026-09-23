import Link from "next/link";
import { Hero } from "@/components/story/Hero";
import { MeetDurham } from "@/components/story/MeetDurham";
import { ChapterNav } from "@/components/story/ChapterNav";
import { ModeShare } from "@/components/viz/ModeShare";
import { InternalReveal } from "@/components/viz/InternalReveal";
import { NetworkMap } from "@/components/viz/NetworkMap";
import { ModeMorph } from "@/components/viz/ModeMorph";
import { ComparableBasis } from "@/components/viz/ComparableBasis";
import { LongView } from "@/components/viz/LongView";
import { WorkAtHomeDivergence } from "@/components/story/WorkAtHomeDivergence";
import { CommunityExplorer } from "@/components/explore/CommunityExplorer";
import {
  LocalCompositionChart,
  ConcentrationChart,
  PurposeChart,
  WeekdayChart,
  TransitChangeChart,
} from "@/components/insights/InsightCharts";
import { SourceNote, SuppressionNote } from "@/components/ui/Notes";
import { getHistoricalTrends, getInsights, getMunicipalities, getOdFlows, getRegionSummary, getWards } from "@/lib/data";
import { loadMapGeom } from "@/lib/od-map-server";
import { fmtPct, fmtInt } from "@/lib/format";
import { licenceRateNote } from "@/lib/metrics";
import type { InsightBase } from "@/lib/types";

export const dynamic = "force-static";

const CHAPTERS = [
  { id: "top", label: "Top" },
  { id: "meet-durham", label: "Meet Durham" },
  { id: "local", label: "Mostly local" },
  { id: "network", label: "Hidden network" },
  { id: "more-than-commute", label: "Beyond the commute" },
  { id: "destination-mode", label: "Destination modes" },
  { id: "change", label: "Change" },
  { id: "your-community", label: "Your community" },
  { id: "long-view", label: "The long view" },
  { id: "methodology", label: "Reading the data" },
];

/** Narrow an insight to its typed values (values shape is per-insight). */
const insight = <V,>(insights: InsightBase[], id: string): InsightBase & { values: V } =>
  insights.find((i) => i.id === id) as InsightBase & { values: V };

export default function StoryPage() {
  const regionSummary = getRegionSummary();
  const municipalitiesFile = getMunicipalities();
  const wardsFile = getWards();
  const trends = getHistoricalTrends();
  const od = getOdFlows();
  const geom = loadMapGeom();
  const { insights, unavailable } = getInsights();

  const localInsight = insight<Parameters<typeof LocalCompositionChart>[0]["values"]>(insights, "local-vs-cross");
  const concentrationInsight = insight<Parameters<typeof ConcentrationChart>[0]["values"]>(insights, "intermunicipal-concentration");
  const purposeInsight = insight<Parameters<typeof PurposeChart>[0]["values"]>(insights, "purpose-composition");
  const weekdayInsight = insight<Parameters<typeof WeekdayChart>[0]["values"]>(insights, "weekday-commuting");
  const transitInsight = insight<Parameters<typeof TransitChangeChart>[0]["values"]>(insights, "comparable-transit-municipal");

  const r2022 = regionSummary.profiles.find((p) => p.surveyYear === 2022)!;
  const r2016 = regionSummary.profiles.find((p) => p.surveyYear === 2016)!;
  const r1986 = regionSummary.profiles.find((p) => p.surveyYear === 1986)!;

  const tripsPerHousehold =
    r2022.tripsTotal !== null && r2022.households ? (r2022.tripsTotal / r2022.households).toFixed(1) : null;

  const facts = [
    {
      id: "people",
      value: r2022.persons ?? 0,
      display: fmtInt(r2022.persons),
      label: "people in the 2022 survey's picture of Durham",
      note: "Every household member reported across the region — an estimate expanded from about 15,000 participating households.",
    },
    {
      id: "households",
      value: r2022.households ?? 0,
      display: fmtInt(r2022.households),
      label: "households, from Clarington's lakefront to Brock's farms",
      note: `About ${(r2022.households! / r1986.households!).toFixed(1)} times the ${fmtInt(r1986.households)} households counted in 1986.`,
    },
    {
      id: "drivers",
      value: r2022.drivers ?? 0,
      display: fmtInt(r2022.drivers),
      label: "licensed drivers",
      note: licenceRateNote(r2022),
    },
    {
      id: "trips",
      value: r2022.tripsTotal ?? 0,
      display: `${(r2022.tripsTotal! / 1_000_000).toFixed(2)} million`,
      label: "weekday trips made by Durham residents",
      note: `About ${tripsPerHousehold ?? "—"} trips per household on an average weekday. 2022 counts include ages 5+ — not directly comparable with earlier cycles.`,
    },
  ];

  const OD_SOURCE = "2022 TTS via DMG iDRS (trips by members of Durham households, expanded weekday estimates; Data Management Group, University of Toronto).";

  return (
    <>
      <ChapterNav chapters={CHAPTERS} />
      <main id="story">
        <Hero />

        {/* Chapter 1 — Meet Durham */}
        <section id="meet-durham" className="dark-section dark-textured scroll-mt-0 border-t border-night-line/50" aria-labelledby="meet-durham-h">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="chapter-kicker">Chapter 1</p>
            <h2 id="meet-durham-h" className="mt-3 max-w-[20ch] font-display text-[clamp(2.2rem,5vw,3.6rem)] font-semibold leading-tight text-chalk">
              Meet Durham, by the numbers
            </h2>
            <MeetDurham facts={facts} />
          </div>
        </section>

        {/* Chapter 2 — Most travel is local — but what kind of local? */}
        <section id="local" className="dark-section dark-textured scroll-mt-8 border-t border-night-line/50" aria-labelledby="local-h">
          <div className="mx-auto max-w-6xl px-6">
            <div className="pt-20">
              <p className="chapter-kicker">Chapter 2</p>
              <h2 id="local-h" className="mt-3 max-w-[22ch] font-display text-[clamp(2.2rem,5vw,3.6rem)] font-semibold leading-tight text-chalk">
                Most travel is local — but what kind of local?
              </h2>
              <p className="prose-story mt-6">
                Scroll through the sequence — then see the three-way split the &ldquo;local&rdquo; headline hides.
              </p>
            </div>
            <InternalReveal geom={geom} totals={od.totals} />
            <div className="pb-20">
              <LocalCompositionChart
                values={localInsight.values}
                takeaway={localInsight.takeaway}
                universe={localInsight.universe}
                source={`Source: ${OD_SOURCE}`}
              />
            </div>
          </div>
        </section>

        {/* Chapter 3 — The hidden network */}
        <section id="network" className="dark-section scroll-mt-8 border-t border-night-line/50" aria-labelledby="network-h">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="chapter-kicker">Chapter 3</p>
            <h2 id="network-h" className="mt-3 max-w-[24ch] font-display text-[clamp(2.2rem,5vw,3.6rem)] font-semibold leading-tight text-chalk">
              The borders aren&apos;t where movement stops
            </h2>
            <p className="prose-story mt-6">
              Four in five trips stay in Durham — and a huge share cross municipal lines. Explore the
              region&apos;s travel connections, then see how concentrated they are.
            </p>
            <div className="mt-12">
              <NetworkMap geom={geom} pairs={od.pairs} threshold={od.display.floor} />
            </div>
            <div className="mt-10">
              <ConcentrationChart
                values={concentrationInsight.values}
                takeaway={concentrationInsight.takeaway}
                source={`Source: ${OD_SOURCE}`}
              />
            </div>
          </div>
        </section>

        {/* Chapter 4 — Everyday travel serves more than the commute */}
        <section id="more-than-commute" className="scroll-mt-8" aria-labelledby="more-than-commute-h">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="chapter-kicker light">Chapter 4</p>
            <h2 id="more-than-commute-h" className="mt-3 max-w-[24ch] font-display text-[clamp(2.2rem,5vw,3.6rem)] font-semibold leading-tight text-ink">
              Everyday travel serves more than the commute
            </h2>
            <p className="prose-story mt-6 text-ink-soft">
              The commuting story dominates the region&apos;s transportation conversation. The survey
              week looked different: work is a quarter of weekday trips, and no two weekdays match.
            </p>
            <div className="mt-10 grid gap-8 lg:grid-cols-2">
              <PurposeChart values={purposeInsight.values} takeaway={purposeInsight.takeaway} source="Source: 2022 TTS public summary, resident weekday trips by purpose (Data Management Group, University of Toronto)." />
              <WeekdayChart values={weekdayInsight.values} takeaway={weekdayInsight.takeaway} source="Source: 2022 TTS public summary, person commute-day and commute-frequency questions (Data Management Group, University of Toronto)." />
            </div>
            <SuppressionNote />
          </div>
        </section>

        {/* Chapter 5 — Destinations change the mode */}
        <section id="destination-mode" className="dark-section dark-textured scroll-mt-8 border-t border-night-line/50" aria-labelledby="destination-mode-h">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="chapter-kicker">Chapter 5</p>
            <h2 id="destination-mode-h" className="mt-3 max-w-[24ch] font-display text-[clamp(2.2rem,5vw,3.6rem)] font-semibold leading-tight text-chalk">
              Where we&apos;re going changes how we get there
            </h2>
            <p className="prose-story mt-6">
              Same households, same weekday — wildly different travel, depending on the destination.
              Switch between the five destination contexts; they cover every Durham trip exactly once.
            </p>
            <div className="mt-12">
              <ModeMorph contexts={od.modeContexts} />
            </div>
            <SourceNote>
              Source: 2022 TTS origin–destination by primary mode via DMG iDRS. &ldquo;Transit&rdquo; includes
              local transit, GO rail, and combined GO + local trips; &ldquo;Other&rdquo; includes taxi,
              ride-hailing, motorcycle, e-scooter and unclassified trips. The five contexts are
              mutually exclusive; association, not a causal effect of the boundary.
            </SourceNote>

            <div className="mt-16">
              <h3 className="font-display text-2xl font-semibold text-chalk">Zoomed out: how we move overall</h3>
              <p className="prose-story mt-3 max-w-[60ch] text-chalk-dim">
                On an average weekday in 2022, Durham residents made{" "}
                <strong className="text-chalk">{fmtInt(r2022.tripsTotal)} trips</strong> —{" "}
                <strong className="text-chalk">{fmtPct(r2022.modeShares.autoDriver.value)}</strong> as a
                driver, plus {fmtPct(r2022.modeShares.autoPassenger.value)} as a passenger. Transit
                carries {fmtPct(r2022.modeShares.transit.value)}; walking, {fmtPct(r2022.modeShares.walk.value)}.
              </p>
              <div className="mt-10">
                <ModeShare region={r2022} />
              </div>
              <SourceNote>
                Source: 2022 TTS, trips by residents by main mode, 24-hour (Data Management Group,
                University of Toronto). 2022 trip counts cover ages 5+ and capture walking more fully
                than earlier cycles — see{" "}
                <Link href="/methodology/" className="underline underline-offset-2">methodology</Link>.
              </SourceNote>
            </div>
          </div>
        </section>

        {/* Chapter 6 — Change was uneven */}
        <section id="change" className="dark-section scroll-mt-8 border-t border-night-line/50" aria-labelledby="change-h">
          <span id="surprise" className="block scroll-mt-24" aria-hidden />
          <div className="mx-auto max-w-6xl px-6 py-20">
            <WorkAtHomeDivergence data={municipalitiesFile} region2016={r2016.workAtHomeShare} />
            <SourceNote>
              Source: 2016 and 2022 TTS, persons usually employed at home as a share of employed
              residents. Point estimates from two survey cycles; no significance or causation claimed.
            </SourceNote>
            <div className="mt-14">
              <TransitChangeChart
                values={transitInsight.values}
                takeaway={transitInsight.takeaway}
                source="Sources: 2016 TTS public municipal summary; 2022 TTS via DMG iDRS, 2016-comparable basis (excl2016 = 0). Reconciliation differences between extracts are documented, not forced."
              />
            </div>
          </div>
        </section>

        {/* Chapter 7 — Find your community (one explorer) */}
        <section id="your-community" className="scroll-mt-8" aria-labelledby="your-community-h">
          <span id="your-durham" className="block scroll-mt-24" aria-hidden />
          <span id="not-one-place" className="block scroll-mt-24" aria-hidden />
          <span id="explore" className="block scroll-mt-24" aria-hidden />
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="chapter-kicker light">Chapter 7</p>
            <h2 id="your-community-h" className="mt-3 max-w-[22ch] font-display text-[clamp(2.2rem,5vw,3.6rem)] font-semibold leading-tight text-ink">
              Find your community
            </h2>
            <p className="prose-story mt-6 text-ink-soft">
              One workspace for every community&apos;s travel picture: a snapshot postcard, where its
              trips go, a map of how the eight municipalities compare, and rankings that keep
              unknown values visible. Pick a community — the link in your address bar updates and
              stays shareable.
            </p>
            <div className="mt-10">
              <CommunityExplorer
                geom={geom}
                region={wardsFile.region}
                municipalities={municipalitiesFile.municipalities}
                wards={wardsFile.wards}
                od={od}
              />
            </div>
            <SourceNote>
              Sources: 2022 TTS public municipal and ward summaries; 2022 TTS origin–destination
              tabulation via DMG iDRS (municipality-level destination detail; there is no ward-level
              OD data). Ward boundaries are the 2022 structure.
            </SourceNote>
            <SuppressionNote />
          </div>
        </section>

        {/* Chapter 8 — The Long View */}
        <section id="long-view" className="dark-section dark-textured scroll-mt-8 border-t border-night-line/50" aria-labelledby="long-view-h">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="chapter-kicker">Chapter 8</p>
            <h2 id="long-view-h" className="mt-3 max-w-[20ch] font-display text-[clamp(2.2rem,5vw,3.6rem)] font-semibold leading-tight text-chalk">
              The long view: 1986 → 2022
            </h2>
            <p className="prose-story mt-6">
              Durham&apos;s surveyed population has more than doubled since 1986 — from{" "}
              <strong>{fmtInt(r1986.persons)}</strong> to {fmtInt(r2022.persons)}. Choose a measure to
              see the whole series. Where survey methods changed, the chart breaks the line and says
              so plainly.
            </p>
            <div className="mt-10">
              <LongView trends={trends} />
            </div>
            <ComparableBasis
              year2016={{
                transit: r2016.modeShares.transit.value,
                walk: r2016.modeShares.walk.value,
                autoDriver: r2016.modeShares.autoDriver.value,
                tripsTotal: r2016.tripsTotal,
              }}
              comparable={od.comparable2022}
            />
          </div>
        </section>

        {/* Chapter 9 — How to Read This */}
        <section id="methodology" className="scroll-mt-8" aria-labelledby="methodology-h">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="chapter-kicker light">Chapter 9</p>
            <h2 id="methodology-h" className="mt-3 max-w-[22ch] font-display text-[clamp(2.2rem,5vw,3.6rem)] font-semibold leading-tight text-ink">
              How to read this
            </h2>
            <div className="prose-story mt-6 space-y-4">
              <p>
                <strong>The Transportation Tomorrow Survey (TTS)</strong> is a household travel survey run
                every five or six years across the Greater Toronto and Hamilton Area since 1986. Households
                record each member&apos;s travel for one weekday. Results are expanded to estimate everyone —
                they are survey estimates, not counts.
              </p>
              <p>
                <strong>Small numbers disappear.</strong> When fewer than four surveyed households support a
                figure, it is suppressed. We show those as unknown — never as zero — and never
                reconstruct them from totals.
              </p>
              <p>
                <strong>Bases changed twice.</strong> Trips were collected for ages 6+ in 1986, 11+ from
                1991–2016, and 5+ in 2022 (with fuller walking capture). 2022 and 1986 points are drawn
                as separate markers, never connected to the 1991–2016 line.
              </p>
              <p>
                <strong>Lines, not roads.</strong> The travel connections shown in chapters 2–5 and 7 come
                from an authorized origin–destination tabulation of the 2022 TTS. They show where trips
                begin and end — not the streets or transit routes used.
              </p>
            </div>

            <div className="mt-10 rounded-xl border border-line bg-paper-dim/40 p-5 md:p-7">
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint">
                What this data cannot answer (yet)
              </h3>
              <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-ink-soft">
                {unavailable.map((u) => (
                  <li key={u.question}>
                    <strong className="text-ink">{u.question}.</strong> {u.reason}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/methodology/" className="rounded-full border border-ink px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-ink hover:text-paper">
                Full methodology
              </Link>
              <Link href="/sources/" className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink">
                Sources &amp; licence
              </Link>
            </div>
          </div>
        </section>

        {/* Keep exploring — the story shelf */}
        <section id="keep-exploring" className="dark-section dark-textured scroll-mt-8 border-t border-night-line/50" aria-labelledby="keep-exploring-h">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="chapter-kicker">Keep exploring</p>
            <h2 id="keep-exploring-h" className="mt-3 max-w-[22ch] font-display text-[clamp(2.2rem,5vw,3.6rem)] font-semibold leading-tight text-chalk">
              Two more ways to see Durham move
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <Link
                href="/stories/day/"
                className="group relative overflow-hidden rounded-2xl border border-night-line bg-night-soft p-7 transition-colors hover:border-walk/60 md:p-8"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-walk">Story</p>
                <h3 className="mt-3 font-display text-2xl font-semibold text-chalk">A Day in Durham</h3>
                <p className="mt-3 max-w-[38ch] text-sm leading-relaxed text-chalk-dim">
                  How more than a million weekday journeys change from hour to hour — and why the
                  afternoon, not the morning rush, is the region&apos;s biggest surge.
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-walk">
                  Watch the day unfold
                  <span aria-hidden className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none">→</span>
                </span>
                <ClockGlyph />
              </Link>
              <Link
                href="/stories/transit/"
                className="group relative overflow-hidden rounded-2xl border border-night-line bg-night-soft p-7 transition-colors hover:border-walk/60 md:p-8"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-walk">Story</p>
                <h3 className="mt-3 font-display text-2xl font-semibold text-chalk">The Transit Journey</h3>
                <p className="mt-3 max-w-[38ch] text-sm leading-relaxed text-chalk-dim">
                  How Durham residents reach transit, connect through stations, and complete their
                  journeys — a transit trip starts before the train arrives.
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-walk">
                  Follow the chain
                  <span aria-hidden className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none">→</span>
                </span>
                <RailGlyph />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

/** Decorative 24-hour dial for the day-story card. */
function ClockGlyph() {
  const R = 46;
  const C = 52;
  const pt = (min: number, r: number) => {
    const a = ((min / 1440) * 360 - 90) * (Math.PI / 180);
    return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
  };
  const from = pt(240, R);
  const to = pt(1110, R);
  return (
    <svg viewBox="0 0 104 104" className="pointer-events-none absolute -bottom-4 -right-3 h-32 w-32 opacity-60" aria-hidden>
      <circle cx={C} cy={C} r={R} fill="none" stroke="#2a333b" strokeWidth="1.5" />
      {Array.from({ length: 24 }, (_, h) => {
        const a = pt(h * 60, R);
        const b = pt(h * 60, h % 6 === 0 ? R - 6 : R - 3);
        return <line key={h} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={h === 4 ? "#f5b043" : "#3d4a52"} strokeWidth={h === 4 ? 1.6 : 1} />;
      })}
      <path d={`M${from.x} ${from.y} A${R} ${R} 0 1 1 ${to.x} ${to.y}`} fill="none" stroke="#7fd6cc" strokeWidth="3.5" strokeLinecap="round" opacity="0.9" />
      <circle cx={C} cy={C} r="2.5" fill="#ecf1f0" />
    </svg>
  );
}

/** Decorative line-and-stations glyph for the transit-story card. */
function RailGlyph() {
  const stations = [10, 34, 58, 82, 94];
  return (
    <svg viewBox="0 0 104 104" className="pointer-events-none absolute -bottom-5 -right-4 h-28 w-44 opacity-60" aria-hidden>
      <path d="M6 62 Q52 46 98 62" fill="none" stroke="#2a333b" strokeWidth="2" />
      <path d="M6 62 Q52 46 98 62" fill="none" stroke="#00857a" strokeWidth="2" strokeDasharray="4 7" strokeLinecap="round" />
      {stations.map((x, i) => (
        <circle key={x} cx={x} cy={62 - Math.sin(((x - 6) / 92) * Math.PI) * 14} r={i === stations.length - 1 ? 5 : i === 0 ? 5 : 3.5} fill={i === 0 || i === stations.length - 1 ? "#f5b043" : "#7fd6cc"} />
      ))}
    </svg>
  );
}

function SiteFooter() {
  return (
    <footer className="dark-section border-t border-night-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-display text-xl text-chalk">Durham in Motion</p>
          <p className="mt-2 max-w-[52ch] text-xs leading-relaxed text-chalk-dim">
            Transportation Tomorrow Survey data: Data Management Group, University of Toronto
            (public summaries and authorized iDRS origin–destination extracts). Additional historical
            data: Government of Ontario. Calculations and visualizations by Durham in Motion.
            This is an independent public project and is not endorsed by or affiliated with the Data
            Management Group or the University of Toronto.
          </p>
        </div>
        <nav aria-label="Site" className="flex flex-col gap-1.5 text-sm">
          <Link href="/stories/day/" className="text-chalk-dim transition-colors hover:text-chalk">A Day in Durham</Link>
          <Link href="/stories/transit/" className="text-chalk-dim transition-colors hover:text-chalk">The Transit Journey</Link>
          <Link href="/methodology/" className="text-chalk-dim transition-colors hover:text-chalk">Methodology</Link>
          <Link href="/sources/" className="text-chalk-dim transition-colors hover:text-chalk">Sources &amp; licence</Link>
          <a href="/data/manifest.json" className="text-chalk-dim transition-colors hover:text-chalk">Data manifest (JSON)</a>
        </nav>
      </div>
    </footer>
  );
}
