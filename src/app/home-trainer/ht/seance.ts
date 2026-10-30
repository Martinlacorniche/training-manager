// ─────────────────────────────────────────────────────────────────────────
// Home-trainer (30/10/2026) : une séance de vélo en étapes pilotables.
// Deux écritures d'entrée :
//   - le « workout language » d'intervals.icu, celui que portent les séances
//     du coach (sessions.workout_text) ;
//   - l'écriture courte pour les séances faites à la main :
//       10' 150W, 5x(4' 300W / 3' 150W), 10' 140W
// Les deux donnent la même liste d'étapes, qui se réécrit dans les deux sens
// (les blocs à boutons éditent les étapes, le texte suit).
// Copie de App-Coach/lib/ht/seance.ts — garder les deux identiques.
// ─────────────────────────────────────────────────────────────────────────

export type Cible =
  | { type: "w"; min: number; max: number }       // watts (une valeur : min = max)
  | { type: "bpm"; min: number; max: number }     // cardio : l'app règle les watts pour y rester
  | { type: "libre" };                            // pas de cible : watts libres, réglables

export type Etape = {
  s: number;                 // durée en secondes
  cible: Cible;
  rampe?: { de: number; a: number };  // watts, de → à sur la durée de l'étape
  cadence?: number;          // tr/min conseillés
  lap?: boolean;             // se termine à l'appui sur « suivant » (durée = estimation)
};

// Un bloc répété garde sa structure pour l'affichage et la réécriture.
export type Bloc = { fois: number; etapes: Etape[] };

export const LIBRE_PCT = 0.55;          // watts d'une étape sans cible, en part de FTP
const ZONES: Record<string, number> = { z1: 0.5, z2: 0.65, z3: 0.83, z4: 0.98, z5: 1.13, z6: 1.3, z7: 1.6 };

export const aplatir = (blocs: Bloc[]): Etape[] => blocs.flatMap((b) => Array.from({ length: b.fois }, () => b.etapes).flat());
export const dureeTotale = (blocs: Bloc[]) => aplatir(blocs).reduce((a, e) => a + e.s, 0);

/** Watts visés à `t` secondes du début de l'étape (avant ajustement). */
export function wattsCibles(e: Etape, t: number, ftp: number): number {
  if (e.rampe) return Math.round(e.rampe.de + (e.rampe.a - e.rampe.de) * Math.min(1, t / Math.max(1, e.s)));
  if (e.cible.type === "w") return Math.round((e.cible.min + e.cible.max) / 2);
  return Math.round(ftp * LIBRE_PCT);
}

// ─── Lecture commune d'une cible ───

