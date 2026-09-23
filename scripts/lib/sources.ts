/**
 * Single source of truth for every public source used by Durham in Motion.
 * Used by fetch-data.ts (download/verify), build-manifest.ts (provenance),
 * and normalize-data.ts (source attribution for every metric record).
 */

export interface SourceDef {
  id: string;
  organization: string;
  title: string;
  surveyYear: number;
  geography: "region" | "municipality" | "ward";
  url: string;
  landingPage: string;
  licence: string;
  licenceUrl: string;
  /** Path under data/raw/ where the file is archived. */
  rawPath: string;
  /** Note for humans reading the manifest or the Sources page. */
  note?: string;
  /** Excluded from per-record source attribution: cross-check copies and
   *  non-tabular (query-produced) extracts such as iDRS origin–destination runs. */
  supplementaryOnly?: boolean;
}

const DMG_ORG = "Data Management Group, University of Toronto";
const DMG_LICENCE = "DMG Open Data Licence";
const DMG_LICENCE_URL = "https://dmg.utoronto.ca/open-data/";
const TTS_LANDING = "https://dmg.utoronto.ca/download-tts-data/";
const ONTARIO_ORG = "Government of Ontario";
const ONTARIO_LICENCE = "Open Government Licence – Ontario";
const ONTARIO_LICENCE_URL = "https://www.ontario.ca/page/open-government-licence-ontario";

const dmgCsv = (
  id: string,
  surveyYear: number,
  geography: SourceDef["geography"],
  uploadsPath: string,
  note?: string,
): SourceDef => ({
  id,
  organization: DMG_ORG,
  title: `${surveyYear} TTS Durham Region ${geography === "ward" ? "Ward" : "Planning District (area municipality)"} summary`,
  surveyYear,
  geography,
  url: `https://dmg.utoronto.ca${uploadsPath}`,
  landingPage: TTS_LANDING,
  licence: DMG_LICENCE,
  licenceUrl: DMG_LICENCE_URL,
  // Archived under data/raw/ using the exact filename DMG publishes.
  rawPath: `data/raw/${surveyYear >= 2016 ? surveyYear : "historical"}/${uploadsPath.split("/").pop()}`,
  note,
});

/**
 * DMG labels the "mun" files as Planning District summaries; for Durham the
 * planning districts correspond exactly to the eight area municipalities.
 */
