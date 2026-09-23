import type { Metadata } from "next";
import Link from "next/link";
import { getDayStory } from "@/lib/stories/data";
import {
  getNetBoundaryFlowByHour,
  getPurposeCompositionByHour,
  getTripsByHour,
} from "@/lib/stories/selectors";
import { BROAD_PURPOSES, PURPOSE_LABEL } from "@/lib/stories/types";
import { loadMapGeom } from "@/lib/od-map-server";
import { fmtInt, fmtPct } from "@/lib/format";
import { StoryHero } from "@/components/stories/primitives";
import { StoryEndCard } from "@/components/stories/primitives";
import { PractitionerNote, SourceFootnote } from "@/components/stories/primitives";
import { MetricReveal } from "@/components/stories/MetricReveal";
import { DayExperience, type BeatSpec } from "@/components/stories/day/DayExperience";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "A Day in Durham",
  description:
    "How the region wakes up, moves, and changes through a weekday — hour by hour, from the 2022 Transportation Tomorrow Survey.",
  openGraph: {
    title: "A Day in Durham | Durham in Motion",
    description:
      "The morning commute is not the busiest moment of Durham's travel day. Watch the region's daily rhythm unfold.",
    url: "/stories/day/",
    images: [{ url: "/og-day.png", width: 1200, height: 630, alt: "A Day in Durham" }],
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "A Day in Durham | Durham in Motion",
    description: "The morning commute is not the busiest moment of Durham's travel day.",
    images: ["/og-day.png"],
  },
};

const OD_SOURCE =
  "2022 TTS via DMG iDRS (authorized extracts; Data Management Group, University of Toronto). Expanded weekday estimates.";

