// Fichier partagé app ↔ site : copie de App-Coach/lib/dessin-seance.ts — garder les deux identiques.
// ─────────────────────────────────────────────────────────────────────────
// Dessin d'une séance prévue : texte intervals.icu (sessions.workout_text)
// → parties à dessiner en blocs (largeur = durée, hauteur = effort).
// Fonction pure, sans IA. Un texte illisible rend [] : la fiche garde alors
// le texte seul. (lib/ht/seance.ts ignore les distances, d'où ce lecteur.)
// ─────────────────────────────────────────────────────────────────────────

export type Niveau = "tranquille" | "moyen" | "vite";

export type EtapeDessin = {
  secondes: number;          // largeur du dessin (estimée si la ligne est une distance)
  dureeLue: boolean;         // false = distance : durée estimée
  metres: number | null;
  allure: string | null;     // « 4:20/km »
  pct: [number, number] | null; // % de la puissance seuil (vélo), [bas, haut] ; une rampe ou une plage a deux bornes
  cadence: number | null;    // tours de pédale par minute si la ligne la donne
  niveau: Niveau;
};

/** Une partie de la séance : une étape seule, ou une série répétée (plusieurs étapes). */
export type PartieDessin = {
  libelle: string;           // « Échauffement », « Retour au calme », « Effort »…
  repetitions: number;
  etapes: EtapeDessin[];
};

const DUREE = /^(?:(\d+)h)?(?:(\d+)m(?!tr))?(?:(\d+)s)?$/;
const DISTANCE = /^(\d+(?:[.,]\d+)?)(mtr|km)$/;
const ALLURE = /(\d{1,2}):(\d{2})\/km/;
const ALLURE_DEFAUT = 360;   // s/km quand une distance n'a aucune allure : 6:00/km

