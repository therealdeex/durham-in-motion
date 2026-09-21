/**
 * GeoJSON → SVG path conversion for decorative inline maps (hero, section
 * marks). Simple equirectangular projection scaled to a viewBox — precise
 * enough for gestures, not used for analysis.
 */
export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

type Ring = [number, number][];
interface MultiPolyGeom {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
}

function geomRings(geom: MultiPolyGeom): Ring[] {
  if (geom.type === "Polygon") return geom.coordinates as unknown as Ring[];
  return (geom.coordinates as unknown as Ring[][][]).flat() as unknown as Ring[];
}

export function bboxOf(geom: MultiPolyGeom): BBox {
  const bb: BBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const ring of geomRings(geom)) {
    for (const [x, y] of ring) {
      bb.minX = Math.min(bb.minX, x);
      bb.maxX = Math.max(bb.maxX, x);
      bb.minY = Math.min(bb.minY, y);
      bb.maxY = Math.max(bb.maxY, y);
    }
  }
  return bb;
}

export interface PathOptions {
  width: number;
  height: number;
  padding?: number;
  /** Center longitude for the cos(lat) x-scale (defaults to bbox center). */
  lon0?: number;
}

export function projectGeometry(geom: MultiPolyGeom, bb: BBox, opts: PathOptions): Ring[] {
  const pad = opts.padding ?? 0;
  const lon0 = opts.lon0 ?? (bb.minX + bb.maxX) / 2;
  const kx = Math.cos((((bb.minY + bb.maxY) / 2) * Math.PI) / 180);
  const sx = (opts.width - pad * 2) / ((bb.maxX - bb.minX) * kx);
  const sy = (opts.height - pad * 2) / (bb.maxY - bb.minY);
  const s = Math.min(sx, sy);
  const ox = pad + ((opts.width - pad * 2) - (bb.maxX - bb.minX) * kx * s) / 2;
  const oy = pad + ((opts.height - pad * 2) - (bb.maxY - bb.minY) * s) / 2;
  return geomRings(geom).map((ring) =>
    ring.map(([lon, lat]) => [
      ox + (lon - bb.minX) * kx * s,
      oy + (bb.maxY - lat) * s,
    ]),
  );
}

export function ringsToPath(rings: Ring[]): string {
  return rings
    .map((ring) => ring.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ") + "Z")
    .join(" ");
}

export function centroidOf(rings: Ring[]): [number, number] {
  // Area-weighted centroid of the largest ring (outer boundary).
  let best = rings[0];
  let bestArea = -1;
  for (const ring of rings) {
    let a = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    }
    if (Math.abs(a) > bestArea) {
      bestArea = Math.abs(a);
      best = ring;
    }
  }
  let x = 0;
  let y = 0;
  let a = 0;
  for (let i = 0; i < best.length - 1; i++) {
    const cross = best[i][0] * best[i + 1][1] - best[i + 1][0] * best[i][1];
    a += cross;
    x += (best[i][0] + best[i + 1][0]) * cross;
    y += (best[i][1] + best[i + 1][1]) * cross;
  }
  a /= 2;
  return [x / (6 * a), y / (6 * a)];
}
