// ─────────────────────────────────────────────────────────────────────────
// Home-trainer : le catalogue des séances (Martin, 02/11/2026). On choisit
// combien de temps, puis une séance ; chacune s'écrit en % de FTP (juste
// pour chacun) et se construit sur le temps choisi.
//
// Règle de construction (validée le 02/11, « pas de fourre-tout ») : une
// séance est une SÉRIE répétable. On ajoute des séries entières jusqu'à un
// plafond ; un reste ≤ 3 min va dans l'échauffement et le retour au calme ;
// de 3 à 10 min, il allonge les récupérations entre séries ; au-delà, un
// COMPLÉMENT dans l'esprit de la séance se place au milieu, jamais à la fin.
// Sinon la séance n'est pas proposée à cette durée.
//
// Deux publics : la DÉCOUVERTE (balades et scénarios de course, pour ceux qui
// n'y connaissent rien, et la borne de l'hôtel) et le CATALOGUE des habitués.
// Les tests (rampe, check-up) ne dépendent pas du temps choisi.
// Copie de App-Coach/lib/ht/catalogue.ts — garder les deux identiques.
// ─────────────────────────────────────────────────────────────────────────

import { depuisCourt, dureeTotale } from "./seance";

export type Famille = "decouverte" | "tranquille" | "rythme" | "costaud" | "pique" | "explosif" | "course" | "test";
export type Intensite = 1 | 2 | 3;

export const FAMILLES: { id: Famille; nom: string; emoji: string; phrase: string }[] = [
  { id: "decouverte", nom: "Découverte", emoji: "🎬", phrase: "Des sorties qui racontent une course" },
  { id: "tranquille", nom: "Tranquille", emoji: "🌿", phrase: "Récupérer, faire tourner les jambes" },
  { id: "rythme", nom: "Rythme", emoji: "🛣️", phrase: "Le moteur, longtemps" },
  { id: "costaud", nom: "Costaud", emoji: "🔥", phrase: "Tenir fort" },
  { id: "pique", nom: "Ça pique", emoji: "⚡", phrase: "Le haut du moteur" },
  { id: "explosif", nom: "Explosif", emoji: "💥", phrase: "Sprints et force" },
  { id: "course", nom: "Comme en course", emoji: "🏁", phrase: "Changements de rythme et attaques" },
  { id: "test", nom: "Test", emoji: "📏", phrase: "Savoir où tu en es" },
];
export const INTENSITES: Record<Intensite, string> = { 1: "Tranquille", 2: "Ça travaille", 3: "Ça pique" };
export const DUREES = [20, 30, 45, 60, 90] as const;

// ─── Les briques ───

type Etape = [number, string];            // [secondes, cible : « 95% », « 85% @50 », « 120>90% »]
type Hasard = () => number;               // 0 ≤ x < 1
type Complement = (s: number) => Etape[] | null;

/** Un gabarit : une série répétable (motif…) ou une construction libre (construire). */
export type Gabarit = {
  id: string; famille: Famille; nom: string; classique?: string; sentir: string; intensite: Intensite;
  niveau: 1 | 2 | 3;                      // 3 : caché aux invités débutants
  minD?: number; maxD?: number;
  motif?: Etape[]; sansFin?: boolean;     // une répétition ; sans la dernière récup de chaque série
  parSerie?: [number, number]; entre?: Etape; maxSeries?: number; plafond?: number;
  complement?: Complement;
  construire?: (s: number, hasard: Hasard) => Etape[] | null;   // séances qui racontent quelque chose
  test?: "rampe" | "lsct";
  pourquoi?: string;                      // pour l'assistant IA (jargon permis)
};

// Échauffement et retour au calme selon le temps total (minutes).
const eq = (D: number) => (D <= 20 ? 5 : D <= 30 ? 8 : D <= 45 ? 10 : 12);
const rc = (D: number) => (D <= 20 ? 3 : D <= 30 ? 5 : D <= 60 ? 7 : 10);
const arrondi30 = (s: number) => Math.round(s / 30) * 30;

// Des compléments « dans l'esprit » : ils remplissent exactement s secondes.
function enBlocs(s: number, bloc: number, pause: number, cible: string, cibleP = "60%"): Etape[] | null {
  if (s < 240) return null;
  const n = Math.max(1, Math.round((s + pause) / (bloc + pause)));
  const travail = Math.floor((s - (n - 1) * pause) / n / 15) * 15;   // au quart de minute : lisible
  const out: Etape[] = [];
  for (let i = 0; i < n; i++) {
    out.push([i === n - 1 ? s - (n - 1) * (travail + pause) : travail, cible]);
    if (i < n - 1) out.push([pause, cibleP]);
  }
  return out;
}
export const COMPLEMENTS = {
  rythme: (s: number) => enBlocs(s, 360, 60, "78%"),
  tempo: (s: number) => enBlocs(s, 480, 120, "85%"),
  velocite: (s: number) => {
    if (s < 240) return null;
    const n = Math.floor(s / 120), r = s - n * 120;
    const out: Etape[] = [];
    for (let i = 0; i < n; i++) out.push([60, "65% @105"], [60 + (i === n - 1 ? r : 0), "60% @88"]);
    return out;
  },
  // Un pont d'endurance : seulement court (jamais plus de 10 min de remplissage).
  pont: (s: number) => (s <= 600 ? [[s, "68%"] as Etape] : enBlocs(s, 540, 60, "70%", "75%")),
};

