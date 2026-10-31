// ─────────────────────────────────────────────────────────────────────────
// Home-trainer : la phrase qui félicite, en tête de la description Strava
// (Martin, 31/10/2026). Toujours un fait VRAI tiré de la séance — jamais un
// faux compliment, ni badge, ni record, ni série, ni comparaison (refusés).
// Si rien ne ressort, un encouragement simple.
// Copie de App-Coach/lib/ht/compliment.ts — garder les deux identiques.
// ─────────────────────────────────────────────────────────────────────────

import type { Point, Tour } from "./moteur";
import type { Etape } from "./seance";

const moy = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const ordinal = (n: number) => (n === 1 ? "1ʳᵉ" : `${n}ᵉ`);

export function compliment(points: Point[], tours: Tour[], etapes: Etape[], ftp: number, bouclee: boolean): string {
  // Précision : part des secondes à ±4 % (au moins 5 W) des watts visés
  const vises = points.filter((p) => p.c && p.w != null);
  const dedans = vises.filter((p) => Math.abs(p.w! - p.c!) <= Math.max(5, p.c! * 0.04)).length;
  const precision = vises.length >= 120 ? Math.round((dedans / vises.length) * 100) : 0;

  // Répétitions dures (≥ 90 % FTP) : la dernière tient-elle comme la première ?
  const dures = tours
    .filter((t) => { const e = etapes[t.etape]; return e && e.cible.type === "w" && (e.cible.min + e.cible.max) / 2 >= ftp * 0.9 && t.fin - t.debut >= 20; })
    .map((t) => moy(points.slice(t.debut, t.fin + 1).map((p) => p.w ?? 0)));

  // Force : étapes à cadence basse menées à leur terme
  const force = tours.filter((t) => { const e = etapes[t.etape]; return e?.cadence && e.cadence <= 65 && t.fin - t.debut + 1 >= e.s * 0.9; }).length;

  const km = points.length ? points[points.length - 1].m / 1000 : 0;

  if (precision >= 90) return `🎯 ${precision} % du temps dans le mille. Bravo !`;
  if (dures.length >= 3 && dures[dures.length - 1] >= dures[0] * 0.98) return `💪 La ${ordinal(dures.length)} répétition aussi forte que la 1ʳᵉ. Joli !`;
  if (force >= 2) return `🦵 ${force} blocs de force tenus jusqu'au bout.`;
  if (bouclee) return "✅ Séance bouclée jusqu'au bout, rien lâché 👏";
  if (precision >= 80) return `🎯 ${precision} % du temps dans le mille.`;
  if (!etapes.length && km >= 5) return `🛋️ ${km.toFixed(0)} km sans quitter le salon.`;
  return "👊 Séance faite, c'est ce qui compte.";
}
