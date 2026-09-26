"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// ─────────────────────────────────────────────────────────────────────────
// L'onglet « Mon voyage » : la distance de l'année, tous sports additionnés,
// devient un trajet depuis sa ville vers la destination choisie. Une histoire,
// jamais un quota. Km et temps de la semaine et du mois, sans comparaison ;
// « semaine faite » ; mode discret. Calculé par la fonction voyage (App-Coach).
// Même écran que l'app (App-Coach, components/SuiviVoyage.tsx).
// ─────────────────────────────────────────────────────────────────────────

type Lieu = { nom: string; lat: number; lng: number; detail?: string };
const SPORT: Record<string, string> = { Run: "Course", Trail: "Trail", "Vélo": "Vélo", Natation: "Natation", Renfo: "Renfo", Muscu: "Muscu", Autre: "Autre" };
const SUGGESTIONS: Lieu[] = [
  { nom: "Rome", lat: 41.894, lng: 12.483 }, { nom: "Berlin", lat: 52.52, lng: 13.405 }, { nom: "Lisbonne", lat: 38.717, lng: -9.139 },
  { nom: "Oslo", lat: 59.913, lng: 10.752 }, { nom: "Athènes", lat: 37.984, lng: 23.728 }, { nom: "Marrakech", lat: 31.63, lng: -8.008 },
];
// Distance à vol d'oiseau +10 % (la route passe par les grandes villes), « ≈ ».
function kmVers(depuis: { lat: number; lng: number } | null, l: Lieu): string | null {
  if (!depuis) return null;
  const r = (x: number) => (x * Math.PI) / 180;
  const hh = Math.sin(r(l.lat - depuis.lat) / 2) ** 2 + Math.cos(r(depuis.lat)) * Math.cos(r(l.lat)) * Math.sin(r(l.lng - depuis.lng) / 2) ** 2;
  const d = 2 * 6371 * Math.asin(Math.sqrt(hh)) * 1.1;
  return d < 50 ? "tout près" : `≈ ${(Math.round(d / 50) * 50).toLocaleString("fr-FR")} km`;
}
const n0 = (x: number) => Math.round(x).toLocaleString("fr-FR");
const h = (x: number) => (x >= 1 ? `${Math.floor(x)} h ${String(Math.round((x % 1) * 60)).padStart(2, "0")}` : `${Math.round(x * 60)} min`);

