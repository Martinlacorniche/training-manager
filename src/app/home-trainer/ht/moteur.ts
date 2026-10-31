// ─────────────────────────────────────────────────────────────────────────
// Home-trainer : le moteur de séance, sans Bluetooth ni écran. On lui donne
// les mesures (mesurer) et l'heure (tic, ~4 fois par seconde) ; il tient le
// chrono, choisit l'étape, calcule la consigne à envoyer au home-trainer et
// enregistre une mesure par seconde pour le fichier .fit.
//
// Sécurités, choisies avec Martin le 30/10/2026 :
//   - cadence qui s'effondre en ERG (< 55 tr/min pendant 5 s) : la consigne
//     tombe à 60 % jusqu'à ce que la cadence repasse 70, pour ne pas rester
//     planté sous le frein (la « spirale de la mort » de l'ERG). Une étape
//     de force à cadence basse (« @50 », 30/10) abaisse le seuil à cadence − 15 ;
//   - arrêt de pédalage 3 s : pause automatique, reprise dès qu'on repédale ;
//   - sprint (> 150 % FTP sur 30 s ou moins) : résistance plutôt qu'ERG,
//     l'ERG ne suit pas un sprint ;
//   - cible cardio : les watts montent ou descendent doucement (±5 W toutes
//     les 15 s) pour rester dans la plage.
// Copie de App-Coach/lib/ht/moteur.ts — garder les deux identiques.
// ─────────────────────────────────────────────────────────────────────────

import { aplatir, type Bloc, type Etape, wattsCibles, LIBRE_PCT } from "./seance";
import { altitudeA, penteA, type Col } from "./cols";

export type Consigne = { type: "erg"; w: number } | { type: "pente"; pct: number };
// c = watts visés ; x = position dans le dessin de la séance (s), pour y tracer les vrais watts
export type Point = { ts: number; w: number | null; cad: number | null; bpm: number | null; kmh: number; m: number; c: number | null; x: number };
export type Moyennes = { w: number | null; bpm: number | null; cad: number | null; s: number };

/** Le profil du cycliste, tiré de ce que l'app sait déjà (30/10/2026). */
export type Profil = { ftp: number; poids?: number | null; cp?: number | null; wPrime?: number | null; col?: Col | null };
export type Tour = { debut: number; fin: number; etape: number };   // indices dans `points`

export type Etat = {
  i: number; etape: Etape | null; suivante: Etape | null;
  tEtape: number; resteEtape: number | null; tTotal: number; dureeTotale: number;
  cible: number | null; consigne: Consigne;
  watts: number | null; cadence: number | null; bpm: number | null;
  pause: "non" | "manuelle" | "auto"; fini: boolean; erg: boolean; ajust: number; pente: number;
  alerte: string | null; attendLap: boolean;
  reserve: number | null;   // part de la réserve au-dessus de la puissance critique (0 à 1), si connue
  w3s: number | null;       // puissance lissée sur 3 s : celle qu'on affiche
  tour: Moyennes;           // le tour (l'étape) en cours
  tourPrec: Moyennes | null;
  seance: { w: number | null; kj: number; km: number };
  col: { d: number; total: number; pente: number; alt: number; kmh: number } | null;   // « Les grands cols »
};

const PAS = 1000;

export class Moteur {
  readonly etapes: Etape[];
  readonly ftp: number;
  points: Point[] = [];
  rr: { ts: number; s: number }[] = [];   // battements (ceinture), pour le .fit
  tours: Tour[] = [];
  private i = 0;
  private tEtape = 0;           // secondes chronométrées dans l'étape
  private tTotal = 0;
  private dernierTic = 0;
  private dernierPoint = 0;
  private pause: Etat["pause"] = "manuelle";   // on démarre au premier coup de pédale
  private demarre = false;
  private fini = false;
  private erg = true;
  private ajust = 1;            // −/+ 5 %
  private pente = 1;            // % en mode résistance
  private wBpm: number;         // watts tenus par la régulation cardio
  private derniereRegul = 0;
  private bas = 0;              // depuis quand la cadence est basse (ms), 0 = non
  private soulagement = false;
  private arret = 0;
  private debutTour = 0;
  private m = 0;                // distance (m)
  private recents: { t: number; w: number }[] = [];   // pour la puissance 3 s
  // Mesures : la plus récente de chaque source, avec son heure
  private ht: { w?: number; cad?: number; kmh?: number; t: number } = { t: 0 };
  private ped: { w?: number; cad?: number; t: number } = { t: 0 };
  private cardio: { bpm?: number; t: number } = { t: 0 };
  private match: { ht: number; ped: number }[] = [];

  private masse: number;
  private cp: number | null;
  private w0: number | null;
  private wBal: number | null;
  readonly col: Col | null;
  private dCol = 0;             // mètres montés sur le profil
  private kmh = 0;

