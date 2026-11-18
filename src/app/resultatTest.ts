// La page de résultat d'un test : tout ce qui se calcule sans écran (niveaux
// d'effort, écart avec le test d'avant, date du prochain test, paliers de la
// rampe). Mêmes textes et mêmes calculs dans l'app (App-Coach, lib/resultatTest.ts).
// Les coefficients vélo sont ceux du barème serveur (supabase/functions/_shared/bareme.ts).

/** Les tests qui ont leur page de résultat ; les autres gardent l'ancienne page. */
export const PROTOCOLES_AVEC_PAGE = ["rampe", "progressif"] as const;
export const aUnePage = (p: unknown): boolean => p === "rampe" || p === "progressif";

export type Niveau = { cle: "tranquille" | "tempo" | "seuil" | "tres_dur"; nom: string; aide: string; couleur: string; texte: string };

const COULEURS = { tranquille: "#86efac", tempo: "#fde047", seuil: "#fdba74", tres_dur: "#a78bfa" } as const;
const AIDES = {
  tranquille: "tu peux parler sans effort",
  tempo: "soutenu, mais régulier",
  seuil: "dur, par blocs de 10 à 20 min",
  tres_dur: "quelques minutes seulement",
};
const NOMS = { tranquille: "Tranquille", tempo: "Tempo", seuil: "Seuil", tres_dur: "Très dur" } as const;

const arrondi5 = (x: number) => Math.round(x / 5) * 5;

/** Vélo : 4 niveaux en watts, depuis la FTP (50-70 %, 76-87 %, 91-105 %, 110 % et plus). */
export function niveauxVelo(ftp: number): Niveau[] {
  const w = (p: number) => arrondi5((ftp * p) / 100);
  const mk = (cle: Niveau["cle"], texte: string): Niveau => ({ cle, nom: NOMS[cle], aide: AIDES[cle], couleur: COULEURS[cle], texte });
  return [
    mk("tranquille", `${w(50)}–${w(70)} W`),
    mk("tempo", `${w(76)}–${w(87)} W`),
    mk("seuil", `${w(91)}–${w(105)} W`),
    mk("tres_dur", `${w(110)} W et +`),
  ];
}

