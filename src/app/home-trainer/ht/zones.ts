// Home-trainer : les zones en mots simples et en couleurs, comme la Météo du
// corps (dégradés). Copie de App-Coach/lib/ht/zones.ts — garder les deux identiques.
import type { Etape } from "./seance";

export type Zone = { mot: string; degrade: [string, string]; plein: string };

const ZONES: { jusqua: number; z: Zone }[] = [
  { jusqua: 0.56, z: { mot: "Récup", degrade: ["#475569", "#94a3b8"], plein: "#94a3b8" } },
  { jusqua: 0.76, z: { mot: "Endurance", degrade: ["#2563eb", "#38bdf8"], plein: "#3b82f6" } },
  { jusqua: 0.91, z: { mot: "Tempo", degrade: ["#059669", "#34d399"], plein: "#10b981" } },
  { jusqua: 1.06, z: { mot: "Seuil", degrade: ["#d97706", "#fbbf24"], plein: "#f59e0b" } },
  { jusqua: 1.21, z: { mot: "Costaud", degrade: ["#ea580c", "#fb923c"], plein: "#f97316" } },
  { jusqua: Infinity, z: { mot: "À fond", degrade: ["#be123c", "#f43f5e"], plein: "#f43f5e" } },
];
export const ZONE_CARDIO: Zone = { mot: "Au cœur", degrade: ["#be185d", "#f472b6"], plein: "#ec4899" };
export const ZONE_LIBRE: Zone = { mot: "Libre", degrade: ["#0f766e", "#2dd4bf"], plein: "#14b8a6" };
export const ZONE_PAUSE: Zone = { mot: "Pause", degrade: ["#334155", "#64748b"], plein: "#64748b" };

export const zoneDe = (pct: number): Zone => ZONES.find((x) => pct < x.jusqua)!.z;

export function zoneEtape(e: Etape | null, ftp: number): Zone {
  if (!e || e.cible.type === "libre") return ZONE_LIBRE;
  if (e.cible.type === "bpm") return ZONE_CARDIO;
  const w = e.rampe ? (e.rampe.de + e.rampe.a) / 2 : (e.cible.min + e.cible.max) / 2;
  return zoneDe(w / ftp);
}

/** « Dans le mille », « +12 W », « −8 W » : l'écart aux watts visés, sans jargon. */
export function ecart(w: number | null, cible: number | null): { texte: string; bon: boolean } | null {
  if (w == null || !cible) return null;
  const d = Math.round(w - cible);
  if (Math.abs(d) <= Math.max(5, cible * 0.04)) return { texte: "Dans le mille", bon: true };
  return { texte: `${d > 0 ? "+" : "−"}${Math.abs(d)} W`, bon: false };
}

/** La zone cardiaque du moment (« Zone 2 »), d'après les zones de l'athlète
 *  (bornes basses, ex : [0, 120, 140, 150, 162], réglées dans l'app). */
const COUL_COEUR = ["#94a3b8", "#3b82f6", "#10b981", "#f59e0b", "#f97316", "#f43f5e"];
export function zoneCoeur(bpm: number | null, bornes: number[] | null | undefined): { n: number; texte: string; coul: string } | null {
  if (bpm == null || !bornes?.length) return null;
  let i = 0;
  bornes.forEach((b, j) => { if (bpm >= b) i = j; });
  const coul = COUL_COEUR[Math.round((i / Math.max(1, bornes.length - 1)) * (COUL_COEUR.length - 1))];
  return { n: i + 1, texte: `Zone ${i + 1}`, coul };
}
