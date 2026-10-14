"use client";
import { useEffect, useState } from "react";
import { Info, Trophy } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabaseClient";
import { ageDe, situer, vo2Course, vo2Velo, type Situation } from "./vo2";

// « Mon moteur » (Martin, 15/10/2026) — comme dans l'app (components/MonMoteur.tsx) :
// VO2max estimée course et vélo, située par âge et sexe, + niveau de course (Daniels).
// Peu de texte : l'explication s'ouvre au clic.

const BANDES: [number, number, string][] = [[0, 25, "#ef4444"], [25, 50, "#f59e0b"], [50, 75, "#16a34a"], [75, 90, "#2563eb"], [90, 100, "#8b5cf6"]];

function Jauge({ s, children }: { s: Situation | null; children: React.ReactNode }) {
  const r = 40, c = 50, a0 = 150, a1 = 390;
  const pt = (pc: number) => { const a = ((a0 + (a1 - a0) * pc / 100) * Math.PI) / 180; return [c + r * Math.cos(a), c + r * Math.sin(a)]; };
  const arc = (p0: number, p1: number) => { const [x0, y0] = pt(p0), [x1, y1] = pt(p1); return `M ${x0} ${y0} A ${r} ${r} 0 ${(p1 - p0) * 2.4 > 180 ? 1 : 0} 1 ${x1} ${y1}`; };
  const [mx, my] = pt(s?.percentile ?? 0);
  return (
    <div className="relative w-24 h-20 flex items-center justify-center">
      <svg viewBox="0 0 100 100" className="absolute top-0 w-24 h-24">
        {BANDES.map(([p0, p1, col]) => <path key={p0} d={arc(p0 + 0.8, p1 - 0.8)} stroke={s ? col : "#e2e8f0"} strokeWidth={7} strokeLinecap="round" fill="none" />)}
        {s && <circle cx={mx} cy={my} r={6} fill={s.couleur} stroke="#fff" strokeWidth={2.5} />}
      </svg>
      <div className="relative flex flex-col items-center mt-1">{children}</div>
    </div>
  );
}

type Pop = { titre: string; lignes: string[]; source?: string } | null;

