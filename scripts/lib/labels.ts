/**
 * Crosswalk from raw DMG category labels to canonical metric ids.
 *
 * DMG labels drift slightly across survey cycles ("in 24-hour" vs
 * "in 24-hours", "with GO Rail" vs "using Go Rail", typos such as
 * "Thursdayy", "other occcupations", "usingTTCSubway/RT"). Every label from
 * every archived file must resolve to exactly one canonical metric;
 * inspect-data.ts asserts full coverage so future drift fails the build
 * instead of silently dropping rows.
 *
 * Canonical shape: { domain, metric, category?, direction?, period? }
 *  - domain:    household | person | trip | transit_detail
 *  - direction: residents | to_area | from_area  (trips, transit_detail)
 *  - period:    all_day | am_peak | pm_peak      (trips)
 */

export type Domain = "household" | "person" | "trip" | "transit_detail";
export type TripDirection = "residents" | "to_area" | "from_area";
export type TripPeriod = "all_day" | "am_peak" | "pm_peak";

export interface MetricMeta {
  domain: Domain;
  metric: string;
  category?: string;
  direction?: TripDirection;
  period?: TripPeriod;
}

const norm = (label: string): string =>
  label
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\bthursdayy\b/, "thursday")
    .replace(/usingttcsubway\/rt/g, "using ttc subway/rt")
    .replace(/using tts subway\/rt/g, "using ttc subway/rt") // sic — DMG typo
    .replace(/shoppingtrips/g, "shopping trips")
    .replace(/fromthe area/g, "from the area") // sic — DMG typo
    .trim();

const N5 = "5 or more";
const cat5 = (s: string) => (s === N5 ? "5plus" : s);

const AREA_PURPOSE: Record<string, string> = {
  work: "work",
  school: "school",
  daycare: "daycare",
  shopping: "shopping",
  entertainment: "shopping_entertainment_1986",
  facilitate: "facilitate",
  other: "other",
  home: "home",
  personal: "personal_1986",
  unknown: "unknown_purpose",
};

const OCCUPATION: Record<string, string> = {
  "business or finance or natural and applied sciences": "business_finance_science",
  "health care or education or law or community or social services": "health_education_law_social",
  management: "management",
  "technical or paraprofessional professions": "technical_paraprofessional",
  "administration and administrative support": "administration",
  sales: "sales",
  "personal service or customer information service": "personal_customer_service",
  "the industrial construction or equipment operation trade": "trades_industrial",
  "transport and construction": "transport_construction",
  "natural resources agriculture and related production": "natural_resources_agriculture",
  "manufacturing and utilities": "manufacturing_utilities",
  "other occcupations": "other", // sic — DMG label typo
  "other occupations": "other",
  // 2006/2011 occupation taxonomy (distinct from the 2016/2022 one above).
  "general office": "general_office_2011",
  "manufacturing/construction/trade": "manufacturing_construction_trade_2011",
  "professional/management/techical field": "professional_management_technical_2011", // sic
  "sales/service": "sales_service_2011",
};

const LOCATIONS: Record<string, string> = {
  toronto: "toronto",
  durham: "durham",
  york: "york",
  peel: "peel",
  halton: "halton",
  hamilton: "hamilton",
  niagara: "niagara",
  waterloo: "waterloo",
  guelph: "guelph",
  wellington: "wellington",
  orangeville: "orangeville",
  barrie: "barrie",
  simcoe: "simcoe",
  "kawartha lakes": "kawartha_lakes",
  "peterborough city": "peterborough_city",
  "peterborough co": "peterborough_county",
  "peterborough county": "peterborough_county",
  orillia: "orillia",
  dufferin: "dufferin",
  brantford: "brantford",
  brant: "brant",
  "northumberland co": "northumberland",
  "northumberland county": "northumberland",
  northumberland: "northumberland",
  "blue mountains": "blue_mountains",
  grey: "grey",
  // Bare "Peterborough" denotes the county; "Peterborough City" the city.
  peterborough: "peterborough_county",
};

const TRANSIT_SERVICE: Record<string, string> = {
  "go rail": "go_rail",
  "go bus": "go_bus",
  "ttc subway/rt": "ttc_subway",
  "ttc bus/streetcar": "ttc_bus_streetcar",
  "local transit": "local_transit",
  "non-local transit": "non_local_transit",
  "non-ttc local transit": "local_transit",
};

