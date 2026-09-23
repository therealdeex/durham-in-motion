/**
 * Metric × cycle compatibility rules.
 *
 * Replaces the former domain-wide labels ("all trips 1986–2016 share one
 * basis") with explicit per-cycle bases, correcting the 2022 TTS Data Guide
 * findings in docs/tts-audit-2026-09.md (A05):
 *
 *  - Trip capture ages (Data Guide §1.5): 1986 collected trips for persons
 *    aged 6+; 1991–2016 collected ages 11+; 2022 collected ages 5+ and
 *    captured walking trips more completely. The archived CSVs carry no
 *    per-cycle age note of their own (only the 2022 files state theirs), so
 *    the guide's basis governs.
 *  - The guide documents survey/weighting changes and cycle-specific
 *    collection restrictions (e.g. 2011 household-attribute restrictions),
 *    so "demographics were collected identically in every cycle" is not a
 *    claim this project makes. Headline household/person counts are `strong`
 *    with the documented exceptions carried per metric.
 *  - `excl2016` is defined by the guide with values 0, 1 and 2: 0 marks trips
 *    on the pre-2022 (2016-comparable) basis; codes 1 and 2 mark trips
 *    excluded from that basis — code 2 covers excluded non-commute walking.
 *    DMG's guidance for comparing 2022 with earlier cycles is to filter
 *    excl2016 = 0. (Our reconciliation found full-basis walking 120,195 =
 *    67,089 excl-0 + 25,393 excl-1 + 27,713 remainder — consistent with the
 *    remainder being the guide's code 2, though the extracts themselves do
 *    not carry the flag values.)
 */

export type Comparability = "strong" | "caution" | "not_comparable";

/** Trip-collection basis by cycle, from the Data Guide. */
export const TRIP_BASIS_BY_YEAR: Record<number, string> = {
  1986: "trips-age-6plus",
  1991: "trips-age-11plus",
  1996: "trips-age-11plus",
  2001: "trips-age-11plus",
  2006: "trips-age-11plus",
  2011: "trips-age-11plus",
  2016: "trips-age-11plus",
  2022: "trips-age-5plus-fuller-walk",
};

export const BASIS_LABEL: Record<string, string> = {
  "trips-age-6plus": "1986 basis: trips collected for persons aged 6+",
  "trips-age-11plus": "Pre-2022 basis: trips collected for persons aged 11+",
  "trips-age-5plus-fuller-walk": "2022 basis: trips collected for persons aged 5+, walking captured more completely",
  demographics: "Household/person measures",
};

/**
 * Comparability of a metric in a given cycle, relative to the reference
 * series conventions used on the site:
 *  - Trip-domain metrics are `caution` inside their basis group and
 *    `not_comparable` for the groups that break it (1986 6+ and 2022 5+).
 *  - Income changed bands in 2016 → caution everywhere.
 *  - Other household/person metrics are strong, with cycle-specific category
 *    gaps (e.g. townhouse not collected in 1986) already preserved as
 *    not_available cells in normalization.
 */
export function comparabilityFor(
  meta: { domain: string; metric: string },
  year: number,
): Comparability {
  if (meta.domain === "trip" || meta.domain === "transit_detail") {
    // 2022 is never comparable with earlier cycles; 1986's 6+ basis is also
    // distinct from the 1991–2016 11+ series.
    return year === 2022 || year === 1986 ? "not_comparable" : "caution";
  }
  if (meta.metric === "income") return "caution";
  return "strong";
}

/** Two years can share a chart line only on the same trip basis. */
export const sameTripBasis = (a: number, b: number): boolean =>
  TRIP_BASIS_BY_YEAR[a] === TRIP_BASIS_BY_YEAR[b];
