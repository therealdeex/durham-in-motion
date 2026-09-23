# Phase 3 findings — what the data says before we build anything

Acquisition and analysis are complete; per the Phase 3 handoff, **no story
pages are built yet**. This report holds 18 candidate insights (from
`data/processed/phase3/story-candidates.json`, all deterministic outputs of
the pipeline). Each lists the exact numerator, denominator, source extraction
and caveats. Every headline claim is backed by an unexpanded mirror where one
exists (support counts in brackets are survey records).

**Basis.** Two populations: the *all-households universe* — 19,470,494
expanded weekday trips across the surveyed GGH (759,736 survey records) — and
the familiar *Durham-household population* — 1,440,137 trips. New dimensions:
time of day, trip distance, age, household vehicles, and the Transit record
set (GO stations, access modes, route links).

**Recommendation summary.** The data confirmed the handoff's expectation with
a twist: **A Day in Durham** (time) and **Who Comes to Durham?** (inbound)
are the strongest two stories, and the inbound story is strong precisely
because the expected "asymmetry" turned out to be *symmetry*. Scoring details
are in story-candidates.json.

---

## The 18 candidates

### 1. Durham's boundary trade is almost perfectly balanced — BUILD
**Finding.** 202,000 weekday trips come *into* Durham from outside; 205,153
go *out* — an inbound/outbound ratio of **0.98**. Only ~2.1% of the region's
19.5M trips cross Durham's boundary at all. [support: 15,763 records]
**Numerator/denominator.** inbound = trips with destination in Durham, origin
outside; outbound = mirror; both from the 19,470,494-trip all-households
matrix (A), unexpanded support from B.
**Why interesting.** The site currently describes only residents' trips. The
full travel market shows Durham as neither importer nor exporter — a
corrective to both "bedroom community" and "jobs centre" framings.
**Visualization.** Boundary exchange dial / two-arrow balance opening the
story. **Caveat.** Trip balance ≠ economic attraction. **Recommendation:
BUILD** (opens "Who Comes to Durham?").

### 2. The afternoon is Durham's biggest rush hour — BUILD
**Finding.** The travel day has **two peaks and the PM one wins**: 156,056
trip-starts in the 08:00 hour vs **161,115** in the 15:00 hour. The region is
nearly still at 04:00 (5,674) and survey-hours 24:00–27:00 hold just 8,072.
[support: 54,535 records]
**Numerator/denominator.** Trip-starts per survey hour, Durham-household
trips (F), day total 1,440,145.
**Why interesting.** The conventional commuter bell is wrong for 2022; the
afternoon peak is carried by school pickup + discretionary travel.
**Visualization.** Synchronized clock + volume curve + map (A Day in
Durham). **Caveat.** Departure times; 2022 full basis. **Recommendation:
BUILD.**

### 3. Every hour belongs to a different Durham — HOLD (top tier)
**Finding.** The 05:00 hour is **84.8%** home-based work; by 08:00, school
(36.3%) and discretionary (33.7%) dominate; from 08:00 onward discretionary
never gives the lead back (74.5% by 20:00). Even mid-career hours' largest
purpose by volume is discretionary, not work.
**Source.** F. **Visualization.** Stacked purpose ribbon through the day.
**Caveat.** Broad purpose categories. **Recommendation: HOLD** — merge into
A Day in Durham as its narrative spine.

### 4. Net exchange flips direction across the day — HOLD (top tier)
**Finding.** Net external flow (inbound − outbound, G/H) bottoms at **−15,134
trips in the 07:00 hour** and peaks at **+10,474 in the 17:00 hour**. Durham
is an origin at some hours and a destination at others.
**Source.** G, H. **Visualization.** Net-flow line crossing zero under the
day curve. **Caveat.** Hourly net flows exclude trips without a valid start
time; overnight hours excluded from the headline search.
**Recommendation: HOLD** — key scene in A Day in Durham.

