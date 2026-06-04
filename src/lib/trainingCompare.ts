// Chantier 3 — « demandé vs fait ».
// Compare le prescrit (durée + intensité posées par le coach) au réalisé (données
// Strava). 100% factuel : aucune prescription. Fonction pure, réutilisée à l'écran.
// Seuils heuristiques regroupés en tête → faciles à régler.
// (Miroir de App-Coach/lib/trainingCompare.ts — garder les deux synchronisés.)

export const COMPARE_THRESHOLDS = {
  durationDeltaPct: 15,
  highZoneShare: 0.15,
  modZoneShare: 0.05,
  z3Share: 0.25,
  driftPct: 8,
  rpeLow: 3,
  rpeHigh: 7,
};

export type Intensity = "basse" | "moyenne" | "haute";

export type SessionLike = {
  status?: string | null;
  strava_activity_id?: number | null;
  prescribed_hour?: number | null;
  planned_hour?: number | null;       // = durée réalisée après synchro
  intensity?: string | null;          // intensité prescrite
  rpe?: number | null;
  strava_tss?: number | null;
  strava_trimp?: number | null;
  strava_hr_drift?: number | null;
  strava_time_in_zone?: number[] | null;
};

export type Comparison = {
  done: boolean;
  duration: { prescribed: number; actual: number; deltaPct: number; flag: boolean } | null;
  intensity: { prescribed: Intensity | null; realized: Intensity | null; mismatch: boolean } | null;
  rpe: { value: number; flag: boolean; note: string | null } | null;
  drift: { value: number; flag: boolean } | null;
};

export function realizedIntensity(tiz: number[] | null | undefined): Intensity | null {
  if (!Array.isArray(tiz) || tiz.length === 0) return null;
  const total = tiz.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  const high = ((tiz[3] ?? 0) + (tiz[4] ?? 0)) / total;
  const mod = (tiz[2] ?? 0) / total;
  if (high >= COMPARE_THRESHOLDS.highZoneShare) return "haute";
  if (high >= COMPARE_THRESHOLDS.modZoneShare || mod >= COMPARE_THRESHOLDS.z3Share) return "moyenne";
  return "basse";
}

const asIntensity = (v: string | null | undefined): Intensity | null =>
  v === "basse" || v === "moyenne" || v === "haute" ? v : null;

export function compareSession(s: SessionLike): Comparison {
  const done = s.status === "valide" || s.strava_activity_id != null;

  let duration: Comparison["duration"] = null;
  const prescribed = s.prescribed_hour ?? null;
  const actual = s.planned_hour ?? null;
  if (prescribed != null && prescribed > 0 && actual != null) {
    const deltaPct = Math.round(((actual - prescribed) / prescribed) * 100);
    duration = { prescribed, actual, deltaPct, flag: Math.abs(deltaPct) > COMPARE_THRESHOLDS.durationDeltaPct };
  }

  const presInt = asIntensity(s.intensity);
  const realInt = realizedIntensity(s.strava_time_in_zone);
  const intensity = (presInt || realInt)
    ? { prescribed: presInt, realized: realInt, mismatch: !!(presInt && realInt && presInt !== realInt) }
    : null;

  let rpe: Comparison["rpe"] = null;
  if (s.rpe != null) {
    let note: string | null = null;
    if (realInt === "basse" && s.rpe >= COMPARE_THRESHOLDS.rpeHigh) note = "RPE élevé pour une FC basse";
    else if (realInt === "haute" && s.rpe <= COMPARE_THRESHOLDS.rpeLow) note = "RPE bas pour une FC haute";
    rpe = { value: s.rpe, flag: note != null, note };
  }

  const drift = s.strava_hr_drift != null
    ? { value: s.strava_hr_drift, flag: s.strava_hr_drift > COMPARE_THRESHOLDS.driftPct }
    : null;

  return { done, duration, intensity, rpe, drift };
}
