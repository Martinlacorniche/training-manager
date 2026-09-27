"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import InfoWbgt from "./InfoWbgt";

// Le suivi d'une séance faite, en mots simples : ressenti comparé à
// d'habitude, météo et allure « au frais », tenue d'une répétition à l'autre,
// tour par tour. Calculé côté serveur, sans IA (App-Coach,
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
  const [confort, setConfort] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: a }, { data: r }] = await Promise.all([
        supabase.from("activites").select("id, user_id, source, appareil, competition_id").eq("session_id", sessionId).maybeSingle(),
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
      // Sa zone de confort (modèle du sport), pour situer l'indice chaleur de la sortie.
      const groupe = sport === "Vélo" ? "velo" : "course";
      const { data: m } = await supabase.from("modele_fc").select("w_opt, valide").eq("user_id", a.user_id).eq("sport", groupe).maybeSingle();
      setConfort(m?.valide && m.w_opt != null ? Number(m.w_opt) : null);
      // Une série d'une poignée de secondes (bouton tour pressé en fin de sortie) n'apprend rien.
      setSeries((s ?? []).filter((l: any) => (l.duree_s ?? 0) >= 20));
    })();
  }, [sessionId, sport]);

  const course = sport === "Run" || sport === "Trail";
  const dynamiques = series.some((s) => s.gct_ms != null);
  const ecart = rpe != null && attendu ? rpe - attendu.attendu : null;

  if (!act && !attendu) return (
    <p className="text-sm text-slate-400 italic">Pas encore d&apos;activité reçue de la montre pour cette séance.</p>
  );

  // UNE PHRASE SIMPLE D'ABORD, les chiffres ensuite et en petit : les détails
  // techniques (contact au sol, équilibre, indices) sont réservés au MCP.
  // Départ et fin (J. Mestrallet, 27/09) : sur les COURSES seulement (Martin) —
  // à l'entraînement, partir lentement ou accélérer à la fin est souvent voulu.
  const enCourse = !!act?.competition_id;
  const fin = enCourse && an?.fin_pct != null ? Number(an.fin_pct) : null, dep = enCourse && an?.depart_pct != null ? Number(an.depart_pct) : null;
  const phraseFin = fin == null ? null
    : fin <= -5 ? `Tu as ralenti de ${Math.round(-fin)} % sur la fin.`
    : fin < -2 ? `Léger ralentissement sur la fin (${Math.round(fin)} %).`
    : fin < 2 ? "Allure tenue jusqu'au bout."
    : `Tu as fini plus vite que tu es parti (+${Math.round(fin)} %).`;
  const phraseDepart = dep != null && dep >= 3
    ? `Parti un peu vite : ton premier tiers était ${Math.round(dep)} % plus rapide que la suite.` : null;
  const pen = Number(an?.penalite_pct ?? 0);
  const gain = an?.gap_effort && an?.gap_effort_frais ? Math.round(1000 / an.gap_effort - 1000 / an.gap_effort_frais) : 0;
  const lecture = (() => {
    if (!an || an.series_comparees < 2 || !course) return null;
    const gct = Number(an.derive_gct ?? 0), cad = Number(an.derive_cadence ?? 0), eq = Number(an.derive_equilibre ?? 0), fc = Number(an.derive_fc_fin ?? 0);
    const fatigue = gct > 8 || cad < -3;
    const phrases = [fatigue
      ? "Ta foulée s'est un peu dégradée en fin de séance (appui au sol plus long, pas moins rapides) : un signe de fatigue."
      : "Tu as bien tenu jusqu'au bout : ta foulée n'a pas bougé d'une répétition à l'autre."];
    if (an.derive_equilibre != null && Math.abs(eq) >= 1.5) {
      phrases.push(`Ton appui a glissé vers la jambe ${eq > 0 ? "gauche" : "droite"} au fil des répétitions. Rien d'inquiétant sur une séance ; à surveiller si ça se répète.`);
    }
    if (fc >= 5) phrases.push(`Ton cœur est monté un peu plus à chaque répétition${pen >= 0.3 ? ", normal avec la chaleur" : ""}.`);
    return phrases;
  })();

  return (
    <div className="space-y-4">
      {attendu && rpe != null && ecart != null && (
        <Carte titre="Ressenti">
          <p className={`font-bold ${ecart >= 1.5 ? "text-amber-700" : "text-slate-800"}`}>
            {ecart >= 2 ? "Séance nettement plus dure que d'habitude pour ce type de séance."
              : ecart >= 1.5 ? "Séance plus dure que d'habitude pour ce type de séance."
              : ecart <= -1.5 ? "Séance plus facile que d'habitude pour ce type de séance."
              : "Aussi dure que d'habitude pour ce type de séance."}
          </p>
          <p className="text-sm text-slate-500">Tu l&apos;as notée {rpe} sur 10 ; d&apos;habitude, {Math.round(attendu.attendu)} pour ce genre de séance.</p>
        </Carte>
      )}

      {an?.fc_douteuse && (
        <p className="text-sm text-slate-400">Ton cœur a peut-être été mal mesuré ({an.fc_douteuse_raison}) : cette sortie ne compte pas dans ton suivi de forme.</p>
      )}

      {(phraseFin || phraseDepart) && (
        <Carte titre="Allure">
          {phraseDepart && <p className="font-bold text-slate-800">{phraseDepart}</p>}
          {phraseFin && <p className={phraseDepart ? "text-sm text-slate-700" : "font-bold text-slate-800"}>{phraseFin}</p>}
          <p className="text-xs text-slate-400">Allure ramenée à plat, montées et descentes retirées.</p>
        </Carte>
      )}

      {an?.wbgt_moy != null && (
        <Carte titre="Météo">
          <p className="font-bold text-slate-800">
            {pen < 0.3 ? "La météo n'a pas pesé sur cette séance."
              : an.meteo_cote === "froid" ? "Il faisait froid pour toi : ça t'a coûté un peu."
              : "Il faisait chaud : ça t'a coûté un peu."}
          </p>
          <p className="text-xs text-slate-400">Indice chaleur {Math.round(Number(an.wbgt_moy))} pendant ta sortie{confort != null ? ` · tu es bien jusqu'à ${Math.round(confort)}` : ""}</p>
          {course && pen >= 0.3 && an.gap_effort && gain > 0 && (
            <p className="text-sm text-slate-700">
              Par une météo idéale pour toi, la même séance t&apos;aurait fait courir à <strong>{allure(an.gap_effort_frais)}/km</strong> au lieu de {allure(an.gap_effort)}, soit {gain} s/km plus vite.
            </p>
          )}
          <p className="text-xs text-slate-400">Chaleur, froid, humidité : chacun réagit à sa façon. <InfoWbgt /></p>
        </Carte>
      )}

      {lecture && (
        <Carte titre="D'une répétition à l'autre">
          <p className="font-bold text-slate-800">{lecture[0]}</p>
          {lecture.slice(1).map((p) => <p key={p} className="text-sm text-slate-700">{p}</p>)}
        </Carte>
      )}

      {series.length > 1 && (
        <Carte titre="Tour par tour">
          <p className="text-xs text-slate-400">Les tours enregistrés par ta montre. En gris, les récupérations.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="text-xs text-slate-400 text-left border-b border-slate-100">
                  <th className="py-1 pr-4">#</th><th className="pr-4">Durée</th><th className="pr-4">Distance</th>
                  {course ? <><th className="pr-4">Allure</th><th className="pr-4">Allure à plat</th></> : <th className="pr-4">Puissance</th>}
                  <th className="pr-4">Cœur début → fin</th>
                  {dynamiques && <><th className="pr-4">Temps au sol</th><th className="pr-4">Appui gauche</th><th className="pr-4">Rebond</th><th className="pr-4">Longueur de pas</th></>}
                  <th>Chaleur</th>
                </tr>
              </thead>
              <tbody>
                {series.map((s) => (
                  <tr key={s.idx} className={`border-b border-slate-50 ${s.genre === "RECOVERY" ? "text-slate-400" : "text-slate-700"}`}>
                    <td className="py-1 pr-4">{s.idx + 1}</td>
                    <td className="pr-4">{duree(s.duree_s)}</td>
                    <td className="pr-4">{s.distance_m ? `${n0(s.distance_m)} m` : "—"}</td>
                    {course
                      ? <><td className="pr-4 font-semibold">{allure(s.vitesse)}</td><td className="pr-4">{allure(s.gap)}</td></>
                      : <td className="pr-4 font-semibold">{s.puissance ? `${n0(s.puissance)} W` : "—"}</td>}
                    <td className="pr-4">{n0(s.fc_debut)} → {n0(s.fc_fin)}</td>
                    {dynamiques && <>
                      <td className="pr-4">{n0(s.gct_ms)} ms</td>
                      <td className="pr-4">{n1(s.gct_equilibre)} %</td>
                      <td className="pr-4">{s.osc_vert_mm != null ? `${n1(Number(s.osc_vert_mm) / 10)} cm` : "—"}</td>
                      <td className="pr-4">{s.pas_m != null ? `${n1(s.pas_m)} m` : "—"}</td>
                    </>}
                    <td>{n1(s.wbgt)}°</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400">
            « Allure à plat » : ce que vaut ton allure une fois montées et descentes retirées. « Chaleur » : l&apos;indice qui compte l&apos;humidité et le soleil.
            {dynamiques ? " Temps au sol, appui et rebond : mesurés par ta montre." : ""}
          </p>
        </Carte>
      )}
    </div>
  );
}
