import { fmtInt, fmtPct } from "@/lib/format";
import type { TransitStoryFile } from "@/lib/stories/types";
import { getStationAccessComposition, getTransitLinkDistribution, getUnionAlightingShare } from "@/lib/stories/selectors";

/**
 * The closing synthesis: one conceptual journey rendered as a vertical chain,
 * with the real shares from the story attached to each stage. Server-rendered;
 * no animation — the numbers carry it.
 */
export function JourneyChain({ file }: { file: TransitStoryFile }) {
  const accessTotal = Object.values(file.accessOverall).reduce((a, b) => a + b, 0);
  const walkShare = file.accessOverall.walk! / accessTotal;
  const carShareTotal = (file.accessOverall.drive! + file.accessOverall.passenger!) / accessTotal;
  const oshawa = getStationAccessComposition(file, "oshawa");
  const union = getUnionAlightingShare(file);
  const links = getTransitLinkDistribution(file, "go");
  const multiLink = 1 - links.buckets[0]!.share;

  const stages: { title: string; note: string; stat?: string; contrast?: string }[] = [
    {
      title: "Home",
      note: "The journey starts at the door — with a choice the train schedule never shows.",
    },
    {
      title: "Getting there",
      note: "Across all transit journeys, walking is the largest single way in —",
      stat: `${fmtPct(walkShare, 0)} walk · ${fmtPct(carShareTotal, 0)} by car`,
      contrast: `but at Oshawa GO, ${fmtPct(oshawa.arriveByCar, 1)} arrive by car`,
    },
    {
      title: "The station",
      note: "Four front doors on the Lakeshore East line, each drawing almost entirely from its own municipality.",
      stat: `${fmtInt(file.stations.reduce((a, s) => a + s.boardings, 0))} weekday GO boardings across the four stations`,
    },
    {
      title: "The GO link",
      note: "Union is the biggest single destination — and more than half of GO journeys end somewhere else.",
      stat: `${fmtPct(union.share, 0)} Union · ${fmtPct(1 - union.share, 0)} elsewhere`,
    },
    {
      title: "Another link, sometimes",
      note: "Half of GO journeys are chains, not single rides.",
      stat: `${fmtPct(multiLink, 0)} use two or more transit links`,
    },
    {
      title: "Destination",
      note: "Work, school, home — the reason the whole chain exists.",
    },
  ];

  return (
    <ol className="relative space-y-0">
      {stages.map((s, i) => (
        <li key={s.title} className="relative flex gap-4 pb-8 last:pb-0">
          {/* rail */}
          <div className="flex flex-col items-center" aria-hidden>
            <span
              className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold ${
                i === 0 || i === stages.length - 1
                  ? "border-accent bg-accent text-paper"
                  : "border-[#00857a] bg-paper text-[#00857a]"
              }`}
            >
              {i === 0 ? "◉" : i === stages.length - 1 ? "◉" : i}
            </span>
            {i < stages.length - 1 && <span className="mt-1 w-0.5 flex-1 bg-line" />}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="font-display text-lg font-semibold text-ink">{s.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">{s.note}</p>
            {s.stat && (
              <p className="mt-1.5 text-sm font-semibold tabular-nums text-ink">{s.stat}</p>
            )}
            {s.contrast && (
              <p className="mt-1 text-sm leading-relaxed text-accent">{s.contrast}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
