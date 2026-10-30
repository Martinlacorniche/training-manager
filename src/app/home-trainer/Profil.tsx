// La séance dessinée : une barre par étape, hauteur = watts visés, couleur =
// zone (part de FTP). Un trait montre où on en est.
import type { Etape } from "./ht/seance";
import { LIBRE_PCT } from "./ht/seance";

export const couleurZone = (pct: number) =>
  pct < 0.56 ? "#94a3b8" : pct < 0.76 ? "#3b82f6" : pct < 0.91 ? "#22c55e" : pct < 1.06 ? "#eab308" : pct < 1.21 ? "#f97316" : "#ef4444";

export function Profil({ etapes, ftp, ecoule, hauteur = 80, sombre = false }: {
  etapes: Etape[]; ftp: number; ecoule?: number; hauteur?: number; sombre?: boolean;
}) {
  const total = etapes.reduce((a, e) => a + e.s, 0) || 1;
  const wMax = Math.max(ftp * 1.3, ...etapes.map((e) => e.cible.type === "w" ? e.cible.max : ftp * LIBRE_PCT));
  let x = 0;
  return (
    <svg viewBox={`0 0 1000 ${hauteur}`} preserveAspectRatio="none" className="w-full block" style={{ height: hauteur }}>
      {etapes.map((e, k) => {
        const larg = (e.s / total) * 1000;
        const h = (w: number) => Math.max(4, (w / wMax) * (hauteur - 2));
        const de = e.rampe ? e.rampe.de : e.cible.type === "w" ? (e.cible.min + e.cible.max) / 2 : ftp * LIBRE_PCT;
        const a = e.rampe ? e.rampe.a : de;
        const pct = ((de + a) / 2) / ftp;
        const coul = e.cible.type === "w" ? couleurZone(pct) : e.cible.type === "bpm" ? "#ec4899" : sombre ? "#475569" : "#cbd5e1";
        const p = `M${x},${hauteur} L${x},${hauteur - h(de)} L${x + larg},${hauteur - h(a)} L${x + larg},${hauteur} Z`;
        x += larg;
        return <path key={k} d={p} fill={coul} stroke={sombre ? "#0f172a" : "#fff"} strokeWidth={larg > 3 ? 1 : 0} />;
      })}
      {ecoule != null && <rect x={Math.min(998, (ecoule / total) * 1000)} y={0} width={3} height={hauteur} fill={sombre ? "#fff" : "#0f172a"} />}
    </svg>
  );
}
