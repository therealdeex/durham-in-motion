import Link from "next/link";
import { Hero } from "@/components/story/Hero";
import { MeetDurham } from "@/components/story/MeetDurham";
import { ChapterNav } from "@/components/story/ChapterNav";
import { ModeShare } from "@/components/viz/ModeShare";
import { MapSection } from "@/components/viz/MapSection";
import { CommunityFinder } from "@/components/story/CommunityFinder";
import { LongView } from "@/components/viz/LongView";
import { SurprisingStory } from "@/components/story/SurprisingStory";
import { Explorer } from "@/components/story/Explorer";
import { SourceNote, SuppressionNote } from "@/components/ui/Notes";
import { getHistoricalTrends, getMunicipalities, getRegionSummary, getWards } from "@/lib/data";
import { fmtPct, fmtX, fmtInt } from "@/lib/format";

export const dynamic = "force-static";

const CHAPTERS = [
  { id: "top", label: "Top" },
  { id: "meet-durham", label: "Meet Durham" },
  { id: "how-we-move", label: "How we move" },
  { id: "not-one-place", label: "Not one place" },
  { id: "your-durham", label: "Your Durham" },
  { id: "long-view", label: "The long view" },
  { id: "surprise", label: "The finding" },
  { id: "methodology", label: "Reading the data" },
  { id: "explore", label: "Explore" },
];