const ACCESS_MODE: Record<string, string> = {
  walk: "walk",
  "auto driver": "auto_driver",
  "auto passenger": "auto_passenger",
  cycle: "bicycle",
  bicycle: "bicycle",
  motorcycle: "motorcycle",
  taxi: "taxi",
  "school bus": "school_bus",
  other: "other",
  unknown: "unknown",
  "paid rideshare": "rideshare",
};

/** Trip mode rules for one direction; phrase is an anchored regex prefix. */
function tripModeRules(phrase: RegExp): { re: RegExp; metric: string }[] {
  const m = (metric: string, tail: string): { re: RegExp; metric: string } => ({
    metric,
    re: new RegExp(`^${phrase.source} ${tail}`),
  });
  return [
    m("auto_driver", "as auto driver"),
    m("auto_passenger", "as auto passenger"),
    m("transit_local", "by transit excluding go rail"),
    m("go_rail", "by go rail only"),
    m("joint_go_transit", "by joint go rail and public transit"),
    m("walk", "by walk mode"),
    m("bicycle", "by bicycle"),
    m("school_bus", "by school bus"),
    m("motorcycle", "by motorcycle"),
    m("taxi", "as taxi passenger"),
    m("rideshare", "by paid rideshare( mode)?"),
    m("escooter", "by e-scooter"),
    m("other", "by other travel mode"),
    m("other", "by other modes"),
    m("unknown_mode", "by unknown travel mode"),
  ];
}

/** Note/header rows that legitimately appear inside the data area. */
export function isNoteRow(rawLabel: string): boolean {
  const label = norm(rawLabel);
  return (
    label === "" ||
    label === "category" ||
    /^\d{4} tts\b/.test(label) ||
    /^no information is presented/.test(label) ||
    /^updated\s/.test(label)
  );
}

/**
 * Resolve a raw DMG label to canonical metadata.
 * Returns null when the label matches no rule; callers should treat
 * non-note nulls as a crosswalk coverage failure.
 */
