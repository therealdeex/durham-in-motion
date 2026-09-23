import type { Metadata } from "next";
import Link from "next/link";
import { getTransitStory } from "@/lib/stories/data";
import {
  getGoDestinationDistribution,
  getStationAccessComposition,
  getTransitLinkDistribution,
  getUnionAlightingShare,
} from "@/lib/stories/selectors";
import { fmtInt, fmtPct } from "@/lib/format";
import { PractitionerNote, SourceFootnote, StoryHero } from "@/components/stories/primitives";
import { MetricReveal } from "@/components/stories/MetricReveal";
import {
  AccessStrip,
  BoardingsBars,
  CatchmentMatrix,
  DestinationBars,
  LinkStacks,
  StationAccess,
  StationPairs,
  TransitSection,
} from "@/components/stories/transit/TransitCharts";
import { JourneyChain } from "@/components/stories/transit/JourneyChain";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "The Transit Journey",
  description:
    "A transit trip starts before the train or bus arrives: how Durham residents reach transit, connect through stations, and complete their journeys.",
  openGraph: {
    title: "The Transit Journey | Durham in Motion",
    description:
      "A train trip doesn't begin at the platform. How Durham reaches GO — by car, on foot, by chain of links.",
    url: "/stories/transit/",
    images: [{ url: "/og-transit.png", width: 1200, height: 630, alt: "The Transit Journey" }],
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Transit Journey | Durham in Motion",
    description: "A train trip doesn't begin at the platform.",
    images: ["/og-transit.png"],
  },
};

const SOURCE =
  "2022 TTS Transit dataset via DMG iDRS (authorized extracts; Data Management Group, University of Toronto). Expanded weekday estimates.";