export const allureKm = (kmh: number): string => {
  const s = Math.round(3600 / kmh);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Course : 4 niveaux en allures au km, depuis la VMA (65-75 %, 80-85 %, 88-92 %, 100 % et plus). */
export function niveauxCourse(vmaKmh: number): Niveau[] {
  const a = (p: number) => allureKm((vmaKmh * p) / 100);
  const mk = (cle: Niveau["cle"], texte: string): Niveau => ({ cle, nom: NOMS[cle], aide: AIDES[cle], couleur: COULEURS[cle], texte });
  return [
    mk("tranquille", `${a(75)}–${a(65)} /km`),
    mk("tempo", `${a(85)}–${a(80)} /km`),
    mk("seuil", `${a(92)}–${a(88)} /km`),
    mk("tres_dur", `${a(100)} /km et +`),
  ];
}

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MOIS_COURT = ["JAN", "FÉV", "MARS", "AVR", "MAI", "JUIN", "JUIL", "AOÛT", "SEPT", "OCT", "NOV", "DÉC"];
const dateDe = (jour: string) => new Date(`${jour.slice(0, 10)}T12:00:00`);

/** « 4 NOV » */
export const jourCourt = (jour: string): string => { const d = dateDe(jour); return `${d.getDate()} ${MOIS_COURT[d.getMonth()]}`; };
/** « 4 novembre » */
export const jourLong = (jour: string): string => { const d = dateDe(jour); return `${d.getDate()} ${MOIS[d.getMonth()]}`; };

export type Ecart = { titre: string; detail: string };

/**
 * L'écart avec le test d'avant, sans dramatiser : jamais de record ni de rouge.
 * `precedent` null = premier test. L'unité est « W » (vélo) ou « km/h » (course).
 */
export function ecartAvecPrecedent(actuel: number, precedent: { valeur: number; jour: string } | null, unite: "W" | "km/h", objet = "tes séances"): Ecart {
  if (!precedent) return { titre: "C'est ta base de départ.", detail: "Ce premier test sert de repère pour la suite." };
  const fmt = (x: number) => (unite === "km/h" ? x.toFixed(1).replace(".", ",") : String(Math.round(x)));
  const ecart = unite === "km/h" ? Math.round((actuel - precedent.valeur) * 10) / 10 : Math.round(actuel - precedent.valeur);
  const depuis = `depuis le ${jourLong(precedent.jour)}`;
  const de = `De ${fmt(precedent.valeur)} à ${fmt(actuel)} ${unite}`;
  if (ecart === 0) return { titre: `Pareil que le ${jourLong(precedent.jour)}.`, detail: `Toujours ${fmt(actuel)} ${unite} : ${objet} restent réglées comme avant.` };
  const signe = ecart > 0 ? "+" : "−";
  const valeurAbs = fmt(Math.abs(ecart));
  const suite = ecart > 0 ? `${objet} sont réglées un cran plus haut.` : `${objet} sont réglées un cran plus bas, au niveau d'aujourd'hui.`;
  return { titre: `${signe}${valeurAbs} ${unite} ${depuis}.`, detail: `${de} : ${suite}` };
}

/** Le prochain test : 8 semaines plus tard, dit en « début / mi / fin de mois ». */
export function prochainTest(jour: string, aujourdhui: Date = new Date()): string {
  const d = dateDe(jour);
  d.setDate(d.getDate() + 56);
  const fini = d.getTime() < aujourdhui.getTime();
  if (fini) return "Ça fait un moment : refais un test pour garder des séances bien réglées.";
  let mois = d.getMonth(), quand: string;
  const j = d.getDate();
  if (j <= 10) quand = "début";
  else if (j <= 20) quand = "mi";
  else if (j <= 26) quand = "fin";
  else { quand = "début"; mois = (mois + 1) % 12; }
  const nom = MOIS[mois];
  const lieu = quand === "mi" ? `mi-${nom}` : `${quand} ${nom}`;
  return `Refais un test dans 6 à 8 semaines, ${lieu}, pour garder des séances bien réglées.`;
}

export type Tour = { idx: number; duree_s: number | null; debut_s?: number | null; puissance: number | null; fc_fin: number | null; fc_max: number | null };
export type Palier = { w: number; fc: number | null; debut_s: number | null; duree_s: number };

/** Les marches d'une minute de la rampe (même règle que le serveur, _shared/tests.ts). */
export function paliersRampe(tours: Tour[]): Palier[] {
  let meilleure: Tour[] = [], cour: Tour[] = [];
  for (const t of [...tours].sort((a, b) => a.idx - b.idx)) {
    const minute = (t.duree_s ?? 0) >= 45 && (t.duree_s ?? 0) <= 75 && (t.puissance ?? 0) > 0;
    const monte = cour.length > 0 && (t.puissance ?? 0) >= 0.97 * (cour[cour.length - 1].puissance ?? 0) && t.idx === cour[cour.length - 1].idx + 1;
    if (minute && (!cour.length || monte)) cour.push(t);
    else { if (cour.length > meilleure.length) meilleure = cour; cour = minute ? [t] : []; }
  }
  if (cour.length > meilleure.length) meilleure = cour;
  if (meilleure.length < 5) return [];
  return meilleure.map((t) => {
    const fc = t.fc_fin ?? t.fc_max;
    return { w: Math.round(t.puissance ?? 0), fc: fc ? Math.round(fc) : null, debut_s: t.debut_s ?? null, duree_s: t.duree_s ?? 60 };
  });
}

/** Minutes écoulées depuis le départ de la séance quand la dernière marche se termine. */
export function minutesALarret(paliers: Palier[]): number | null {
  const d = paliers[paliers.length - 1];
  return d && d.debut_s != null ? Math.round((d.debut_s + d.duree_s) / 60) : null;
}