export function MonMoteur({ userId, soi, cs, niveau }: { userId: string; soi: boolean; cs: any | null; niveau: any | null }) {
  const [cp, setCp] = useState<{ cs: number; d_prime: number } | null>(null);
  const [profil, setProfil] = useState<{ annee_naissance: number | null; sexe: string | null; poids_kg: number | null } | null>(null);
  const [pop, setPop] = useState<Pop>(null);
  useEffect(() => {
    (async () => {
      const [{ data: vv }, { data: pp }] = await Promise.all([
        supabase.from("vitesse_critique").select("cs, d_prime").eq("user_id", userId).eq("sport", "velo").order("jour", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("profil_physique").select("annee_naissance, sexe, poids_kg").eq("user_id", userId).maybeSingle(),
      ]);
      setCp(vv ? { cs: Number(vv.cs), d_prime: Number(vv.d_prime) } : null);
      setProfil(pp ?? null);
    })();
  }, [userId]);

  const vc = cs ? vo2Course(Number(cs.cs), Number(cs.d_prime)) : null;
  const vv = cp ? vo2Velo(cp.cs, cp.d_prime, profil?.poids_kg ? Number(profil.poids_kg) : null) : null;
  const age = ageDe(profil?.annee_naissance), sexe = profil?.sexe ?? null;
  const sc = situer(vc, sexe, age), sv = situer(vv, sexe, age);
  if (vc == null && vv == null && !niveau) return null;
  const dec = age ? `${Math.floor(age / 10) * 10}–${Math.floor(age / 10) * 10 + 9} ans` : null;
  const qui = sexe === "F" ? `des femmes${dec ? ` de ${dec}` : ""}` : sexe === "M" ? `des hommes${dec ? ` de ${dec}` : ""}` : null;
  const comparaison = (s: Situation | null) => s ? (s.top ? `${s.top} ${qui}.` : `Dans la moyenne ${qui} : de la marge pour progresser.`)
    : (soi ? "Indique ton sexe et ton année de naissance dans les réglages pour te situer." : "");

  const tuile = "flex-1 flex flex-col items-center bg-slate-50 rounded-xl py-2.5 px-1 hover:bg-slate-100 transition";
  const Chiffre = ({ v, s }: { v: number | null; s: Situation | null }) => (<>
    <span className="text-2xl font-extrabold text-slate-900 leading-none">{v != null ? Math.round(v) : "—"}</span>
    {s && <span className="text-[11px] font-bold" style={{ color: s.couleur }}>{s.mot}</span>}
  </>);
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
      <h2 className="font-bold text-slate-800">{soi ? "Mon moteur" : "Son moteur"}</h2>
      <div className="flex gap-2">
        <button className={tuile} onClick={() => setPop({ titre: "VO2max estimée — course", lignes: [
          vc != null ? `${Math.round(vc)} ml/kg/min. ${comparaison(sc)}` : "Pas encore assez d'efforts à fond pour l'estimer.",
          "Tirée de ta vitesse critique : la vitesse que tu tiendrais 6 min (ta VMA) × 3,5.", "Même échelle que les montres, à ±5 près."],
          source: "Formule de Léger · comparaison : registre FRIEND (Mayo Clinic, 2015)" })}>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Course</span>
          <Jauge s={sc}><Chiffre v={vc} s={sc} /></Jauge><Info size={14} className="text-slate-400" />
        </button>
        <button className={tuile} onClick={() => setPop({ titre: "VO2max estimée — vélo", lignes: [
          vv != null ? `${Math.round(vv)} ml/kg/min. ${comparaison(sv)}` : (soi ? "Il faut ton poids (réglages) et des efforts à fond à vélo." : "Pas encore estimable."),
          "Tirée de ta puissance tenable 5 min, rapportée à ton poids.", "Même échelle que les montres, à ±5 près."],
          source: "Formule ACSM · comparaison : registre FRIEND (Mayo Clinic, 2015)" })}>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Vélo</span>
          <Jauge s={sv}><Chiffre v={vv} s={sv} /></Jauge><Info size={14} className="text-slate-400" />
        </button>
        <button className={tuile} onClick={() => setPop({ titre: "Niveau de course", lignes: [
          niveau ? `${Math.round(Number(niveau.niveau))} (entre ${Math.round(Number(niveau.bas))} et ${Math.round(Number(niveau.haut))}), calculé sur ${niveau.source}, chaleur retirée.` : "Calculé après ta prochaine course ou ton calibrage.",
          "Ce que tu vaux le jour J, économie de course comprise : c'est lui qui prédit le mieux tes chronos.",
          "Souvent 5 à 8 points sous la VO2max des montres : c'est normal."],
          source: "Méthode Jack Daniels (VDOT) · courses et tests des 4 derniers mois" })}>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Niveau</span>
          <div className="h-20 flex flex-col items-center justify-center">
            <Trophy size={22} className="text-amber-500" />
            <span className="text-2xl font-extrabold text-slate-900 leading-none">{niveau ? Math.round(Number(niveau.niveau)) : "—"}</span>
            <span className="text-[11px] font-bold text-slate-500">performance</span>
          </div>
          <Info size={14} className="text-slate-400" />
        </button>
      </div>
      {pop && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-6" onClick={() => setPop(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-2" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold text-slate-900">{pop.titre}</h3>
            {pop.lignes.filter(Boolean).map((l, i) => <p key={i} className={i === 0 ? "font-bold text-slate-900" : "text-sm text-slate-600"}>{l}</p>)}
            {pop.source && <p className="text-xs text-slate-400">{pop.source}</p>}
            <div className="text-right"><button className="text-blue-600 font-bold px-3 py-1" onClick={() => setPop(null)}>OK</button></div>
          </div>
        </div>
      )}
    </section>
  );
}