const secondesAllure = (a: string) => { const m = ALLURE.exec(a); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

// Effort lu dans la ligne : % (puissance/seuil) ou zone ; null si rien de tel.
function scoreLigne(ligne: string): number | null {
  const l = ligne.toLowerCase();
  const p = /(\d+(?:\.\d+)?)%(?:\s*-\s*(\d+(?:\.\d+)?)%)?/.exec(l);
  if (p && !/pace|hr|lthr|mhr/.test(l.slice(p.index, p.index + p[0].length + 6))) {
    return p[2] ? (Number(p[1]) + Number(p[2])) / 2 : Number(p[1]);
  }
  const z = /\bz([1-7])\b/.exec(l);
  if (z) return [0, 55, 70, 83, 98, 110, 120, 130][Number(z[1])];
  return null;
}

// Puissance en % lue dans la ligne (« 62% », « 60-70% », « ramp 45%-60% ») ; jamais une allure ni une FC.
export function lirePct(ligne: string): [number, number] | null {
  const l = ligne.toLowerCase();
  const m = /(\d+(?:\.\d+)?)%?\s*-\s*(\d+(?:\.\d+)?)%|(\d+(?:\.\d+)?)%/.exec(l);
  if (!m || /pace|hr|lthr|mhr/.test(l.slice(m.index, m.index + m[0].length + 6))) return null;
  return m[3] != null ? [Number(m[3]), Number(m[3])] : [Number(m[1]), Number(m[2])];
}
const lireCadence = (ligne: string): number | null => { const m = /(\d{2,3})\s*rpm/i.exec(ligne); return m ? Number(m[1]) : null; };

/** Watts (arrondis à 5 W) pour une étape, sans « % » ni « FTP » ; null sans FTP ou sans pourcentage. */
export function wattsMots(pct: [number, number] | null, cadence: number | null, ftp: number | null | undefined): string | null {
  if (!pct || !ftp || ftp <= 0) return null;
  const w = (x: number) => Math.round((x * ftp) / 100 / 5) * 5;
  const [a, b] = [w(pct[0]), w(pct[1])];
  return `${a === b ? a : `${Math.min(a, b)}-${Math.max(a, b)}`} W${cadence ? ` · ${cadence} tr/min` : ""}`;
}
const niveauDe = (s: number): Niveau => (s < 78 ? "tranquille" : s < 92 ? "moyen" : "vite");

type Brute = { section: string; fois: number; jeton: string; ligne: string };

function etapeDe(b: Brute): Omit<EtapeDessin, "niveau"> | null {
  const mots = b.ligne.replace(/^press\s+lap\s+/i, "").split(/\s+/);
  const jeton = (mots[0] ?? "").toLowerCase();
  const allureTxt = ALLURE.exec(b.ligne);
  const allure = allureTxt ? `${Number(allureTxt[1])}:${allureTxt[2]}/km` : null;
  const pct = lirePct(b.ligne), cadence = lireCadence(b.ligne);
  const d = DUREE.exec(jeton);
  if (d && (d[1] || d[2] || d[3])) {
    return { secondes: Number(d[1] ?? 0) * 3600 + Number(d[2] ?? 0) * 60 + Number(d[3] ?? 0), dureeLue: true, metres: null, allure, pct, cadence };
  }
  const k = DISTANCE.exec(jeton);
  if (k) {
    const km = Number(k[1].replace(",", ".")) / (k[2] === "mtr" ? 1000 : 1);
    const parKm = allure ? secondesAllure(allure)! : ALLURE_DEFAUT;
    return { secondes: Math.max(1, Math.round(km * parKm)), dureeLue: false, metres: Math.round(km * 1000), allure, pct, cadence };
  }
  return null;
}

export function lireDessin(texte: string | null | undefined): PartieDessin[] {
  if (!texte || !texte.trim()) return [];
  // 1. Lignes → étapes brutes, regroupées par section (une ligne vide ferme la section).
  const sections: { titre: string; fois: number; lignes: Brute[] }[] = [];
  let cour: (typeof sections)[number] | null = null;
  for (const brute of texte.split("\n")) {
    const l = brute.trim();
    if (!l) { cour = null; continue; }
    if (!l.startsWith("-")) {
      const r = /(\d+)x\s*$/i.exec(l);
      cour = { titre: l, fois: r ? Number(r[1]) : 1, lignes: [] };
      sections.push(cour);
      continue;
    }
    if (!cour) { cour = { titre: "", fois: 1, lignes: [] }; sections.push(cour); }
    cour.lignes.push({ section: cour.titre, fois: cour.fois, jeton: "", ligne: l.slice(1).trim() });
  }
  const pleines = sections.filter((s) => s.lignes.length);
  if (!pleines.length) return [];

  // Allure la plus rapide du texte, pour situer une étape sans pourcentage.
  const toutes = pleines.flatMap((s) => s.lignes.map((b) => ALLURE.exec(b.ligne) ? secondesAllure(b.ligne) : null)).filter((x): x is number => x != null);
  const rapide = toutes.length ? Math.min(...toutes) : null;

  const parties: PartieDessin[] = [];
  for (let i = 0; i < pleines.length; i++) {
    const s = pleines[i];
    const t = s.titre.toLowerCase();
    const echauf = /warm|échauff|echauff/.test(t) || (i === 0 && pleines.length > 1 && s.fois === 1 && !t);
    const calme = /cool|retour|calme/.test(t);
    const lus = s.lignes.map((b) => ({ b, e: etapeDe(b), sc: scoreLigne(b.ligne), al: ALLURE.exec(b.ligne) ? secondesAllure(b.ligne) : null }));
    if (lus.some((x) => !x.e)) return [];            // une ligne illisible : on ne dessine pas de travers
    const serie = s.fois > 1 && lus.length >= 1;
    const niveaux: Niveau[] = lus.map((x) => {
      if (echauf || calme) return "tranquille";
      if (x.sc != null) return niveauDe(x.sc);
      return "moyen";
    });
    if (!echauf && !calme) {
      // Étapes sans pourcentage : par la structure et les allures.
      const ref = lus.map((x) => x.al).filter((a): a is number => a != null);
      const meilleur = ref.length ? Math.min(...ref) : null;
      lus.forEach((x, k) => {
        if (x.sc != null) return;
        if (serie) {
          if (lus.length === 1) niveaux[k] = "vite";
          else if (meilleur != null && x.al != null) niveaux[k] = x.al <= meilleur * 1.04 ? "vite" : "tranquille";
          else niveaux[k] = lus.some((y) => y.sc != null) || k === 0 ? "vite" : "tranquille";
        } else {
          niveaux[k] = x.al != null && rapide != null && x.al <= rapide * 1.04 ? "vite" : "moyen";
        }
      });
    }
    const libelle = echauf ? "Échauffement" : calme ? "Retour au calme" : "Effort";
    const etapes = lus.map((x, k) => ({ ...x.e!, niveau: niveaux[k] }));
    if (serie) parties.push({ libelle, repetitions: s.fois, etapes });
    else etapes.forEach((e) => parties.push({ libelle, repetitions: 1, etapes: [e] }));
  }
  return parties.length >= 2 ? parties : [];
};

// ─── Mots simples ───

export function dureeMots(s: number): string {
  s = Math.round(s);
  if (s >= 3600) { const m = Math.round((s % 3600) / 60); return m ? `${Math.floor(s / 3600)} h ${String(m).padStart(2, "0")}` : `${s / 3600} h`; }
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60), r = s % 60;
  return r ? `${m} min ${String(r).padStart(2, "0")}` : `${m} min`;
}
const metresMots = (m: number) => (m >= 2000 && m % 1000 === 0 ? `${m / 1000} km` : `${m} m`);
export const effortMots = (e: EtapeDessin) => (e.metres != null ? metresMots(e.metres) : dureeMots(e.secondes));
const NIVEAU_MOTS: Record<Niveau, string> = { tranquille: "tranquille", moyen: "à allure moyenne", vite: "vite" };

export type LigneLegende = { niveau: Niveau; texte: string; valeur: string | null; petit: boolean };

/** La légende : une ligne par partie, en mots simples. */
export function legende(parties: PartieDessin[], ftp?: number | null): LigneLegende[] {
  const W = (e: EtapeDessin) => wattsMots(e.pct, e.cadence, ftp);
  const out: LigneLegende[] = [];
  for (const p of parties) {
    if (p.repetitions === 1) {
      const e = p.etapes[0];
      const nom = p.libelle === "Effort" ? `${e.metres != null ? effortMots(e) : "Effort"} ${NIVEAU_MOTS[e.niveau]}`.replace(/^Effort /, "Effort ") : p.libelle;
      const base = p.libelle === "Effort" ? (e.allure ?? (e.metres == null ? dureeMots(e.secondes) : null)) : dureeMots(e.secondes);
      const w = W(e);
      out.push({ niveau: e.niveau, texte: nom, valeur: w ? (base && !e.allure ? `${base} · ${w}` : (e.allure ?? w)) : base, petit: false });
      continue;
    }
    const [a, ...reste] = p.etapes;
    out.push({ niveau: a.niveau, texte: `${p.repetitions} fois ${effortMots(a)} ${NIVEAU_MOTS[a.niveau]}`, valeur: a.allure ?? W(a), petit: false });
    reste.forEach((e) => out.push({
      niveau: e.niveau, petit: true, valeur: e.allure ?? W(e),
      texte: reste.length === 1 ? `${effortMots(e)} ${NIVEAU_MOTS[e.niveau]} entre chaque` : `Puis ${effortMots(e)} ${NIVEAU_MOTS[e.niveau]}`,
    }));
  }
  return out;
}
