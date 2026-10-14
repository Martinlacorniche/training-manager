// ─────────────────────────────────────────────────────────────────────────
// La VO2max ESTIMÉE (Martin, 15/10/2026) : sur la même échelle que les montres,
// pour se situer et se comparer. À côté, le « niveau de course » (Daniels) reste
// la mesure de performance réelle. Copie de App-Coach lib/vo2.ts : les deux doivent rester identiques.
//
// Course : VMA ≈ vitesse tenable 6 min, tirée du modèle de vitesse critique
// (CS + D'/360) ; VO2max ≈ 3,5 × VMA en km/h (Léger).
// Vélo : puissance 5 min du modèle (CP + W'/300) ; VO2max ≈ 10,8 × W/kg + 7 (ACSM).
// Comparaison : tables FRIEND (Kaminsky et al., Mayo Clin Proc 2015), percentiles
// 10/25/50/75/90 par âge et sexe, sur tapis.
// ─────────────────────────────────────────────────────────────────────────

export function vo2Course(cs: number | null, dPrime: number | null): number | null {
  if (!cs || cs <= 0) return null;
  const vma = (cs + Number(dPrime ?? 0) / 360) * 3.6;
  return Math.round(vma * 3.5 * 10) / 10;
}

export function vo2Velo(cp: number | null, wPrime: number | null, poids: number | null): number | null {
  if (!cp || !poids) return null;
  const p5 = cp + Number(wPrime ?? 0) / 300;
  return Math.round((10.8 * p5 / poids + 7) * 10) / 10;
}

// [âge mini, p10, p25, p50, p75, p90]
const FRIEND: Record<"M" | "F", number[][]> = {
  M: [[20, 32.1, 40.1, 48, 55.2, 61.8], [30, 30.2, 35.9, 42.4, 49.2, 56.5], [40, 26.8, 31.9, 37.8, 45, 52.1],
      [50, 22.8, 27.1, 32.6, 39.7, 45.6], [60, 19.8, 23.7, 28.2, 34.5, 40.3], [70, 17.1, 20.4, 24.4, 30.4, 36.6]],
  F: [[20, 23.9, 30.5, 37.6, 44.7, 51.3], [30, 20.9, 25.3, 30.2, 36.1, 41.4], [40, 18.8, 22.1, 26.7, 32.4, 38.4],
      [50, 17.3, 19.9, 23.4, 27.6, 32], [60, 14.6, 17.2, 20, 23.8, 27], [70, 13.6, 15.6, 18.3, 20.8, 23.1]],
};

export type Situation = { percentile: number; mot: string; couleur: string; top: string | null };

/** Où se situe une VO2max pour un sexe et un âge. Sans sexe : null. Sans âge : 30-39 ans. */
export function situer(vo2: number | null, sexe: string | null, age: number | null): Situation | null {
  if (vo2 == null || (sexe !== "M" && sexe !== "F")) return null;
  const lignes = FRIEND[sexe];
  const l = [...lignes].reverse().find((x) => (age ?? 35) >= x[0]) ?? lignes[0];
  const pts: [number, number][] = [[10, l[1]], [25, l[2]], [50, l[3]], [75, l[4]], [90, l[5]]];
  let p: number;
  if (vo2 <= pts[0][1]) p = Math.max(1, 10 * vo2 / pts[0][1]);
  else if (vo2 >= pts[4][1]) {
    // Au-delà du 90e, la queue s'aplatit : 95e ≈ p90 + 0,45 × (p90 − p75)
    // (≈ 59,8 chez les hommes de 30-39 ans, la valeur publiée par l'ACSM),
    // 99e ≈ p90 + 1,2 × (p90 − p75). Plafonné à 99.
    const d = pts[4][1] - pts[3][1], p95 = pts[4][1] + 0.45 * d, p99 = pts[4][1] + 1.2 * d;
    p = vo2 < p95 ? 90 + 5 * (vo2 - pts[4][1]) / (p95 - pts[4][1])
      : Math.min(99, 95 + 4 * (vo2 - p95) / (p99 - p95));
  } else {
    const i = pts.findIndex(([, v]) => vo2 < v);
    const [p0, v0] = pts[i - 1], [p1, v1] = pts[i];
    p = p0 + (p1 - p0) * (vo2 - v0) / (v1 - v0);
  }
  p = Math.round(p);
  const [mot, couleur] = p >= 90 ? ["Supérieur", "#8b5cf6"] : p >= 75 ? ["Excellent", "#2563eb"] : p >= 50 ? ["Bon", "#16a34a"] : p >= 25 ? ["Moyen", "#f59e0b"] : ["À travailler", "#ef4444"];
  return { percentile: p, mot, couleur, top: p >= 50 ? `Top ${Math.max(1, 100 - p)} %` : null };
}

export const ageDe = (annee: number | null | undefined) => (annee ? new Date().getFullYear() - annee : null);