export function resolveLabel(rawLabel: string): MetricMeta | null {
  const label = norm(rawLabel);

  if (isNoteRow(rawLabel)) {
    return null;
  }

  // ---------- Households ----------
  if (label === "total number of households") return { domain: "household", metric: "total" };
  if (label === "number of houses") return { domain: "household", metric: "dwelling", category: "house" };
  if (label === "number of apartments") return { domain: "household", metric: "dwelling", category: "apartment" };
  if (label === "number of townhouses") return { domain: "household", metric: "dwelling", category: "townhouse" };
  if (label === "number of unknown dwelling types")
    return { domain: "household", metric: "dwelling", category: "unknown" };

  let m = label.match(/^number of households with (\d|5 or more) persons?$/);
  if (m) return { domain: "household", metric: "size", category: cat5(m[1]) };

  m = label.match(/^number of households with (\d|5 or more) vehicles?$/);
  if (m) return { domain: "household", metric: "vehicles", category: cat5(m[1]) };

  m = label.match(/^number of households with (\d|5 or more) licenced drivers$/);
  if (m) return { domain: "household", metric: "licensed_drivers", category: cat5(m[1]) };
  if (label === "number of households with unknown number of licenced drivers")
    return { domain: "household", metric: "licensed_drivers", category: "unknown" };

  for (const [phrase, metric] of [
    ["full-time employees?", "full_time_employees"],
    ["part-time employees?", "part_time_employees"],
    ["work-at-home employees?", "work_at_home_employees"],
    ["students?", "students"],
  ] as const) {
    const hit = label.match(new RegExp(`^number of households with (\\d|5 or more) ${phrase}$`));
    if (hit) return { domain: "household", metric, category: cat5(hit[1]) };
  }
  if (label === "number of households with unknown number of vehicles")
    return { domain: "household", metric: "vehicles", category: "unknown" };

  const structure: Record<string, string> = {
    "no of households with one adult only": "one_adult",
    "no of households with two adults no children": "two_adults_no_children",
    "no of households with 3 or more adults and no children": "three_plus_adults_no_children",
    "no of households with one adult and one or more children": "one_adult_with_children",
    "no of households with two adults and one or more children": "two_adults_with_children",
    "no of households with three or more adults and one or more children": "three_plus_adults_with_children",
  };
  if (structure[label]) return { domain: "household", metric: "structure", category: structure[label] };

  if (label.startsWith("number of households with income")) {
    if (/declined/.test(label)) return { domain: "household", metric: "income", category: "declined" };
    const band = label
      .replace(/^number of households with income /, "")
      .replace(/\$|,/g, "")
      .replace(/ and above/g, "-above")
      .replace(/ to | and /g, "-");
    return { domain: "household", metric: "income", category: band };
  }

  // ---------- Persons ----------
  if (label === "total number of persons") return { domain: "person", metric: "total" };
  if (label === "number of females") return { domain: "person", metric: "sex", category: "female" };
  if (label === "number of males") return { domain: "person", metric: "sex", category: "male" };

  m = label.match(/^number of persons between (\d+) and (\d+) years old$/);
  if (m) return { domain: "person", metric: "age", category: `${m[1]}_${m[2]}` };
  if (label === "number of persons with unknown age")
    return { domain: "person", metric: "age", category: "unknown" };
  if (label === "number of persons with unknown gender")
    return { domain: "person", metric: "sex", category: "unknown" };
  if (label === "number of persons with unknown driver's licence status")
    return { domain: "person", metric: "licence", category: "unknown" };

  if (label === "number of persons too young for driver's licence")
    return { domain: "person", metric: "licence", category: "too_young" };
  if (label === "number of persons without a driver's licence")
    return { domain: "person", metric: "licence", category: "without" };
  if (label === "number of persons with a driver's licence")
    return { domain: "person", metric: "licence", category: "with" };

  const transitPass: Record<string, string> = {
    "number of persons with unknown transit pass status": "unknown",
    "number of persons without any transit pass": "without",
    "number of persons not asked transit pass question (under 6 years old)": "not_asked_under_6",
    "number of persons with a transit pass": "with",
    "number of persons with a presto card": "presto",
    // 2011 asked the question with agency-specific categories.
    "number of persons with a ttc metro pass": "ttc_metro_pass",
    "number of persons with a transit pass from other agency": "other_agency_pass",
    "number of persons with a go transit pass": "go_pass",
    "number of persons with a combination/dual transit pass": "combination_dual",
  };
  if (transitPass[label]) return { domain: "person", metric: "transit_pass", category: transitPass[label] };

  const employment: Record<string, string> = {
    "number of persons who are full-time employed": "full_time",
    "number of persons who are full-time employed at home": "full_time_at_home",
    "number of persons who are part-time employed at home": "part_time_at_home",
    "number of persons who are not employed": "not_employed",
    "number of persons who are part-time employed": "part_time",
    "number of persons with unknown employment status": "unknown",
  };
  if (employment[label]) return { domain: "person", metric: "employment", category: employment[label] };

  m = label.match(/^number of persons with work in (.+)$/);
  if (m && OCCUPATION[m[1]]) return { domain: "person", metric: "occupation", category: OCCUPATION[m[1]] };
  if (label === "number of persons with unknown occupation type")
    return { domain: "person", metric: "occupation", category: "unknown" };

  if (label === "number of persons who have no usual place of work"
    || label === "number of persons who has no usual place") // sic — DMG label typo in some cycles
    return { domain: "person", metric: "work_location", category: "no_usual_place" };
  if (label === "number of persons who work in areas not covered in the tts survey")
    return { domain: "person", metric: "work_location", category: "outside_tts" };
  m = label.match(/^number of persons who work in (.+)$/);
  if (m && LOCATIONS[m[1]]) return { domain: "person", metric: "work_location", category: LOCATIONS[m[1]] };

  const student: Record<string, string> = {
    "number of persons with unknown student status": "unknown",
    "number of persons who are not students": "not_student",
    "number of part-time students": "part_time",
    "number of full-time students": "full_time",
  };
  if (student[label]) return { domain: "person", metric: "student", category: student[label] };

  if (label === "number of students who go to school in areas not covered in the tts survey")
    return { domain: "person", metric: "school_location", category: "outside_tts" };
  if (label === "number of students who go to school in unknown areas")
    return { domain: "person", metric: "school_location", category: "unknown" };
  m = label.match(/^number of students who go to school in (.+)$/);
  if (m && LOCATIONS[m[1]]) return { domain: "person", metric: "school_location", category: LOCATIONS[m[1]] };

  m = label.match(/^no of persons who commuted to work (\d) days? last week$/);
  if (m) return { domain: "person", metric: "commute_days", category: m[1] };
  if (label === "no of persons who did not commute for work last week")
    return { domain: "person", metric: "commute_days", category: "0" };
  if (label === "no of persons who work exclusively from home or are unemployed")
    return { domain: "person", metric: "commute_days", category: "exclusively_home_or_unemployed" };
  if (label === "no of persons with an unknown number of commute days last week")
    return { domain: "person", metric: "commute_days", category: "unknown" };
  m = label.match(/^no of persons who commuted for work last (monday|tuesday|wednesday|thursday|friday)$/);
  if (m) return { domain: "person", metric: "commute_day_of_week", category: m[1] };

  // ---------- Trips ----------
  // DMG's period time strings contain typos ("6:00am to 8:59 pm"), so the
  // keyword — never the clock text — decides the period.
  const period: TripPeriod = /morning peak/.test(label)
    ? "am_peak"
    : /afternoon peak|evening peak/.test(label)
      ? "pm_peak"
      : "all_day";

  let direction: TripDirection | null = null;
  if (/\bby residents\b/.test(label)) direction = "residents";
  else if (/to (?:the )?area\b/.test(label)) direction = "to_area";
  else if (/from (?:the )?area\b/.test(label)) direction = "from_area";

  if (direction) {
    const totalRe: Record<TripDirection, RegExp> = {
      residents: /^total number of trips made by residents/,
      to_area: /^total number of trips (?:made )?to the area/,
      from_area: /^total number of trips (?:made )?from the area/,
    };
    if (totalRe[direction].test(label))
      return { domain: "trip", metric: "total", direction, period };

    // "Linked trips" appear only in the older to/from-area reports.
    if (/^number of linked trips (?:made )?(?:to|from) the area/.test(label))
      return { domain: "trip", metric: "linked", direction, period };

    if (direction === "residents") {
      m = label.match(/^number of home-based (work|school|discretionary) trips by residents/);
      if (m)
        return {
          domain: "trip",
          metric: "purpose",
          category: m[1] === "work" ? "hbw" : m[1] === "school" ? "hbs" : "hbd",
          direction,
          period,
        };
      if (/^number of non-home-based trips by residents/.test(label))
        return { domain: "trip", metric: "purpose", category: "nhb", direction, period };
      for (const { re, metric } of tripModeRules(/^number of trips by residents/)) {
        if (re.test(label)) return { domain: "trip", metric, direction, period };
      }
    } else {
      const phrase = direction === "to_area"
        ? /^number of trips (?:made )?to the area/
        : /^number of trips (?:made )?from the area/;
      for (const { re, metric } of tripModeRules(phrase)) {
        if (re.test(label)) return { domain: "trip", metric, direction, period };
      }
      m = label.match(
        /^number of (work|school|daycare|shopping|entertainment|facilitate|personal|other|home|unknown)(?: purpose)? trips (?:made )?(?:to|from) the area/,
      );
      if (m) return { domain: "trip", metric: "purpose", category: AREA_PURPOSE[m[1]], direction, period };
    }
  }

  // ---------- Transit detail ----------
  if (/^number of transit trips/.test(label)) {
    let td: TripDirection | null = null;
    if (/residents/.test(label)) td = "residents";
    else if (/to (the )?area/.test(label)) td = "to_area";
    else if (/from (the )?area/.test(label)) td = "from_area";
    if (td) {
      m = label.match(/with ([1-6]) transit routes?$/);
      if (m) return { domain: "transit_detail", metric: "routes", category: m[1], direction: td };
      m = label.match(/(?:using|with) (go rail|go bus|ttc subway\/rt|ttc bus\/streetcar|non-ttc local transit|local transit|non-local transit)$/);
      if (m && TRANSIT_SERVICE[m[1]])
        return { domain: "transit_detail", metric: "service", category: TRANSIT_SERVICE[m[1]], direction: td };
      m = label.match(/with (.+?) (access|egress)$/);
      if (m && ACCESS_MODE[m[1]])
        return {
          domain: "transit_detail",
          metric: m[2] === "access" ? "access_mode" : "egress_mode",
          category: ACCESS_MODE[m[1]],
          direction: td,
        };
      m = label.match(/accessed by (.+?) modes?$/);
      if (m && ACCESS_MODE[m[1]])
        return { domain: "transit_detail", metric: "access_mode", category: ACCESS_MODE[m[1]], direction: td };
    }
  }

  return null;
}
