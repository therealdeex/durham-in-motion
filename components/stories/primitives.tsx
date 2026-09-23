import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Editorial narrative primitives shared by the story pages (Phase 4).
 * Server-safe presentational pieces; interactive primitives (scrubber,
 * metric counter, sticky observer) live in their own client files.
 */

/** Full-height opening for a story page. */
export function StoryHero({
  kicker,
  title,
  standfirst,
  children,
}: {
  kicker: string;
  title: string;
  standfirst: string;
  children?: ReactNode;
}) {
  return (
    <section className="dark-section dark-textured relative flex min-h-[92svh] flex-col" aria-label={title}>
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-24">
        <p className="mb-6 text-xs font-semibold uppercase tracking-[0.28em] text-walk">{kicker}</p>
        <h1 className="max-w-[16ch] font-display text-[clamp(2.8rem,8vw,6rem)] font-semibold leading-[1.02] tracking-tight text-chalk">
          {title}
        </h1>
        <p className="mt-7 max-w-[48ch] text-lg leading-relaxed text-chalk-dim">{standfirst}</p>
        {children && <div className="mt-10">{children}</div>}
      </div>
    </section>
  );
}

/**
 * One narrative card in a scrollytelling sequence. `id` drives the observer
 * in StickyVisualization; `onDark` beats sit over the immersive background.
 */
export function StoryBeat({
  id,
  kicker,
  title,
  children,
  wide = false,
}: {
  id: string;
  kicker?: string;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <article
      id={id}
      data-story-beat={id}
      className={`story-beat mx-auto w-full px-6 py-10 md:py-14 ${wide ? "max-w-3xl" : "max-w-xl"}`}
    >
      <div className="rounded-2xl border border-night-line/70 bg-night-soft p-6 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8)] md:p-8">
        {kicker && <p className="text-xs font-semibold uppercase tracking-[0.2em] text-walk">{kicker}</p>}
        <h2 className="mt-3 font-display text-2xl font-semibold leading-tight text-chalk md:text-[2rem]">{title}</h2>
        <div className="prose-story mt-4 space-y-4">{children}</div>
      </div>
    </article>
  );
}

/** Small emphasized note attached to a visualization moment. */
export function Annotation({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="border-l-2 border-walk/70 pl-3 text-sm leading-relaxed text-chalk-dim">
      <span className="block font-semibold text-chalk">{label}</span>
      {children}
    </p>
  );
}

/** Source + basis line for a story section. */
export function SourceFootnote({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-xs leading-relaxed text-ink-faint dark-section:text-chalk-dim">{children}</p>;
}

/** Collapsible practitioner detail (methodology that would break the narrative). */
export function PractitionerNote({ title = "For practitioners", children }: { title?: string; children: ReactNode }) {
  return (
    <details className="mt-5 rounded-xl border border-night-line bg-night-soft/60 px-5 py-4 text-sm leading-relaxed text-chalk-dim">
      <summary className="cursor-pointer list-none font-semibold text-chalk-dim transition-colors hover:text-chalk">
        <span className="mr-2 inline-block transition-transform motion-reduce:transition-none" aria-hidden>
          ▸
        </span>
        {title}
      </summary>
      <div className="mt-3 space-y-2.5 border-t border-night-line/60 pt-3">{children}</div>
    </details>
  );
}

/** Closing card: what the reader should leave with, and where to go next. */
export function StoryEndCard({
  title,
  lessons,
  next,
  backLabel = "Back to Durham in Motion",
  backHref = "/",
}: {
  title: string;
  lessons: string[];
  next?: { href: string; label: string; note: string };
  backLabel?: string;
  backHref?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <div className="rounded-2xl border border-walk/30 bg-gradient-to-b from-night-soft to-night p-7 md:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-walk">What to remember</p>
        <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-chalk">{title}</h2>
        <ul className="mt-6 space-y-3">
          {lessons.map((l) => (
            <li key={l} className="flex gap-3 text-[15px] leading-relaxed text-chalk-dim">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-walk" />
              <span>{l}</span>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap gap-4">
          {next && (
            <Link
              href={next.href}
              className="rounded-full bg-walk px-5 py-2.5 text-sm font-semibold text-night transition-opacity hover:opacity-90"
            >
              Next story: {next.label}
            </Link>
          )}
          <Link
            href={backHref}
            className="rounded-full border border-night-line px-5 py-2.5 text-sm font-semibold text-chalk-dim transition-colors hover:border-chalk-dim hover:text-chalk"
          >
            {backLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