export const SOURCES: SourceDef[] = [
  dmgCsv("tts-1986-durham-pd", 1986, "municipality", "/wp-content/uploads/2023/04/tts1986_mun_durham.csv", "DMG download table labels this file PD; columns are the eight Durham area municipalities."),
  dmgCsv("tts-1991-durham-pd", 1991, "municipality", "/wp-content/uploads/2023/04/tts1991_mun_durham.csv"),
  dmgCsv("tts-1996-durham-pd", 1996, "municipality", "/wp-content/uploads/2023/04/tts1996_mun_durham.csv"),
  dmgCsv("tts-2001-durham-pd", 2001, "municipality", "/wp-content/uploads/2023/04/tts2001_mun_durham.csv"),
  dmgCsv("tts-2001-durham-ward", 2001, "ward", "/wp-content/uploads/2023/04/tts2001_ward_durham.csv"),
  dmgCsv("tts-2006-durham-pd", 2006, "municipality", "/wp-content/uploads/2023/04/tts2006_mun_durham.csv"),
  dmgCsv("tts-2006-durham-ward", 2006, "ward", "/wp-content/uploads/2023/04/tts2006_ward_durham.csv"),
  dmgCsv("tts-2011-durham-pd", 2011, "municipality", "/wp-content/uploads/2023/04/tts2011_mun_durham.csv"),
  dmgCsv("tts-2011-durham-ward", 2011, "ward", "/wp-content/uploads/2023/04/tts2011_ward_durham.csv"),
  dmgCsv("tts-2016-durham-pd", 2016, "municipality", "/wp-content/uploads/2023/04/tts2016_mun_Durham.csv"),
  dmgCsv("tts-2016-durham-ward", 2016, "ward", "/wp-content/uploads/2023/04/tts2016_ward_Durham.csv"),
  dmgCsv("tts-2022-durham-pd", 2022, "municipality", "/wp-content/uploads/2026/01/tts2022_mun_Durham.csv", "Trips collected for persons aged 5+ (11+ in earlier cycles); walking trips captured more completely."),
  dmgCsv("tts-2022-durham-ward", 2022, "ward", "/wp-content/uploads/2026/01/tts2022_ward_Durham.csv"),
  {
    id: "tts-1986-2016-ontario-historical",
    organization: ONTARIO_ORG,
    title: "Transportation Tomorrow historical survey data (1986–2016)",
    surveyYear: 1986,
    geography: "region",
    url: "https://files.ontario.ca/opendata/tts_dataset.zip",
    landingPage: "https://data.ontario.ca/en/dataset/transportation-tomorrow-historical-survey-data",
    licence: ONTARIO_LICENCE,
    licenceUrl: ONTARIO_LICENCE_URL,
    rawPath: "data/raw/ontario-zip/tts_dataset.zip",
    note: "Mirror of the DMG per-year summary CSVs. Used only as a provenance cross-check; not independently processed.",
    supplementaryOnly: true,
  },
  {
    id: "tts-2022-durham-pd-boundaries",
    organization: DMG_ORG,
    title: "2022 TTS Planning District boundaries (shapefile)",
    surveyYear: 2022,
    geography: "region",
    url: "https://dmg.utoronto.ca/wp-content/uploads/2025/01/tts2022_pd_shapefile.zip",
    landingPage: "https://dmg.utoronto.ca/survey-boundary-files/",
    licence: DMG_LICENCE,
    licenceUrl: DMG_LICENCE_URL,
    rawPath: "data/raw/geography/tts2022_pd_shapefile.zip",
  },
  {
    id: "tts-2016-durham-pd-boundaries",
    organization: DMG_ORG,
    title: "2016 TTS Planning District boundaries (shapefile)",
    surveyYear: 2016,
    geography: "region",
    url: "https://dmg.utoronto.ca/wp-content/uploads/2025/01/tts2016_pd_shapefile.zip",
    landingPage: "https://dmg.utoronto.ca/survey-boundary-files/",
    licence: DMG_LICENCE,
    licenceUrl: DMG_LICENCE_URL,
    rawPath: "data/raw/geography/tts2016_pd_shapefile.zip",
  },
  {
    id: "tts-pd-boundaries-legacy",
    organization: DMG_ORG,
    title: "TTS Planning District boundaries, pre-2016 zone system (shapefile)",
    surveyYear: 2011,
    geography: "region",
    url: "https://dmg.utoronto.ca/wp-content/uploads/2025/01/tts_pd_shapefile.zip",
    landingPage: "https://dmg.utoronto.ca/survey-boundary-files/",
    licence: DMG_LICENCE,
    licenceUrl: DMG_LICENCE_URL,
    rawPath: "data/raw/geography/tts_pd_shapefile.zip",
  },

  // ---- Authenticated iDRS extracts (drs.dmg.utoronto.ca) -------------------
  // Produced by interactive queries against the 2022 TTS trip table with the
  // filter "Regional municipality of household in Durham". Full query strings,
  // method notes and caveats: docs/idrs-data.md. Raw extracts are archived
  // locally only; confirm redistribution terms with DMG before publishing them
  // (or files derived from them) verbatim.
  {
    id: "tts-2022-idrs-od-pd",
    organization: DMG_ORG,
    title: "2022 TTS origin–destination matrix, planning districts × planning districts (Durham-resident trips)",
    surveyYear: 2022,
    geography: "region",
    url: "https://drs.dmg.utoronto.ca/",
    landingPage: "https://drs.dmg.utoronto.ca/",
    licence: `${DMG_LICENCE} (authenticated iDRS access)`,
    licenceUrl: DMG_LICENCE_URL,
    rawPath: "data/raw/idrs/tts2022_od_pd_durham-residents.csv",
    note: "Cross-tabulation: row = pd_orig, column = pd_dest, filter region_hhld in Durham, expansion factors on. Total reconciles with the public 2022 trip table to within 12 trips.",
    supplementaryOnly: true,
  },
  {
    id: "tts-2022-idrs-od-pd-mode",
    organization: DMG_ORG,
    title: "2022 TTS origin–destination matrix by primary mode (Durham-resident trips)",
    surveyYear: 2022,
    geography: "region",
    url: "https://drs.dmg.utoronto.ca/",
    landingPage: "https://drs.dmg.utoronto.ca/",
    licence: `${DMG_LICENCE} (authenticated iDRS access)`,
    licenceUrl: DMG_LICENCE_URL,
    rawPath: "data/raw/idrs/tts2022_od_pd_durham-residents_by-mode.csv",
    note: "Same query with table attribute mode_prime (13 mode blocks, column format). Block totals fall 9 trips short of the unidimensional matrix (mode-not-stated trips).",
    supplementaryOnly: true,
  },
  {
    id: "tts-2022-idrs-mode-pd-full",
    organization: DMG_ORG,
    title: "2022 TTS mode × planning district of household (Durham residents, full 2022 basis)",
    surveyYear: 2022,
    geography: "municipality",
    url: "https://drs.dmg.utoronto.ca/",
    landingPage: "https://drs.dmg.utoronto.ca/",
    licence: `${DMG_LICENCE} (authenticated iDRS access)`,
    licenceUrl: DMG_LICENCE_URL,
    rawPath: "data/raw/idrs/tts2022_mode_by-pd_durham-residents_full.csv",
    note: "Validation extract: every mode total reconciles with the public 2022 municipal summary to within 4 trips.",
    supplementaryOnly: true,
  },
  {
    id: "tts-2022-idrs-mode-pd-excl2016",
    organization: DMG_ORG,
    title: "2022 TTS mode × planning district of household (Durham residents, 2016-comparable basis, excl2016 = 0)",
    surveyYear: 2022,
    geography: "municipality",
    url: "https://drs.dmg.utoronto.ca/",
    landingPage: "https://drs.dmg.utoronto.ca/",
    licence: `${DMG_LICENCE} (authenticated iDRS access)`,
    licenceUrl: DMG_LICENCE_URL,
    rawPath: "data/raw/idrs/tts2022_mode_by-pd_durham-residents_excl2016-0.csv",
    note: "Filters region_hhld in Durham AND excl2016 = 0. First 2016-comparable 2022 mode split for the Long View; see docs/idrs-data.md for the excl2016 0/1/unclassified caveat.",
    supplementaryOnly: true,
  },
];

export const sourceById = (id: string): SourceDef => {
  const s = SOURCES.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown source id: ${id}`);
  return s;
};

/** Source id used to attribute records from a given survey year + geography. */
export const sourceIdFor = (surveyYear: number, geography: SourceDef["geography"]): string => {
  const s = SOURCES.find((x) => x.surveyYear === surveyYear && x.geography === geography && !x.supplementaryOnly);
  if (!s) throw new Error(`No source for ${surveyYear} ${geography}`);
  return s.id;
};
