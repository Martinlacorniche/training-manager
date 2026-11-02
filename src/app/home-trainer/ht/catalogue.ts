// ─────────────────────────────────────────────────────────────────────────
// Home-trainer : le catalogue des séances (Martin, 02/11/2026). On choisit
// en deux gestes : combien de temps, et envie de quoi (une famille). Chaque
// séance se déroule sur le temps choisi (un Gimenez de 30 min fait 4 tours,
// de 60 min en fait 9) et s'écrit en % de FTP : juste pour chacun.
// Les tests (rampe, check-up) ne dépendent pas du temps choisi.
// Copie de App-Coach/lib/ht/catalogue.ts — garder les deux identiques.
// ─────────────────────────────────────────────────────────────────────────

import { depuisCourt, dureeTotale } from "./seance";

export type Famille = "tranquille" | "rythme" | "seuil" | "pique" | "explosif" | "test";

export const FAMILLES: { id: Famille; nom: string; emoji: string; phrase: string }[] = [
  { id: "tranquille", nom: "Tranquille", emoji: "🌿", phrase: "Récupérer, faire tourner les jambes" },
  { id: "rythme", nom: "Rythme", emoji: "🛣️", phrase: "Le moteur, longtemps" },
  { id: "seuil", nom: "Seuil", emoji: "🔥", phrase: "Tenir fort" },
  { id: "pique", nom: "Ça pique", emoji: "⚡", phrase: "Le haut du moteur" },
  { id: "explosif", nom: "Explosif", emoji: "💥", phrase: "Sprints et force" },
  { id: "test", nom: "Test", emoji: "📏", phrase: "Savoir où tu en es" },
];

export const DUREES = [20, 30, 45, 60, 90] as const;

type Gabarit = {
  id: string; famille: Famille; nom: string; phrase: string;
  niveau: 1 | 2 | 3;              // 3 : caché aux invités qui ne roulent « jamais ou presque »
  minD: number;                   // durée minimale (min) pour qu'elle ait un sens
  corps?: (main: number, f: number) => string | null;   // le cœur de la séance, en minutes disponibles
  test?: "rampe" | "lsct";
};

// Échauffement et retour au calme selon le temps total.
const eq = (D: number) => (D <= 20 ? 5 : D <= 30 ? 8 : D <= 45 ? 10 : 12);
const rc = (D: number) => (D <= 20 ? 3 : D <= 30 ? 5 : D <= 60 ? 7 : 10);
// Nombre de répétitions : ce que le temps permet, réduit pour un invité débutant (f < 1).
const fois = (n: number, f: number, max = 30) => Math.max(1, Math.min(max, Math.floor(n * f)));
const reste = (main: number, utilise: number, pct: number) => (main - utilise >= 1 ? `, ${Math.round(main - utilise)}' ${pct}%` : "");
// n × (travail / récup) sans la dernière récup ; une seule fois : le travail seul.
// Rend le texte et les minutes prises. t et r en minutes.
const serie = (n: number, travail: string, t: number, recup: string, r: number): [string, number] =>
  n > 1 ? [`${n}x(${travail} / ${recup})!`, n * (t + r) - r] : [travail, t];