  constructor(blocs: Bloc[], profil: Profil) {
    this.etapes = aplatir(blocs);
    const ftp = profil.ftp;
    this.ftp = ftp > 0 ? ftp : 200;
    this.masse = (profil.poids && profil.poids > 30 ? profil.poids : 72) + 9;   // + vélo
    // Réserve : modèle de la puissance critique (CP, W'), recharge de Skiba
    // (forme différentielle, Skiba et al. 2015) : elle se vide au-dessus de
    // CP du surplus de watts, se recharge en dessous d'autant plus vite
    // qu'on est loin sous CP et qu'elle est vide.
    this.cp = profil.cp && profil.cp > 50 ? profil.cp : null;
    this.w0 = this.cp && profil.wPrime && profil.wPrime > 1000 ? profil.wPrime : null;
    this.wBal = this.w0;
    // Un col : pas d'étapes, la pente du profil pilote le home-trainer (mode simulation)
    this.col = profil.col ?? null;
    if (this.col) this.erg = false;
    this.wBpm = Math.round(this.ftp * LIBRE_PCT);
    if (!this.etapes.length) this.erg = false;     // sortie libre : résistance
  }

  mesurer(src: "ht" | "pedales" | "cardio", m: { watts?: number; cadence?: number; vitesse?: number; bpm?: number; rr?: number[] }, t: number) {
    if (src === "ht") this.ht = { w: m.watts ?? this.ht.w, cad: m.cadence ?? this.ht.cad, kmh: m.vitesse ?? this.ht.kmh, t };
    if (src === "pedales") this.ped = { w: m.watts ?? this.ped.w, cad: m.cadence ?? this.ped.cad, t };
    if (src === "cardio" || m.bpm) this.cardio = { bpm: m.bpm, t };
    if (m.rr?.length && this.pause === "non" && !this.fini) for (const s of m.rr) if (s > 0.25 && s < 2.5) this.rr.push({ ts: t, s });
  }

  // Une mesure de plus de 3 s est périmée (capteur perdu, pédalier à l'arrêt).
  private frais = (t0: number, now: number) => now - t0 < 3000;
  private wattsMesures(now: number) {
    if (this.frais(this.ped.t, now) && this.ped.w != null) return this.ped.w;
    return this.frais(this.ht.t, now) ? this.ht.w ?? null : null;
  }
  private cadenceMesuree(now: number) {
    if (this.frais(this.ped.t, now) && this.ped.cad != null) return this.ped.cad;
    return this.frais(this.ht.t, now) ? this.ht.cad ?? null : null;
  }
  private bpmMesure(now: number) { return this.frais(this.cardio.t, now) ? this.cardio.bpm ?? null : null; }

  // ─── Commandes ───
  basculerPause() { this.pause = this.pause === "non" ? "manuelle" : "non"; this.demarre = true; }
  suivante() { if (this.i < this.etapes.length) this.passer(this.i + 1); }
  precedente() {
    // Au début d'une étape, revient à la précédente ; sinon recommence l'étape.
    this.passer(this.tEtape < 5 ? Math.max(0, this.i - 1) : this.i);
  }
  plus() { if (this.erg) this.ajust = Math.min(1.5, Math.round((this.ajust + 0.05) * 100) / 100); else this.pente = Math.min(15, this.pente + 1); }
  moins() { if (this.erg) this.ajust = Math.max(0.5, Math.round((this.ajust - 0.05) * 100) / 100); else this.pente = Math.max(-5, this.pente - 1); }
  basculerErg() { this.erg = !this.erg; }
  /** Toutes les étapes faites (et pas « Terminer » en cours de route). */
  get bouclee() { return this.etapes.length > 0 && this.i >= this.etapes.length; }
  terminer() { this.fermerTour(); this.fini = true; this.pause = "manuelle"; }

  private passer(j: number) {
    this.fermerTour();
    this.i = j; this.tEtape = 0; this.bas = 0; this.soulagement = false;
    if (j >= this.etapes.length && this.etapes.length) this.fini = true;
  }
  private fermerTour() {
    if (this.points.length > this.debutTour) this.tours.push({ debut: this.debutTour, fin: this.points.length - 1, etape: this.i });
    this.debutTour = this.points.length;
  }