export default function DayStoryPage() {
  const file = getDayStory();
  const geom = loadMapGeom({ width: 620, height: 640 });
  const binMinutes = file.meta.binMinutes;

  // every headline number flows through a selector — no literals in JSX
  const trips = (h: number) => getTripsByHour(file, h);
  const purpose = (h: number) => getPurposeCompositionByHour(file, h);
  const boundary = (h: number) => getNetBoundaryFlowByHour(file, h);
  const pct = (h: number, p: (typeof BROAD_PURPOSES)[number]) => fmtPct(purpose(h).shares[p], 0);

  const lateNightTotal = [24, 25, 26, 27].reduce((a, h) => a + trips(h), 0);
  const pickupDropoffDay =
    file.meta.context.internalPickupDropoff + file.meta.context.internalDropoffPassenger;

  const beats: BeatSpec[] = [
    {
      id: "beat-0400",
      minutes: 0,
      kicker: "4:00 a.m.",
      title: "Durham, barely moving",
      body: (
        <>
          <p>
            In the first half-hour of the survey day, Durham households start{" "}
            <strong className="text-chalk">{fmtInt(file.bins[0]!.trips)}</strong> trips. The region is as
            still as it ever gets. Most of what moves is work — early shifts crossing a dark map.
          </p>
          <p>
            The clock below starts here because the survey does: the Transportation Tomorrow Survey
            treats the day as one long block that begins at <strong className="text-chalk">4 a.m.</strong> and
            ends just before 4 a.m. tomorrow.
          </p>
        </>
      ),
    },
    {
      id: "beat-0600",
      minutes: 2 * 60,
      kicker: "6:00 a.m.",
      title: "The first wave is almost entirely work",
      body: (
        <>
          <p>
            By the 6 a.m. hour the region starts <strong className="text-chalk">{fmtInt(trips(6))}</strong>{" "}
            trips — and {pct(5, "Home-Based Work")} of the 5 a.m. hour was people going to work. This is
            the commuter wave the region is famous for.
          </p>
          <p>But watch what happens when it crests.</p>
        </>
      ),
    },
    {
      id: "beat-0800",
      minutes: 4 * 60,
      kicker: "8:00 a.m.",
      title: "The morning rush isn't what it looks like",
      body: (
        <>
          <p>
            The 8 a.m. hour is the traditional morning peak:{" "}
            <MetricReveal value={trips(8)} format="int" className="font-display text-3xl font-semibold text-walk" />{" "}
            trip starts. Yet work alone is only <strong className="text-chalk">{pct(8, "Home-Based Work")}</strong> of
            them. School ({pct(8, "Home-based School")}) and discretionary travel ({pct(8, "Home-based Discretionary")})
            together carry the hour.
          </p>
          <p>
            Durham is also exporting movement:{" "}
            <strong className="text-chalk">{fmtInt(boundary(7).outbound)}</strong> trips left the region in the 7
            a.m. hour against {fmtInt(boundary(7).inbound)} arriving — the day&apos;s widest gap,{" "}
            <strong className="text-chalk">{fmtInt(-boundary(7).net)}</strong> more leaving than entering.
          </p>
        </>
      ),
    },
    {
      id: "beat-1200",
      minutes: 8 * 60,
      kicker: "12:00 p.m.",
      title: "Midday belongs to everything else",
      body: (
        <>
          <p>
            After the morning peak, travel settles into a broad plateau around{" "}
            <strong className="text-chalk">{fmtInt(trips(12))}</strong> trips an hour — but its character has
            flipped: {pct(12, "Home-based Discretionary")} of the noon hour is discretionary. Errands, lunches,
            visits, deliveries.
          </p>
          <p>The quiet hours between the peaks are not a lull. They are a different region.</p>
        </>
      ),
    },
    {
      id: "beat-1500",
      minutes: 11 * 60,
      kicker: "3:00 p.m.",
      title: "The bigger surge comes in the afternoon",
      body: (
        <>
          <p>
            <MetricReveal
              value={trips(15)}
              format="int"
              className="font-display text-4xl font-semibold text-walk"
            />{" "}
            trip starts in the 3 p.m. hour — <strong className="text-chalk">{fmtInt(trips(15) - trips(8))}</strong>{" "}
            more than the morning peak. The busiest hour of Durham&apos;s travel day is not a commute.
          </p>
          <p>
            What fills it: school travel ({pct(15, "Home-based School")}) layered with discretionary trips (
            {pct(15, "Home-based Discretionary")}) and work ({pct(15, "Home-Based Work")}). The survey&apos;s
            day-level detail shows passenger pick-up and drop-off purposes alone account for about{" "}
            {fmtInt(pickupDropoffDay)} internal trips across a whole day — the school run, drawn in journeys.
          </p>
          <p>And the boundary has already flipped: {fmtInt(boundary(15).inbound)} entering against{" "}
            {fmtInt(boundary(15).outbound)} leaving.</p>
        </>
      ),
    },
    {
      id: "beat-1700",
      minutes: 13 * 60,
      kicker: "5:00 p.m.",
      title: "The flow reverses",
      body: (
        <>
          <p>
            By the 5 p.m. hour, <strong className="text-chalk">{fmtInt(boundary(17).inbound)}</strong> trips
            enter Durham and {fmtInt(boundary(17).outbound)} leave — a net of{" "}
            <strong className="text-walk">+{fmtInt(boundary(17).net)}</strong> entering. Twelve hours earlier
            that same balance read <strong style={{ color: "#c2502e" }}>−{fmtInt(-boundary(7).net)}</strong>.
          </p>
          <p>
            The region breathes: out in the morning, home in the evening. Not a one-way bedroom-community
            story — a rhythm.
          </p>
        </>
      ),
    },
    {
      id: "beat-2100",
      minutes: 17 * 60,
      kicker: "9:00 p.m.",
      title: "The network thins to a few threads",
      body: (
        <>
          <p>
            Evening travel runs at <strong className="text-chalk">{fmtInt(trips(21))}</strong> trips an hour,
            {pct(21, "Home-based Discretionary")} of it discretionary. On the map, only a handful of corridors
            remain above the display threshold — the day&apos;s strongest connections, still holding.
          </p>
        </>
      ),
    },
    {
      id: "beat-0100",
      minutes: 21 * 60,
      kicker: "1:00 a.m.",
      title: "The survey day's long tail",
      body: (
        <>
          <p>
            The survey clock reads <strong className="text-chalk">25:00</strong>. In public time that&apos;s 1
            a.m. — the TTS keeps counting past midnight instead of resetting, so a night shift ending at 2
            a.m. belongs to the day it started.
          </p>
          <p>
            The four post-midnight survey hours hold{" "}
            <strong className="text-chalk">{fmtInt(lateNightTotal)}</strong> trips — a sliver of the day&apos;s{" "}
            {fmtInt(file.bins.reduce((a, b) => a + b.trips, 0))}, but never zero.
          </p>
        </>
      ),
    },
  ];

  const hourlyRows = Array.from({ length: 24 }, (_, i) => {
    const h = i + 4;
    const p = purpose(h);
    const top = BROAD_PURPOSES.reduce((a, b) => (p.shares[b] > p.shares[a] ? b : a));
    const b = boundary(h);
    return { h, trips: trips(h), top, topShare: p.shares[top], net: b.net };
  });
  const maxHourTrips = Math.max(...hourlyRows.map((r) => r.trips));

  return (
    <main className="dark-section dark-textured">
      <nav aria-label="Story" className="border-b border-night-line/60 bg-night/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="text-sm font-semibold text-chalk-dim transition-colors hover:text-chalk">
            ← Durham in Motion
          </Link>
          <p className="text-xs uppercase tracking-[0.2em] text-chalk-dim">A Day in Durham</p>
        </div>
      </nav>

      <StoryHero
        kicker="Based on the 2022 Transportation Tomorrow Survey"
        title="A Day in Durham"
        standfirst="Durham, 4:00 a.m. Very little movement. The region is about to make more than a million journeys — and the busiest hour of its day is not the one you expect."
      />

      <DayExperience
        file={file}
        geom={geom}
        beats={beats}
        exploreIntro={
          <p>
            Scrub the clock, press play, or filter the volume curve by purpose or mode. The map always
            shows everyone moving — the same Durham, whatever hour you choose.
          </p>
        }
      />

      {/* How to read this clock — methodology in the open */}
      <section aria-labelledby="day-method-h" className="mx-auto max-w-3xl px-6 py-16">
        <p className="chapter-kicker">How to read this</p>
        <h2 id="day-method-h" className="mt-3 font-display text-3xl font-semibold text-chalk">
          The clock, the curve, and what counts
        </h2>
        <div className="prose-story mt-6 space-y-4">
          <p>
            <strong className="text-chalk">The day runs 4 a.m. to 4 a.m.</strong> The survey keeps counting
            past midnight — 24:30 is 12:30 a.m., 25:00 is 1 a.m. — so late-night journeys stay attached to
            the day they began. We show both labels.
          </p>
          <p>
            <strong className="text-chalk">Two populations, one clock.</strong> The volume curve counts
            weekday trips by members of Durham households ({fmtInt(file.bins.reduce((a, b) => a + b.trips, 0))}{" "}
            across the day). The map and the boundary counters count everyone travelling to, from, and
            within Durham — whatever household they belong to.
          </p>
          <p>
            <strong className="text-chalk">Half-hour steps.</strong> Times are reported to the minute and
            grouped into 30-minute bins — the smallest interval that keeps readable motion and honest
            survey support in every bin (each half-hour rests on at least{" "}
            {fmtInt(Math.min(...file.bins.map((b) => b.surveyRecords)))} survey records; the peak hours on
            thousands).
          </p>
        </div>
        <PractitionerNote>
          <p>
            Binning: {binMinutes}-minute bins over 04:00–27:59 ({file.bins.length} frames). 15-minute bins
            thin the off-peak frames below usable support; 60-minute bins erase the transitions the story
            turns on. Map frames show only intermunicipal corridors of ≥{fmtInt(file.meta.displayFloor)}{" "}
            expanded trips per half-hour — a readability floor that never alters a total.
          </p>
          <p>
            Sources: {file.meta.sources.join(", ")} of the Phase 3 audit (docs/phase3-data-audit.md). The
            curve and purpose stack come from F/F-unexp (Durham-household trips, expanded; survey-record
            support carried per bin). Boundary exchange and map frames come from G/H (trips starting or
            ending in Durham Region regardless of household residence; no unexpanded mirror exists for
            these two, so their frames carry expanded values only).
          </p>
          <p>
            Boundary balance is the balance of trips crossing the regional boundary — nothing more. It is
            not a jobs measure, an economic-attractor measure, or a commuting-balance claim.
          </p>
        </PractitionerNote>
        <SourceFootnote>Source: {OD_SOURCE}</SourceFootnote>
      </section>

      {/* The numbers behind the story */}
      <section aria-labelledby="day-numbers-h" className="mx-auto max-w-4xl px-6 pb-8">
        <details className="rounded-xl border border-night-line bg-night-soft/60 px-5 py-4">
          <summary className="cursor-pointer text-sm font-semibold text-chalk-dim transition-colors hover:text-chalk">
            View the numbers — every hour of the day
          </summary>
          <table className="mt-3 w-full text-left text-sm">
            <caption className="sr-only">
              Trip starts, leading purpose, and boundary exchange for each survey hour
            </caption>
            <thead>
              <tr className="border-b border-night-line text-xs uppercase tracking-wide text-chalk-dim">
                <th scope="col" className="py-2">Hour</th>
                <th scope="col" className="py-2 pl-4 text-right">Trip starts</th>
                <th scope="col" className="py-2 pl-4 text-right">Share of peak</th>
                <th scope="col" className="py-2 pl-6">Leading purpose</th>
                <th scope="col" className="py-2 pl-4 text-right">Entering</th>
                <th scope="col" className="py-2 pl-4 text-right">Leaving</th>
              </tr>
            </thead>
            <tbody>
              {hourlyRows.map((r) => (
                <tr key={r.h} className="border-b border-night-line/40 text-chalk-dim">
                  <th scope="row" className="py-1.5 font-medium text-chalk">
                    {String(r.h).padStart(2, "0")}:00
                  </th>
                  <td className="py-1.5 pl-4 text-right tabular-nums">{fmtInt(r.trips)}</td>
                  <td className="py-1.5 pl-4 text-right tabular-nums">{fmtPct(r.trips / maxHourTrips, 0)}</td>
                  <td className="py-1.5 pl-6">
                    {PURPOSE_LABEL[r.top]} {fmtPct(r.topShare, 0)}
                  </td>
                  <td className="py-1.5 pl-4 text-right tabular-nums">{fmtInt(boundary(r.h).inbound)}</td>
                  <td className="py-1.5 pl-4 text-right tabular-nums">{fmtInt(boundary(r.h).outbound)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <StoryEndCard
        title="The region has a daily rhythm"
        lessons={[
          "The afternoon surge is at least as big as the traditional morning rush — in this survey, bigger.",
          "Different purposes dominate different hours: work owns the early morning, school and discretionary travel own the peaks that matter.",
          "The balance of trips crossing Durham's boundary reverses through the day — out in the morning, home in the evening.",
          "The region's travel network changes shape, not merely volume: different corridors lead at 8 a.m., 3 p.m., and 9 p.m.",
        ]}
        next={{ href: "/stories/transit/", label: "The Transit Journey", note: "" }}
      />
    </main>
  );
}
