import type { Metadata } from "next";
import Link from "next/link";
import { getManifest } from "@/lib/data";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How Durham in Motion turns Transportation Tomorrow Survey data into a public story: sources, suppression rules, comparability decisions and known limitations.",
};

export const dynamic = "force-static";

export default function MethodologyPage() {
  const manifest = getManifest();
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="chapter-kicker">How to read this</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-ink md:text-5xl">
        Methodology
      </h1>
      <p className="prose-story mt-6">
        Everything on this site is built from Transportation Tomorrow Survey (TTS) data published by the
        Data Management Group (DMG) at the University of Toronto — public summary CSVs for most chapters,
        plus authorized authenticated tabulations for the origin–destination stories. This page explains
        what the data is, what we did to it, and where you should be careful.
      </p>

      <section className="mt-12 space-y-10">
        <Block title="What the TTS is">
          <p>
            The TTS is a household travel survey conducted every five or six years across the Greater
            Toronto and Hamilton Area since 1986. Participating households record one weekday of travel for
            (in 2022) every member aged five or older, alongside household and person characteristics.
            Results are statistically expanded to represent the full population — so every number here is a{" "}
            <em>survey estimate</em>, not an administrative count.
          </p>
        </Block>

        <Block title="What we used">
          <p>
            DMG publishes per-region summary CSVs. For Durham we used every published cycle for the region
            (1986–2022) at the area-municipality level — which is what DMG labels Durham&apos;s planning
            districts — and ward-level files from 2001 onward (2022 ward structure: 33 wards). We also used
            DMG&apos;s planning-district boundary shapefile for maps. Each file&apos;s checksum and
            download date are recorded in the machine-readable{" "}
            <a href="/data/manifest.json" className="underline decoration-accent underline-offset-2">
              data manifest
            </a>
            .
          </p>
          <p>
            The origin–destination chapters (trips between communities, mode by destination, the 79%
            internal-share reveal) additionally use four authenticated tabulations pulled through DMG&apos;s
            iDRS service from the 2022 TTS trip table, filtered to trips by members of Durham households,
            with expansion factors applied. The project owner is an authorized practitioner who received
            permission to use these extracts in this application; the scope of that authorization is{" "}
            recorded in the repository&apos;s data-permissions record. Like every other number on the
            site, all figures derived from them are computed at build time by a documented pipeline.
          </p>
        </Block>

        <Block title="Suppression (the asterisk rule)">
          <p>
            DMG marks any category supported by fewer than four survey records with an asterisk. We store
            these as <em>suppressed</em> — a distinct state from zero. They are never charted as 0%, never
            filled with a neutral colour labelled &quot;none&quot;, and never reverse-engineered from
            totals. On maps and cards they appear as &quot;suppressed&quot; with a neutral pattern colour;
            in profiles, shares that cannot be computed are omitted and the profile notes it.
          </p>
          <p>
            A related marker <code className="rounded bg-paper-dim px-1">≈</code> (&quot;approximate&quot;)
            appears when a small suppressed category sits inside a larger total we display — for example a
            seniors share where the 90+ cell was suppressed. The direction of the resulting small bias is
            stated where relevant.
          </p>
        </Block>

        <Block title="Comparing across survey cycles">
          <p>
            Every metric carries a comparability flag:
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Strong:</strong> household and person measures (population, households, vehicles,
              licensed drivers, employment, commuting). Definitions are stable 1986–2022.
            </li>
            <li>
              <strong>Caution:</strong> all trip measures from 1986–2016. These cycles collected trips for
              household members aged 11+ with consistent mode definitions, but wording, expansion and peak
              windows evolved (e.g. the 2016 PM peak runs 15:00–17:59 vs 2022&apos;s 15:00–18:59).
            </li>
            <li>
              <strong>Not comparable:</strong> all 2022 trip measures. The 2022 TTS collected trips for ages
              5+ and captured walking trips more completely. Adding ages 5–10 alone mechanically depresses
              every mode share (more total trips, few of them by transit). We never draw 2022 trip counts or
              mode shares on the same line as earlier cycles.
            </li>
          </ul>
        </Block>

        <Block title="Assumptions we made">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Top-coded categories (&quot;5 or more&quot; vehicles/drivers per household) count as 5 when
              computing means. This biases means slightly low — uniformly for every community — so
              comparisons are unaffected.
            </li>
            <li>
              &quot;Transit&quot; in our mode stories is the sum of local transit, GO Rail and combined
              GO+local trips.
            </li>
            <li>
              Commute-to-Toronto shares use workers with a usual place of work inside the surveyed area as
              the denominator.
            </li>
            <li>
              Work-at-home shares use full-time plus part-time &quot;usually work at home&quot; over all
              employed residents. The 1986 region value is approximate because its part-time-at-home cell
              was suppressed.
            </li>
            <li>
              In the OD chapters, &quot;Durham&quot; means the eight area municipalities, and trips belong
              to a municipality based on where they <em>begin</em>. &quot;Trips made by Durham residents&quot;
              means trips by members of Durham households, wherever those trips start.
            </li>
          </ul>
        </Block>

        <Block title="Travel connections (desire lines)">
          <p>
            The connection maps in chapters 2–5 draw <em>desire lines</em>: straight-or-arc strokes between
            community midpoints whose thickness follows the number of trips (on a square-root scale so
            small and large corridors stay legible). A desire line says nothing about the route — people
            travelling between Whitby and Oshawa may drive the 401, take Kingston Road, ride DRT or GO, or
            anything else. We never place these lines along specific roads, and we never animate vehicles
            along real streets, because the survey does not record paths.
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Display threshold:</strong> connections below 1,000 expanded weekday trips are
              omitted from the map and lists for readability. Totals and percentages are always computed
              from the complete data — hiding a line never changes a number.
            </li>
            <li>
              <strong>Reconciliation:</strong> the OD tabulation totals 1,440,137 trips versus 1,440,149
              in the public summaries (a 12-trip query residue, ≈0.001%). The mode-by-destination extract
              is a further 9 trips short (trips with no stated mode). We document these instead of forcing
              them to match.
            </li>
            <li>
              <strong>iDRS output carries no suppression markers</strong> (unlike the public CSVs&apos;
              asterisks). Small flows are still small survey samples — hence the display threshold.
            </li>
          </ul>
        </Block>

        <Block title="The comparable-basis 2022 comparison">
          <p>
            The long view&apos;s 2016 ↔ 2022 comparison uses a 2022 extract filtered to{" "}
            <code className="rounded bg-paper-dim px-1">excl2016 = 0</code> — DMG&apos;s flag for records
            collected on a basis comparable with 2016 and earlier cycles. This matters most for walking:
            full-basis 2022 walking (120,195 trips, 8.3%) uses the new fuller capture, while the
            comparable extract records 67,089 walking trips (5.2%). Full-basis 2022 figures are never
            placed on a chart line with earlier cycles anywhere on this site. Note that the comparable
            2022 comparison still describes a post-pandemic travel environment; the survey alone cannot
            attribute causes.
          </p>
        </Block>

        <Block title="Known limitations">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              TTS under-represents some groups relative to the census (e.g. collective dwellings, some
              shift/overnight travel). Population figures here will not match Statistics Canada exactly.
            </li>
            <li>
              Ward boundaries changed between cycles; ward-level figures are shown for the 2022 structure
              only, and the public ward files are more heavily suppressed than municipal ones.
            </li>
            <li>
              The OD chapters describe 2022 only. No comparable OD matrix is published for earlier
              cycles, so nothing there can be trended over time.
            </li>
          </ul>
        </Block>

        <Block title="For practitioners">
          <p>
            The full ETL pipeline — source manifest, download checksums, label crosswalk, normalization and
            validation — runs at build time and is open source in the repository. Validation asserts that
            no suppressed cell becomes zero, that mode/purpose/vehicle partitions reconcile with published
            totals within tolerance, and that ward totals match municipal totals. The normalized dataset
            (97,713 records across 46 geographies and 8 cycles) and every curated JSON file under{" "}
            <code className="rounded bg-paper-dim px-1">/data/</code> are downloadable.
          </p>
          <p className="mt-3">
            DMG&apos;s own 2022 Data Guide defines the underlying categories; where the guide and our
            transformations differ, we say so above.
          </p>
        </Block>
      </section>

      <p className="mt-14 text-xs leading-relaxed text-ink-faint">
        {manifest.attribution} {manifest.endorsement}
      </p>
      <p className="mt-6">
        <Link href="/" className="text-sm font-semibold text-accent hover:underline">← Back to the story</Link>
      </p>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-2xl font-semibold text-ink">{title}</h2>
      <div className="prose-story mt-3 space-y-3">{children}</div>
    </section>
  );
}