### 5. The boundary river is two-way at every municipality — HOLD
**Finding.** Net imbalances are tiny relative to gross exchange: Oshawa
balances to **0.3%** of its two-way flow; even Scugog, the most lopsided, is
**3.2%**. Gross exchange varies six-fold — Brock 15,423 vs Pickering 97,123.
[support: 7,824 records]
**Source.** A, B. **Visualization.** Gross columns with near-invisible net
bars — the flatness is the story. **Caveat.** Inbound counts all
Durham-ending trips regardless of household. **Recommendation: HOLD** —
chapter 2 of Who Comes to Durham?.

### 6. Coming and going are mirror images — and walking vanishes at the line — HOLD (top tier)
**Finding.** Inbound vs outbound mode shares are near-identical (drive 78.3%
vs 77.6%, transit 6.9% vs 7.0%, passenger 13.5% vs 14.2%). The boundary
effect is subtraction: **67 walking trips** cross in vs **118,858** walking
trips inside Durham (0.03% vs 10.3% of internal travel).
**Source.** C. **Visualization.** Back-to-back mode bars + "what vanishes"
inset. **Caveat.** Small modes thin at the boundary. **Recommendation:
HOLD** — the surprise twist of Who Comes to Durham?.

### 7. Why people come: 57.7% are just going home; for the rest, work is only 29.5% — HOLD (top tier)
**Finding.** 116,586 inbound trips (57.7%) end at Home — largely residents'
return legs. The remaining **85,398** arrive for an activity: Usual Work
29.5%, Shopping 11.0%, Other Work-related 9.6%, Recreation 9.0%, Visiting
8.3%. **70.5% of inbound activity travel is not commuting.**
**Source.** D2. **Visualization.** Two-tier donut + ranked bars (WHY PEOPLE
COME). **Caveat.** Home-ending trips can't be split resident/visitor without
a household filter — treated as their own class. **Recommendation: HOLD** —
chapter 3 of Who Comes to Durham?.

### 8. There isn't one Durham network — purpose redraws the map — HOLD
**Finding.** 96.7% of home-based **school** travel stays inside Durham vs
**72.2%** of home-based **work**; work sends 17.4% of trips to Toronto vs
school's 2.3%.
**Source.** E. **Visualization.** Purpose switcher on the network map.
**Caveat.** Durham-household trips, broad purpose. **Recommendation: HOLD** —
feeds Every Mode Has Its Own Map / the existing network chapter.

### 9. Each mode lives at a different scale — HOLD (top tier)
**Finding.** Median reported trip distance: **<1 km walking, 1–2 km cycling,
5–10 km driving, 10–20 km transit**. 147,633 drive trips (15.9% of driving)
are under 2 km straight-line — a pattern, not a claim they were walkable.
**Source.** I (banded locally), C. **Visualization.** The rescaling map
(EVERY MODE HAS ITS OWN MAP). **Caveat.** Straight-line whole km; banded
medians are band labels, not interpolated km. **Recommendation: HOLD** —
strong candidate for the third build if Story 3 is preferred over transit.

### 10. GO is a downtown shuttle with a two-anchor front door — HOLD (top tier)
**Finding.** 8,644 of 18,736 GO trips (46.1%) alight at Union — and Union is
also the top *boarding* station (8,367): the return legs. On the line,
Oshawa (2,729) and Whitby (2,712) are nearly tied as Durham's stations; two-way
Union flows: Whitby 5,088, Oshawa 4,456, Pickering 3,527, Ajax 3,414.
[Union-alighting support: 576 records]
**Source.** O, O-unexp, N. **Visualization.** Lakeshore-East line diagram
with station weights (HOW DURHAM GETS TO GO). **Caveat.** Station OD cells
rest on few records (Union↔Whitby ≈146) — rankings safe, small cells not.
**Recommendation: HOLD** — chapter 2 of The Transit Journey.

