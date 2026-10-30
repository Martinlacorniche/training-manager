// ─────────────────────────────────────────────────────────────────────────
// Home-trainer : la séance enregistrée devient un fichier .fit d'activité,
// comme celui d'une montre (une mesure par seconde, un tour par étape), que
// Strava lit tel quel. Vélo d'intérieur : Strava le marque « home-trainer ».
// Copie de App-Coach/lib/ht/fit.ts — garder les deux identiques.
// ─────────────────────────────────────────────────────────────────────────

import { Encoder, Profile } from "@garmin/fitsdk";
import type { Point, Tour } from "./moteur";

const moy = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : undefined;
};
const max = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? Math.max(...v) : undefined;
};

function resume(pts: Point[]) {
  const d = pts[0], f = pts[pts.length - 1];
  return {
    startTime: new Date(d.ts),
    totalElapsedTime: (f.ts - d.ts) / 1000 + 1,
    totalTimerTime: pts.length,                    // un point = une seconde pédalée
    totalDistance: f.m - (d.m - 0),
    avgPower: moy(pts.map((p) => p.w)), maxPower: max(pts.map((p) => p.w)),
    avgHeartRate: moy(pts.map((p) => p.bpm)), maxHeartRate: max(pts.map((p) => p.bpm)),
    avgCadence: moy(pts.map((p) => p.cad)), maxCadence: max(pts.map((p) => p.cad)),
    avgSpeed: pts.length ? (f.m - d.m) / Math.max(1, pts.length) : 0,
  };
}

export function fichierFit(points: Point[], tours: Tour[]): Uint8Array {
  if (!points.length) throw new Error("Rien d'enregistré");
  const enc = new Encoder();
  const debut = new Date(points[0].ts), fin = new Date(points[points.length - 1].ts);
  const N = Profile.MesgNum;
  // Les types du SDK ne listent pas les champs : on passe des objets simples.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ecrire = (n: number, m: Record<string, unknown>) => enc.onMesg(n as any, m as any);
  ecrire(N.FILE_ID, { type: "activity", manufacturer: "development", product: 0, serialNumber: 1, timeCreated: debut });
  ecrire(N.DEVICE_INFO, { timestamp: debut, manufacturer: "development", product: 0, productName: "App-Coach home-trainer", deviceIndex: "creator" });
  ecrire(N.EVENT, { timestamp: debut, event: "timer", eventType: "start" });
  let prec = points[0].ts;
  for (const p of points) {
    // Un trou de plus de 2 s = une pause : Strava doit le savoir
    if (p.ts - prec > 2500) {
      ecrire(N.EVENT, { timestamp: new Date(prec + 1000), event: "timer", eventType: "stopAll" });
      ecrire(N.EVENT, { timestamp: new Date(p.ts), event: "timer", eventType: "start" });
    }
    prec = p.ts;
    ecrire(N.RECORD, {
      timestamp: new Date(p.ts), distance: p.m, speed: p.kmh / 3.6,
      ...(p.w != null ? { power: Math.max(0, Math.round(p.w)) } : {}),
      ...(p.cad != null ? { cadence: Math.round(p.cad) } : {}),
      ...(p.bpm != null ? { heartRate: Math.round(p.bpm) } : {}),
    });
  }
  ecrire(N.EVENT, { timestamp: fin, event: "timer", eventType: "stopAll" });
  const laps = tours.length ? tours : [{ debut: 0, fin: points.length - 1, etape: 0 }];
  laps.forEach((t, k) => {
    const pts = points.slice(t.debut, t.fin + 1);
    if (!pts.length) return;
    ecrire(N.LAP, {
      messageIndex: k, timestamp: new Date(pts[pts.length - 1].ts), event: "lap", eventType: "stop",
      sport: "cycling", subSport: "indoorCycling", lapTrigger: "manual", ...resume(pts),
    });
  });
  const r = resume(points);
  ecrire(N.SESSION, {
    messageIndex: 0, timestamp: fin, event: "session", eventType: "stop",
    sport: "cycling", subSport: "indoorCycling", firstLapIndex: 0, numLaps: laps.length, trigger: "activityEnd", ...r,
  });
  ecrire(N.ACTIVITY, { timestamp: fin, totalTimerTime: r.totalTimerTime, numSessions: 1, type: "manual", event: "activity", eventType: "stop" });
  return enc.close();
}
