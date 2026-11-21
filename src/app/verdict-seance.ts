// ─────────────────────────────────────────────────────────────────────────
// Verdict « prévu vs fait » d'une séance faite, en mots simples, d'un coup d'œil
// pour le coach. Pur, sans appel réseau : tout vient de colonnes déjà en base.
// — durée : prescribed_hour (prévu) contre planned_hour (durée réalisée après synchro) ;
// — effort : intensity (prévue) contre les zones de FC réellement tenues
//   (strava_time_in_zone, mêmes seuils que trainingCompare côté site).
// Jamais de rouge : « ok » = vert pâle, « ecart » = ambre pâle.
// (Copie miroir : Site-Coach/src/app/verdict-seance.ts — garder les deux synchronisés.)
// ─────────────────────────────────────────────────────────────────────────
export type Effort = "basse" | "moyenne" | "haute";
export type Ton = "ok" | "ecart";

export type VerdictEntree = {
  prescribed_hour?: number | null;
  planned_hour?: number | null;
  intensity?: string | null;
  strava_time_in_zone?: number[] | null;
};

export type Verdict = {
  titre: string;                       // « Fait comme prévu », « Plus court que prévu »…
  ton: Ton;
  pastilles: { texte: string; ton: Ton }[];
  duree: { prevu: string; fait: string } | null;
  effort: { prevu: string; fait: string } | null;
};

const SEUIL_DUREE = 0.15;
const NOM_EFFORT: Record<Effort, string> = { basse: "Tranquille", moyenne: "Moyen", haute: "Costaud" };
const RANG: Record<Effort, number> = { basse: 0, moyenne: 1, haute: 2 };

/** 0.9 → « 54 min », 1.25 → « 1h15 ». */
export function dureeCourte(h: number): string {
  const t = Math.round(h * 60);
  if (t < 60) return `${t} min`;
  const m = t % 60;
  return `${Math.floor(t / 60)}h${m ? String(m).padStart(2, "0") : ""}`;
}

/** L'effort réellement tenu, lu dans le temps passé par zone de FC (Z1..Z5). */
export function effortFait(tiz: number[] | null | undefined): Effort | null {
  if (!Array.isArray(tiz) || tiz.length === 0) return null;
  const total = tiz.reduce((a, b) => a + (Number(b) || 0), 0);
  if (total <= 0) return null;
  const haut = ((tiz[3] ?? 0) + (tiz[4] ?? 0)) / total;
  const moyen = (tiz[2] ?? 0) / total;
  if (haut >= 0.15) return "haute";
  if (haut >= 0.05 || moyen >= 0.25) return "moyenne";
  return "basse";
}

const effortPrevu = (v: string | null | undefined): Effort | null =>
  v === "basse" || v === "moyenne" || v === "haute" ? v : null;

/** Null quand rien n'est comparable (pas de durée prévue, pas de zones). */
export function verdictSeance(s: VerdictEntree): Verdict | null {
  const pastilles: Verdict["pastilles"] = [];
  let titre: string | null = null;
  let duree: Verdict["duree"] = null;
  let effort: Verdict["effort"] = null;

  const prevu = Number(s.prescribed_hour) || 0;
  const fait = Number(s.planned_hour) || 0;
  if (prevu > 0 && fait > 0) {
    duree = { prevu: dureeCourte(prevu), fait: dureeCourte(fait) };
    const ecart = (fait - prevu) / prevu;
    if (ecart < -SEUIL_DUREE) {
      titre = "Plus court que prévu";
      pastilles.push({ texte: `Plus court que prévu (${dureeCourte(fait)} sur ${dureeCourte(prevu)})`, ton: "ecart" });
    } else if (ecart > SEUIL_DUREE) {
      titre = "Plus long que prévu";
      pastilles.push({ texte: `Plus long que prévu (${dureeCourte(fait)} sur ${dureeCourte(prevu)})`, ton: "ecart" });
    } else {
      pastilles.push({ texte: "Durée respectée", ton: "ok" });
    }
  }

  const p = effortPrevu(s.intensity);
  const f = effortFait(s.strava_time_in_zone);
  if (p && f) {
    effort = { prevu: NOM_EFFORT[p], fait: NOM_EFFORT[f] };
    if (RANG[f] > RANG[p]) {
      titre = titre ? `${titre}, plus intense` : "Plus intense que prévu";
      pastilles.push({ texte: "Plus intense que prévu", ton: "ecart" });
    } else if (RANG[f] < RANG[p]) {
      titre = titre ? `${titre}, plus facile` : "Plus facile que prévu";
      pastilles.push({ texte: "Plus facile que prévu", ton: "ecart" });
    } else {
      pastilles.push({ texte: "Effort comme prévu", ton: "ok" });
    }
  }

  if (!pastilles.length) return null;
  const ecarts = pastilles.some((x) => x.ton === "ecart");
  return { titre: ecarts ? (titre as string) : "Fait comme prévu", ton: ecarts ? "ecart" : "ok", pastilles, duree, effort };
}