// ─── Construction ───

const dureeEtapes = (e: Etape[]) => e.reduce((a, x) => a + x[0], 0);
const repetition = (g: Gabarit, r: number): Etape[] => {
  const t = Array.from({ length: r }, () => g.motif!).flat();
  return g.sansFin && g.motif!.length > 1 ? t.slice(0, -1) : t;
};

/** Le cœur d'une séance-série pour s secondes : les étapes, ou null si elle n'a pas sa place. */
function corpsSerie(g: Gabarit, s: number, f: number): { etapes: Etape[]; plusEq: number; plusRc: number } | null {
  const [pmin, pmax] = g.parSerie ?? [1, 1];
  const entre = g.entre ?? [0, "60%"];
  const plafond = Math.max(pmin, Math.floor((g.plafond ?? 99) * f));
  let best: { k: number; r: number; total: number } | null = null;
  for (let k = 1; k <= (g.maxSeries ?? 1); k++) {
    for (let r = Math.min(pmax, Math.floor(plafond / k)); r >= pmin; r--) {
      const total = k * dureeEtapes(repetition(g, r)) + (k - 1) * entre[0];
      if (total <= s && (!best || total > best.total)) best = { k, r, total };
    }
  }
  if (!best) return null;
  const { k, r } = best;
  let reste = s - best.total, pause = entre[0], plusEq = 0, plusRc = 0;
  let comp: Etape[] | null = null;
  if (reste <= 180) { plusEq = Math.floor(reste / 2); plusRc = reste - plusEq; reste = 0; }
  else if (reste <= 600) {
    // Les pauses entre séries s'allongent, sans dépasser 10 min (sinon c'est du remplissage).
    if (k >= 2) { const p = Math.max(0, Math.min(Math.floor(reste / (k - 1)), 600 - pause)); pause += p; reste -= p * (k - 1); }
    plusEq = Math.min(reste, 300); plusRc = reste - plusEq; reste = 0;
  } else {
    // Le complément coûte une pause de plus (ou 2' avant une série unique) : on la retire du reste.
    comp = g.complement?.(reste - (k >= 2 ? pause : 120)) ?? null;
    if (!comp) return null;
  }
  // Les séries, et le complément au milieu (avant la série unique s'il n'y en a qu'une).
  const series = Array.from({ length: k }, () => repetition(g, r));
  const out: Etape[] = [];
  const milieu = k >= 2 ? Math.floor(k / 2) : 0;
  series.forEach((x, i) => {
    if (comp && i === milieu) {
      if (k >= 2) out.push([pause, entre[1]]);
      out.push(...comp);
      if (k >= 2) out.push([pause, entre[1]]);
      else out.push([120, "60%"]);
    } else if (i > 0) out.push([pause, entre[1]]);
    out.push(...x);
  });
  // L'arrondi du complément : l'écart restant va à l'échauffement.
  if (comp) plusEq += s - dureeEtapes(out);
  return { etapes: out, plusEq, plusRc };
}

// ─── Écriture courte (celle de l'app) ───

const dureeTexte = (s: number) => {
  s = Math.max(1, Math.round(s));
  if (s < 60) return `${s}"`;
  const m = Math.floor(s / 60), r = s % 60;
  return r ? `${m}'${String(r).padStart(2, "0")}` : `${m}'`;
};
/** Étapes → texte court, en regroupant les répétitions identiques qui se suivent. */
function versTexte(etapes: Etape[]): string {
  const morceaux: string[] = [];
  let i = 0;
  while (i < etapes.length) {
    // Cherche un motif de 2 étapes répété (le cas courant : travail / récup)
    const a = etapes[i], b = etapes[i + 1];
    if (b) {
      let n = 1;
      while (etapes[i + 2 * n]?.[0] === a[0] && etapes[i + 2 * n]?.[1] === a[1] && etapes[i + 2 * n + 1]?.[0] === b[0] && etapes[i + 2 * n + 1]?.[1] === b[1]) n++;
      const fin = etapes[i + 2 * n];
      const sansFin = n >= 1 && fin && fin[0] === a[0] && fin[1] === a[1];
      if (n >= 2 || (n >= 1 && sansFin)) {
        morceaux.push(`${n + (sansFin ? 1 : 0)}x(${dureeTexte(a[0])} ${a[1]} / ${dureeTexte(b[0])} ${b[1]})${sansFin ? "!" : ""}`);
        i += 2 * n + (sansFin ? 1 : 0);
        continue;
      }
    }
    morceaux.push(`${dureeTexte(a[0])} ${a[1]}`);
    i++;
  }
  return morceaux.join(", ");
}

