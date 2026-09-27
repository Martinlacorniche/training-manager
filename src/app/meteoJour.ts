// La météo du jour, en discret dans l'en-tête (Martin, 27/09 ; même code que l'app, App-Coach/lib/meteoJour.ts) : température et
// WBGT maximum de la journée (6 h – 21 h) à la ville de l'athlète (celle de
// « Mon voyage »), sinon au départ de sa dernière sortie. WBGT à l'ombre, même formule que l'analyse
// (App-Coach, supabase/functions/_shared/icu.ts : Stull 2011, 0,7·Tw + 0,3·T).

export type MeteoJour = { t: number; wbgt: number };

const tempHumide = (t: number, hr: number) =>
  t * Math.atan(0.151977 * Math.sqrt(hr + 8.313659)) + Math.atan(t + hr) - Math.atan(hr - 1.676331)
  + 0.00391838 * Math.pow(hr, 1.5) * Math.atan(0.023101 * hr) - 4.686035;

const cache: Record<string, { quand: number; m: MeteoJour | null }> = {};

export async function meteoDuJour(lat: number, lng: number): Promise<MeteoJour | null> {
  const cle = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const c = cache[cle];
  if (c && Date.now() - c.quand < 3600_000) return c.m;
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&hourly=temperature_2m,relative_humidity_2m&timezone=auto&forecast_days=1`).then((x) => x.json());
    const h = r?.hourly;
    let t = -99, w = -99;
    (h?.time || []).forEach((iso: string, i: number) => {
      const heure = Number(iso.slice(11, 13));
      const T = h.temperature_2m[i], HR = h.relative_humidity_2m[i];
      if (heure < 6 || heure > 21 || T == null || HR == null) return;
      t = Math.max(t, T);
      w = Math.max(w, 0.7 * tempHumide(T, HR) + 0.3 * T);
    });
    const m = t > -99 ? { t: Math.round(t), wbgt: Math.round(w) } : null;
    cache[cle] = { quand: Date.now(), m };
    return m;
  } catch { return null; }
}

// Couleur discrète : gris tant que c'est confortable, puis orange, puis rouge.
export const couleurWbgt = (w: number) => (w >= 25 ? "#dc2626" : w >= 20 ? "#ea580c" : "#94a3b8");
