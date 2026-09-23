"use client";

import { useEffect, useRef, useState } from "react";
import { fmtCompact, fmtInt } from "@/lib/format";

const FORMATS = {
  int: fmtInt,
  compact: fmtCompact,
  /** value is already a percentage number (e.g. 90.8) — one decimal + %. */
  pct1: (v: number): string => `${v.toFixed(1)}%`,
} as const;

/**
 * Big narrative number. Counts up once when scrolled into view (motion
 * allowed only); reduced-motion users and repeat views see the value
 * immediately. Value is always present in the DOM for screen readers.
 * `format` is a discriminator (not a function) so server components can
 * render this directly.
 */
export function MetricReveal({
  value,
  format = "int",
  suffix,
  className = "",
  durationMs = 1100,
}: {
  value: number;
  format?: keyof typeof FORMATS;
  suffix?: string;
  className?: string;
  durationMs?: number;
}) {
  const formatter = FORMATS[format];
  const [shown, setShown] = useState(value);
  const [started, setStarted] = useState(false);
  const hostRef = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setStarted(true);
      return;
    }
    const el = hostRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        // static HTML already shows the final value; the reveal restarts from
        // zero for motion-allowed users only
        setShown(0);
        setStarted(true);
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setShown(value);
      return;
    }
    const from = shown;
    const delta = value - from;
    if (Math.abs(delta) < 1) {
      setShown(value);
      return;
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(from + delta * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, started, durationMs]);

  return (
    <span ref={hostRef} className={className}>
      <span className="tabular-nums">{formatter(Math.round(shown))}</span>
      {suffix && <span> {suffix}</span>}
    </span>
  );
}