// ─── Les séances de DÉCOUVERTE (débutants, borne de l'hôtel) ───

const DECOUVERTE: Gabarit[] = [
  { id: "balade", famille: "decouverte", nom: "Balade", sentir: "Tu pédales à l'aise, tu peux parler", intensite: 1, niveau: 1, minD: 20,
    construire: (s) => enBlocs(s, 540, 60, "65%", "70%") },
  { id: "relances", famille: "decouverte", nom: "Balade + relances", sentir: "À l'aise, avec une petite relance de 20 secondes toutes les 5 minutes", intensite: 1, niveau: 1, minD: 20,
    motif: [[280, "66%"], [20, "105%"]], parSerie: [1, 40], plafond: 40 },
  { id: "jambes", famille: "decouverte", nom: "Les jambes qui tournent", sentir: "Facile, mais tes jambes tournent vite une minute sur deux", intensite: 1, niveau: 1, minD: 20,
    motif: [[60, "62% @105"], [60, "60% @88"]], parSerie: [5, 15], entre: [240, "65%"], maxSeries: 4, plafond: 50 },
  { id: "montee", famille: "decouverte", nom: "Montée en rythme", sentir: "Ça monte doucement, jusqu'à bien respirer à la fin", intensite: 2, niveau: 1, minD: 20,
    construire: (s) => {
      const n = Math.max(3, Math.min(8, Math.floor(s / 300)));
      const l = Math.floor(s / n);
      return Array.from({ length: n }, (_, i): Etape => [i === n - 1 ? s - l * (n - 1) : l, `${Math.round(65 + (25 * i) / (n - 1))}%`]);
    } },
  { id: "echappee", famille: "decouverte", nom: "L'échappée", sentir: "Tu roules dans le peloton, tu attaques, tu tiens devant… et tu finis au sprint", intensite: 2, niveau: 1, minD: 30,
    construire: (s) => {
      const ech = arrondi30(Math.min(900, Math.max(300, s * 0.3))), final: Etape[] = [[180, "85>105%"], [20, "150%"]];
      const peloton = s - 60 - ech - 180 - 200;
      if (peloton < 240) return null;
      const p = enBlocs(peloton, 420, 30, "72%", "95%")!;
      return [...p, [60, "125%"], [ech, "90%"], [180, "60%"], ...final];
    } },
  { id: "attaques", famille: "decouverte", nom: "Les attaques", sentir: "Tu roules tranquille… et ça attaque quand tu ne t'y attends pas", intensite: 2, niveau: 1, minD: 20,
    construire: (s, h) => {
      const out: Etape[] = [];
      let t = 0;
      while (s - t > 240) {
        const calme = arrondi30(120 + h() * 180), att = [20, 30, 40, 60][Math.floor(h() * 4)];
        if (t + calme + att > s - 60) break;
        out.push([calme, "70%"], [att, `${Math.round(115 + h() * 25)}%`]);
        t += calme + att;
      }
      if (!out.length) return null;
      out.push([s - t, "65%"]);
      return out;
    } },
  { id: "clm", famille: "decouverte", nom: "Le contre-la-montre", sentir: "Seul contre le chrono : un effort bien régulier", intensite: 2, niveau: 1, minD: 30,
    motif: [[600, "92%"], [240, "60%"]], sansFin: true, parSerie: [1, 4], plafond: 4, complement: COMPLEMENTS.rythme },
  { id: "sommet", famille: "decouverte", nom: "L'arrivée au sommet", sentir: "Ça devient de plus en plus dur, jusqu'à la dernière minute", intensite: 3, niveau: 2, minD: 20,
    construire: (s) => {
      const n = Math.max(3, Math.min(10, Math.floor((s - 60) / 240)));
      const l = Math.floor((s - 60) / n);
      const out = Array.from({ length: n }, (_, i): Etape => [i === n - 1 ? s - 60 - l * (n - 1) : l, `${Math.round(70 + (35 * i) / (n - 1))}%`]);
      return [...out, [60, "115%"]];
    } },
  { id: "sprintfinal", famille: "decouverte", nom: "Le sprint final", sentir: "Une sortie tranquille, puis un final où tu accélères jusqu'au sprint", intensite: 2, niveau: 1, minD: 20,
    construire: (s) => {
      const avant = s - 200;
      if (avant < 240) return null;
      return [...enBlocs(avant, 585, 15, "70%", "100%")!, [180, "85>105%"], [20, "160%"]];
    } },
  { id: "3015", famille: "decouverte", nom: "Les 30/15", sentir: "30 secondes fort, 15 secondes pour souffler : ça passe vite !", intensite: 3, niveau: 2, minD: 20,
    motif: [[30, "118%"], [15, "50%"]], sansFin: true, parSerie: [6, 13], entre: [180, "55%"], maxSeries: 3, plafond: 39, complement: COMPLEMENTS.rythme },
  { id: "escaliercadence", famille: "decouverte", nom: "L'escalier de cadence", sentir: "Tes jambes tournent de plus en plus vite, palier après palier", intensite: 1, niveau: 1, minD: 20,
    motif: [[120, "65% @80"], [120, "65% @90"], [120, "65% @100"], [120, "65% @110"], [120, "60% @85"]], parSerie: [1, 1], entre: [60, "62%"], maxSeries: 6, plafond: 6, complement: COMPLEMENTS.pont },
];

