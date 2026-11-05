// ─────────────────────────────────────────────────────────────────────────
// Le détail d'une séance avant de la lancer (05/11/2026, Martin : « on voit
// pas le détail des objectifs watts et rpm »). Chaque ligne : la durée, les
// watts (calculés sur la FTP de l'athlète), la cadence conseillée et le mot
// de la zone. Les blocs répétés gardent leur « 4 × ».
// Copie de App-Coach/lib/ht/apercu.ts — garder les deux identiques.
// ─────────────────────────────────────────────────────────────────────────
import type { Bloc, Etape } from "./seance";
import { zoneEtape } from "./zones";

export type EtapeApercu = { duree: string; watts: string; cadence: string | null; mot: string; couleur: string };
export type LigneApercu = { fois: number; etapes: EtapeApercu[] };

export function dureeLisible(s: number): string {
  const m = Math.floor(s / 60), r = Math.round(s % 60);
  if (!m) return `${r}″`;
  return r ? `${m}′${String(r).padStart(2, "0")}` : `${m}′`;
}

function watts(e: Etape): string {
  if (e.lap) return "jusqu'à ton signal";
  if (e.rampe) return `${e.rampe.de} → ${e.rampe.a} W`;
  if (e.cible.type === "w") return e.cible.min === e.cible.max ? `${e.cible.min} W` : `${e.cible.min}–${e.cible.max} W`;
  if (e.cible.type === "bpm") return `cœur ${e.cible.min}–${e.cible.max}`;
  return "libre";
}

export function apercu(blocs: Bloc[], ftp: number): LigneApercu[] {
  return blocs.map((b) => {
    return {
      fois: b.fois,
      etapes: b.etapes.map((e) => {
        const z = zoneEtape(e, ftp);
        return { duree: dureeLisible(e.s), watts: watts(e), cadence: e.cadence ? `${e.cadence} tr/min` : null, mot: z.mot, couleur: z.plein };
      }),
    };
  });
}

/** Le texte d'une info-bulle pour une étape : « 3′ · 260 W · 95 tr/min ». */
export const bulleEtape = (e: Etape) => [dureeLisible(e.s), watts(e), e.cadence ? `${e.cadence} tr/min` : ""].filter(Boolean).join(" · ");
