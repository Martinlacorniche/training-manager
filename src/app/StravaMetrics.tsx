"use client";
import React from "react";

// Bloc « Données Strava » réutilisable (web) — athlète ET coach, séance ET compète.
// Affiche stats brutes + signaux dérivés (TSS, Charge FC, Dérive, zones) + indicateurs
// nage (allure /100m, SWOLF). ⓘ = explications repliables. Lecture seule.
// Toute la logique de calcul vit côté edge functions ; ici on ne fait qu'afficher.

type Data = {
  strava_activity_id?: number | null;
  strava_distance?: number | null;
  strava_elevation?: number | null;
  strava_avg_hr?: number | null;
  strava_avg_watts?: number | null;
  strava_tss?: number | null;
  strava_trimp?: number | null;
  strava_hr_drift?: number | null;
  strava_time_in_zone?: number[] | null;
  strava_pace_100?: number | null;
  strava_swolf?: number | null;
};

function fmtPace(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const ZONE_COLORS = ["#94a3b8", "#38bdf8", "#22c55e", "#f59e0b", "#ef4444"];

export default function StravaMetrics({ data }: { data: Data | null | undefined }) {
  const [showHelp, setShowHelp] = React.useState(false);
  if (!data?.strava_activity_id) return null;

  const tiz = Array.isArray(data.strava_time_in_zone) ? data.strava_time_in_zone : null;
  const total = tiz ? (tiz.reduce((a, b) => a + b, 0) || 1) : 1;

  const Stat = ({ value, label }: { value: React.ReactNode; label: string }) => (
    <div className="flex-1 min-w-[28%] rounded-lg bg-white border border-orange-200 px-2 py-1.5 text-center">
      <div className="text-sm font-extrabold text-orange-600">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );

  return (
    <div className="rounded-xl border border-orange-300 bg-orange-50/60 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-black uppercase tracking-wide text-orange-600">⚡ Données Strava</div>
        <button type="button" onClick={() => setShowHelp((v) => !v)} title="Que veulent dire ces chiffres ?"
          className="w-5 h-5 grid place-items-center rounded-full border border-orange-300 text-orange-600 text-[11px] font-bold hover:bg-orange-100">ⓘ</button>
      </div>
      {showHelp && (
        <div className="mb-2 rounded-lg bg-white border border-orange-200 p-2 text-[11px] leading-snug text-slate-600 space-y-0.5">
          <div><b>TSS</b> : charge d'entraînement (allure/puissance vs seuil).</div>
          <div><b>Charge FC</b> : effort interne via le temps dans les zones de FC (TRIMP).</div>
          <div><b>Dérive</b> : hausse de la FC à effort égal entre le début et la fin.</div>
          <div><b>SWOLF</b> : efficacité de nage (temps + coups par 25 m, plus bas = mieux).</div>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {data.strava_distance != null && <Stat value={`${data.strava_distance} km`} label="Distance" />}
        {data.strava_pace_100 != null && <Stat value={`${fmtPace(data.strava_pace_100)}/100m`} label="Allure" />}
        {data.strava_swolf != null && <Stat value={Math.round(data.strava_swolf)} label="SWOLF /25m" />}
        {data.strava_elevation != null && data.strava_elevation > 0 && <Stat value={`${data.strava_elevation} m`} label="Dénivelé +" />}
        {data.strava_avg_hr != null && <Stat value={`${Math.round(data.strava_avg_hr)} bpm`} label="FC moy." />}
        {data.strava_avg_watts != null && <Stat value={`${Math.round(data.strava_avg_watts)} w`} label="Puissance" />}
        {data.strava_tss != null && <Stat value={Math.round(data.strava_tss)} label="TSS" />}
        {data.strava_trimp != null && <Stat value={Math.round(data.strava_trimp)} label="Charge FC" />}
        {data.strava_hr_drift != null && <Stat value={`${data.strava_hr_drift > 0 ? "+" : ""}${data.strava_hr_drift}%`} label="Dérive FC" />}
      </div>
      {tiz && tiz.some((t) => t > 0) && (
        <div className="mt-2">
          <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-200">
            {tiz.map((t, i) => <div key={i} style={{ flex: t / total, backgroundColor: ZONE_COLORS[i % ZONE_COLORS.length] }} />)}
          </div>
          <div className="flex flex-wrap gap-2 mt-1 text-[11px] text-slate-500">
            {tiz.map((t, i) => t > 0 ? <span key={i}>Z{i + 1} {Math.round(t / 60)}min</span> : null)}
          </div>
        </div>
      )}
    </div>
  );
}
