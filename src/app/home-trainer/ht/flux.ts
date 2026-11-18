// ─────────────────────────────────────────────────────────────────────────
// Home-trainer : les mesures de la séance en « flux » (une valeur par seconde),
// dans la forme que Strava rend pour une activité (time, watts, heartrate,
// cadence, velocity_smooth, distance) plus les tours. Envoyé à ht-envoi AVEC le
// .fit : l'analyse est gardée même sans Strava ni intervals.icu.
// Copie de App-Coach/lib/ht/flux.ts — garder les deux identiques.
// ─────────────────────────────────────────────────────────────────────────

import type { Point, Tour } from "./moteur";

export type TourFlux = { i: number; d: number; t: number; v: number; hr: number | null; w: number | null; elev: number | null };
export type Flux = {
  time: number[]; watts: number[]; heartrate: number[]; cadence: number[];
  velocity_smooth: number[]; distance: number[]; tours: TourFlux[];
};

const moy = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
};

export function fluxDesPoints(points: Point[], tours: Tour[]): Flux | null {
  if (!points.length) return null;
  const t0 = points[0].ts, m0 = points[0].m;
  const tourFlux: TourFlux[] = [];
  tours.forEach((tr, k) => {
    const seg = points.slice(tr.debut, tr.fin + 1);
    if (!seg.length) return;
    const dist = seg[seg.length - 1].m - seg[0].m;
    tourFlux.push({
      i: k + 1, d: Math.round(dist), t: seg.length,
      v: Math.round((dist / Math.max(1, seg.length)) * 100) / 100,
      hr: moy(seg.map((p) => p.bpm)), w: moy(seg.map((p) => p.w)), elev: null,
    });
  });
  return {
    time: points.map((p) => Math.max(0, Math.round((p.ts - t0) / 1000))),
    watts: points.map((p) => Math.round(p.w ?? 0)),
    heartrate: points.map((p) => Math.round(p.bpm ?? 0)),
    cadence: points.map((p) => Math.round(p.cad ?? 0)),
    velocity_smooth: points.map((p) => Math.round((p.kmh / 3.6) * 100) / 100),
    distance: points.map((p) => Math.round(p.m - m0)),
    tours: tourFlux,
  };
}
