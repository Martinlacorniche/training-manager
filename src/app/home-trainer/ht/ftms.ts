// ─────────────────────────────────────────────────────────────────────────
// Home-trainer : le Bluetooth, sans dépendre de la plateforme. Les octets
// arrivent ici (Web Bluetooth sur le site, react-native-ble-plx dans l'app)
// et repartent d'ici. Normes Bluetooth SIG :
//   - Fitness Machine Service (FTMS, 0x1826) : mesures du home-trainer et
//     commandes (ERG = puissance cible, simulation = pente) ;
//   - Cycling Power (0x1818) : pédales / capteur de puissance ;
//   - Heart Rate (0x180D) : ceinture cardio.
// Copie de App-Coach/lib/ht/ftms.ts — garder les deux identiques.
// ─────────────────────────────────────────────────────────────────────────

const uuid = (court: number) => `0000${court.toString(16).padStart(4, "0")}-0000-1000-8000-00805f9b34fb`;

export const UUID = {
  ftms: uuid(0x1826),
  indoorBikeData: uuid(0x2ad2),
  controlPoint: uuid(0x2ad9),
  ftmsStatus: uuid(0x2ada),
  power: uuid(0x1818),
  powerMeasurement: uuid(0x2a63),
  hr: uuid(0x180d),
  hrMeasurement: uuid(0x2a37),
};

export type Mesure = { watts?: number; cadence?: number; vitesse?: number; bpm?: number; rr?: number[] };   // rr en secondes

/** Indoor Bike Data (0x2AD2). Un home-trainer peut éclater ses champs sur
 *  plusieurs notifications : on ne rend que ceux présents. */
export function lireIndoorBike(v: DataView): Mesure {
  const f = v.getUint16(0, true);
  let o = 2;
  const m: Mesure = {};
  if (!(f & 0x1)) { m.vitesse = v.getUint16(o, true) / 100; o += 2; }   // km/h ; bit 0 = « More Data » inversé
  if (f & 0x2) o += 2;                                                   // vitesse moyenne
  if (f & 0x4) { m.cadence = v.getUint16(o, true) / 2; o += 2; }
  if (f & 0x8) o += 2;                                                   // cadence moyenne
  if (f & 0x10) o += 3;                                                  // distance totale
  if (f & 0x20) o += 2;                                                  // niveau de résistance
  if (f & 0x40) { m.watts = v.getInt16(o, true); o += 2; }
  if (f & 0x80) o += 2;                                                  // puissance moyenne
  if (f & 0x100) o += 5;                                                 // énergie
  if (f & 0x200) { m.bpm = v.getUint8(o); o += 1; }
  return m;
}

/** Cycling Power Measurement (0x2A63). La cadence se déduit des tours de
 *  pédalier cumulés : il faut garder la mesure précédente (`etat`). */
export function lirePuissance(v: DataView, etat: { tours?: number; t?: number; cadence?: number }): Mesure {
  const f = v.getUint16(0, true);
  const m: Mesure = { watts: v.getInt16(2, true) };
  let o = 4;
  if (f & 0x1) o += 1;            // équilibre gauche/droite
  if (f & 0x4) o += 2;            // couple cumulé
  if (f & 0x10) o += 6;           // tours de roue
  if (f & 0x20) {
    const tours = v.getUint16(o, true), t = v.getUint16(o + 2, true);   // t en 1/1024 s
    if (etat.tours != null && etat.t != null) {
      const dt = ((t - etat.t + 65536) % 65536) / 1024, dn = (tours - etat.tours + 65536) % 65536;
      if (dt > 0) etat.cadence = Math.round((dn / dt) * 60);   // dt = 0 : même événement répété
    }
    etat.tours = tours; etat.t = t;
    m.cadence = etat.cadence;
  }
  return m;
}

export function lireCardio(v: DataView): number {
  return v.getUint8(0) & 0x1 ? v.getUint16(1, true) : v.getUint8(1);
}

/** Les battements un par un (intervalles R-R, en s) qu'envoie une ceinture :
 *  enregistrés dans le .fit, ils disent à l'analyse que le cœur vient d'une
 *  ceinture (fiable), et servent à la variabilité. Une montre n'en envoie pas. */
export function lireRR(v: DataView): number[] {
  const f = v.getUint8(0);
  if (!(f & 0x10)) return [];
  let o = f & 0x1 ? 3 : 2;
  if (f & 0x8) o += 2;                      // énergie dépensée
  const rr: number[] = [];
  for (; o + 1 < v.byteLength; o += 2) rr.push(v.getUint16(o, true) / 1024);
  return rr;
}

// ─── Commandes FTMS (Control Point 0x2AD9, à écrire avec réponse) ───

const octets = (...b: number[]) => new Uint8Array(b);
const i16 = (n: number) => { const x = Math.round(n) & 0xffff; return [x & 0xff, x >> 8]; };

export const Commande = {
  prendreLaMain: () => octets(0x00),
  reinitialiser: () => octets(0x01),
  demarrer: () => octets(0x07),
  stop: () => octets(0x08, 0x01),
  pause: () => octets(0x08, 0x02),
  /** ERG : le home-trainer tient ces watts quelle que soit la cadence. */
  puissance: (w: number) => octets(0x05, ...i16(Math.max(0, Math.min(2000, w)))),
  /** Simulation : pente en %, vent nul, roulement et traînée standard. Sert
   *  de « résistance » (sorties libres, sprints) : tous les trainers la gèrent. */
  pente: (pct: number) => octets(0x11, 0, 0, ...i16(Math.max(-10, Math.min(20, pct)) * 100), 40, 51),
};

/** Réponse du Control Point : [0x80, opcode, résultat] ; 1 = succès. */
export function reponseOk(v: DataView): { opcode: number; ok: boolean } | null {
  if (v.byteLength < 3 || v.getUint8(0) !== 0x80) return null;
  return { opcode: v.getUint8(1), ok: v.getUint8(2) === 0x01 };
}
