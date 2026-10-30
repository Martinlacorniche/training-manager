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

export type Consigne = { type: "erg"; w: number } | { type: "pente"; pct: number };
export type Point = { ts: number; w: number | null; cad: number | null; bpm: number | null; kmh: number; m: number };
export type Tour = { debut: number; fin: number; etape: number };   // indices dans `points`

export type Etat = {
  i: number; etape: Etape | null; suivante: Etape | null;
  tEtape: number; resteEtape: number | null; tTotal: number; dureeTotale: number;
  cible: number | null; consigne: Consigne;
  watts: number | null; cadence: number | null; bpm: number | null;
  pause: "non" | "manuelle" | "auto"; fini: boolean; erg: boolean; ajust: number; pente: number;
  alerte: string | null; attendLap: boolean;
};

const PAS = 1000;

export class Moteur {
  readonly etapes: Etape[];
  readonly ftp: number;
  points: Point[] = [];
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
  // Mesures : la plus récente de chaque source, avec son heure
  private ht: { w?: number; cad?: number; kmh?: number; t: number } = { t: 0 };
  private ped: { w?: number; cad?: number; t: number } = { t: 0 };
  private cardio: { bpm?: number; t: number } = { t: 0 };
  private match: { ht: number; ped: number }[] = [];

  constructor(blocs: Bloc[], ftp: number) {
    this.etapes = aplatir(blocs);
    this.ftp = ftp > 0 ? ftp : 200;
    this.wBpm = Math.round(this.ftp * LIBRE_PCT);
    if (!this.etapes.length) this.erg = false;     // sortie libre : résistance
  }

  mesurer(src: "ht" | "pedales" | "cardio", m: { watts?: number; cadence?: number; vitesse?: number; bpm?: number }, t: number) {
    if (src === "ht") this.ht = { w: m.watts ?? this.ht.w, cad: m.cadence ?? this.ht.cad, kmh: m.vitesse ?? this.ht.kmh, t };
    if (src === "pedales") this.ped = { w: m.watts ?? this.ped.w, cad: m.cadence ?? this.ped.cad, t };
    if (src === "cardio" || m.bpm) this.cardio = { bpm: m.bpm, t };
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
    const pedale = (cad ?? 0) >= 20 || (w ?? 0) > 30;

    // Pause automatique et reprise
    if (!this.fini) {
      if (this.pause === "non" && !pedale) {
        this.arret ||= now;
        if (now - this.arret > 3000) this.pause = "auto";
      } else this.arret = 0;
      if (pedale && (this.pause === "auto" || (this.pause === "manuelle" && !this.demarre))) { this.pause = "non"; this.demarre = true; }
    }

    const e = this.etapes[this.i] ?? null;
    if (this.pause === "non" && !this.fini) {
      this.tEtape += dt; this.tTotal += dt;
      if (e && this.tEtape >= e.s && !e.lap) this.passer(this.i + 1);
    }
    const et = this.etapes[this.i] ?? null;

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
      } else if (sprint) {
        consigne = { type: "pente", pct: 4 };
        alerte = "Sprint : à fond !";
      }
      if (et.lap && this.tEtape >= et.s) alerte = "Appuie sur ⏭ quand tu es prêt";
    }
    if (this.pause !== "non" && !this.fini) consigne = { type: "pente", pct: 0 };

    // Enregistrement : un point par seconde, hors pause
    if (this.pause === "non" && !this.fini && now - this.dernierPoint >= PAS) {
      const kmh = this.frais(this.ht.t, now) && this.ht.kmh ? this.ht.kmh : vitesseDepuisWatts(w ?? 0);
      this.m += (kmh / 3.6) * (this.dernierPoint ? Math.min(2, (now - this.dernierPoint) / 1000) : 1);
      this.points.push({ ts: now, w, cad, bpm, kmh, m: Math.round(this.m) });
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

/** Vitesse sur le plat pour une puissance (80 kg, CdA 0,32, Crr 0,004). */
export function vitesseDepuisWatts(w: number): number {
  if (w <= 0) return 0;
  let v = 8;
  for (let k = 0; k < 20; k++) {
    const f = 0.004 * 80 * 9.81 * v + 0.5 * 1.2 * 0.32 * v ** 3 - w;
    const d = 0.004 * 80 * 9.81 + 1.5 * 1.2 * 0.32 * v ** 2;
    v -= f / d;
  }
  return Math.max(0, v * 3.6);
}
