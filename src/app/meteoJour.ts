import { wbgtSoleil } from "./wbgt";

// La météo du jour, en discret dans l'en-tête (Martin, 27/09 ; même code que l'app, App-Coach/lib/meteoJour.ts) : température et
// WBGT maximum de la journée (6 h – 21 h) à la ville de l'athlète (celle de
// « Mon voyage »), sinon au départ de sa dernière sortie. WBGT à l'ombre, même formule que l'analyse
// (App-Coach, supabase/functions/_shared/icu.ts : Stull 2011, 0,7·Tw + 0,3·T).

export type MeteoJour = { t: number; wbgt: number };

const cache: Record<string, { quand: number; m: MeteoJour | null }> = {};

export async function meteoDuJour(lat: number, lng: number): Promise<MeteoJour | null> {
  const cle = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const c = cache[cle];
  if (c && Date.now() - c.quand < 3600_000) return c.m;
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,shortwave_radiation&wind_speed_unit=ms&timezone=auto&forecast_days=1`).then((x) => x.json());
    const h = r?.hourly, decalage = Number(r?.utc_offset_seconds ?? 0) * 1000;
    let t = -99, w = -99;
    (h?.time || []).forEach((iso: string, i: number) => {
      const heure = Number(iso.slice(11, 13));
      const T = h.temperature_2m[i], HR = h.relative_humidity_2m[i];
      if (heure < 6 || heure > 21 || T == null || HR == null) return;
      t = Math.max(t, T);
      // Heure locale → UTC ; le rayonnement est la moyenne de l'heure écoulée : soleil à mi-heure.
      const quand = new Date(Date.parse(`${iso}:00Z`) - decalage - 30 * 60_000);
      w = Math.max(w, wbgtSoleil({ t: T, hr: HR, vent: h.wind_speed_10m?.[i] ?? null, ray: h.shortwave_radiation?.[i] ?? null }, lat, lng, quand));
    });
    const m = t > -99 ? { t: Math.round(t), wbgt: Math.round(w) } : null;
    cache[cle] = { quand: Date.now(), m };
    return m;
  } catch { return null; }
}

// Couleur discrète : gris tant que c'est confortable, puis orange, puis rouge.
export const couleurWbgt = (w: number) => (w >= 28 ? "#dc2626" : w >= 23 ? "#ea580c" : "#94a3b8");   // très chaud / risqué (indice au soleil)

// Ce que la chaleur du jour change POUR CET ATHLÈTE, en 3-4 phrases simples
// (Martin, 27/09 : « en cliquant sur WBGT, version condensée »). Même modèle
// que l'analyse : c bpm par °C de WBGT au-dessus de sa zone de confort,
// effacé à 70 % par l'habitude de la chaleur (Racinais 2015).
export type ProfilChaleur = { c: number; wOpt: number; valide: boolean } | null;
export function lectureChaleur(m: MeteoJour, p: ProfilChaleur, acclimatation: number): string[] {
  const l = ["L'indice chaleur mélange température, humidité et soleil : c'est ce que ton corps ressent vraiment."];
  if (!p || !p.valide) return [...l, "Pas encore assez de sorties pour savoir comment toi, tu réagis à la chaleur."];
  const exces = m.wbgt - p.wOpt;
  if (exces <= 0) return [...l, `Tu es bien jusqu'à ${Math.round(p.wOpt)}. Aujourd'hui, rien à changer.`];
  const brut = Math.round(p.c * exces), reel = Math.round(p.c * exces * (1 - 0.7 * acclimatation));
  l.push(`Tu es bien jusqu'à ${Math.round(p.wOpt)}. À ${m.wbgt}, ton cœur battrait environ ${brut} fois de plus par minute à la même allure.`);
  if (acclimatation >= 0.3) l.push(`Mais tu es habitué à la chaleur (${Math.round(acclimatation * 100)} %) : ça tombe à environ ${reel}.`);
  l.push(reel >= 5 ? "Pars un peu plus lentement, et bois." : "Rien à changer.");
  return l;
}
