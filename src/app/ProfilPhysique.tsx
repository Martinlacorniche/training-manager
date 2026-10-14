"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Mon profil (15/10/2026), comme dans les réglages de l'app : âge et sexe pour
// situer la VO2max estimée, poids pour les W/kg. Facultatif.
export function ProfilPhysique({ className }: { className: string }) {
  const [uid, setUid] = useState<string | null>(null);
  const [p, setP] = useState<{ annee: string; sexe: string | null; poids: string }>({ annee: "", sexe: null, poids: "" });
  const [ok, setOk] = useState(false);
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUid(session.user.id);
      const { data } = await supabase.from("profil_physique").select("annee_naissance, sexe, poids_kg").eq("user_id", session.user.id).maybeSingle();
      setP({ annee: data?.annee_naissance ? String(data.annee_naissance) : "", sexe: data?.sexe ?? null, poids: data?.poids_kg ? String(data.poids_kg) : "" });
    })();
  }, []);
  const enregistrer = async (n: typeof p) => {
    setP(n);
    if (!uid) return;
    const annee = parseInt(n.annee, 10), poids = parseFloat(n.poids.replace(",", "."));
    const { error } = await supabase.from("profil_physique").upsert({
      user_id: uid, annee_naissance: annee >= 1920 && annee <= 2020 ? annee : null, sexe: n.sexe,
      poids_kg: poids >= 25 && poids <= 250 ? poids : null, maj: new Date().toISOString(),
    });
    setOk(!error);
    if (!error) setTimeout(() => setOk(false), 1500);
  };
  const champ = "w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-800";
  return (
    <section className={className}>
      <h2 className="font-bold text-slate-800">Mon profil {ok && <span className="text-xs font-semibold text-emerald-600">· enregistré</span>}</h2>
      <p className="text-xs text-slate-400">Pour te situer (âge, sexe) et calculer tes watts par kilo. Facultatif, visible par toi et ton coach.</p>
      <div className="flex gap-2">
        {[["F", "Femme"], ["M", "Homme"]].map(([v, l]) => (
          <button key={v} onClick={() => enregistrer({ ...p, sexe: p.sexe === v ? null : v })}
            className={`flex-1 py-2 rounded-lg border-2 font-bold ${p.sexe === v ? "border-blue-600 bg-blue-50 text-blue-600" : "border-slate-200 text-slate-500"}`}>{l}</button>
        ))}
      </div>
      <div className="flex gap-2">
        <label className="flex-1 text-xs font-semibold text-slate-500">Année de naissance
          <input className={champ} inputMode="numeric" placeholder="1990" value={p.annee}
            onChange={(e) => setP({ ...p, annee: e.target.value.replace(/[^0-9]/g, "").slice(0, 4) })} onBlur={() => enregistrer(p)} />
        </label>
        <label className="flex-1 text-xs font-semibold text-slate-500">Poids (kg)
          <input className={champ} inputMode="decimal" placeholder="68" value={p.poids}
            onChange={(e) => setP({ ...p, poids: e.target.value.replace(/[^0-9.,]/g, "").slice(0, 5) })} onBlur={() => enregistrer(p)} />
        </label>
      </div>
    </section>
  );
}
