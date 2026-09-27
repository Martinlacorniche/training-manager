// ─────────────────────────────────────────────────────────────────────────
// UNE SEULE CHARGE PARTOUT (Martin, 27/09) : ressenti × heures (sRPE, Foster
// 2001, valable pour tous les sports, natation et renfo compris), séances
// FAITES seulement. Pas de ressenti = pas de charge : on n'invente rien.
// Même règle dans l'app (App-Coach/lib/charge.ts). Le connecteur donne
// en plus le TSS par sport.
// Seule exception : le calendrier des semaines À VENIR montre une charge
// PRÉVUE, estimée depuis l'intensité, jamais mêlée au réel du passé.
// ─────────────────────────────────────────────────────────────────────────

type Seance = { status?: string | null; rpe?: number | string | null; planned_hour?: number | string | null; intensity?: string | null };
type Course = { status?: string | null; rpe?: number | string | null; duration_hour?: number | string | null; strava_activity_id?: number | null };

export const chargeSeance = (s: Seance) =>
  s.status === "valide" && s.rpe ? Number(s.rpe) * (Number(s.planned_hour) || 0) : 0;

export const chargeCourse = (c: Course) =>
  c.rpe && c.duration_hour && (c.status || c.strava_activity_id) ? Number(c.rpe) * Number(c.duration_hour) : 0;


export const RPE_ESTIME: Record<string, number> = { basse: 3, moyenne: 6, haute: 9 };
export const chargePrevue = (s: Seance) => (Number(s.planned_hour) || 0) * (RPE_ESTIME[s.intensity || "moyenne"] || 6);
