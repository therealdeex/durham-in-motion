# Findings scan

Generated 2026-09-23 by `npm run data:findings`.
Every claim below is computed directly from the normalized records; the machine-readable version is `public/data/story-candidates.json`.

## population-growth
- **Headline:** Durham's surveyed population grew from 317,886 in 1986 to 691,893 in 2022 (118%).
- **Metric:** persons_total (comparability: strong)
- **from:** 1986: 317,886
- **to:** 2022: 691,893
- **change:** 118%
- **notes:** Household survey population estimates, all ages.
- **Notes:** Household survey population estimates, all ages.

## work-at-home
- **Headline:** Working at home went from 4.9% of employed residents in 1991 to 14.1% in 2022.
- **Metric:** work_at_home_share_of_employed (comparability: strong)
- **from:** 1991: 4.9%
- **to:** 2022: 14.1%
- **change:** +9.2 pp
- **notes:** Full-time + part-time usually-work-at-home as a share of employed persons. 1986 is not computable from the published cells (the part-time-at-home cell is suppressed, affecting numerator and denominator), so the series starts in 1991. 2022 reflects post-2020 hybrid work.
- **Notes:** Full-time + part-time usually-work-at-home as a share of employed persons. 1986 is not computable from the published cells (the part-time-at-home cell is suppressed, affecting numerator and denominator), so the series starts in 1991. 2022 reflects post-2020 hybrid work.

## vehicles-per-household
- **Headline:** The average Durham household owned 1.71 vehicles in 1986; in the 2022 survey it owned 1.81.
- **Metric:** avg_vehicles_per_household (comparability: strong)
- **from:** 1986: 1.71
- **to:** 2022: 1.81
- **change:** +0.11
- **notes:** Top-coded '5 or more' counted as 5, so means are slightly low; the bias need not be identical across communities.
- **Notes:** Top-coded '5 or more' counted as 5, so means are slightly low; the bias need not be identical across communities.

## transit_share
- **Headline:** Transit share of weekday trips: highest Ajax (5.0%), lowest Uxbridge (0.5%).
- **Metric:** transit_share (comparability: within-2022)
- **value:** highest Ajax 5.0%
- **durham:** 3.5%
- **difference:** 5.0% vs 0.5%
- **notes:** Share of resident weekday trips by local transit + GO (2022).
- **Ranking:** Ajax 5.0% · Pickering 4.3% · Oshawa 4.0% · Whitby 4.0% · Clarington 1.5% · Scugog 0.5% · Uxbridge 0.5%
- **Notes:** Share of resident weekday trips by local transit + GO (2022).

## zero_vehicle_share
- **Headline:** Households with no vehicle: highest Oshawa (8.1%), lowest Clarington (2.9%).
- **Metric:** zero_vehicle_share (comparability: within-2022)
- **value:** highest Oshawa 8.1%
- **durham:** 4.9%
- **difference:** 8.1% vs 2.9%
- **notes:** Share of households reporting zero vehicles (2022).
- **Notes:** Share of households reporting zero vehicles (2022).

## walk_share
- **Headline:** Walking share of weekday trips: highest Ajax (10.6%), lowest Scugog (5.4%).
- **Metric:** walk_share (comparability: within-2022)
- **value:** highest Ajax 10.6%
- **durham:** 8.3%
- **difference:** 10.6% vs 5.4%
- **notes:** Share of resident weekday trips on foot (2022).
- **Notes:** Share of resident weekday trips on foot (2022).

## toronto_commute_share
- **Headline:** Workers commuting to Toronto: highest Pickering (37.0%), lowest Scugog (9.4%).
- **Metric:** toronto_commute_share (comparability: within-2022)
- **value:** highest Pickering 37.0%
- **durham:** 24.3%
- **difference:** 37.0% vs 9.4%
- **notes:** Employed residents whose usual workplace is in Toronto, as a share of all employed residents (2022). The stricter usual-workplace denominator is never complete (suppressed area cells), so employed residents is the denominator.
- **Notes:** Employed residents whose usual workplace is in Toronto, as a share of all employed residents (2022). The stricter usual-workplace denominator is never complete (suppressed area cells), so employed residents is the denominator.

## vehicles_per_hh
- **Headline:** Vehicles per household: highest Uxbridge (2.10), lowest Oshawa (1.60).
- **Metric:** vehicles_per_hh (comparability: within-2022)
- **value:** highest Uxbridge 2.10
- **durham:** 1.81
- **difference:** 2.10 vs 1.60
- **notes:** Mean vehicles per household (2022), top-coded at 5.
- **Ranking:** Uxbridge 2.10 · Clarington 1.99 · Pickering 1.85 · Whitby 1.83 · Ajax 1.81 · Oshawa 1.60
- **Notes:** Mean vehicles per household (2022), top-coded at 5.

## mode-mix-2022
- **Headline:** 64.6% of weekday trips by Durham residents are made as the driver of a private car; 83.2% are made by car, driving or riding.
- **Metric:** mode_shares_2022 (comparability: 2022-only)
- **value:** auto driver 64.6%, passenger 18.5%, transit 3.5%, walk 8.3%, bike 0.7%, school bus 3.7%, other 0.6%
- **notes:** 2022 methodology (persons 5+, fuller walking capture). Shares may not sum to 100% due to rounding.
- **Notes:** 2022 methodology (persons 5+, fuller walking capture). Shares may not sum to 100% due to rounding.

## transit-growth-pre2022
- **Headline:** Transit's share of resident weekday trips moved from 4.6% in 1991 to 6.4% in 2016 (comparable 11+ cycles only).
- **Metric:** transit_share_1991_2016 (comparability: caution)
- **from:** 1991: 4.6%
- **to:** 2016: 6.4%
- **notes:** 1991–2016 only: 1986 collected trips at ages 6+ and 2022 at ages 5+ with fuller walking capture — both are excluded as different bases.
- **Notes:** 1991–2016 only: 1986 collected trips at ages 6+ and 2022 at ages 5+ with fuller walking capture — both are excluded as different bases.

## ward-transit-extremes
- **Headline:** Ward-level transit share ranges from 5.1% in Oshawa Ward 2 to 0.2% in Scugog Ward 4.
- **Metric:** transit_share_wards_2022 (comparability: within-2022)
- **value:** highest Oshawa Ward 2 5.1%
- **durham:** 3.5%
- **notes:** Wards with ≥500 surveyed households; suppressed shares excluded.
- **Ranking:** Oshawa Ward 2 5.1% · Whitby Ward 3 5.1% · Ajax Ward 3 5.1% · Ajax Ward 2 5.0% · Ajax Ward 1 4.9% · Pickering Ward 2 4.9% · Oshawa Ward 5 4.9% · Whitby Ward 4 4.9%
- **Notes:** Wards with ≥500 surveyed households; suppressed shares excluded.