const GABARITS: Gabarit[] = [
  // 🌿 Tranquille
  { id: "recup", famille: "tranquille", nom: "Récup", phrase: "Tout doux, pour faire circuler", niveau: 1, minD: 20,
    corps: (m) => `${m}' 52%` },
  { id: "endurance", famille: "tranquille", nom: "Endurance", phrase: "Le rythme qui fait du bien, longtemps", niveau: 1, minD: 30,
    corps: (m) => `${m}' 68%` },
  { id: "relances", famille: "tranquille", nom: "Endurance + relances", phrase: "Tranquille, avec une petite relance de 20 secondes toutes les 5 minutes", niveau: 1, minD: 30,
    corps: (m) => { const n = fois(m / 5, 1); return `${n}x(4'40 68% / 20" 110%)${reste(m, n * 5, 65)}`; } },
  { id: "velocite", famille: "tranquille", nom: "Vélocité", phrase: "Facile, mais les jambes tournent vite une minute sur deux", niveau: 1, minD: 20,
    corps: (m) => { const n = fois(m / 2, 1, 60); return `${n}x(1' 62% @105 / 1' 60% @88)`; } },

  // 🛣️ Rythme
  { id: "tempo", famille: "rythme", nom: "Tempo", phrase: "Des blocs de 10 minutes à un rythme soutenu mais facile à tenir", niveau: 2, minD: 30,
    corps: (m, f) => { const [x, u] = serie(fois((m + 3) / 13, f, 6), "10' 80%", 10, "3' 60%", 3); return `${x}${reste(m, u, 62)}`; } },
  { id: "sweetspot", famille: "rythme", nom: "Sweet spot", phrase: "Juste sous le seuil : beaucoup de bénéfice pour la fatigue", niveau: 2, minD: 45,
    corps: (m, f) => { const [x, u] = serie(fois((m + 4) / 16, f, 5), "12' 90%", 12, "4' 60%", 4); return `${x}${reste(m, u, 62)}`; } },
  { id: "blocslongs", famille: "rythme", nom: "Blocs longs", phrase: "Le grand classique : deux ou trois longs blocs bien soutenus", niveau: 3, minD: 60,
    corps: (m, f) => { const L = m >= 65 ? 20 : 15; const [x, u] = serie(fois((m + 5) / (L + 5), f, 3), `${L}' 92%`, L, "5' 60%", 5); return `${x}${reste(m, u, 62)}`; } },

  // 🔥 Seuil
  { id: "seuil8", famille: "seuil", nom: "Seuil 8'", phrase: "8 minutes au seuil, 4 minutes pour souffler", niveau: 3, minD: 30,
    corps: (m, f) => { const [x, u] = serie(fois((m + 4) / 12, f, 6), "8' 100%", 8, "4' 55%", 4); return `${x}${reste(m, u, 60)}`; } },
  { id: "overunder", famille: "seuil", nom: "Dessus-dessous", phrase: "Tu alternes juste sous et juste au-dessus du seuil", niveau: 3, minD: 30,
    corps: (m, f) => {
      const n = fois((m + 4) / 13, f, 5);
      return Array.from({ length: n }, (_, i) => `3x(2' 95% / 1' 106%)${i < n - 1 ? ", 4' 55%" : ""}`).join(", ") + reste(m, n * 13 - 4, 60);
    } },
  { id: "pyramide", famille: "seuil", nom: "Pyramide", phrase: "Ça monte (2, 4, 6 minutes) puis ça redescend", niveau: 3, minD: 45,
    corps: (m) => {
      const k = Math.max(1, Math.min(2, Math.floor((m / 27) * 2) / 2));
      const d = (x: number) => { const s = Math.round(x * k * 60); return s % 60 ? `${Math.floor(s / 60)}'${String(s % 60).padStart(2, "0")}` : `${s / 60}'`; };
      return `${d(2)} 102%, ${d(1)} 55%, ${d(4)} 100%, ${d(2)} 55%, ${d(6)} 98%, ${d(3)} 55%, ${d(4)} 100%, ${d(2)} 55%, ${d(2)} 102%${reste(m, 27 * k, 60)}`;
    } },

  // ⚡ Ça pique
  { id: "gimenez", famille: "pique", nom: "Gimenez", phrase: "4 minutes costaud, 1 minute très fort, sans jamais vraiment souffler", niveau: 3, minD: 30,
    corps: (m, f) => { const n = fois(m / 5, f, 10); return `${n}x(4' 86% / 1' 123%)${reste(m, n * 5, 60)}`; } },
  { id: "3030", famille: "pique", nom: "30/30", phrase: "30 secondes très fort, 30 secondes tranquille, par séries de 10", niveau: 3, minD: 20,
    corps: (m, f) => {
      const n = fois((m + 5) / 15, f, 4);
      return Array.from({ length: n }, (_, i) => `10x(30" 125% / 30" 50%)!${i < n - 1 ? ", 5' 55%" : ""}`).join(", ") + reste(m, n * 15 - 5, 58);
    } },
  { id: "4020", famille: "pique", nom: "40/20", phrase: "40 secondes très fort, 20 secondes de repos : ça pique vraiment", niveau: 3, minD: 30,
    corps: (m, f) => {
      const n = fois((m + 4) / 12, f, 4);
      return Array.from({ length: n }, (_, i) => `8x(40" 120% / 20" 50%)!${i < n - 1 ? ", 4' 55%" : ""}`).join(", ") + reste(m, n * 12 - 4, 58);
    } },
  { id: "5x3", famille: "pique", nom: "Fractions de 3'", phrase: "3 minutes très fort, 3 minutes pour récupérer", niveau: 3, minD: 30,
    corps: (m, f) => { const [x, u] = serie(fois((m + 3) / 6, f, 6), "3' 115%", 3, "3' 55%", 3); return `${x}${reste(m, u, 58)}`; } },
  { id: "decouverte", famille: "pique", nom: "Premières accélérations", phrase: "Des petites accélérations de 30 secondes, rien de méchant", niveau: 1, minD: 20,
    corps: (m) => { const n = fois(m / 2, 1, 15); return `${n}x(30" 110% / 1'30 58%)${reste(m, n * 2, 58)}`; } },

  // 💥 Explosif
  { id: "sprints", famille: "explosif", nom: "Sprints", phrase: "10 secondes à fond, puis on récupère complètement", niveau: 2, minD: 20,
    corps: (m) => { const n = fois(m / 4, 1, 10); return `${n}x(10" 200% / 3'50 55%)${reste(m, n * 4, 58)}`; } },
  { id: "force", famille: "explosif", nom: "Force à 50 tr/min", phrase: "Gros braquet, jambes lentes : comme une côte raide", niveau: 2, minD: 30,
    corps: (m, f) => { const [x, u] = serie(fois((m + 3) / 8, f, 5), "5' 85% @50", 5, "3' 60% @90", 3); return `${x}${reste(m, u, 60)}`; } },
  { id: "departs", famille: "explosif", nom: "Départs arrêtés", phrase: "Presque à l'arrêt, puis 15 secondes de démarrage à fond", niveau: 2, minD: 30,
    corps: (m) => { const n = fois(m / 4, 1, 8); return `${n}x(15" 180% @60 / 3'45 55%)${reste(m, n * 4, 58)}`; } },

  // 📏 Test
  { id: "rampe", famille: "test", nom: "Calibrage (rampe)", phrase: "Les watts montent chaque minute jusqu'à ce que tu ne suives plus. Il mesure ta FTP et ta fréquence cardiaque max.", niveau: 1, minD: 0, test: "rampe" },
  { id: "lsct", famille: "test", nom: "Check-up vélo", phrase: "3 paliers à cœur fixe. Si tu pousses plus fort pour le même cœur, tu as progressé.", niveau: 1, minD: 0, test: "lsct" },
];

