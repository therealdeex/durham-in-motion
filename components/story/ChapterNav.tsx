"use client";

import { useEffect, useRef, useState } from "react";

interface Chapter {
  id: string;
  label: string;
}

/** Fixed chapter navigation dots; highlights the section in view. */
export function ChapterNav({ chapters }: { chapters: Chapter[] }) {
  const [active, setActive] = useState(chapters[0]?.id);
  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observer.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    for (const c of chapters) {
      const el = document.getElementById(c.id);
      if (el) observer.current?.observe(el);
    }
    return () => observer.current?.disconnect();
  }, [chapters]);

  return (
    <>
      <nav aria-label="Chapters" className="fixed right-5 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-end gap-3 lg:flex">
        {chapters.map((c) => {
          const isActive = active === c.id;
          return (
            <a key={c.id} href={`#${c.id}`} aria-current={isActive ? "true" : undefined} className="group flex items-center gap-2.5">
              <span
                className={`rounded-full bg-ink/85 px-3 py-1 text-[11px] font-semibold tracking-wide text-paper shadow-md backdrop-blur transition-opacity duration-200 ${
                  isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                }`}
              >
                {c.label}
              </span>
              <span
                aria-hidden
                className={`block rounded-full shadow-[0_0_0_1.5px_rgba(0,0,0,0.35)] transition-all duration-200 ${
                  isActive ? "h-3 w-3 bg-walk shadow-[0_0_0_1.5px_rgba(0,0,0,0.45)]" : "h-2 w-2 bg-white/90 group-hover:bg-white"
                }`}
              />
            </a>
          );
        })}
      </nav>

      {/* Mobile chapter navigation (audit A10: none existed below lg). */}
      <details className="fixed bottom-4 right-4 z-40 lg:hidden">
        <summary className="flex h-11 w-11 items-center justify-center rounded-full bg-ink/90 text-paper shadow-lg backdrop-blur">
          <span aria-hidden className="text-lg leading-none">☰</span>
          <span className="sr-only">Chapters</span>
        </summary>
        <nav
          aria-label="Chapters"
          className="absolute bottom-14 right-0 max-h-[70svh] w-56 overflow-y-auto rounded-xl border border-night-line bg-ink/95 p-2 shadow-xl backdrop-blur"
        >
          {chapters.map((c) => (
            <a
              key={c.id}
              href={`#${c.id}`}
              aria-current={active === c.id ? "true" : undefined}
              className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                active === c.id ? "bg-white/10 text-walk" : "text-paper/85 hover:bg-white/5"
              }`}
            >
              {c.label}
            </a>
          ))}
        </nav>
      </details>
    </>
  );
}
