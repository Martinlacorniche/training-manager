// ─────────────────────────────────────────────────────────────────────────
// L'indice chaleur COMPLET (WBGT au soleil), d'après Liljegren et al. 2008
// (J Occup Environ Hyg 5:645-655), la méthode de référence pour calculer le
// WBGT à partir de la météo : WBGT = 0,7·Tnwb + 0,2·Tg + 0,1·Ta, où
//   Tg   = température du globe noir (soleil, rayonnement du sol et du ciel, vent)
//   Tnwb = température humide « naturelle » (évaporation, vent, soleil)
// Chacune est l'équilibre thermique d'un petit capteur, résolu par bisection.
//
// Recodé à partir des équations publiées (27/09, validé par Martin : « go »).
// Remplace la formule « à l'ombre » (0,7·Tw + 0,3·Ta), qui ignorait le soleil.
// Copie de App-Coach/supabase/functions/_shared/wbgt.ts (même calcul partout).
//
// CHOIX : vent mesuré à 10 m ramené à 2 m (profil logarithmique, ×0,65), au
// moins 0,5 m/s (un calme horaire absolu est rare au ras du sol) ; albédo du
// sol 0,4 et pression 1010 hPa comme l'implémentation de référence.
// ─────────────────────────────────────────────────────────────────────────

const SIGMA = 5.6696e-8, CP = 1003.5, M_AIR = 28.97, M_H2O = 18.015, R_GAZ = 8314.34;
const R_AIR = R_GAZ / M_AIR, RATIO = (CP * M_AIR) / M_H2O, PR = CP / (CP + 1.25 * R_AIR);
const P_AIR = 1010, ALB_SOL = 0.4, EMIS_SOL = 0.999;
const EMIS_GLOBE = 0.95, ALB_GLOBE = 0.05, D_GLOBE = 0.0508;
const EMIS_MECHE = 0.95, ALB_MECHE = 0.4, D_MECHE = 0.007, L_MECHE = 0.0254;

const esat = (tk: number) => 1.004 * 6.1121 * Math.exp((17.502 * (tk - 273.15)) / (tk - 32.18));   // hPa
const viscosite = (tk: number) => {
  const omega = ((tk / 97 - 2.9) / 0.4) * -0.034 + 1.048;
  return (2.6693e-6 * Math.sqrt(28.97 * tk)) / (3.617 ** 2 * omega);
};
const conductivite = (tk: number) => (CP + 1.25 * R_AIR) * viscosite(tk);
const diffusivite = (tk: number) =>
  3.64e-4 * (tk / Math.sqrt(132 * 647.3)) ** 2.334 * (36.4 * 218) ** (1 / 3) * (132 * 647.3) ** (5 / 12)
  * Math.sqrt(1 / 28.97 + 1 / 18.015) / (P_AIR / 1013.25) * 1e-4;
const densite = (tk: number) => (P_AIR * 100) / (R_AIR * tk);
const hSphere = (tk: number, v: number) => {
  const re = (v * densite(tk) * D_GLOBE) / viscosite(tk);
  return ((2 + 0.6 * Math.sqrt(re) * PR ** (1 / 3)) * conductivite(tk)) / D_GLOBE;
};
const hCylindre = (tk: number, v: number) => {
  const re = (v * densite(tk) * D_MECHE) / viscosite(tk);
  return (0.281 * re ** 0.6 * PR ** 0.44 * conductivite(tk)) / D_MECHE;
};
const chaleurEvap = (tk: number) => ((313.15 - tk) / 30) * -71100 + 2407300;

// Point fixe x = f(x), par bisection sur f(x) − x (monotone sur l'intervalle).
function pointFixe(f: (x: number) => number, bas: number, haut: number): number {
  let a = bas, b = haut, ga = f(a) - a;
  for (let i = 0; i < 60; i++) {
    const m = (a + b) / 2, gm = f(m) - m;
    if (Math.sign(gm) === Math.sign(ga)) { a = m; ga = gm; } else b = m;
    if (b - a < 1e-4) break;
  }
  return (a + b) / 2;
}