export type SeanceCatalogue = { id: string; famille: Famille; nom: string; phrase: string; texte: string | null; minutes: number | null; test?: "rampe" | "lsct" };

/** Durée réelle (min) d'un texte court. */
export const minutesTexte = (texte: string) => Math.round(dureeTotale(depuisCourt(texte, 200).blocs) / 60);

/**
 * Les séances d'une famille pour un temps donné.
 * f : 1 pour un athlète ; moins pour un invité débutant (moins de répétitions).
 * niveauMax : 2 cache les séances les plus dures (invité qui ne roule « jamais ou presque »).
 */
export function seancesDe(famille: Famille, D: number, opts: { f?: number; niveauMax?: number; avecLsct?: boolean } = {}): SeanceCatalogue[] {
  const f = opts.f ?? 1;
  return GABARITS.filter((g) => g.famille === famille && g.niveau <= (opts.niveauMax ?? 3) && (g.test !== "lsct" || opts.avecLsct))
    .map((g): SeanceCatalogue | null => {
      if (g.test) return { id: g.id, famille: g.famille, nom: g.nom, phrase: g.phrase, texte: null, minutes: null, test: g.test };
      if (D < g.minD) return null;
      const main = D - eq(D) - rc(D);
      const c = g.corps!(main, f);
      if (!c) return null;
      const texte = `${eq(D)}' 50>68%, ${c}, ${rc(D)}' 60>45%`;
      return { id: g.id, famille: g.famille, nom: g.nom, phrase: g.phrase, texte, minutes: minutesTexte(texte) };
    })
    .filter((x): x is SeanceCatalogue => !!x);
}

/** La rampe en écriture courte (invité, sans planning) : la même que celle du planning. */
export function texteRampe(departW: number, paliers = 40): string {
  const d = Math.max(60, Math.round(departW / 20) * 20);
  return [`10' ${Math.round(d * 0.5)}>${d}W`, ...Array.from({ length: paliers }, (_, i) => `1' ${d + 20 * i}W`), "10' 120>80W"].join(", ");
}

/** Le résultat immédiat d'une rampe, sur l'écran de fin : la meilleure minute
 *  (moyenne glissante sur 60 points d'une seconde), la FTP à 75 %, la FC max. */
export function resultatRampe(points: { w: number | null; bpm: number | null }[]): { pma: number; ftp: number; fcMax: number | null } | null {
  if (points.length < 60) return null;
  let somme = 0, meilleure = 0;
  for (let i = 0; i < points.length; i++) {
    somme += points[i].w ?? 0;
    if (i >= 60) somme -= points[i - 60].w ?? 0;
    if (i >= 59) meilleure = Math.max(meilleure, somme / 60);
  }
  const fc = Math.max(0, ...points.map((p) => p.bpm ?? 0));
  return { pma: Math.round(meilleure), ftp: Math.round((0.75 * meilleure) / 5) * 5, fcMax: fc > 80 ? fc : null };
}
