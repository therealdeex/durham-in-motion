import type { Metadata } from "next";
import Link from "next/link";
import { getManifest } from "@/lib/data";

export const metadata: Metadata = {
  title: "Sources & Licence",
  description: "Every public dataset behind Durham in Motion, with checksums, licences and download dates.",
};

export const dynamic = "force-static";

export default function SourcesPage() {
  const manifest = getManifest();
  const primary = manifest.sources.filter((s) => !s.supplementaryOnly);
  const supplementary = manifest.sources.filter((s) => s.supplementaryOnly);

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <p className="chapter-kicker">Transparency</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-ink md:text-5xl">
        Sources &amp; licence
      </h1>
      <p className="prose-story mt-6">
        {manifest.attribution}
      </p>
      <p className="prose-story mt-4">{manifest.endorsement}</p>

      <h2 className="mt-12 font-display text-2xl font-semibold text-ink">Datasets</h2>
      <div className="mt-5 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-paper-dim text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Dataset</th>
              <th scope="col" className="px-4 py-3 font-semibold">Source</th>
              <th scope="col" className="px-4 py-3 font-semibold">SHA-256 (first 12)</th>
              <th scope="col" className="px-4 py-3 font-semibold">Downloaded</th>
            </tr>
          </thead>
          <tbody>
            {primary.map((s) => (
              <tr key={s.id} className="border-t border-line align-top">
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{s.title}</p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    <code>{s.id}</code>
                    {s.note ? ` — ${s.note}` : ""}
                  </p>
                </td>
                <td className="px-4 py-3 text-xs leading-relaxed text-ink-soft">
                  <a href={s.url} className="underline decoration-line underline-offset-2 hover:decoration-accent" rel="external">
                    {new URL(s.url).pathname.split("/").pop()}
                  </a>
                  <br />
                  {s.organization} ·{" "}
                  <a href={s.licenceUrl} className="underline decoration-line underline-offset-2 hover:decoration-accent" rel="external">
                    {s.licence}
                  </a>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-ink-soft">{s.sha256?.slice(0, 12) ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-ink-soft">{s.downloadedAt?.slice(0, 10) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 font-display text-2xl font-semibold text-ink">Provenance cross-check</h2>
      {supplementary.map((s) => (
        <p key={s.id} className="prose-story mt-3">
          {s.title} ({s.organization}, {s.licence}) — mirrored copies of the DMG summary files, used to
          verify our downloads; not processed separately.
        </p>
      ))}

      <h2 className="mt-10 font-display text-2xl font-semibold text-ink">Not used, and why</h2>
      <p className="prose-story mt-3">
        DMG also publishes 2022 Origin-Destination matrices and detailed interactive data via its Data
        Retrieval System. The OD matrices are published as PDF tables whose reliable extraction would
        require OCR; that fails our determinism bar for v1 (documented in the repository&apos;s{" "}
        <code className="rounded bg-paper-dim px-1">docs/od-data-investigation.md</code>). The DRS requires
        an authenticated academic/planning account, which this public site deliberately avoids.
      </p>

      <h2 className="mt-10 font-display text-2xl font-semibold text-ink">Machine-readable manifest</h2>
      <p className="prose-story mt-3">
        Every file above is listed with full checksums in{" "}
        <a href="/data/manifest.json" className="underline decoration-accent underline-offset-2">/data/manifest.json</a>.
        All curated site data lives under <code className="rounded bg-paper-dim px-1">/data/</code> as JSON.
      </p>

      <p className="mt-12">
        <Link href="/" className="text-sm font-semibold text-accent hover:underline">← Back to the story</Link>
      </p>
    </div>
  );
}
