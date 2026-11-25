// ─────────────────────────────────────────────────────────────────────────
// Home-trainer : la copie de secours d'une sortie (logique pure, sans stockage).
// Une sortie est copiée sur l'appareil dès la fin (et en brouillon pendant le
// pédalage) ; la copie n'est retirée qu'une fois ht-envoi répondu sans erreur.
// Fichier partagé app ↔ site (Site-Coach/src/app/home-trainer/ht/secours.ts).
// ─────────────────────────────────────────────────────────────────────────

import type { Point, Tour } from "./moteur";
import type { Bloc } from "./seance";

export const CLE_ENVOIS = "ht:envois-en-attente";
export const CLE_BROUILLON = "ht:brouillon";
export const MAX_ESSAIS = 3;
export const AGE_MAX_MS = 7 * 86_400_000;
export const BROUILLON_MAX_MS = 24 * 3_600_000;
const MIN_POINTS = 30;

export type Sortie = {
  id: string; cree_le: number; userId: string; sessionId: string | null;
  titre: string; blocs: Bloc[]; texteCourt: string | null; jour: string;   // jour : AAAA-MM-JJ
  points: Point[]; tours: Tour[]; rr: { ts: number; s: number }[];
  flux?: unknown;                    // gardé même quand les points sont allégés
  compliment: string; rpe: number | null; essais: number;
  maj?: number;                      // brouillon : dernière écriture
};

export const nouvelId = (now: number) => `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function lire(brut: string | null): Sortie[] {
  if (!brut) return [];
  try {
    const l = JSON.parse(brut);
    return Array.isArray(l) ? l.filter((s) => s && typeof s.id === "string" && typeof s.userId === "string") : [];
  } catch { return []; }
}

export const ajouter = (l: Sortie[], s: Sortie) => [...l.filter((x) => x.id !== s.id), s];
export const retirer = (l: Sortie[], id: string) => l.filter((x) => x.id !== id);
export const modifier = (l: Sortie[], id: string, patch: Partial<Sortie>) => l.map((x) => (x.id === id ? { ...x, ...patch } : x));
export const nettoyer = (l: Sortie[], now: number) => l.filter((s) => now - s.cree_le <= AGE_MAX_MS);

/** Il reste de quoi refaire le fichier (sinon la copie allégée ne garde que le flux). */
export const renvoyable = (s: Sortie) => s.points.length >= MIN_POINTS;

/** Les copies de cet utilisateur à renvoyer maintenant. */
export const aRenvoyer = (l: Sortie[], userId: string) => l.filter((s) => s.userId === userId && renvoyable(s) && s.essais < MAX_ESSAIS);
/** Celles qu'on a arrêté d'essayer : à montrer, avec « Réessayer ». */
export const bloquees = (l: Sortie[], userId: string) => l.filter((s) => s.userId === userId && s.essais >= MAX_ESSAIS);
export const noterEssai = (l: Sortie[], id: string) => modifier(l, id, { essais: (l.find((x) => x.id === id)?.essais ?? 0) + 1 });
export const remettreEssais = (l: Sortie[], userId: string) => l.map((s) => (s.userId === userId ? { ...s, essais: 0 } : s));

/** Le brouillon vaut d'être proposé : même personne, moins de 24 h, au moins 30 s. */
export const brouillonUtilisable = (b: Sortie | null, userId: string, now: number) =>
  !!b && b.userId === userId && b.points.length >= MIN_POINTS && now - (b.maj ?? b.cree_le) <= BROUILLON_MAX_MS;

/** Allège une copie : plus de points, on garde le flux (petit). */
export const allegee = (s: Sortie): Sortie => ({ ...s, points: [], rr: [] });

/** Texte JSON de la liste ; si trop gros, on allège les plus anciennes copies d'abord. */
export function serialiser(l: Sortie[], max = 4_000_000): string {
  let cur = l;
  let t = JSON.stringify(cur);
  const ordre = [...l].sort((a, b) => a.cree_le - b.cree_le);
  for (const s of ordre) {
    if (t.length <= max) break;
    cur = cur.map((x) => (x.id === s.id ? allegee(x) : x));
    t = JSON.stringify(cur);
  }
  return t;
}

/** « 45 min, hier 18 h » */
export function libelleSortie(s: Sortie, now: number): string {
  const fin = new Date(s.maj ?? s.cree_le);
  const auj = new Date(now);
  const j0 = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const ecart = Math.round((j0(auj) - j0(fin)) / 86_400_000);
  const quand = ecart <= 0 ? "aujourd'hui" : ecart === 1 ? "hier" : `le ${String(fin.getDate()).padStart(2, "0")}/${String(fin.getMonth() + 1).padStart(2, "0")}`;
  const min = Math.max(1, Math.round(s.points.length / 60));
  return `${min} min, ${quand} ${fin.getHours()} h`;
}