export default function TransitStoryPage() {
  const file = getTransitStory();
  const accessTotal = Object.values(file.accessOverall).reduce((a, b) => a + b, 0);
  const walkShare = file.accessOverall.walk! / accessTotal;
  const carAccessTotal = file.accessOverall.drive! + file.accessOverall.passenger!;
  const carShare = carAccessTotal / accessTotal;

  const oshawa = getStationAccessComposition(file, "oshawa");
  const pickering = getStationAccessComposition(file, "pickering");
  const wht = file.stations.find((s) => s.id === "whitby")!;
  const osh = file.stations.find((s) => s.id === "oshawa")!;
  const boardingsDiff = Math.abs(osh.boardings - wht.boardings);
  const oshawaFromClarington = file.catchment.find((c) => c.id === "oshawa")!.origins.clarington ?? 0;

  // strongest Union pair, both directions (sample-supported pairs only)
  const supported = file.stationPairs.filter((p) => p.surveyRecords >= file.meta.displayFloor.stationPairs);
  const toUnion = supported
    .filter((p) => p.to === "Union GO" && p.from === "Whitby GO")
    .reduce((a, p) => a + p.trips, 0);
  const fromUnion = supported
    .filter((p) => p.from === "Union GO" && p.to === "Whitby GO")
    .reduce((a, p) => a + p.trips, 0);

  const union = getUnionAlightingShare(file);
  const destinations = getGoDestinationDistribution(file);
  const durhamReturns = destinations
    .filter((d) => ["Whitby GO", "Oshawa GO", "Ajax GO", "Pickering GO"].includes(d.name))
    .reduce((a, d) => a + d.trips, 0);
  const torontoOthers = destinations
    .filter((d) => d.name !== "Union GO" && !["Whitby GO", "Oshawa GO", "Ajax GO", "Pickering GO"].includes(d.name))
    .reduce((a, d) => a + d.trips, 0);

  const linksGo = getTransitLinkDistribution(file, "go");
  const linksNonGo = getTransitLinkDistribution(file, "nonGo");
  const goMultiLink = 1 - linksGo.buckets[0]!.share;
  const nonGoSingle = linksNonGo.buckets[0]!.share;
  const goSupport = linksGo.buckets.reduce((a, b) => a + b.surveyRecords, 0);

  // drive-access GO riders using 2+ links (the 49.6% claim, computed)
  const driveRows = file.links.byAccessGo["Drive-access transit"] ?? {};
  const driveTotal = Object.values(driveRows).reduce((a, b) => a + b, 0);
  const driveMulti = driveTotal ? 1 - (driveRows["1"] ?? 0) / driveTotal : 0;

  return (
    <main className="bg-paper text-ink">
      <nav aria-label="Story" className="border-b border-line bg-paper/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="text-sm font-semibold text-ink-soft transition-colors hover:text-ink">
            ← Durham in Motion
          </Link>
          <p className="text-xs uppercase tracking-[0.2em] text-ink-faint">The Transit Journey</p>
        </div>
      </nav>

      <div className="dark-section dark-textured">
        <StoryHero
          kicker="Based on the 2022 Transportation Tomorrow Survey"
          title="The Transit Journey"
          standfirst="A train trip doesn't begin at the platform. First, you have to get there — by foot, by bike, or most often, by car. Then the ride itself may be a chain of connections. This is one journey, told link by link."
        />
      </div>

      <TransitSection
        id="first-leg"
        kicker="The first leg"
        title="Getting there is part of the trip"
        lead={
          <>
            <p>
              Durham households made <strong>{fmtInt(accessTotal)}</strong> transit journeys in the survey
              week&apos;s snapshot weekday. Before any of them boarded, every rider crossed the gap between
              home and the first vehicle — and that gap has a shape.
            </p>
            <p>
              Walking is the largest single front door to transit:{" "}
              <MetricReveal value={file.accessOverall.walk!} format="int" className="font-display text-3xl font-semibold text-ink" />{" "}
              journeys, <strong>{fmtPct(walkShare, 0)}</strong> of the total. But the car is close behind —{" "}
              <strong>{fmtInt(carAccessTotal)}</strong> journeys ({fmtPct(carShare, 0)}) begin behind a
              windshield, as a driver or a dropped-off passenger.
            </p>
          </>
        }
      >
        <AccessStrip access={file.accessOverall} />
        <SourceFootnote>
          Access classification is derived from the survey&apos;s transit-access types. &ldquo;Dropped off&rdquo;
          riders travel by car too — combined here only when labelled &ldquo;by car.&rdquo; Source: {SOURCE}
        </SourceFootnote>
      </TransitSection>

      <TransitSection
        id="go-access"
        kicker="The GO stations"
        title="Getting to the train is part of the trip"
        lead={
          <>
            <p>
              At <strong>Oshawa GO</strong>,{" "}
              <MetricReveal value={oshawa.arriveByCar * 100} format="pct1" className="font-display text-4xl font-semibold text-accent" />{" "}
              of riders arrive by car — {fmtInt(oshawa.station.access.drive)} driving themselves and{" "}
              {fmtInt(oshawa.station.access.passenger)} dropped off. Fewer than one in ten walk.
            </p>
            <p>
              Head west along the line and the picture shifts station by station, until at{" "}
              <strong>Pickering</strong> {fmtPct(pickering.station.walkShare, 0)} of riders arrive on foot — the
              only station where walking comes close to the car.
            </p>
          </>
        }
      >
        <StationAccess stations={file.stations} />
        <PractitionerNote title="Why &ldquo;arrive by car&rdquo; and not &ldquo;park-and-ride&rdquo;">
          <p>
            The access variable distinguishes drivers from dropped-off passengers, but not parking from
            being dropped at the curb. &ldquo;Arrive by car&rdquo; covers both; &ldquo;park-and-ride&rdquo;
            would claim more than the data says.
          </p>
          <p>
            Station access profiles rest on expanded values (Query N); station-to-station claims carry
            explicit survey-record support from the unexpanded mirror (Query O-unexp).
          </p>
        </PractitionerNote>
        <SourceFootnote>Source: {SOURCE}</SourceFootnote>
      </TransitSection>

      <TransitSection
        id="stations"
        kicker="Four front doors"
        title="Whitby and Oshawa are Durham's twin gates"
        lead={
          <>
            <p>
              Oshawa and Whitby generate <strong>remarkably similar</strong> numbers of GO boardings —{" "}
              {fmtInt(osh.boardings)} and {fmtInt(wht.boardings)}, just {fmtInt(boardingsDiff)} apart
              ({fmtPct(boardingsDiff / wht.boardings, 1)}) — a difference far smaller than any survey
              noise. Framed as parity, not a ranking.
            </p>
            <p>
              And each station draws almost entirely from its own municipality. The exception:{" "}
              <strong>Oshawa reaches east</strong> — {fmtInt(oshawaFromClarington)} of its riders come
              from Clarington, which has no GO station of its own.
            </p>
          </>
        }
      >
        <BoardingsBars stations={file.stations} />
        <div className="mt-12">
          <h3 className="font-display text-xl font-semibold text-ink">Where each station draws from</h3>
          <p className="prose-story mt-2 max-w-[60ch] text-ink-soft">
            One row per municipality, one column per station — dot size is boardings. The diagonal is the
            story: every station is its community&apos;s front door, except Oshawa, which also serves
            Clarington.
          </p>
          <div className="mt-5">
            <CatchmentMatrix file={file} />
          </div>
        </div>
        <SourceFootnote>
          Origins use aggregate municipality geography only — the survey never records exact homes. Source: {SOURCE}
        </SourceFootnote>
      </TransitSection>

      <TransitSection
        id="destinations"
        kicker="Where the train goes"
        title="Not every GO trip ends at Union"
        lead={
          <>
            <p>
              Union Station is the largest single destination —{" "}
              <MetricReveal value={union.trips} format="int" className="font-display text-3xl font-semibold text-accent" />{" "}
              alightings, <strong>{fmtPct(union.share, 1)}</strong> of all GO journeys by Durham residents.
              But that makes the real headline the other side of the sentence:
            </p>
            <p>
              <strong>More than half end somewhere else.</strong> The next four destinations are Durham&apos;s
              own stations — {fmtInt(durhamReturns)} alightings, the return legs home — and{" "}
              {fmtInt(torontoOthers)} spread across Toronto&apos;s other stations and beyond, from Rouge Hill
              to Niagara Falls.
            </p>
          </>
        }
      >
        <DestinationBars file={file} />
        <PractitionerNote>
          <p>
            Denominator: {fmtInt(union.total)} GO journeys with a stated destination station (the station
            field is missing on 2 of {fmtInt(file.totals.goJourneys)} journeys). &ldquo;Home&rdquo; as a
            destination is not literally identified — Durham stations as alighting points are the return
            legs of journeys that began there that morning; the direction is inferred from the boarding
            station, which the data does record.
          </p>
        </PractitionerNote>
        <SourceFootnote>Source: {SOURCE}</SourceFootnote>
      </TransitSection>

      <TransitSection
        id="network"
        kicker="The flows"
        title="Morning out, evening home — nearly mirror images"
        lead={
          <p>
            The strongest station-to-station flows are the Union pairs, and they come in nearly matched
            couples: {fmtInt(toUnion)} Whitby→Union against {fmtInt(fromUnion)} Union→Whitby. A transit
            day has a tide.
          </p>
        }
      >
        <StationPairs file={file} />
        <SourceFootnote>
          Flows shown only where at least 4 survey records support the cell. &ldquo;GO Rail not used&rdquo;
          (local-transit-only journeys) is never treated as a station. Source: {SOURCE}
        </SourceFootnote>
      </TransitSection>

      <TransitSection
        id="links"
        kicker="The chain"
        title="One transit trip can be several journeys joined together"
        lead={
          <>
            <p>
              A GO journey rarely means one vehicle. <strong>{fmtPct(goMultiLink, 0)}</strong> of GO journeys
              use two or more transit links — drive or walk to a station, ride GO, then another bus or a
              second train to actually arrive. Among drive-access GO riders specifically, it&apos;s{" "}
              <strong>{fmtPct(driveMulti, 1)}</strong>.
            </p>
            <p>
              Local-transit journeys chain less often — <strong>{fmtPct(nonGoSingle, 0)}</strong> are a
              single link — but even here, more than a third involve a connection.
            </p>
          </>
        }
      >
        <LinkStacks file={file} />
        <PractitionerNote title="What a &ldquo;link&rdquo; is">
          <p>
            The variable counts the number of transit routes/links a journey is built from — it is not
            literally named &ldquo;number of transfers.&rdquo; Two links usually imply one change of
            vehicle, but we say &ldquo;two transit links&rdquo; and let the reader draw the obvious
            conclusion. Survey support: {fmtInt(goSupport)} records behind the GO distribution.
          </p>
        </PractitionerNote>
        <SourceFootnote>Source: {SOURCE}</SourceFootnote>
      </TransitSection>

      <TransitSection
        id="whole-journey"
        kicker="The whole journey"
        title="Transit is not one event. It's a chain."
        lead={
          <p>
            Put the stages end to end and a &ldquo;transit trip&rdquo; turns out to be a chain of
            decisions and legs — most invisible in a mode-share pie chart.
          </p>
        }
      >
        <div className="rounded-2xl border border-line bg-white p-6 shadow-[0_1px_0_rgba(28,32,36,0.06),0_12px_40px_-24px_rgba(28,32,36,0.35)] md:p-8">
          <JourneyChain file={file} />
        </div>
        <SourceFootnote>Source: {SOURCE}</SourceFootnote>
      </TransitSection>

      {/* light-theme end card needs dark text; reuse with custom classes */}
      <div className="mx-auto max-w-3xl px-6 pb-20">
        <div className="rounded-2xl border border-accent/30 bg-gradient-to-b from-paper-dim to-white p-7 md:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">What to remember</p>
          <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-ink">
            The journey starts before the platform
          </h2>
          <ul className="mt-6 space-y-3">
            {[
              "A transit trip begins before boarding — the first leg is a trip of its own.",
              "Access to GO varies sharply by station: from 73% arriving by car at Pickering to 91% at Oshawa.",
              "Cars carry most riders to Durham's eastern GO stations; walking matters most at Pickering.",
              "Union is the biggest single GO destination — and more than half of journeys end elsewhere.",
              "Half of GO journeys are chains of two or more transit links.",
            ].map((l) => (
              <li key={l} className="flex gap-3 text-[15px] leading-relaxed text-ink-soft">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span>{l}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/stories/day/"
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition-opacity hover:opacity-90"
            >
              More stories: A Day in Durham
            </Link>
            <Link
              href="/"
              className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:border-ink hover:text-ink"
            >
              Back to Durham in Motion
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