  // ─── Le temps ───
  tic(now: number): Etat {
    const dt = this.dernierTic ? Math.min(2, (now - this.dernierTic) / 1000) : 0;
    this.dernierTic = now;
    const w = this.wattsMesures(now), cad = this.cadenceMesuree(now), bpm = this.bpmMesure(now);
    if (w != null) this.recents.push({ t: now, w });
    while (this.recents.length && now - this.recents[0].t > 3000) this.recents.shift();
    const w3s = this.recents.length ? Math.round(this.recents.reduce((a, x) => a + x.w, 0) / this.recents.length) : null;
    const pedale = (cad ?? 0) >= 20 || (w ?? 0) > 30;

    // Pause automatique et reprise
    if (!this.fini) {
      if (this.pause === "non" && !pedale) {
        this.arret ||= now;
        if (now - this.arret > 3000) this.pause = "auto";
      } else this.arret = 0;
      if (pedale && (this.pause === "auto" || (this.pause === "manuelle" && !this.demarre))) { this.pause = "non"; this.demarre = true; }
    }

    if (this.wBal != null && this.w0 && this.cp && dt > 0 && !this.fini) {
      const p = this.pause === "non" ? (w ?? 0) : 0;
      this.wBal = p > this.cp
        ? Math.max(0, this.wBal - (p - this.cp) * dt)
        : Math.min(this.w0, this.wBal + ((this.cp - p) * (this.w0 - this.wBal) / this.w0) * dt);
    }

    const e = this.etapes[this.i] ?? null;
    if (this.pause === "non" && !this.fini) {
      this.tEtape += dt; this.tTotal += dt;
      if (e && this.tEtape >= e.s && !e.lap) this.passer(this.i + 1);
    }
    const et = this.etapes[this.i] ?? null;
    // Col : on avance sur le profil à la vitesse que donnent tes watts sur cette pente
    if (this.col && !this.fini) {
      const total = this.col.km * 1000;
      const p = penteA(this.col, this.dCol);
      this.kmh = this.pause === "non" ? vitesseSurPente(w ?? 0, this.masse, p) : 0;
      if (this.pause === "non" && dt > 0) {
        const avant = this.dCol;
        this.dCol = Math.min(total, this.dCol + (this.kmh / 3.6) * dt);
        if (Math.floor(this.dCol / 1000) > Math.floor(avant / 1000)) this.fermerTour();   // un tour par km
        if (this.dCol >= total) { this.fermerTour(); this.fini = true; }
      }
    }

    // Cible et consigne
    let cible: number | null = null;
    let consigne: Consigne = { type: "pente", pct: this.pente };
    let alerte: string | null = null;
    if (et && !this.fini) {
      if (et.cible.type === "bpm") {
        if (bpm != null && now - this.derniereRegul > 15000 && this.pause === "non") {
          if (bpm > et.cible.max) this.wBpm -= 5;
          else if (bpm < et.cible.min) this.wBpm += 5;
          this.wBpm = Math.max(Math.round(this.ftp * 0.3), Math.min(Math.round(this.ftp * 1.1), this.wBpm));
          this.derniereRegul = now;
        }
        cible = this.wBpm;
      } else cible = wattsCibles(et, this.tEtape, this.ftp);
      cible = Math.round(cible * this.ajust);
      const sprint = cible > this.ftp * 1.5 && et.s <= 30;
      if (this.erg && !sprint) {
        // Cadence qui s'effondre
        // Exercice de force à cadence basse (« @50 ») : on ne relâche que si
        // la cadence tombe bien en dessous de celle demandée (calage, pas effort).
        const seuil = et.cadence ? Math.min(55, et.cadence - 15) : 55;
        if (cad != null && cad < seuil && this.pause === "non") { this.bas ||= now; if (now - this.bas > 5000) this.soulagement = true; }
        else this.bas = 0;
        if (this.soulagement && cad != null && cad >= seuil + 15) this.soulagement = false;
        if (this.soulagement) alerte = "Cadence trop basse : on relâche, relance les jambes";
        consigne = { type: "erg", w: this.soulagement ? Math.round(cible * 0.6) : this.powerMatch(cible) };
        // Anticipation : le home-trainer met 2 à 4 s à suivre une nouvelle
        // consigne ; on envoie celle de l'étape suivante 2 s avant le changement.
        const apres = this.etapes[this.i + 1];
        if (!this.soulagement && !et.lap && et.s - this.tEtape <= 2 && apres && apres.cible.type === "w") {
          const wSuivant = Math.round(wattsCibles(apres, 0, this.ftp) * this.ajust);
          if (!(wSuivant > this.ftp * 1.5 && apres.s <= 30)) consigne = { type: "erg", w: this.powerMatch(wSuivant) };
        }
      } else if (sprint) {
        consigne = { type: "pente", pct: 4 };
        alerte = "Sprint : à fond !";
      }
      if (et.lap && this.tEtape >= et.s) alerte = "Appuie sur ⏭ quand tu es prêt";
    }
    if (this.col) consigne = { type: "pente", pct: Math.round(penteA(this.col, this.dCol) * 10) / 10 };
    if (this.pause !== "non" && !this.fini) consigne = { type: "pente", pct: 0 };

    // Enregistrement : un point par seconde, hors pause
    if (this.pause === "non" && !this.fini && now - this.dernierPoint >= PAS) {
      const kmh = this.col ? this.kmh : this.frais(this.ht.t, now) && this.ht.kmh ? this.ht.kmh : vitesseDepuisWatts(w ?? 0, this.masse);
      if (this.col) this.m = this.dCol;
      else this.m += (kmh / 3.6) * (this.dernierPoint ? Math.min(2, (now - this.dernierPoint) / 1000) : 1);
      const x = this.etapes.slice(0, this.i).reduce((a, e2) => a + e2.s, 0) + Math.min(this.tEtape, et?.s ?? this.tEtape);
      this.points.push({ ts: now, w, cad, bpm, kmh, m: Math.round(this.m), c: cible, x });
      this.dernierPoint = now;
      if (w != null && this.frais(this.ped.t, now) && this.frais(this.ht.t, now) && this.ht.w != null && this.ped.w != null) {
        this.match.push({ ht: this.ht.w, ped: this.ped.w });
        if (this.match.length > 30) this.match.shift();
      }
    }

    const reste = et && !et.lap ? Math.max(0, et.s - this.tEtape) : null;
    return {
      i: this.i, etape: et, suivante: this.etapes[this.i + 1] ?? null,
      tEtape: this.tEtape, resteEtape: reste, tTotal: this.tTotal,
      dureeTotale: this.etapes.reduce((a, x) => a + x.s, 0),
      cible, consigne, watts: w, cadence: cad, bpm,
      pause: this.pause, fini: this.fini, erg: this.erg, ajust: this.ajust, pente: this.pente,
      alerte, attendLap: !!(et?.lap && this.tEtape >= et.s),
      reserve: this.wBal != null && this.w0 ? Math.max(0, Math.min(1, this.wBal / this.w0)) : null,
      w3s,
      col: this.col ? { d: this.dCol, total: this.col.km * 1000, pente: penteA(this.col, this.dCol), alt: altitudeA(this.col, this.dCol), kmh: this.kmh } : null,
      tour: moyennes(this.points.slice(this.debutTour)),
      tourPrec: this.tours.length ? moyennes(this.points.slice(this.tours[this.tours.length - 1].debut, this.tours[this.tours.length - 1].fin + 1)) : null,
      seance: { w: moyennes(this.points).w, kj: Math.round(this.points.reduce((a, p) => a + (p.w ?? 0), 0) / 1000), km: Math.round(this.m / 100) / 10 },
    };
  }