/** Les 6 sorties de la borne de l'hôtel (le Mont Faron est ajouté par l'écran, c'est un col). */
export const BORNE = ["balade", "relances", "jambes", "montee", "echappee"] as const;

// ─── Le CATALOGUE des habitués ───

// 28 séances (agent « catalogue expert », 02/11/2026 : sources dans « pourquoi »).
const HABITUES: Gabarit[] = [
// ── Tranquille
{ id: "endurance", famille: "tranquille", nom: "L'endurance", classique: "Z2", sentir: "un effort facile où tu peux parler, avec une minute de jambes vives toutes les 5 minutes", intensite: 1, niveau: 1,
  motif: [[240, "70%"], [60, "64% @100"]], parSerie: [2, 16], plafond: 16, minD: 30, maxD: 90,
  pourquoi: "Volume en zone 1 de Seiler (<LT1, ~65-75 % FTP, Coggan L2) : base de la distribution polarisée/pyramidale (Seiler 2010). La minute à 100 tr/min évite le pédalage figé en ERG." },
{ id: "endurance-force", famille: "tranquille", nom: "L'endurance en force", classique: "", sentir: "le souffle calme et les cuisses qui poussent en gros braquet 1 minute 30 toutes les 5 minutes", intensite: 1, niveau: 2,
  motif: [[210, "70%"], [90, "76% @60"]], parSerie: [2, 16], plafond: 16, minD: 30, maxD: 90,
  pourquoi: "Couple élevé à faible intensité métabolique (Z2) : stimulus neuromusculaire de force sans coût de fatigue ; preuves modestes (Paton 2009 ; Kristoffersen 2014 sans effet chez vétérans), intérêt surtout de variété et d'économie." },
{ id: "endurance-pedalage", famille: "tranquille", nom: "Le pédalage rond", classique: "", sentir: "tes jambes changer de rythme, normal, vite, lent, sans jamais forcer", intensite: 1, niveau: 1,
  motif: [[180, "68% @90"], [60, "66% @108"], [60, "70% @72"]], parSerie: [2, 16], plafond: 16, minD: 30, maxD: 90,
  pourquoi: "Endurance Z2 avec variabilité de cadence (coordination, plage de cadence efficace) ; pratique d'entraîneur (FFC, bibliothèques TrainerRoad/SYSTM), pas d'étude contrôlée dédiée." },
// ── Rythme
{ id: "tempo", famille: "rythme", nom: "Le tempo", classique: "", sentir: "un rythme soutenu où tu ne parles plus qu'en phrases courtes, avec 30 secondes pour souffler toutes les 5 minutes", intensite: 2, niveau: 1,
  motif: [[270, "85%"], [30, "70%"]], sansFin: true, parSerie: [2, 13], plafond: 13, minD: 20, maxD: 90,
  pourquoi: "Coggan L3 (76-90 % FTP), juste sous/au LT1-LT2 bas : volume aérobie « dur mais durable », utile pour la durabilité ; zone grise si abusée (Seiler 2010)." },
{ id: "sweet-spot", famille: "rythme", nom: "Le juste en dessous", classique: "Sweet spot", sentir: "du fort mais tenable : 12 minutes juste sous ta limite, 2 minutes pour souffler", intensite: 2, niveau: 2,
  motif: [[720, "90%"]], parSerie: [1, 1], entre: [120, "60%"], maxSeries: 5, plafond: 5, minD: 20, maxD: 90,
  pourquoi: "88-93 % FTP (concept Coggan/TrainerRoad) : beaucoup de temps près de MLSS pour un coût de récup modéré ; efficace pour pratiquants à volume limité, preuves surtout empiriques." },
{ id: "tempo-cadences", famille: "rythme", nom: "Le tempo jambes lourdes, jambes vives", classique: "", sentir: "le même effort, 3 minutes en force puis 3 minutes en vitesse de jambes", intensite: 2, niveau: 2,
  motif: [[180, "86% @70"], [180, "84% @100"]], parSerie: [1, 3], entre: [180, "60%"], maxSeries: 3, plafond: 9, minD: 20, maxD: 90,
  pourquoi: "Tempo L3 avec alternance de couple/cadence : transfert terrain (montée vs plat), robustesse de la technique sous charge ; pratique d'entraîneur (pas d'ECR)." },
{ id: "tempo-relances", famille: "rythme", nom: "Le tempo qui relance", classique: "", sentir: "un bon rythme, et toutes les 5 minutes 15 secondes pour boucher un trou", intensite: 2, niveau: 2,
  motif: [[285, "88%"], [15, "140%"]], parSerie: [2, 4], entre: [240, "60%"], maxSeries: 3, plafond: 12, minD: 20, maxD: 90,
  pourquoi: "Tempo haut entrecoupé de surges : recrute des fibres rapides puis oblige à « éponger » le lactate à intensité soutenue (logique des intervalles à intensité variée, Bossi 2020)." },
// ── Costaud
{ id: "seuil-12", famille: "costaud", nom: "Le seuil en blocs de 12 minutes", classique: "Cruise intervals", sentir: "ta limite, mais en contrôle : 12 minutes que tu finis sans exploser", intensite: 3, niveau: 1,
  motif: [[720, "96%"]], parSerie: [1, 1], entre: [150, "55%"], maxSeries: 3, plafond: 3, minD: 20, maxD: 60,
  pourquoi: "Coggan L4 (91-105 % FTP) au plus près de MLSS ; Stepto 1999 : intervalles proches de l'allure de course (85 % PPO, ~seuil haut) = meilleur gain sur 1 h." },
{ id: "seuil-long", famille: "costaud", nom: "Le seuil long", classique: "2x20", sentir: "la tête qui travaille autant que les jambes : 18 minutes régulières au bord de ta limite", intensite: 3, niveau: 2,
  motif: [[1080, "95%"]], parSerie: [1, 1], entre: [300, "55%"], maxSeries: 3, plafond: 3, minD: 60, maxD: 90,
  pourquoi: "Variante du classique 2x20 (Allen & Coggan) adaptée aux temps de l'app (2x18 à 60', 3x18 à 90') : temps cumulé élevé à ~MLSS." },
{ id: "dessus-dessous", famille: "costaud", nom: "Le dessus-dessous", classique: "Over-unders", sentir: "2 minutes juste sous ta limite, 1 minute juste au-dessus, sans jamais pouvoir souffler", intensite: 3, niveau: 2,
  motif: [[120, "95%"], [60, "106%"]], parSerie: [3, 5], entre: [150, "55%"], maxSeries: 3, plafond: 12, minD: 20, maxD: 60,
  pourquoi: "Over-unders (TrainerRoad, Xert) : les « over » produisent du lactate que les « under » obligent à recycler au seuil ; base factuelle = intensité variée (Bossi 2020), le reste est empirique." },
{ id: "escalier-seuil", famille: "costaud", nom: "L'escalier du seuil", classique: "", sentir: "trois marches de 4 minutes qui montent jusqu'à ta limite, puis 2 minutes pour souffler", intensite: 3, niveau: 1,
  motif: [[240, "90%"], [240, "95%"], [240, "100%"]], parSerie: [1, 1], entre: [120, "55%"], maxSeries: 5, plafond: 5, minD: 20, maxD: 90,
  pourquoi: "Progressif sous-seuil → seuil (pratique FFC « seuil progressif ») : le temps près de MLSS arrive en fin de bloc, plus tolérable que le seuil constant ; bon outil de reprise d'intensité." },
{ id: "huit-minutes", famille: "costaud", nom: "Les 8 minutes", classique: "4x8 Seiler", sentir: "8 minutes juste au-dessus de ta limite : dur jusqu'au bout, mais tu tiens", intensite: 3, niveau: 2,
  motif: [[480, "103%"], [120, "55%"]], sansFin: true, parSerie: [3, 4], plafond: 4, minD: 45, maxD: 60,
  pourquoi: "Seiler et al. 2013 : 4x8' (2' récup) > 4x4' et 4x16' sur VO2max/puissance chez pratiquants entraînés (effort maximal tenable, ~90 % FCmax, ~100-106 % FTP)." },
// ── Ça pique
{ id: "40-20", famille: "pique", nom: "Les 40/20", classique: "", sentir: "40 secondes fort, 20 secondes trop courtes pour souffler : la fin de chaque série est longue", intensite: 3, niveau: 2,
  motif: [[40, "115%"], [20, "50%"]], sansFin: true, parSerie: [8, 13], entre: [180, "55%"], maxSeries: 3, plafond: 36, minD: 20, maxD: 60,
  pourquoi: "Micro-intervalles (famille Rønnestad 30/15) : temps >90 % VO2max élevé grâce à une récup trop courte pour que la VO2 redescende (Buchheit & Laursen 2013) ; 40/20 = plus de travail que 30/15, cible un peu plus basse." },
{ id: "30-30", famille: "pique", nom: "Les 30/30", classique: "Billat", sentir: "30 secondes fort, 30 secondes facile : tu respires fort mais tu récupères à chaque fois", intensite: 3, niveau: 1,
  motif: [[30, "120%"], [30, "50%"]], sansFin: true, parSerie: [8, 13], entre: [240, "50%"], maxSeries: 3, plafond: 33, minD: 20, maxD: 60,
  pourquoi: "Billat 2000 : l'intermittent 30/30 à vVO2max maintient VO2max plus longtemps qu'un continu ; récup 50 % plus longue que 30/15 → séance PMA d'entrée, mieux tolérée." },
{ id: "quatre-minutes", famille: "pique", nom: "Les 4 minutes", classique: "", sentir: "4 minutes où tu respires à fond, puis 2 minutes 30 pour revenir", intensite: 3, niveau: 2,
  motif: [[240, "112%"], [150, "55%"]], sansFin: true, parSerie: [3, 6], plafond: 6, minD: 30, maxD: 60,
  pourquoi: "Intervalles longs à ~PMA (106-120 % FTP) ; Seiler & Hetlelid 2005 : ~2 min de récup suffisent entre 4' ; Laursen & Jenkins 2002 pour la base HIIT." },
{ id: "depart-rapide", famille: "pique", nom: "Les 5 minutes qui partent fort", classique: "Fast-start", sentir: "une minute très forte pour lancer, puis 4 minutes à tenir au-dessus de ta limite", intensite: 3, niveau: 3,
  motif: [[60, "125%"], [240, "106%"], [150, "55%"]], sansFin: true, parSerie: [3, 5], plafond: 5, minD: 45, maxD: 60,
  pourquoi: "Départ rapide → VO2 monte plus vite, plus de temps >90 % VO2max à charge égale (Rønnestad 2019 skieurs ; revue Mølmen & Rønnestad 2024 : effet si le départ dure ≥ ~1,5-2')." },
{ id: "dents-de-scie", famille: "pique", nom: "Les dents de scie", classique: "Bossi", sentir: "4 minutes 30 qui accélèrent toutes les minutes et demie, sans vrai répit", intensite: 3, niveau: 3,
  motif: [[30, "130%"], [60, "100%"], [30, "130%"], [60, "100%"], [30, "130%"], [60, "100%"], [180, "55%"]], sansFin: true, parSerie: [2, 6], plafond: 6, minD: 30, maxD: 60,
  pourquoi: "Bossi et al. 2020 (IJSPP, 14 cyclistes) : intervalles à intensité variée (pics 30'' à PMA) → plus de temps >90 % VO2max (410 vs 286 s) que l'intensité constante, RPE égal." },
{ id: "vagues", famille: "pique", nom: "Les vagues", classique: "Gimenez", sentir: "4 minutes à ta limite, puis 1 minute au-dessus, et on recommence sans s'arrêter", intensite: 3, niveau: 2,
  motif: [[240, "92%"], [60, "120%"]], parSerie: [2, 4], entre: [240, "55%"], maxSeries: 3, plafond: 12, minD: 20, maxD: 90,
  pourquoi: "Méthode Gimenez (Gimenez et al. 1982, exercice en créneaux) : base près du seuil + pics à PMA ; classique des entraîneurs français pour PMA/seuil sans récup complète." },
{ id: "pyramide", famille: "pique", nom: "La pyramide", classique: "", sentir: "des efforts de 1 à 4 minutes puis de 4 à 1 : le plus dur est au milieu", intensite: 3, niveau: 2,
  motif: [[60, "120%"], [60, "55%"], [120, "115%"], [60, "55%"], [180, "110%"], [90, "55%"], [240, "106%"], [120, "55%"], [180, "110%"], [90, "55%"], [120, "115%"], [60, "55%"], [60, "120%"]], parSerie: [1, 1], plafond: 1, minD: 45, maxD: 45,
  pourquoi: "Pyramide classique (FFC, bibliothèques publiques) : couvre PMA courte et longue dans la même séance ; ~16' de travail >105 % FTP, intérêt surtout psychologique et de variété." },
// ── Explosif
{ id: "une-minute", famille: "explosif", nom: "Les minutes à fond", classique: "", sentir: "une minute à fond qui brûle les cuisses, puis 4 minutes pour t'en remettre", intensite: 3, niveau: 2,
  motif: [[60, "145%"], [240, "50%"]], sansFin: true, parSerie: [3, 5], entre: [300, "50%"], maxSeries: 2, plafond: 10, minD: 20, maxD: 60,
  pourquoi: "Coggan L6 (121-150 % FTP) 30''-2' : capacité anaérobie / tolérance lactique (Laursen 2010 ; Buchheit & Laursen 2013 cible « anaérobie »). Récup 1:4 pour garder la qualité." },
{ id: "sprints-lances", famille: "explosif", nom: "Les sprints lancés", classique: "", sentir: "12 secondes à fond, jambes qui tournent vite, puis presque 5 minutes pour récupérer", intensite: 2, niveau: 1,
  motif: [[12, "230%"], [288, "55%"]], sansFin: true, parSerie: [3, 4], entre: [300, "55%"], maxSeries: 3, plafond: 12, complement: COMPLEMENTS.velocite, minD: 20, maxD: 90,
  pourquoi: "Neuromusculaire (Coggan L7) : sprints ≤ 15'' récup complète (PCr) ; Creer 2004 : sprints répétés améliorent la puissance chez cyclistes entraînés. Mode résistance (>150 %, ≤30'')." },
{ id: "departs-arretes", famille: "explosif", nom: "Les départs arrêtés", classique: "Standing starts", sentir: "10 secondes pour démarrer presque à l'arrêt en gros braquet, de toutes tes forces", intensite: 2, niveau: 2,
  motif: [[10, "250% @45"], [140, "55%"]], sansFin: true, parSerie: [4, 6], entre: [300, "55%"], maxSeries: 3, plafond: 18, minD: 20, maxD: 60,
  pourquoi: "Couple maximal départ basse cadence (« standing starts ») : force/puissance neuromusculaire spécifique ; preuves = muscu (Rønnestad 2015 force lourde), pratique piste/FFC. Résistance (>150 %, ≤30'')." },
{ id: "force-cote", famille: "explosif", nom: "La force en côte", classique: "", sentir: "une longue côte en gros braquet : les cuisses travaillent, le souffle reste calme", intensite: 2, niveau: 2,
  motif: [[360, "85% @55"], [165, "62% @95"]], sansFin: true, parSerie: [2, 5], plafond: 5, minD: 30, maxD: 60,
  pourquoi: "Force-endurance (50-60 tr/min, tempo) ; Paton 2009 : intervalles basse cadence > haute cadence sur puissance 4 mM ; preuves mitigées (Kristoffersen 2014), à doser si genoux sensibles." },
{ id: "trente-force", famille: "explosif", nom: "Les 30 secondes en force", classique: "Paton", sentir: "30 secondes très fort en gros braquet, puis 1 minute 30 tranquille", intensite: 3, niveau: 3,
  motif: [[30, "135% @65"], [90, "50%"]], sansFin: true, parSerie: [5, 8], entre: [240, "55%"], maxSeries: 3, plafond: 24, minD: 20, maxD: 60,
  pourquoi: "Paton, Hopkins & Cook 2009 (JSCR) : efforts intenses à 60-70 tr/min > 110-120 tr/min sur P60s (+2,5 %), Pmax (+3,6 %), P4mM (+7 %) chez routiers entraînés." },
// ── Comme en course
{ id: "peloton-nerveux", famille: "course", nom: "Le peloton nerveux", classique: "Surges", sentir: "un peloton qui roule vite et qui relance toutes les minutes", intensite: 3, niveau: 2,
  motif: [[45, "85%"], [15, "145%"]], parSerie: [8, 12], entre: [240, "55%"], maxSeries: 4, plafond: 44, complement: COMPLEMENTS.rythme, minD: 20, maxD: 90,
  pourquoi: "Reproduit la variabilité de puissance de la course (VI élevé) ; intensité variée = plus de temps aérobie haut (Bossi 2020) + répétition de recrutements rapides ; transfert spécifique." },
{ id: "tenir-attaque", famille: "course", nom: "Tenir après l'attaque", classique: "", sentir: "une attaque de 20 secondes, puis presque 6 minutes à tenir l'écart à ta limite", intensite: 3, niveau: 3,
  motif: [[20, "160%"], [340, "95%"], [240, "55%"]], sansFin: true, parSerie: [2, 4], plafond: 4, minD: 30, maxD: 60,
  pourquoi: "Seuil après un pic anaérobie : apprendre à tenir MLSS avec un débit lactique initial élevé (situation d'échappée) ; logique du fast-start (Mølmen & Rønnestad 2024), pratique Xert « breakaway »." },
{ id: "relais", famille: "course", nom: "Le relais", classique: "", sentir: "1 minute devant à fond de train, 1 minute dans la roue, comme une échappée à plusieurs", intensite: 3, niveau: 2,
  motif: [[60, "112%"], [60, "80%"]], parSerie: [6, 10], entre: [240, "55%"], maxSeries: 4, plafond: 32, minD: 20, maxD: 90,
  pourquoi: "Intermittent long 1/1 avec récup active haute (80 %) : temps élevé >90 % VO2max (Millet 2003 : 60/30 > 30/30), lactate recyclé en roulant ; spécifique du relais en échappée." },
{ id: "tempo-sprint", famille: "course", nom: "Le tempo puis le sprint", classique: "", sentir: "un sprint lancé alors que tes jambes sont déjà chargées par le rythme", intensite: 3, niveau: 2,
  motif: [[210, "88%"], [15, "200%"], [135, "55%"]], sansFin: true, parSerie: [2, 11], plafond: 11, minD: 20, maxD: 90,
  pourquoi: "Puissance en état de fatigue (« durabilité », Maunder 2021) : la course se joue après des efforts ; la répétition tempo → sprint entraîne le maintien du sprint pré-fatigué." },
];

