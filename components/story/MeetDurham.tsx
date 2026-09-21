"use client";

import { useEffect, useRef, useState } from "react";
import { fmtInt } from "@/lib/format";

export interface Fact {
  id: string;
  value: number;
  display: string;
  label: string;
  note: string;
}

/** Count-up numeral; runs once when visible, instant under reduced motion. */
export function CountUp({ value, format, className }: { value: number; format?: (v: number) => string; className?: string }) {
  const [displayed, setDisplayed] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const played = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || played.current) return;
        played.current = true;
        if (reduced) {
          setDisplayed(value);
          return;
        }
        const t0 = performance.now();
        const dur = 1500;
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          setDisplayed(value * eased);
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return (
    <span ref={ref} className={className}>
      {format ? format(displayed) : fmtInt(displayed)}
    </span>
  );
}

/**
 * Chapter 1 — Meet Durham. One dominant number per screen; each fact row is
 * a full-height beat so exactly one number leads at a time.
 */
export function MeetDurham({ facts }: { facts: Fact[] }) {
  return (
    <div>
      {facts.map((f) => (
        <div key={f.id} className="flex min-h-[82svh] flex-col justify-center py-16">
          <p className="font-display text-[clamp(3.4rem,10vw,8.5rem)] font-semibold leading-none tracking-tight text-walk">
            {f.display}
          </p>
          <p className="mt-4 font-display text-[clamp(1.4rem,3vw,2.2rem)] text-chalk">{f.label}</p>
          <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-chalk-dim">{f.note}</p>
        </div>
      ))}
      <p className="sr-only">
        {facts.map((f) => `${f.label}: ${fmtInt(f.value)}. ${f.note}`).join(" ")}
      </p>
    </div>
  );
}
