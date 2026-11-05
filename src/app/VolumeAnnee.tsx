"use client";
// L'année d'un athlète : les heures FAITES par semaine, empilées par sport.
// Commun à la page Équipe du coach et à « Mes chiffres » de l'athlète
// (05/11/2026). Pas de charge sur un second axe, pas de record : le volume,
// lisible d'un coup d'œil.
import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { supabase } from "@/lib/supabaseClient";
import { SPORT_COULEUR, SPORT_NOM, duree } from "./commun";
dayjs.extend(isoWeek);

const GROUPES = ["Run", "Trail", "Vélo", "Natation", "Renfo", "Autre"] as const;
const groupe = (s: string | null) => (s === "Muscu" ? "Renfo" : GROUPES.includes(s as never) ? (s as string) : "Autre");

export default function VolumeAnnee({ userId, titre }: { userId: string; titre: string }) {
  const [annee, setAnnee] = useState(dayjs().year());
  const [lignes, setLignes] = useState<{ date: string; planned_hour: number | null; sport: string | null }[]>([]);
  useEffect(() => {
    supabase.from("sessions").select("date, planned_hour, sport").eq("user_id", userId).eq("status", "valide")
      .gte("date", dayjs(`${annee}-01-01`).startOf("isoWeek").format("YYYY-MM-DD")).lte("date", `${annee}-12-31`)
      .then(({ data }) => setLignes(data ?? []));
  }, [userId, annee]);
  const parSemaine = useMemo(() => {
    const debut = dayjs(`${annee}-01-01`).startOf("isoWeek");
    const n = Math.min(53, Math.ceil(dayjs(`${annee}-12-31`).diff(debut, "week", true)));
    const w = Array.from({ length: n }, (_, i) => ({ nom: debut.add(i, "week").format("D MMM"), ...Object.fromEntries(GROUPES.map((g) => [g, 0])) } as Record<string, number | string>));
    for (const s of lignes) {
      const i = dayjs(s.date).startOf("isoWeek").diff(debut, "week");
      if (w[i]) w[i][groupe(s.sport)] = (w[i][groupe(s.sport)] as number) + (s.planned_hour ?? 0);
    }
    return w;
  }, [lignes, annee]);
  const totaux = GROUPES.map((g) => ({ g, h: lignes.filter((s) => groupe(s.sport) === g).reduce((t, s) => t + (s.planned_hour ?? 0), 0) })).filter((x) => x.h > 0);
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold">{titre} <span className="text-slate-400 font-bold">· heures faites par semaine</span></h2>
        <div className="flex items-center rounded-xl border border-slate-200 p-1 text-sm font-extrabold">
          <button onClick={() => setAnnee(annee - 1)} className="px-3 py-1 rounded-lg text-slate-500 hover:bg-slate-50">{annee - 1}</button>
          <span className="px-3 py-1 rounded-lg bg-blue-50 text-blue-600">{annee}</span>
          <button onClick={() => setAnnee(annee + 1)} disabled={annee >= dayjs().year()} className="px-3 py-1 rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-30">{annee + 1}</button>
        </div>
      </div>
      {totaux.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {totaux.map(({ g, h }) => (
            <span key={g} className="rounded-full px-3 py-1 text-[13px] font-extrabold" style={{ background: SPORT_COULEUR[g] + "18", color: SPORT_COULEUR[g] }}>{SPORT_NOM[g]} · {duree(h)}</span>
          ))}
        </div>
      )}
      <div className="h-[380px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={parSemaine} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="nom" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} interval={3} />
            <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} unit=" h" />
            <Tooltip formatter={(v, n) => [duree(Number(v)) || "0", SPORT_NOM[String(n)] ?? String(n)]} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,.1)" }} />
            <Legend iconType="circle" formatter={(n) => SPORT_NOM[String(n)] ?? String(n)} wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
            {GROUPES.map((g) => <Bar key={g} dataKey={g} stackId="a" fill={SPORT_COULEUR[g]} barSize={12} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
