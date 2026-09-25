"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import InfoWbgt from "./InfoWbgt";

// Le suivi d'une séance faite : RPE déclaré contre RPE attendu, chaleur
// réelle et allure « au frais », évolution d'une répétition à l'autre, série
// par série. Calculé côté serveur, sans IA (App-Coach,
// supabase/functions/analyse). Même contenu que l'app
// (App-Coach, components/SuiviSeance.tsx).

const allure = (v: unknown) => {
  const x = Number(v);
  if (!Number.isFinite(x) || x <= 0) return "—";
  const s = Math.round(1000 / x);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const n1 = (v: unknown) => (v == null ? "—" : (Math.round(Number(v) * 10) / 10).toString().replace(".", ","));
const n0 = (v: unknown) => (v == null ? "—" : Math.round(Number(v)).toString());
const signe = (v: unknown) => (v == null ? "—" : `${Number(v) > 0 ? "+" : ""}${n1(v)}`);
const duree = (s: unknown) => {
  const x = Number(s);
  return Number.isFinite(x) && x > 0 ? `${Math.floor(x / 60)}'${String(Math.round(x % 60)).padStart(2, "0")}` : "—";
};

function Carte({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
      <h3 className="font-bold text-slate-800">{titre}</h3>
      {children}
    </section>
  );
}

export default function SuiviSeance({ sessionId, sport, rpe }: { sessionId: string; sport: string; rpe: number | null }) {
  const [act, setAct] = useState<any | null>(null);
  const [an, setAn] = useState<any | null>(null);
  const [series, setSeries] = useState<any[]>([]);
  const [attendu, setAttendu] = useState<{ attendu: number; n: number } | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: a }, { data: r }] = await Promise.all([
        supabase.from("activites").select("id, source, appareil").eq("session_id", sessionId).maybeSingle(),
        supabase.rpc("rpe_attendu", { p_session: sessionId }),
      ]);
      setAct(a ?? null);
      const ra = Array.isArray(r) ? r[0] : r;
      setAttendu(ra?.attendu != null ? { attendu: Number(ra.attendu), n: ra.n } : null);
      if (!a) return;
      const [{ data: x }, { data: s }] = await Promise.all([
        supabase.from("activite_analyse").select("*").eq("activite_id", a.id).maybeSingle(),
        supabase.from("activite_series").select("*").eq("activite_id", a.id).order("idx"),
      ]);
      setAn(x ?? null);
      // Une série d'une poignée de secondes (bouton tour pressé en fin de sortie) n'apprend rien.
      setSeries((s ?? []).filter((l: any) => (l.duree_s ?? 0) >= 20));
    })();
  }, [sessionId]);

  const course = sport === "Run" || sport === "Trail";
  const dynamiques = series.some((s) => s.gct_ms != null);
  const ecart = rpe != null && attendu ? rpe - attendu.attendu : null;

  if (!act && !attendu) return (
    <p className="text-sm text-slate-400 italic">Pas encore d&apos;activité reçue de la montre pour cette séance.</p>
  );

  return (
    <div className="space-y-4">
      {attendu && rpe != null && ecart != null && (
        <Carte titre="Ressenti">
          <p className="text-sm text-slate-700">RPE <strong>{rpe}</strong> pour <strong>{n1(attendu.attendu)}</strong> d&apos;habitude sur ce type de séance</p>
          <p className={`text-sm font-semibold ${ecart >= 1.5 ? "text-amber-700" : ecart <= -1.5 ? "text-emerald-700" : "text-slate-500"}`}>
            {ecart >= 2 ? "Nettement plus dure que d'habitude." : ecart >= 1.5 ? "Plus dure que d'habitude." : ecart <= -1.5 ? "Plus facile que d'habitude." : "Dans la normale."}
          </p>
          <p className="text-xs text-slate-400">Médiane des {attendu.n} séances de même sport et même intensité, sur 90 jours.</p>
        </Carte>
      )}

      {an?.wbgt_moy != null && (
        <Carte titre="Chaleur">
          <p className="text-sm text-slate-700">
            <InfoWbgt /> <strong>{n1(an.wbgt_moy)} °C</strong> · pénalité attendue <strong className={Number(an.penalite_pct) >= 1 ? "text-orange-600" : ""}>{n1(an.penalite_pct)} %</strong>
          </p>
          {course && an.gap_effort && (
            <p className="text-sm text-slate-700">Allure d&apos;effort {allure(an.gap_effort)} → vaut <strong>{allure(an.gap_effort_frais)}/km au frais</strong></p>
          )}
          <p className="text-xs text-slate-400">Météo réelle au point GPS (pas le capteur de la montre, chauffé par le poignet). Acclimatation {n1(an.acclimatation)} sur 1, d&apos;après les sorties chaudes récentes.</p>
        </Carte>
      )}

      {course && an?.series_comparees >= 2 && (
        <Carte titre="D'une répétition à l'autre">
          <p className="text-sm text-slate-700">
            Sur {an.series_comparees} répétitions à allure comparable, de la première à la dernière : FC de fin {signe(an.derive_fc_fin)} bpm · cadence {signe(an.derive_cadence)} pas/min
            {an.derive_gct != null ? ` · contact au sol ${signe(an.derive_gct)} ms` : ""}
            {an.derive_equilibre != null ? ` · équilibre G/D ${signe(an.derive_equilibre)} pt` : ""}
          </p>
          {an.derive_equilibre != null && <p className="text-xs text-slate-400">L&apos;équilibre gauche/droite est un signal de contexte, jamais un diagnostic : il se lit à allure égale et sur plusieurs séances.</p>}
        </Carte>
      )}

      {series.length > 1 && (
        <Carte titre="Série par série">
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="text-xs text-slate-400 text-left border-b border-slate-100">
                  <th className="py-1 pr-3">#</th><th className="pr-3">Durée</th><th className="pr-3">Dist.</th>
                  <th className="pr-3">{course ? "Allure (GAP)" : "Puiss."}</th><th className="pr-3">FC début→fin</th>
                  {dynamiques && <><th className="pr-3">Contact</th><th className="pr-3">Éq. G</th><th className="pr-3">Oscil.</th><th className="pr-3">Pas</th></>}
                  <th>WBGT</th>
                </tr>
              </thead>
              <tbody>
                {series.map((s) => (
                  <tr key={s.idx} className={`border-b border-slate-50 ${s.genre === "RECOVERY" ? "text-slate-400" : "text-slate-700"}`}>
                    <td className="py-1 pr-3">{s.idx + 1}</td>
                    <td className="pr-3">{duree(s.duree_s)}</td>
                    <td className="pr-3">{s.distance_m ? `${n0(s.distance_m)} m` : "—"}</td>
                    <td className="pr-3 font-semibold">{course ? `${allure(s.vitesse)} (${allure(s.gap)})` : s.puissance ? `${n0(s.puissance)} W` : "—"}</td>
                    <td className="pr-3">{n0(s.fc_debut)}→{n0(s.fc_fin)}</td>
                    {dynamiques && <>
                      <td className="pr-3">{n0(s.gct_ms)} ms</td>
                      <td className="pr-3">{n1(s.gct_equilibre)} %</td>
                      <td className="pr-3">{s.osc_vert_mm != null ? `${n1(Number(s.osc_vert_mm) / 10)} cm` : "—"}</td>
                      <td className="pr-3">{s.pas_m != null ? `${n1(s.pas_m)} m` : "—"}</td>
                    </>}
                    <td>{n1(s.wbgt)}°</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400">
            Source : {act?.source === "icu" ? `fichier de la montre via intervals.icu${act?.appareil ? ` (${act.appareil})` : ""}` : "Strava"}.
            {!dynamiques && course ? " Temps de contact et équilibre : seulement avec une montre qui les mesure, branchée à intervals.icu." : ""}
          </p>
        </Carte>
      )}
    </div>
  );
}
