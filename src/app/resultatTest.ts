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

/** « 4 nov. » (fr-FR, mois abrégé) */
export const dateCarte = (jour: string): string => dateDe(jour).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

/**
 * La ligne grise sous la valeur de la carte : « 4 nov. · ton 1er test » ou
 * « 13 janv. · +12 W depuis le 4 nov. » (écart dans la même grandeur, sans couleur).
 */
export function phraseCarte(jour: string, precedent: { valeur: number; jour: string } | null, actuel: number, unite: "W" | "km/h"): string {
  if (!precedent) return `${dateCarte(jour)} · ton 1er test`;
  const e = unite === "km/h" ? Math.round((actuel - precedent.valeur) * 10) / 10 : Math.round(actuel - precedent.valeur);
  const depuis = `le ${dateCarte(precedent.jour)}`;
  if (e === 0) return `${dateCarte(jour)} · pareil que ${depuis}`;
  const abs = unite === "km/h" ? Math.abs(e).toFixed(1).replace(".", ",") : String(Math.abs(e));
  return `${dateCarte(jour)} · ${e > 0 ? "+" : "−"}${abs} ${unite} depuis ${depuis}`;
}

/** « début janvier » : quand refaire un test (8 semaines après), ou null si c'est déjà passé. */
export function quandProchainTest(jour: string, aujourdhui: Date = new Date()): string | null {
  const d = dateDe(jour);
  d.setDate(d.getDate() + 56);
  if (d.getTime() < aujourdhui.getTime()) return null;
  let mois = d.getMonth(), quand: string;
  const j = d.getDate();
  if (j <= 10) quand = "début";
  else if (j <= 20) quand = "mi";
  else if (j <= 26) quand = "fin";
  else { quand = "début"; mois = (mois + 1) % 12; }
  return quand === "mi" ? `mi-${MOIS[mois]}` : `${quand} ${MOIS[mois]}`;
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

// ─────────────────────────────────────────────────────────────────────────
// L'onglet « Mes tests » en 3 étages : tes repères, ton prochain test, ton parcours.
// ─────────────────────────────────────────────────────────────────────────

export type ResTest = { session_id: string; jour: string; protocole: string; valide?: boolean | null; indicateur?: number | null; detail?: Record<string, number | null | undefined> | null };
export type CleRepere = "ftp" | "fcvelo" | "vma" | "dix_km" | "checkup_velo" | "checkup_course";
export type Unite = "W" | "km/h" | "bpm" | "/km";
type Def = { protocole: string; sport: "velo" | "course"; unite: Unite; mot: string; court: string; principal: boolean };
export const REPERES: Record<CleRepere, Def> = {
  ftp: { protocole: "rampe", sport: "velo", unite: "W", mot: "ta FTP", court: "FTP", principal: true },
  fcvelo: { protocole: "rampe", sport: "velo", unite: "bpm", mot: "ton cœur max à vélo", court: "Cœur max vélo", principal: false },
  vma: { protocole: "progressif", sport: "course", unite: "km/h", mot: "ta vitesse max (VMA)", court: "VMA", principal: true },
  dix_km: { protocole: "defi", sport: "course", unite: "/km", mot: "ton 10 km", court: "10 km", principal: true },
  checkup_velo: { protocole: "lsct", sport: "velo", unite: "W", mot: "check-up vélo", court: "Check-up vélo", principal: false },
  checkup_course: { protocole: "tranquille", sport: "course", unite: "bpm", mot: "check-up course", court: "Check-up course", principal: false },
};
/** Les repères qu'on montre en tuile vide quand ils manquent (jamais plus de 3). */
export const PRINCIPAUX: CleRepere[] = ["vma", "ftp", "dix_km"];

/** Valeur chiffrée d'un test pour un repère, ou null si le test n'a rien donné. */
export function valeurRepere(cle: CleRepere, r: ResTest): number | null {
  if (r.protocole !== REPERES[cle].protocole || r.valide === false) return null;
  const brut = cle === "ftp" ? r.detail?.ftp : cle === "fcvelo" ? r.detail?.fc_max : cle === "vma" ? r.detail?.vma_kmh : r.indicateur;
  const n = Number(brut);
  return brut != null && Number.isFinite(n) && n > 0 ? n : null;
}
/** Les repères d'un résultat : la rampe en donne deux (FTP, et cœur max à vélo si le test le donne). */
export const clesDe = (protocole: string): CleRepere[] =>
  protocole === "rampe" ? ["ftp", "fcvelo"] : protocole === "progressif" ? ["vma"] : protocole === "defi" ? ["dix_km"] : protocole === "lsct" ? ["checkup_velo"] : protocole === "tranquille" ? ["checkup_course"] : [];

/** « 285 », « 17,5 », « 4:30 » : la valeur seule, sans unité. */
export function texteValeur(cle: CleRepere, n: number): string {
  const u = REPERES[cle].unite;
  return u === "km/h" ? n.toFixed(1).replace(".", ",") : u === "/km" ? `${Math.floor(Math.round(n) / 60)}:${String(Math.round(n) % 60).padStart(2, "0")}` : String(Math.round(n));
}

/** Plus de 8 semaines : « à refaire » (jamais une alerte, juste un rappel). */
export function estAJour(jour: string, aujourdhui: Date = new Date()): boolean {
  return Math.round((aujourdhui.getTime() - dateDe(jour).getTime()) / 86400000) <= 56;
}

/** L'écart avec le test d'avant dans la même unité : « +12 W », « +0,3 », « −5 s/km », « 1er ». */
export function ecartLigne(cle: CleRepere, actuel: number, precedent: number | null): string {
  if (precedent == null) return "1er";
  const u = REPERES[cle].unite;
  const e = u === "km/h" ? Math.round((actuel - precedent) * 10) / 10 : Math.round(actuel - precedent);
  if (e === 0) return "pareil";
  const abs = u === "km/h" ? Math.abs(e).toFixed(1).replace(".", ",") : String(Math.abs(e));
  const suffixe = u === "km/h" ? "" : u === "/km" ? " s/km" : ` ${u}`;
  return `${e > 0 ? "+" : "−"}${abs}${suffixe}`;
}

export type Repere = { cle: CleRepere; valeur: number; jour: string; session_id: string; aJour: boolean };

/** Le dernier résultat de chaque repère qui existe dans les données. */
export function reperesDe(resultats: ResTest[], aujourdhui: Date = new Date()): Repere[] {
  const tri = [...resultats].sort((a, b) => a.jour.localeCompare(b.jour));
  const sortie: Repere[] = [];
  for (const cle of Object.keys(REPERES) as CleRepere[]) {
    for (let i = tri.length - 1; i >= 0; i--) {
      const v = valeurRepere(cle, tri[i]);
      if (v != null) { sortie.push({ cle, valeur: v, jour: tri[i].jour, session_id: tri[i].session_id, aJour: estAJour(tri[i].jour, aujourdhui) }); break; }
    }
  }
  return sortie;
}
/** Les repères principaux pas encore testés, trois au plus. */
export const reperesVides = (reperes: Repere[]): CleRepere[] => PRINCIPAUX.filter((c) => !reperes.some((r) => r.cle === c)).slice(0, 3);

export type Prochain = { cle: CleRepere; protocole: string; manque: boolean; titre: string; phrase: string } | { cle: null; tout_a_jour: true; phrase: string };

/** Le test à proposer : un principal qui manque d'abord, sinon le plus ancien ; « tout est à jour » sinon. */
export function prochainTestConseille(reperes: Repere[], aujourdhui: Date = new Date()): Prochain | null {
  const vides = reperesVides(reperes);
  const titres: Record<CleRepere, string> = { ftp: "Mesurer ta FTP", vma: "Mesurer ta VMA", dix_km: "Tester ton 10 km", fcvelo: "Mesurer ton cœur max à vélo", checkup_velo: "Faire un check-up vélo", checkup_course: "Faire un check-up course" };
  if (vides.length) {
    const cle = vides[0];
    const phrase = cle === "vma" ? "Pas encore testée : c'est le bon moment pour connaître tes allures de course."
      : cle === "ftp" ? "Pas encore testée : c'est le bon moment pour connaître tes niveaux d'effort à vélo."
      : "Pas encore testé : c'est le bon moment pour connaître ton allure sur 10 km.";
    return { cle, protocole: REPERES[cle].protocole, manque: true, titre: titres[cle], phrase };
  }
  const candidats = reperes.filter((r) => r.cle !== "fcvelo").sort((a, b) => a.jour.localeCompare(b.jour));
  if (!candidats.length) return null;
  const vieux = candidats[0];
  if (!estAJour(vieux.jour, aujourdhui)) {
    return { cle: vieux.cle, protocole: REPERES[vieux.cle].protocole, manque: false, titre: titres[vieux.cle], phrase: `Le dernier date du ${jourLong(vieux.jour)} : refais-le pour garder tes allures justes.` };
  }
  return { cle: null, tout_a_jour: true, phrase: `Tout est à jour. Prochain test conseillé : ${quandProchainTest(vieux.jour, aujourdhui) ?? "dès que tu peux"}.` };
}

export type LigneParcours = { session_id: string; jour: string; cle: CleRepere; nom: string; valeur: string; ecart: string };
/** Tous les tests qui ont donné un chiffre, du plus récent au plus ancien, avec l'écart au test d'avant. */
export function parcours(resultats: ResTest[]): LigneParcours[] {
  const tri = [...resultats].sort((a, b) => a.jour.localeCompare(b.jour));
  const lignes: LigneParcours[] = [];
  const dernier: Partial<Record<CleRepere, number>> = {};
  for (const r of tri) {
    const cle = clesDe(r.protocole)[0];
    if (!cle) continue;
    const v = valeurRepere(cle, r);
    if (v == null) continue;
    lignes.push({ session_id: r.session_id, jour: r.jour, cle, nom: REPERES[cle].court, valeur: `${texteValeur(cle, v)}${REPERES[cle].unite === "km/h" ? " km/h" : REPERES[cle].unite === "/km" ? " /km" : ` ${REPERES[cle].unite}`}`, ecart: ecartLigne(cle, v, dernier[cle] ?? null) });
    dernier[cle] = v;
  }
  return lignes.reverse();
}
