// ─────────────────────────────────────────────────────────────────────────
// Le jeu des cols à plusieurs (25/11/2026) : logique pure, sans réseau ni écran.
// Fantômes (trace de distance par seconde), positions, écarts, classement,
// décalage d'horloge pour le départ commun. Fichier partagé app ↔ site
// (copie de App-Coach/lib/ht/course.ts) : garder les deux identiques.
// ─────────────────────────────────────────────────────────────────────────

/** Une trace gardée pour un fantôme : la distance (m) toutes les `pas` secondes. */
export type Trace = { pas: number; d: number[]; duree: number };

export const PAS_TRACE = 5;
export const MAX_RIVAUX = 9;     // 9 fantômes ou 10 coureurs en direct (toi compris)
export const MAX_SALON = 10;

/** Le premier mot d'un nom : jamais de nom de famille. */
export function prenomDe(nom: string | null | undefined): string {
  const p = (nom ?? "").trim().split(/\s+/)[0];
  return p || "Anonyme";
}

/** Échantillonne les distances (une par seconde) toutes les `pas` s ; le dernier échantillon est l'arrivée. */
export function echantillonner(distances: number[], pas = PAS_TRACE): Trace {
  const duree = distances.length;
  const d: number[] = [0];
  for (let t = pas; t < duree; t += pas) d.push(Math.round(distances[t - 1] ?? 0));
  if (duree > 0) d.push(Math.round(distances[duree - 1]));
  return { pas, d, duree };
}

/** La distance à `t` secondes, interpolée ; après l'arrivée, le fantôme reste au sommet. */
export function distanceA(tr: Trace, t: number): number {
  const n = tr.d.length;
  if (n === 0) return 0;
  if (t <= 0) return tr.d[0];
  if (t >= tr.duree || n === 1) return tr.d[n - 1];
  const k = Math.floor(t / tr.pas);
  const fin = k >= n - 2;   // dernier intervalle : de la dernière grille à l'arrivée
  const t0 = k * tr.pas, t1 = fin ? tr.duree : (k + 1) * tr.pas;
  const d0 = tr.d[Math.min(k, n - 2)], d1 = tr.d[Math.min(k + 1, n - 1)];
  return t1 > t0 ? d0 + ((d1 - d0) * (t - t0)) / (t1 - t0) : d1;
}

/** Une trace relue de la base (jsonb) : refuse tout ce qui n'a pas la forme attendue. */
export function traceValide(x: unknown, duree: number): Trace | null {
  const o = x as { pas?: unknown; d?: unknown } | null;
  if (!o || typeof o.pas !== "number" || o.pas < 1 || !Array.isArray(o.d) || o.d.length < 2) return null;
  if (!o.d.every((v) => typeof v === "number" && isFinite(v))) return null;
  return { pas: o.pas, d: o.d as number[], duree };
}

// ─── Positions et écarts ───

export type Rival = {
  id: string; prenom: string;
  m: number;                 // distance (m)
  v?: number;                // vitesse (m/s)
  fini?: number | null;      // temps d'arrivée (s), si arrivé
  abandon?: boolean;
  fige?: boolean;            // connexion perdue : reste figé et grisé
  moi?: boolean;
};
export type Ecart = { prenom: string; s: number | null; m: number };   // s = null : trop lent, on parle en mètres

/** L'ordre : les arrivés (par temps), puis ceux en route (par distance). Les abandons sortent du classement. */
export function ordonner(liste: Rival[]): Rival[] {
  return liste.filter((r) => !r.abandon).sort((a, b) => {
    const fa = a.fini != null, fb = b.fini != null;
    if (fa && fb) return a.fini! - b.fini! || a.id.localeCompare(b.id);
    if (fa) return -1;
    if (fb) return 1;
    return b.m - a.m || a.id.localeCompare(b.id);
  });
}

/** Le temps qu'il faut pour couvrir `dist` mètres à la vitesse du moment ; null si on ne bouge presque pas. */
export function ecartEnTemps(dist: number, v: number | null | undefined, vAutre?: number | null): number | null {
  const vit = v && v > 0.5 ? v : vAutre && vAutre > 0.5 ? vAutre : 0;
  return vit > 0 ? Math.round(Math.abs(dist) / vit) : null;
}