const TESTS: Gabarit[] = [
  { id: "rampe", famille: "test", nom: "L'escalier (mesure ta forme)", sentir: "Les watts montent chaque minute jusqu'à ce que tu ne suives plus. Il mesure ta FTP et ton cœur max.", intensite: 3, niveau: 1, test: "rampe" },
  { id: "lsct", famille: "test", nom: "Check-up vélo", sentir: "3 paliers à cœur fixe. Si tu pousses plus fort pour le même cœur, tu as progressé.", intensite: 2, niveau: 1, test: "lsct" },
];

export const GABARITS: Gabarit[] = [...DECOUVERTE, ...HABITUES, ...TESTS];

// ─── Ce que l'écran demande ───

export type SeanceCatalogue = {
  id: string; famille: Famille; nom: string; classique?: string; sentir: string; intensite: Intensite;
  texte: string | null; minutes: number | null; test?: "rampe" | "lsct";
};

/** Durée réelle (min) d'un texte court. */
export const minutesTexte = (texte: string) => Math.round(dureeTotale(depuisCourt(texte, 200).blocs) / 60);

/** Un hasard reproductible (« Les attaques » : même aperçu et même séance pour une même graine). */
export function hasardDe(graine: number): Hasard {
  let x = (graine * 2654435761) % 4294967296 || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}

