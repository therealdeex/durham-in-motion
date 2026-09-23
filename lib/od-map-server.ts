/**
 * Server-side map geometry for the OD story chapters. Reads the curated
 * planning-district GeoJSON, projects it (with a Toronto anchor point inside
 * the frame) into an SVG viewBox, and returns plain serializable geometry
 * that client components receive as props.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { bboxOf, projectGeometry, ringsToPath, centroidOf, type BBox } from "@/lib/geo-path";
import type { MapGeom, MuniGeom } from "@/lib/od-map";

/** Eastern Toronto anchor (used as the labelled "Toronto" point). */
const TORONTO = { lon: -79.386, lat: 43.72 };

export function loadMapGeom(opts?: { width?: number; height?: number; toronto?: boolean }): MapGeom {
  const W = opts?.width ?? 620;
  const H = opts?.height ?? 640;
  const withToronto = opts?.toronto ?? true;

  const root = process.cwd();
  const districts = JSON.parse(
    readFileSync(resolve(root, "public/data/planning-districts.geojson"), "utf8"),
  ) as {
    features: { properties: { id: string; name: string }; geometry: { type: "Polygon" | "MultiPolygon"; coordinates: never } }[];
  };
  const outline = JSON.parse(
    readFileSync(resolve(root, "public/data/durham-outline.geojson"), "utf8"),
  ) as { geometry: { type: "Polygon" | "MultiPolygon"; coordinates: never } };

  const bb = bboxOf(outline.geometry as never);
  if (withToronto) {
    bb.minX = Math.min(bb.minX, TORONTO.lon);
    bb.maxX = Math.max(bb.maxX, TORONTO.lon);
    bb.minY = Math.min(bb.minY, TORONTO.lat);
    bb.maxY = Math.max(bb.maxY, TORONTO.lat);
  }
  const PAD = 28;
  const params = projectionParams(bb, W, H, PAD);

  const municipalities: MuniGeom[] = districts.features.map((f) => {
    const rings = projectGeometry(f.geometry, bb, { width: W, height: H, padding: PAD });
    const [cx, cy] = centroidOf(rings);
    return { id: f.properties.id, name: f.properties.name, path: ringsToPath(rings), cx, cy };
  });

  const outlineRings = projectGeometry(outline.geometry, bb, { width: W, height: H, padding: PAD });
  const tx = params.ox + (TORONTO.lon - bb.minX) * params.kx * params.s;
  const ty = params.oy + (bb.maxY - TORONTO.lat) * params.s;

  return {
    W,
    H,
    municipalities,
    outlinePath: ringsToPath(outlineRings),
    toronto: { x: tx, y: ty },
  };
}

/** Mirrors the scaling math in lib/geo-path.ts projectGeometry. */
function projectionParams(bb: BBox, width: number, height: number, pad: number) {
  const kx = Math.cos((((bb.minY + bb.maxY) / 2) * Math.PI) / 180);
  const sx = (width - pad * 2) / ((bb.maxX - bb.minX) * kx);
  const sy = (height - pad * 2) / (bb.maxY - bb.minY);
  const s = Math.min(sx, sy);
  const ox = pad + (width - pad * 2 - (bb.maxX - bb.minX) * kx * s) / 2;
  const oy = pad + (height - pad * 2 - (bb.maxY - bb.minY) * s) / 2;
  return { kx, s, ox, oy };
}