export default function StoryPage() {
  const regionSummary = getRegionSummary();
  const municipalitiesFile = getMunicipalities();
  const wardsFile = getWards();
  const trends = getHistoricalTrends();

  const r2022 = regionSummary.profiles.find((p) => p.surveyYear === 2022)!;
  const r2016 = regionSummary.profiles.find((p) => p.surveyYear === 2016)!;
  const r1986 = regionSummary.profiles.find((p) => p.surveyYear === 1986)!;

  const tripsPerHousehold =
    r2022.tripsTotal !== null && r2022.households ? (r2022.tripsTotal / r2022.households).toFixed(1) : null;
  const licenceRate =
    r2022.drivers !== null && r2022.persons !== null ? (r2022.drivers / r2022.persons).toFixed(1) : null;

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
      note: licenceRate ? `That is ${Math.round((r2022.drivers! / r2022.persons!) * 10) / 10} licensed drivers for every ten residents — children included.` : "",
    },
    {
      id: "trips",
      value: r2022.tripsTotal ?? 0,
      display: `${(r2022.tripsTotal! / 1_000_000).toFixed(2)} million`,
      label: "weekday trips made by Durham residents",
      note: `About ${tripsPerHousehold ?? "—"} trips per household on an average weekday. 2022 counts include ages 5+ — not directly comparable with earlier cycles.`,
    },
  ];

  return (
    <>
      <ChapterNav chapters={CHAPTERS} />
      <main id="story">
        <Hero districts={municipalitiesFile.municipalities.map((m) => ({ id: m.geographyId, name: m.geographyName }))} />

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

        {/* Chapter 2 — How We Move */}
        <section id="how-we-move" className="dark-section scroll-mt-8 border-t border-night-line/50" aria-labelledby="how-we-move-h">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="chapter-kicker">Chapter 2</p>
            <h2 id="how-we-move-h" className="mt-3 max-w-[22ch] font-display text-[clamp(2.2rem,5vw,3.6rem)] font-semibold leading-tight text-chalk">
              How we move
            </h2>
            <p className="prose-story mt-6">
              On an average weekday in 2022, Durham residents made{" "}
              <strong>{fmtInt(r2022.tripsTotal)} trips</strong> — to work, school, shops, appointments and
              each other. Most weekday trips in Durham are still made by car:{" "}
              <strong>{fmtPct(r2022.modeShares.autoDriver.value)}</strong> as a driver, plus{" "}
              {fmtPct(r2022.modeShares.autoPassenger.value)} as a passenger. Transit carries{" "}
              {fmtPct(r2022.modeShares.transit.value)} of trips; walking, {fmtPct(r2022.modeShares.walk.value)}.
            </p>
            <div className="mt-12">
              <ModeShare region={r2022} />
            </div>
            <SourceNote>
              Source: 2022 TTS, trips by residents by main mode, 24-hour (Data Management Group, University of Toronto).
              2022 trip counts cover ages 5+ and capture walking more fully than earlier cycles — see{" "}
              <Link href="/methodology/" className="underline underline-offset-2">methodology</Link>.
            </SourceNote>
          </div>
        </section>

        {/* Chapter 3 — Durham Is Not One Place */}
        <section id="not-one-place" className="dark-section dark-textured scroll-mt-8 border-t border-night-line/50" aria-labelledby="not-one-place-h">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="chapter-kicker">Chapter 3</p>
            <h2 id="not-one-place-h" className="mt-3 max-w-[24ch] font-display text-[clamp(2.2rem,5vw,3.6rem)] font-semibold leading-tight text-chalk">
              Durham is not one place
            </h2>
            <p className="prose-story mt-6">
              From Oshawa's downtown apartments to Uxbridge's country roads, the region's eight communities
              move differently. Ajax leads the region in transit share of weekday trips at{" "}
              <strong>{fmtPct(municipalitiesFile.municipalities.find((m) => m.geographyId === "ajax")?.modeShares.transit.value)}</strong> —
              rural Uxbridge sits at {fmtPct(municipalitiesFile.municipalities.find((m) => m.geographyId === "uxbridge")?.modeShares.transit.value)}.
              Choose a measure, then a community.
            </p>
            <div className="mt-12">
              <MapSection region={municipalitiesFile.region} municipalities={municipalitiesFile.municipalities} />
            </div>
            <SourceNote>
              Source: 2022 TTS Planning District summaries joined to DMG planning-district boundaries.
              For Durham, planning districts correspond to the eight area municipalities.
            </SourceNote>
            <SuppressionNote />
          </div>
        </section>

        {/* Chapter 4 — Your Durham */}
        <section id="your-durham" className="scroll-mt-8" aria-labelledby="your-durham-h">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="chapter-kicker">Chapter 4</p>
            <h2 id="your-durham-h" className="mt-3 max-w-[22ch] font-display text-[clamp(2.2rem,5vw,3.6rem)] font-semibold leading-tight text-ink">
              Your Durham
            </h2>
            <p className="prose-story mt-6">
              Pick any ward or municipality for a quick portrait of how its residents move — and how it
              compares with the region as a whole.
            </p>
            <div className="mt-10">
              <CommunityFinder region={wardsFile.region} municipalities={municipalitiesFile.municipalities} wards={wardsFile.wards} />
            </div>
            <SourceNote>
              Source: 2022 TTS ward summaries. Ward boundaries vary between survey cycles; figures shown are
              for the 2022 ward structure only.
            </SourceNote>
          </div>
        </section>

        {/* Chapter 5 — The Long View */}
        <section id="long-view" className="dark-section dark-textured scroll-mt-8 border-t border-night-line/50" aria-labelledby="long-view-h">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="chapter-kicker">Chapter 5</p>
            <h2 id="long-view-h" className="mt-3 max-w-[20ch] font-display text-[clamp(2.2rem,5vw,3.6rem)] font-semibold leading-tight text-chalk">
              The long view: 1986 → 2022
            </h2>
            <p className="prose-story mt-6">
              Durham's surveyed population has more than doubled since 1986 — from{" "}
              <strong>{fmtInt(r1986.persons)}</strong> to {fmtInt(r2022.persons)} — and households have grown
              even faster. Choose a measure to see the whole series. Where survey methods changed, the chart
              says so plainly.
            </p>
            <div className="mt-10">
              <LongView trends={trends} />
            </div>
          </div>
        </section>

        {/* Chapter 6 — One Surprising Story */}
        <section id="surprise" className="dark-section scroll-mt-8 border-t border-night-line/50" aria-labelledby="surprise-h">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <SurprisingStory data={municipalitiesFile} region2016={r2016.workAtHomeShare.value ?? 0} />
            <SourceNote>
              Source: 2016 and 2022 TTS, persons usually employed at home. A small suppressed category makes
              the earliest available figures approximate.
            </SourceNote>
          </div>
        </section>

        {/* Chapter 7 — How to Read This */}
        <section id="methodology" className="scroll-mt-8" aria-labelledby="methodology-h">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="chapter-kicker">Chapter 7</p>
            <h2 id="methodology-h" className="mt-3 max-w-[22ch] font-display text-[clamp(2.2rem,5vw,3.6rem)] font-semibold leading-tight text-ink">
              How to read this
            </h2>
            <div className="prose-story mt-6 space-y-4">
              <p>
                <strong>The Transportation Tomorrow Survey (TTS)</strong> is a household travel survey run
                every five or six years across the Greater Toronto and Hamilton Area since 1986. Households
                record each member's travel for one weekday. Results are expanded to estimate everyone — they
                are survey estimates, not counts.
              </p>
              <p>
                <strong>Small numbers disappear.</strong> When fewer than four surveyed households support a
                figure, it is suppressed. We show those as unknown — never as zero.
              </p>
              <p>
                <strong>2022 changed the rules.</strong> Trips were collected for ages 5 and up (previously 11+)
                and walking was captured more completely. That is why 2022 trip totals and mode shares never
                share a chart line with earlier cycles on this site.
              </p>
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

        {/* Chapter 8 — Explore a Little More */}
        <section id="explore" className="scroll-mt-8 border-t border-line" aria-labelledby="explore-h">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="chapter-kicker">Chapter 8</p>
            <h2 id="explore-h" className="mt-3 max-w-[24ch] font-display text-[clamp(2.2rem,5vw,3.6rem)] font-semibold leading-tight text-ink">
              Explore a little more
            </h2>
            <p className="prose-story mt-6">
              A compact playground: rank every community by a measure. Everything here comes from the same
              verified 2022 data used in the chapters above.
            </p>
            <div className="mt-10">
              <Explorer region={wardsFile.region} municipalities={municipalitiesFile.municipalities} wards={wardsFile.wards} />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function SiteFooter() {
  return (
    <footer className="dark-section border-t border-night-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-display text-xl text-chalk">Durham in Motion</p>
          <p className="mt-2 max-w-[52ch] text-xs leading-relaxed text-chalk-dim">
            Transportation Tomorrow Survey data: Data Management Group, University of Toronto. Additional
            historical data: Government of Ontario. Calculations and visualizations by Durham in Motion.
            This is an independent public project and is not endorsed by or affiliated with the Data
            Management Group or the University of Toronto.
          </p>
        </div>
        <nav aria-label="Site" className="flex flex-col gap-1.5 text-sm">
          <Link href="/methodology/" className="text-chalk-dim transition-colors hover:text-chalk">Methodology</Link>
          <Link href="/sources/" className="text-chalk-dim transition-colors hover:text-chalk">Sources &amp; licence</Link>
          <a href="/data/manifest.json" className="text-chalk-dim transition-colors hover:text-chalk">Data manifest (JSON)</a>
        </nav>
      </div>
    </footer>
  );
}
