/**
 * Client-safe geometry helpers and types for the OD story chapters' maps.
 * The server-side loader that reads GeoJSON lives in lib/od-map-server.ts.
 */

export interface MuniGeom {
  id: string;
  name: string;
  path: string;
  cx: number;
  cy: number;
}

export interface MapGeom {
  W: number;
  H: number;
  municipalities: MuniGeom[];
  outlinePath: string;
  toronto: { x: number; y: number };
}

/** Quadratic desire-line arc between two points (perpendicular lift). */
export function arcPath(x1: number, y1: number, x2: number, y2: number, lift = 0.18): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  // Perpendicular offset; lift toward the outside (right of travel direction).
  const cx = mx - (dy / len) * len * lift;
  const cy = my + (dx / len) * len * lift;
  return `M${x1.toFixed(1)} ${y1.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}