### 11. The journey to the journey: most riders drive to the platform — HOLD
**Finding.** Car access (driven + dropped off) by station: Oshawa **90.8%**,
Whitby 87.7%, Ajax 84.2%, Pickering 73.3% — Pickering's walk share (26.4%) is
the outlier. System-wide, walk access is the largest single access mode
(31,425 of 50,753 journeys) but concentrated in Toronto-adjacent and local-only
journeys (only 3,012 walk-access GO journeys).
**Source.** N. **Visualization.** Station access strips (walk / drive /
drop-off / bike). **Caveat.** Non-rail access geography uses trip OD as
proxy. **Recommendation: HOLD** — opening scene of The Transit Journey.

### 12. GO journeys are multi-link undertakings — HOLD
**Finding.** Among drive-access GO riders, **49.6%** of GO journeys use 2+
transit links (drive → GO → another link); for drive-access local-transit
journeys it's 52.1%. [support: 50,753 journeys / 2,158 records]
**Source.** P, P-unexp. **Visualization.** Journey stack: access → links →
egress. **Caveat.** n_route counts links, not public-facing transfers.
**Recommendation: HOLD** — chapter 3 of The Transit Journey.

### 13. Car dependence is climbed, then partly descended — HOLD (top tier)
**Finding.** Ages 5–14: 0% drive, **52.7%** ride, 24.7% walk. Driving climbs
through 15–24 (38.4%) to a peak of **84.9%** at 45–64, then steps down
(77.3% at 65–74, 72.9% at 75+) while passenger share climbs back to **20.8%**.
[support: 54,535 records]
**Source.** K, K-unexp, L. **Visualization.** Age slope charts (DURHAM
CHANGES WITH AGE). **Caveat.** Shares within age groups; never compare raw
counts across ages without population denominators. **Recommendation: HOLD**
— strong future chapter; below the top two on novelty.

### 14. Age rewrites the day's purpose mix — HOLD
**Finding.** Top purpose is Home-based School for ages 5–24; from 25 up it is
Home-based Discretionary — even in peak working years.
**Source.** L. **Visualization.** Small-multiple "days" by age band.
**Recommendation: HOLD** — accompanies #13.

### 15. The garage changes the travel day — HOLD, low priority
**Finding.** Zero-vehicle households: transit+walk carry **61.9%** of trips;
in 3+-vehicle households **5.8%**.
**Source.** M. **Visualization.** Mode bars by vehicle availability.
**Caveat.** Association, not causation. **Recommendation: HOLD** —
methodology-page insight rather than a story.

### 16. Even school buses barely cross the line — HOLD, footnote
**Finding.** School bus is 4.4% of internal trips but ~0.5–0.6% of boundary
trips in each direction (≈1,000–1,200 trips).
**Source.** C. **Recommendation: HOLD** — footnote for the inbound story.

### 17. Working-age Durham makes more discretionary trips than work trips — HOLD, footnote
**Finding.** Ages 25–44 make 432,655 trips and 45–64 make 446,031 — in both,
Home-based Discretionary is the largest purpose by volume, ahead of Home-Based
Work.
**Source.** K/L. **Recommendation: HOLD** — supports #3 and #14.

### 18. The unexpanded floor: how thin is a thin line? — HOLD, infrastructure
**Finding.** The all-households universe rests on 759,736 survey records
(≈25.6× expansion). Boundary flows: 15,763 records. Station OD: 2,158 records
total across 26 stations — individual small cells can rest on <4 records and
must never be displayed without a floor.
**Source.** B, O-unexp, P-unexp. **Recommendation: HOLD** — becomes the
practitioner-details layer of whichever stories are built.

---

## Recommendation

Build next: **A Day in Durham** (candidates 2, 3, 4; visual core: clock +
curve + map + purpose/mode annotations) and **Who Comes to Durham?**
(candidates 1, 5, 6, 7). Both enjoy strong sample support, high novelty
relative to the current site, and data that already exists — no further
extraction needed for a first production pass. The transit material
(candidates 10–12) is strong and ready for the story after next; age and
distance (9, 13) follow. Nothing was rejected: every candidate is supported
by reconciled data with its caveat recorded.

*Stop point per handoff §28: extraction + analysis complete; no story pages
built. Bring this file back for the build decision.*
