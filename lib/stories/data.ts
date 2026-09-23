/**
 * Build-time loaders for the Phase 4 story datasets (same pattern as
 * lib/data.ts: server components read the curated public JSON directly).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { DayStoryFile, TransitStoryFile } from "./types";

const ROOT = process.cwd();

export const getDayStory = (): DayStoryFile =>
  JSON.parse(readFileSync(resolve(ROOT, "public/data/story-day.json"), "utf8")) as DayStoryFile;

export const getTransitStory = (): TransitStoryFile =>
  JSON.parse(readFileSync(resolve(ROOT, "public/data/story-transit.json"), "utf8")) as TransitStoryFile;