export type Situation = { rang: number; total: number; devant: Ecart | null; derriere: Ecart | null; ordre: Rival[] };

/** Ta position, l'écart avec celui de devant et celui de derrière. */
export function situation(moi: Rival, autres: Rival[], longueur: number): Situation {
  const ordre = ordonner([{ ...moi, moi: true }, ...autres.filter((a) => a.id !== moi.id)]);
  const i = ordre.findIndex((r) => r.moi);
  const mi = i < 0 ? { ...moi, abandon: true } : ordre[i];
  const ecart = (r: Rival | undefined): Ecart | null => {
    if (!r) return null;
    const dist = Math.abs((r.fini != null ? longueur : r.m) - (mi.fini != null ? longueur : mi.m));
    return { prenom: r.prenom, s: ecartEnTemps(dist, mi.v, r.v), m: Math.round(dist) };
  };
  return { rang: i < 0 ? ordre.length + 1 : i + 1, total: ordre.length + (i < 0 ? 1 : 0), devant: ecart(ordre[i - 1]), derriere: ecart(ordre[i + 1]), ordre };
}

/** « 12 s », « 1 min 05 », ou « 40 m » quand on ne bouge presque pas. */
export function texteEcart(e: Ecart): string {
  if (e.s == null) return `${e.m} m`;
  return e.s < 60 ? `${e.s} s` : `${Math.floor(e.s / 60)} min ${String(e.s % 60).padStart(2, "0")}`;
}

export const rangTexte = (r: number) => (r === 1 ? "1er" : `${r}ᵉ`);

export type Arrivee = { rang: number; id: string; prenom: string; t: number | null; ecart: number | null; abandon: boolean; moi: boolean };

/** Le classement final : temps, écart au premier ; les abandons en dernier ; ceux encore en route avant eux. */
export function classementFinal(liste: Rival[]): Arrivee[] {
  const ordre = ordonner(liste), premier = ordre.find((r) => r.fini != null)?.fini ?? null;
  const sortis = liste.filter((r) => r.abandon);
  return [
    ...ordre.map((r, i) => ({ rang: i + 1, id: r.id, prenom: r.prenom, t: r.fini ?? null, ecart: r.fini != null && premier != null ? r.fini - premier : null, abandon: false, moi: !!r.moi })),
    ...sortis.map((r) => ({ rang: 0, id: r.id, prenom: r.prenom, t: null, ecart: null, abandon: true, moi: !!r.moi })),
  ];
}

/** Un rival qui n'a rien envoyé depuis `delai` ms est figé. */
export const estFige = (vuLe: number, maintenant: number, delai = 4000) => maintenant - vuLe > delai;

// ─── L'horloge commune ───

/** Le décalage serveur − appareil (ms), mesuré sur l'aller-retour le plus court. */
export function decalageHorloge(essais: { t0: number; serveur: number; t1: number }[]): number {
  if (!essais.length) return 0;
  const m = essais.reduce((a, b) => (b.t1 - b.t0 < a.t1 - a.t0 ? b : a));
  return m.serveur - (m.t0 + m.t1) / 2;
}

/** Les secondes (arrondies au-dessus) avant le départ, sur l'heure du serveur ; ≤ 0 : c'est parti. */
export const resteAvantDepart = (departMs: number, maintenant: number, decalage: number) => Math.ceil((departMs - (maintenant + decalage)) / 1000) || 0;

/** Le temps de course (s) d'un arrivé : heure du serveur à l'arrivée − départ commun. */
export const tempsDeCourse = (departMs: number, maintenant: number, decalage: number) => Math.max(0, Math.round((maintenant + decalage - departMs) / 1000));

/** Une couleur par coureur, stable. */
export const COULEURS = ["#2563eb", "#e11d48", "#059669", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#65a30d", "#ea580c", "#475569"];
export const couleurDe = (i: number) => COULEURS[i % COULEURS.length];