// « 4m », « 1m30s », « 1h10m » (icu) ; « 4' », « 1'30 », « 30" », « 30s », « 10min », « 1h » (court).
export function lireDuree(j: string): number | null {
  const t = j.toLowerCase().replace(/’/g, "'").replace(/″|''/g, '"');
  let m = /^(?:(\d+)h)?(?:(\d+)(?:m(?!tr)|min|'))?(?:(\d+)(?:s|"|sec)?)?$/.exec(t);
  if (m && (m[1] || m[2] || m[3])) {
    // « 30 » tout seul n'est pas une durée ; « 1'30 » oui.
    if (!m[1] && !m[2] && !/s|"|sec$/.test(t)) return null;
    return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  }
  m = /^(\d+(?:[.,]\d+)?)h$/.exec(t);
  if (m) return Math.round(Number(m[1].replace(",", ".")) * 3600);
  return null;
}

type Lu = { cible: Cible; rampe?: { de: number; a: number }; cadence?: number };

// Une valeur de puissance : « 250w », « 105% », « 55-65% », « 302w-342w », « z2 ».
function puissance(j: string, ftp: number): [number, number] | null {
  const t = j.toLowerCase();
  let m = /^(\d+(?:\.\d+)?)%?-(\d+(?:\.\d+)?)%$/.exec(t);
  if (m) return [ftp * Number(m[1]) / 100, ftp * Number(m[2]) / 100];
  m = /^(\d+(?:\.\d+)?)%(?:ftp)?$/.exec(t);
  if (m) return [ftp * Number(m[1]) / 100, ftp * Number(m[1]) / 100];
  m = /^(\d+)w?-(\d+)w$/.exec(t);
  if (m) return [Number(m[1]), Number(m[2])];
  m = /^(\d+)w$/.exec(t);
  if (m) return [Number(m[1]), Number(m[1])];
  if (ZONES[t]) return [ftp * ZONES[t], ftp * ZONES[t]];
  return null;
}

function lireCible(jetons: string[], ftp: number): Lu {
  let cible: Cible = { type: "libre" }, rampe: Lu["rampe"], cadence: number | undefined;
  for (let i = 0; i < jetons.length; i++) {
    const t = jetons[i].toLowerCase();
    const cad = /^@?(\d{2,3})(?:rpm|tr\/?min)$/.exec(t) ?? /^@(\d{2,3})$/.exec(t);
    if (cad) { cadence = Number(cad[1]); continue; }
    const bpm = /^(\d{2,3})(?:bpm)?-(\d{2,3})bpm$/.exec(t) ?? /^(\d{2,3})bpm$/.exec(t);
    if (bpm) { cible = { type: "bpm", min: Number(bpm[1]), max: Number(bpm[2] ?? bpm[1]) }; continue; }
    // Rampe : « ramp 50-75% » (icu), « 100>200w » (court)
    if (t === "ramp" && jetons[i + 1]) {
      const p = puissance(jetons[++i], ftp);
      if (p) rampe = { de: Math.round(p[0]), a: Math.round(p[1]) };
      continue;
    }
    const fl = /^(\d+(?:\.\d+)?)(%|w)?>(\d+(?:\.\d+)?)(%|w)$/.exec(t);
    if (fl) {
      const u = fl[2] ?? fl[4], k = (x: string) => (u === "%" ? ftp * Number(x) / 100 : Number(x));
      rampe = { de: Math.round(k(fl[1])), a: Math.round(k(fl[3])) };
      continue;
    }
    const p = puissance(t, ftp);
    if (p) cible = { type: "w", min: Math.round(p[0]), max: Math.round(p[1]) };
  }
  if (rampe) cible = { type: "w", min: Math.min(rampe.de, rampe.a), max: Math.max(rampe.de, rampe.a) };
  return { cible, rampe, cadence };
}

// ─── intervals.icu ───

export function depuisIcu(texte: string, ftp: number): Bloc[] {
  const blocs: Bloc[] = [];
  let courant: Bloc | null = null;
  for (const brute of texte.split("\n")) {
    const l = brute.trim();
    if (!l) { courant = null; continue; }
    if (!l.startsWith("-")) {
      const r = /(\d+)x\s*$/i.exec(l);
      courant = { fois: r ? Number(r[1]) : 1, etapes: [] };
      blocs.push(courant);
      continue;
    }
    let corps = l.slice(1).trim();
    const lap = /^press\s+lap\s+/i.test(corps);
    corps = corps.replace(/^press\s+lap\s+/i, "");
    const jetons = corps.split(/\s+/).filter(Boolean);
    const s = lireDuree(jetons[0] ?? "");
    if (s == null) continue;                    // distance ou ligne illisible : ignorée
    // « 55-65% » peut s'écrire « 55% - 65% » : on recolle
    const reste = jetons.slice(1).join(" ").replace(/\s*-\s*/g, "-").split(/\s+/).filter(Boolean);
    const e: Etape = { s, ...lireCible(reste, ftp), ...(lap ? { lap: true } : {}) };
    if (!courant) { courant = { fois: 1, etapes: [] }; blocs.push(courant); }
    courant.etapes.push(e);
  }
  return blocs.filter((b) => b.etapes.length);
}

const cibleIcu = (e: Etape) => {
  if (e.rampe) return `ramp ${e.rampe.de}w-${e.rampe.a}w`;
  if (e.cible.type === "w") return e.cible.min === e.cible.max ? `${e.cible.min}w` : `${e.cible.min}w-${e.cible.max}w`;
  if (e.cible.type === "bpm") return e.cible.min === e.cible.max ? `${e.cible.min}bpm` : `${e.cible.min}-${e.cible.max}bpm`;
  return "";
};
const dureeIcu = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return `${h ? `${h}h` : ""}${m ? `${m}m` : ""}${r ? `${r}s` : ""}` || "0s";
};

export function versIcu(blocs: Bloc[]): string {
  return blocs.map((b, i) => [
    b.fois > 1 ? `Main Set ${b.fois}x` : (i === 0 ? "Warmup" : i === blocs.length - 1 && blocs.length > 1 ? "Cooldown" : "Main Set"),
    ...b.etapes.map((e) => `- ${e.lap ? "Press lap " : ""}${[dureeIcu(e.s), cibleIcu(e), e.cadence ? `${e.cadence}rpm` : ""].filter(Boolean).join(" ")}`),
  ].join("\n")).join("\n\n");
}

// ─── Écriture courte ───

const dureeCourte = (s: number) => {
  if (s % 3600 === 0) return `${s / 3600}h`;
  if (s < 60) return `${s}"`;
  const m = Math.floor(s / 60), r = s % 60;
  return r ? `${m}'${String(r).padStart(2, "0")}` : `${m}'`;
};
function etapeCourte(e: Etape): string {
  const c = e.rampe ? `${e.rampe.de}>${e.rampe.a}W`
    : e.cible.type === "w" ? (e.cible.min === e.cible.max ? `${e.cible.min}W` : `${e.cible.min}-${e.cible.max}W`)
    : e.cible.type === "bpm" ? (e.cible.min === e.cible.max ? `${e.cible.min}bpm` : `${e.cible.min}-${e.cible.max}bpm`) : "";
  return [e.lap ? "lap" : "", dureeCourte(e.s), c, e.cadence ? `@${e.cadence}` : ""].filter(Boolean).join(" ");
}

export function versCourt(blocs: Bloc[]): string {
  return blocs.map((b) => b.fois > 1
    ? `${b.fois}x(${b.etapes.map(etapeCourte).join(" / ")})`
    : b.etapes.map(etapeCourte).join(", ")).join(", ");
}

export type Lecture = { blocs: Bloc[]; erreurs: string[] };

/** « 10' 150W, 5x(4' 300W / 3' 150W), 10' 140W » → blocs. Virgules ou retours à la ligne. */
export function depuisCourt(texte: string, ftp: number): Lecture {
  const blocs: Bloc[] = [], erreurs: string[] = [];
  // Découpe au premier niveau : les virgules dans une parenthèse restent dedans.
  const morceaux: string[] = [];
  let prof = 0, cur = "";
  for (const ch of texte) {
    if (ch === "(") prof++;
    if (ch === ")") prof = Math.max(0, prof - 1);
    if ((ch === "," || ch === "\n" || ch === ";") && prof === 0) { morceaux.push(cur); cur = ""; } else cur += ch;
  }
  morceaux.push(cur);
  for (const brut of morceaux.map((x) => x.trim()).filter(Boolean)) {
    const rep = /^(\d+)\s*[x×]\s*\((.*)\)$/i.exec(brut);
    const fois = rep ? Number(rep[1]) : 1;
    const parties = rep ? rep[2].split(/[/+,]/) : [brut];
    const etapes: Etape[] = [];
    for (const p of parties.map((x) => x.trim()).filter(Boolean)) {
      const e = etapeDepuisCourt(p, ftp);
      if (e) etapes.push(e); else erreurs.push(`« ${p} » : il manque une durée (ex. 4' ou 30")`);
    }
    if (etapes.length && fois >= 1) blocs.push({ fois: Math.min(fois, 50), etapes });
  }
  return { blocs, erreurs };
}

function etapeDepuisCourt(p: string, ftp: number): Etape | null {
  let jetons = p.replace(/\s*-\s*/g, "-").replace(/\s*>\s*/g, ">").split(/\s+/).filter(Boolean);
  const lap = jetons.some((j) => j.toLowerCase() === "lap");
  jetons = jetons.filter((j) => j.toLowerCase() !== "lap");
  const i = jetons.findIndex((j) => lireDuree(j) != null);
  if (i < 0) return null;
  const s = lireDuree(jetons[i])!;
  if (s <= 0) return null;
  return { s, ...lireCible(jetons.filter((_, k) => k !== i), ftp), ...(lap ? { lap: true } : {}) };
}