// Cosinus de l'angle zénithal du soleil (formules de la NOAA), à un instant UTC.
export function cosZenith(quand: Date, lat: number, lon: number): number {
  const debut = Date.UTC(quand.getUTCFullYear(), 0, 1);
  const jour = Math.floor((quand.getTime() - debut) / 86_400_000);
  const h = quand.getUTCHours() + quand.getUTCMinutes() / 60;
  const g = ((2 * Math.PI) / 365) * (jour + (h - 12) / 24);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
    + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const angleHoraire = ((h * 60 + eqt + 4 * lon) / 4 - 180) * (Math.PI / 180);
  const phi = lat * (Math.PI / 180);
  return Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(angleHoraire);
}

export type MeteoHeure = { t: number; hr: number; vent: number | null; ray: number | null };

// L'indice chaleur au soleil. `quand` et la position servent à situer le soleil.
export function wbgtSoleil(m: MeteoHeure, lat: number, lon: number, quand: Date): number {
  const ta = m.t + 273.15, rh = Math.max(0.01, Math.min(1, m.hr / 100));
  const vent = Math.max(0.5, (m.vent ?? 2) * 0.65);
  let S = Math.max(0, m.ray ?? 0);

  // Part directe du rayonnement, selon sa proportion du maximum possible (Liljegren).
  let cz = cosZenith(quand, lat, lon), fdir = 0;
  if (cz < 0.00873 || S <= 0) { S = 0; cz = Math.max(cz, 0.00873); }
  else {
    const maxi = 1367 * cz, norm = Math.min(S / maxi, 0.85);
    S = norm * maxi;
    fdir = norm > 0 ? Math.max(0, Math.min(0.9, Math.exp(3 - 1.34 * norm - 1.65 / norm))) : 0;
  }
  const zenith = Math.min(Math.acos(Math.min(1, cz)), S > 15 ? 1.54 : 1.57);
  const eAir = rh * esat(ta), emisAtm = 0.575 * eAir ** 0.143;
  const ciel = 0.5 * (emisAtm * ta ** 4 + EMIS_SOL * ta ** 4);

  // Globe noir.
  const tg = pointFixe((x) => {
    const h = hSphere(0.5 * (x + ta), vent);
    const v = ciel - (h / (EMIS_GLOBE * SIGMA)) * (x - ta)
      + (S / (2 * EMIS_GLOBE * SIGMA)) * (1 - ALB_GLOBE) * (fdir * (1 / (2 * Math.cos(zenith)) - 1) + 1 + ALB_SOL);
    return Math.max(v, 1) ** 0.25;
  }, ta - 5, ta + 45);

  // Thermomètre humide naturel.
  const tdew = (() => { // point de rosée (Magnus), borne basse de la recherche
    const a = 17.27, b = 237.7, g = (a * m.t) / (b + m.t) + Math.log(rh);
    return (b * g) / (a - g) + 273.15;
  })();
  const tnwb = pointFixe((x) => {
    const tref = 0.5 * (x + ta);
    const fatm = SIGMA * EMIS_MECHE * (ciel - x ** 4) + (1 - ALB_MECHE) * S
      * ((1 - fdir) * (1 + (0.25 * D_MECHE) / L_MECHE) + (Math.tan(zenith) / Math.PI + (0.25 * D_MECHE) / L_MECHE) * fdir + ALB_SOL);
    const sc = viscosite(ta) / (densite(ta) * diffusivite(tref));
    const eMeche = esat(x);
    return ta - (chaleurEvap(x) / RATIO) * ((eMeche - eAir) / (P_AIR - eMeche)) * (PR / sc) ** 0.56 + fatm / hCylindre(x, vent);
  }, tdew - 1, ta + 10);

  return 0.7 * (tnwb - 273.15) + 0.2 * (tg - 273.15) + 0.1 * m.t;
}