  // Avec des pédales : le home-trainer est recalé sur elles (moyenne 30 s).
  private powerMatch(w: number) {
    if (this.match.length < 10) return w;
    const h = this.match.reduce((a, x) => a + x.ht, 0), p = this.match.reduce((a, x) => a + x.ped, 0);
    if (p < 50) return w;
    return Math.round(w * Math.max(0.85, Math.min(1.15, h / p)));
  }
}

function moyennes(pts: Point[]): Moyennes {
  const m = (k: "w" | "bpm" | "cad") => {
    const v = pts.map((p) => p[k]).filter((x): x is number => x != null);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };
  return { w: m("w"), bpm: m("bpm"), cad: m("cad"), s: pts.length };
}

/** Vitesse en montée (ou descente) pour une puissance : poids + roulement + air
 *  (CdA 0,32, Crr 0,004, air 1,2). Sur un col, c'est elle qui fait avancer. */
export function vitesseSurPente(w: number, masse: number, pentePct: number): number {
  const th = Math.atan(pentePct / 100), g = 9.81;
  const fixe = masse * g * (0.004 * Math.cos(th) + Math.sin(th));
  let v = 5;
  for (let k = 0; k < 30; k++) {
    const f = fixe * v + 0.5 * 1.2 * 0.32 * v ** 3 - Math.max(0, w);
    const d = fixe + 1.5 * 1.2 * 0.32 * v ** 2;
    if (Math.abs(d) < 1e-6) break;
    v = Math.max(0.3, v - f / d);
  }
  return w <= 0 && pentePct >= 0 ? 0 : v * 3.6;
}

/** Vitesse sur le plat pour une puissance (masse cycliste + vélo, CdA 0,32, Crr 0,004). */
export function vitesseDepuisWatts(w: number, masse = 81): number {
  if (w <= 0) return 0;
  let v = 8;
  for (let k = 0; k < 20; k++) {
    const f = 0.004 * masse * 9.81 * v + 0.5 * 1.2 * 0.32 * v ** 3 - w;
    const d = 0.004 * masse * 9.81 + 1.5 * 1.2 * 0.32 * v ** 2;
    v -= f / d;
  }
  return Math.max(0, v * 3.6);
}