/** Une séance construite pour D minutes, ou null si elle n'a pas sa place à cette durée. */
export function construire(g: Gabarit, D: number, f = 1, graine = 1): SeanceCatalogue | null {
  const base = { id: g.id, famille: g.famille, nom: g.nom, classique: g.classique || undefined, sentir: g.sentir, intensite: g.intensite };
  if (g.test) return { ...base, texte: null, minutes: null, test: g.test };
  if (D < (g.minD ?? 20) || D > (g.maxD ?? 90)) return null;
  const s = (D - eq(D) - rc(D)) * 60;
  let corps: Etape[] | null, plusEq = 0, plusRc = 0;
  if (g.construire) corps = g.construire(s, hasardDe(graine + D));
  else { const c = corpsSerie(g, s, f); corps = c?.etapes ?? null; plusEq = c?.plusEq ?? 0; plusRc = c?.plusRc ?? 0; }
  if (!corps?.length) return null;
  const texte = [`${dureeTexte(eq(D) * 60 + plusEq)} 50>68%`, versTexte(corps), `${dureeTexte(rc(D) * 60 + plusRc)} 60>45%`].join(", ");
  return { ...base, texte, minutes: minutesTexte(texte) };
}

/**
 * Les séances d'une famille pour un temps donné.
 * f : 1 pour un athlète ; moins pour un invité débutant (moins de répétitions).
 * niveauMax : cache les séances trop dures (invité débutant).
 */
export function seancesDe(famille: Famille, D: number, opts: { f?: number; niveauMax?: number; avecLsct?: boolean; graine?: number } = {}): SeanceCatalogue[] {
  return GABARITS.filter((g) => g.famille === famille && g.niveau <= (opts.niveauMax ?? 3) && (g.test !== "lsct" || opts.avecLsct))
    .map((g) => construire(g, D, opts.f ?? 1, opts.graine ?? 1))
    .filter((x): x is SeanceCatalogue => !!x);
}

/** Les sorties de la borne, dans l'ordre. */
export function seancesBorne(D: number, f = 1, graine = 1): SeanceCatalogue[] {
  return BORNE.map((id) => construire(GABARITS.find((g) => g.id === id)!, D, f, graine)).filter((x): x is SeanceCatalogue => !!x);
}

/** « Surprends-moi » : une séance au hasard parmi celles proposées. */
export const auHasard = <T,>(liste: T[], graine = Date.now()): T | null => (liste.length ? liste[Math.floor(hasardDe(graine)() * liste.length)] : null);

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