function ChoixLieu({ titre, onChoix, suggestions, depuis }: { titre: string; onChoix: (l: Lieu) => void; suggestions?: Lieu[]; depuis?: { lat: number; lng: number } | null }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Lieu[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) { setRes([]); return; }
    const t = setTimeout(async () => {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.trim())}&count=5&language=fr&format=json`).catch(() => null);
      const j = await r?.json().catch(() => ({}));
      setRes((j?.results ?? []).map((x: Record<string, any>) => ({ nom: x.name, lat: x.latitude, lng: x.longitude, detail: [x.admin1, x.country].filter(Boolean).join(", ") })));
    }, 350);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="space-y-2">
      <h2 className="text-lg font-extrabold text-slate-800">{titre}</h2>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Une ville…" className="w-full rounded-xl border border-slate-200 p-3 outline-none focus:ring-2 focus:ring-teal-200" />
      {res.map((l) => (
        <button key={`${l.lat},${l.lng}`} onClick={() => onChoix(l)} className="block w-full text-left py-1">
          <span className="font-bold text-slate-800">{l.nom}</span> <span className="text-sm text-slate-400">{l.detail}</span>
          {kmVers(depuis ?? null, l) && <span className="float-right text-sm font-bold text-teal-700">{kmVers(depuis ?? null, l)}</span>}
        </button>
      ))}
      {!q && suggestions && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((l) => <button key={l.nom} onClick={() => onChoix(l)} className="rounded-2xl bg-teal-50 px-4 py-2 text-sm font-bold text-teal-700">{l.nom}{kmVers(depuis ?? null, l) && <span className="block text-xs font-semibold text-slate-500">{kmVers(depuis ?? null, l)}</span>}</button>)}
        </div>
      )}
    </div>
  );
}

export function Voyage({ userId, soi }: { userId: string; soi: boolean }) {
  const [d, setD] = useState<Record<string, any> | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [edition, setEdition] = useState<"ville" | "cap" | null>(null);
  const appeler = useCallback(async (extra: Record<string, unknown> = {}) => {
    setErreur(null);
    const { data, error } = await supabase.functions.invoke("voyage", { body: { athleteId: userId, ...extra } });
    if (error) { setErreur("Impossible de charger le voyage."); return; }
    setD(data);
  }, [userId]);
  useEffect(() => { appeler(); }, [appeler]);
  const regler = async (x: Record<string, unknown>) => { setEdition(null); setD(null); await appeler({ mode: "regler", ...x }); };

  const carte = "bg-white rounded-2xl border border-slate-200 p-5 space-y-3";
  if (erreur) return <p className="text-slate-500">{erreur}</p>;
  if (!d) return <p className="text-slate-400">…</p>;
  const discret = d.mode_discret, v = d.voyage;

  if (soi && (edition || !d.ville || !d.cap)) {
    const etape = edition ?? (!d.ville ? "ville" : "cap");
    return (
      <section className={carte}>
        {etape === "ville"
          ? <ChoixLieu titre="D'où pars-tu ?" onChoix={(l) => regler({ ville: l })} />
          : <ChoixLieu titre={v?.cap_atteint ? `Tu es arrivé à ${d.cap} ! Et maintenant ?` : "Où veux-tu aller ?"} onChoix={(l) => regler({ cap: l })} suggestions={SUGGESTIONS}
              depuis={v?.position ?? (d.carte ? { lat: d.carte.maison[1], lng: d.carte.maison[0] } : null)} />}
        {edition && <button onClick={() => setEdition(null)} className="text-sm font-bold text-slate-500">Annuler</button>}
      </section>
    );
  }
  if (!v) return <section className={carte}><p className="text-slate-500">Pas encore de voyage : {soi ? "choisis ta ville et ta destination" : "l'athlète n'a pas choisi sa destination"}.</p></section>;
  const pct = v.jusqu_au_cap ? Math.min(1, v.sur_troncon / v.jusqu_au_cap) : 0;
  const everest = d.d_plus / 8849;

  return (
    <div className="space-y-4">
      {d.carte && (
        <iframe title="Carte du voyage" allowFullScreen src={`/carte-voyage.html?mode=site#${encodeURIComponent(JSON.stringify(d.carte))}`}
          className="h-80 w-full rounded-2xl border-0 bg-[#eef2f7]" />
      )}
      <section className={carte}>
        {!discret && <p className="text-4xl font-black text-slate-800">{n0(d.km)} km</p>}
        <p className="text-sm text-slate-500">{discret ? "Ton voyage continue, à ton rythme." : "depuis le 1er janvier, tous sports"}</p>
        <p className="text-lg font-extrabold text-slate-800">{v.cap_atteint ? `Tu es arrivé à ${v.cap} !` : v.pres_de ? `Tu es près de ${v.pres_de.nom}.` : `Tu es en route vers ${v.cap}.`}</p>
        <div>
          <div className="h-2 rounded bg-slate-200"><div className="h-2 rounded bg-teal-600" style={{ width: `${pct * 100}%` }} /></div>
          <div className="mt-1 flex justify-between text-sm font-bold text-slate-500"><span>{v.depart}</span><span>{v.cap}</span></div>
        </div>
        {soi && !v.cap_atteint && <button onClick={() => setEdition("cap")} className="rounded-xl border-2 border-teal-600 px-3 py-1.5 text-sm font-extrabold text-teal-700">Changer de destination</button>}
        {v.cap_atteint
          ? (soi && <button onClick={() => setEdition("cap")} className="w-full rounded-xl bg-teal-600 py-3 font-bold text-white">Choisir la prochaine destination</button>)
          : v.prochaine && !discret && <p className="text-sm text-slate-700">Prochaine étape : <strong>{v.prochaine.nom}</strong>, dans {n0(v.prochaine.dans)} km.</p>}
        {v.etapes.length > 0 && (
          <ul className="space-y-1">
            {v.etapes.map((e: Record<string, any>) => (
              <li key={`${e.nom}${e.km}`} className={`text-sm ${e.passee ? "font-semibold text-slate-800" : "text-slate-400"}`}>{e.passee ? "✓" : "○"} {e.nom}</li>
            ))}
          </ul>
        )}
        {v.destinations_atteintes.length > 0 && <p className="text-xs text-slate-400">Déjà atteint cette année : {v.destinations_atteintes.join(", ")}.</p>}
      </section>

      {!discret && (d.d_plus > 0 || d.heures > 0) && (
        <section className={carte}>
          {d.d_plus > 0 && <p className="text-slate-800"><strong>{n0(d.d_plus)} m</strong> de montée : {everest >= 1 ? `${everest.toFixed(1).replace(".", ",")} fois l'Everest` : `${Math.round(d.d_plus / 1610)} fois le Ventoux`}.</p>}
          {d.heures > 0 && <p className="text-slate-800"><strong>{n0(d.heures)} heures</strong> en mouvement{d.heures >= 48 ? ` : ${Math.round(d.heures / 24)} jours complets` : ""}.</p>}
        </section>
      )}

      {!discret && (
        <section className={carte}>
          {d.semaine_faite && <p className="text-lg font-extrabold text-teal-700">✓ Semaine faite !</p>}
          {([["Cette semaine", d.semaine], ["Ce mois-ci", d.mois]] as const).map(([titre, liste]) => (
            <div key={titre}>
              <p className="text-sm font-extrabold text-slate-500">{titre}</p>
              {!liste.length ? <p className="text-slate-400">—</p> : liste.map((x: Record<string, any>) => (
                <div key={x.sport} className="flex items-center gap-3 py-1">
                  <span className="flex-1 text-slate-800">{SPORT[x.sport] ?? x.sport}</span>
                  {x.km > 0 && <span className="font-extrabold text-slate-800">{n0(x.km)} km</span>}
                  <span className="w-20 text-right text-sm text-slate-500">{h(x.heures)}</span>
                </div>
              ))}
            </div>
          ))}
        </section>
      )}

      {!discret && d.a_vie?.km > 0 && (
        <section className={carte}>
          <p className="text-lg font-extrabold text-slate-800">🌍 {d.a_vie.tours > 0 ? `${d.a_vie.tours} tour${d.a_vie.tours > 1 ? "s" : ""} du monde` : "Ton tour du monde"}</p>
          <div className="h-2 rounded bg-slate-200"><div className="h-2 rounded bg-teal-600" style={{ width: `${Math.max(2, d.a_vie.vers_le_prochain * 100)}%` }} /></div>
          <p className="text-sm text-slate-500">{n0(d.a_vie.km)} km depuis le début · {Math.round(d.a_vie.vers_le_prochain * 100)} % {d.a_vie.tours > 0 ? "du suivant" : "du tour de la Terre"}</p>
          <p className="text-xs text-slate-400">Un tour du monde = {n0(d.a_vie.tour_km ?? 40075)} km.</p>
          <ul className="space-y-1">
            {d.a_vie.annees.map((a: Record<string, any>) => (
              <li key={a.annee} className="flex gap-3 text-sm"><span className="w-12 font-extrabold text-slate-800">{a.annee}</span><span className="text-slate-500">{n0(a.km)} km{a.destinations.length ? ` · ${a.destinations.join(", ")}` : ""}</span></li>
            ))}
          </ul>
        </section>
      )}

      {soi && (
        <section className={carte}>
          <button onClick={() => setEdition("ville")} className="block font-bold text-teal-700">J&apos;ai déménagé : changer ma ville ({d.ville})</button>
          <label className="flex items-center justify-between gap-4">
            <span><span className="block font-bold text-slate-800">Mode discret</span><span className="block text-sm text-slate-400">Cache les chiffres, pour une pause ou une blessure.</span></span>
            <input type="checkbox" checked={!!discret} onChange={(e) => regler({ discret: e.target.checked })} className="h-5 w-5 accent-teal-600" />
          </label>
        </section>
      )}
    </div>
  );
}
