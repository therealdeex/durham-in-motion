"use client";

import { fmtInt, fmtShare, fmtX, shareStatusNote } from "@/lib/format";
import { MODES } from "@/lib/metrics";
import type { MunicipalityProfile, Profile, Share } from "@/lib/types";

/**
 * Community snapshot postcard. Every share is status-aware: observed,
 * approximate lower bound (≈), suppressed, or not computable — never a
 * silent zero. The mode rows come from the shared metric registry so labels
 * match the map, ranking and narrative everywhere.
 */
export function Postcard({
  profile,
  region,
  municipalityProfile,
}: {
  profile: Profile;
  region: Profile;
  municipalityProfile?: MunicipalityProfile | null;
}) {
  const isRegion = profile.geographyId === "durham";
  const modeRows = MODES.map((m) => ({
    def: m,
    share: profile.modeShares[m.id],
    regionShare: region.modeShares[m.id],
  }));

  const stat = (label: string, share: Share, digits = 1) => (
    <div className="rounded-lg bg-paper px-3 py-2.5">
      <dt className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="mt-0.5 font-display text-xl text-ink">{fmtShare(share, digits)}</dd>
      {share.value !== null && share.status !== "observed" && (
        <p className="mt-0.5 text-[10px] leading-tight text-ink-faint">approximate lower bound</p>
      )}
    </div>
  );

  return (
    <article className="rounded-2xl border border-line bg-white p-6 shadow-[0_1px_0_rgba(28,32,36,0.06),0_12px_40px_-24px_rgba(28,32,36,0.35)] md:p-8">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-4">
        <div>
          <h4 className="font-display text-3xl font-semibold text-ink">{profile.geographyName}</h4>
          <p className="mt-1 text-xs text-ink-faint">
            {isRegion ? "The region overall" : profile.geographyType === "ward" ? "Community (ward)" : "Area municipality"} ·{" "}
            {fmtInt(profile.persons)} residents · {fmtInt(profile.households)} households · 2022 survey
          </p>
        </div>
        <p className="font-display text-lg text-ink-soft">
          {profile.tripsTotal === null ? "trips not shown" : `${fmtInt(profile.tripsTotal)} weekday trips`}
        </p>
      </header>

      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <section aria-label="How people travel here">
          <h5 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint">
            How people move — share of weekday trips
          </h5>
          <ul className="mt-3 space-y-2.5">
            {modeRows.map(({ def, share, regionShare }) => (
              <li key={def.id}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium text-ink">{def.label}</span>
                  <span className="text-ink-soft">
                    {fmtShare(share)}
                    {share.value !== null && regionShare.value !== null && (
                      <span className="ml-1.5 text-xs text-ink-faint">vs {(regionShare.value * 100).toFixed(1)}% region</span>
                    )}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-paper-dim">
                  {share.value === null ? (
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: "100%",
                        backgroundColor: "repeating-linear-gradient(45deg, #e7e2d8, #e7e2d8 4px, #f4f1ea 4px, #f4f1ea 8px)",
                      }}
                      aria-hidden
                    />
                  ) : (
                    <div
                      className="h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none"
                      style={{ width: `${Math.min(100, share.value * 100)}%`, backgroundColor: def.color, maxWidth: "100%" }}
                    />
                  )}
                </div>
                {share.value === null && shareStatusNote(share) && (
                  <p className="mt-0.5 text-[10px] leading-tight text-ink-faint">{shareStatusNote(share)}</p>
                )}
              </li>
            ))}
          </ul>
          {profile.modeSuppressed && (
            <p className="mt-3 text-[11px] leading-snug text-ink-faint">
              Some mode categories here were suppressed (fewer than four survey records); totals and
              shares carry that state rather than pretending the category is zero.
            </p>
          )}
        </section>

        <section aria-label="Household life" className="space-y-4">
          <h5 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint">Household life</h5>
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-paper px-3 py-2.5">
              <dt className="text-[11px] uppercase tracking-wide text-ink-faint">Vehicles / household</dt>
              <dd className="mt-0.5 font-display text-xl text-ink">
                {profile.avgVehiclesPerHousehold === null ? "not computable" : fmtX(profile.avgVehiclesPerHousehold)}
              </dd>
            </div>
            {stat("No-vehicle households", profile.zeroVehicleHouseholdShare)}
            {stat("Work at home", profile.workAtHomeShare)}
            {stat("Work in Toronto", profile.torontoWorkShare, 0)}
            {stat("Population 65+", profile.seniorsShare)}
            <div className="rounded-lg bg-paper px-3 py-2.5">
              <dt className="text-[11px] uppercase tracking-wide text-ink-faint">Licensed drivers</dt>
              <dd className="mt-0.5 font-display text-xl text-ink">{fmtInt(profile.drivers)}</dd>
            </div>
          </dl>

          {municipalityProfile?.prior2016 && municipalityProfile.workAtHomeShare.value !== null && (
            <div className="rounded-lg border border-line bg-paper-dim/50 px-4 py-3 text-sm text-ink-soft">
              Work-at-home change, 2016 → 2022:{" "}
              <strong className="text-ink">
                {(municipalityProfile.prior2016.workAtHomeShare.value! * 100).toFixed(1)}% →{" "}
                {(municipalityProfile.workAtHomeShare.value * 100).toFixed(1)}%
              </strong>
              {municipalityProfile.change2016to2022.workAtHomeShare !== null && (
                <span className="ml-1">
                  (
                  {municipalityProfile.change2016to2022.workAtHomeShare >= 0 ? "+" : "−"}
                  {Math.abs(municipalityProfile.change2016to2022.workAtHomeShare * 100).toFixed(1)} pp)
                </span>
              )}
            </div>
          )}

          <p className="text-xs leading-relaxed text-ink-faint">
            Shares are 2022 TTS estimates. ≈ marks an approximate lower bound (a small category is
            suppressed or not collected); hatched bars mean the value could not be computed from
            the published cells. “Work in Toronto” is the share of employed residents whose usual
            workplace is in Toronto.
          </p>
        </section>
      </div>
    </article>
  );
}
