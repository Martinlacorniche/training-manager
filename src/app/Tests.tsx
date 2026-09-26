"use client";
import { useCallback, useEffect, useState } from "react";
import dayjs from "dayjs";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { supabase } from "@/lib/supabaseClient";
import { allure, apercuTest, CONSIGNE_VELO, CONSIGNES, CONSIGNES_DEFI, programmerTest, Protocole, PROTOCOLES, VERDICTS } from "./tests";

// ─────────────────────────────────────────────────────────────────────────
// Les tests de forme sur le site : consignes, résultat d'une séance-test,
// onglet « Mes tests » de Progrès et programmation. Pendant des composants
// de l'app (App-Coach, components/ConsignesTest, ResultatTest, SuiviTests,
// ProgrammerTest).
// ─────────────────────────────────────────────────────────────────────────

export function ConsignesTest({ protocole, texte }: { protocole: string; texte?: string | null }) {
  const liste = protocole === "defi" ? CONSIGNES_DEFI : protocole === "lsct" ? [...CONSIGNES, CONSIGNE_VELO] : CONSIGNES;
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2">
      <h3 className="font-bold text-slate-800">{protocole === "defi" ? "Pour que le défi soit juste" : "Même parcours, mêmes conditions"}</h3>
      {texte && (
        <div className="rounded-xl bg-white p-3">
          <p className="text-sm font-semibold text-slate-800 whitespace-pre-line">{texte}</p>
          <p className="text-xs text-slate-400 mt-1">Envoie-la sur ta montre (bouton « montre » dans l&apos;app) : chaque partie devient un tour, c&apos;est ce qui permet de lire le test.</p>
        </div>
      )}
      <ul className="space-y-1">{liste.map((c) => <li key={c} className="text-sm text-slate-600">• {c}</li>)}</ul>
    </section>
  );
}

export function ResultatTest({ sessionId, protocole, texte, faite }: { sessionId: string; protocole: string; texte?: string | null; faite: boolean }) {
  const [r, setR] = useState<Record<string, any> | null>(null);
  useEffect(() => {
    supabase.from("test_resultats").select("*").eq("session_id", sessionId).maybeSingle().then(({ data }) => setR(data ?? null));
  }, [sessionId]);
  if (!faite) return <ConsignesTest protocole={protocole} texte={texte} />;
  if (!r) return <p className="text-sm text-slate-500">Le résultat du test arrive dès que la montre a envoyé la séance.</p>;
  const v = VERDICTS[r.verdict] ?? VERDICTS.stable;
  const chiffres: [string, string][] = [];
  if (protocole === "tranquille") {
    if (r.fc_a != null) chiffres.push([`${Math.round(r.fc_a)} bpm`, "Cœur, 1ʳᵉ allure"]);
    if (r.fc_b != null) chiffres.push([`${Math.round(r.fc_b)} bpm`, "Cœur, 2ᵉ allure"]);
  } else if (protocole === "lsct") {
    if (r.puissance_2 != null) chiffres.push([`${Math.round(r.puissance_2)} W`, "Palier 2"]);
    if (r.puissance_3 != null) chiffres.push([`${Math.round(r.puissance_3)} W`, "Palier 3"]);
  } else if (r.indicateur != null) chiffres.push([`${allure(r.indicateur)}/km`, "Allure 10 km"]);
  if (r.fcr_60 != null) chiffres.push([`−${Math.round(r.fcr_60)} bpm`, "Récup en 1 min"]);
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
      <h3 className="font-bold text-slate-800">Résultat du test</h3>
      <p className={`text-sm font-bold ${v.couleur}`}>{v.libelle}</p>
      <p className="font-semibold text-slate-800">{r.phrase}</p>
      {chiffres.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chiffres.map(([val, lib]) => (
            <div key={lib} className="rounded-xl bg-slate-50 px-3 py-2"><p className="font-extrabold text-slate-800">{val}</p><p className="text-xs text-slate-400">{lib}</p></div>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-400">Chaleur déjà retirée, selon ta propre sensibilité.</p>
    </section>
  );
}

function ProgrammerTest({ athleteId, coach, onFait, onFermer }: { athleteId: string; coach: boolean; onFait: () => void; onFermer: () => void }) {
  const [sport, setSport] = useState<"Course" | "Vélo" | null>(null);
  const [protocole, setProtocole] = useState<Protocole | null>(null);
  const [apercu, setApercu] = useState<Record<string, any> | null>(null);
  const [date, setDate] = useState(dayjs().add(1, "day").format("YYYY-MM-DD"));
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fait, setFait] = useState(false);

  useEffect(() => {
    if (!protocole) return;
    setApercu(null); setErreur(null); setOccupe(true);
    apercuTest(athleteId, protocole).then(setApercu).catch((e) => setErreur(e.message)).finally(() => setOccupe(false));
  }, [protocole, athleteId]);

  async function programmer() {
    if (!protocole) return;
    setOccupe(true); setErreur(null);
    try { await programmerTest(athleteId, protocole, date); setFait(true); onFait(); }
    catch (e) { setErreur((e as Error).message); } finally { setOccupe(false); }
  }
  const choix = "w-full text-left rounded-xl border border-slate-200 bg-white p-4 hover:border-violet-300";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" onClick={onFermer}>
      <div className="absolute inset-0 bg-slate-900/55" />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-slate-50 rounded-2xl shadow-xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-extrabold text-slate-800">Test de forme</h3>
        {fait ? (
          <div className="space-y-3 text-center py-4">
            <p className="text-lg font-bold text-emerald-700">✓ Test programmé le {dayjs(date).format("dddd D MMMM")}</p>
            <p className="text-sm text-slate-600">{coach ? "" : "Pense à l'envoyer sur ta montre depuis l'app. "}Le résultat arrivera tout seul après la séance, dans Progrès › Mes tests.</p>
            <button onClick={onFermer} className="px-6 py-2 rounded-xl bg-blue-600 text-white font-bold">OK</button>
          </div>
        ) : !sport ? (
          <>
            <p className="text-sm text-slate-600">Un test régulier, toujours dans les mêmes conditions, est la façon la plus fiable de savoir si {coach ? "ton athlète progresse" : "tu progresses"} vraiment.</p>
            <button className={choix} onClick={() => setSport("Course")}><p className="font-bold text-slate-800">Course</p><p className="text-sm text-slate-500">Test tranquille, ou mini-défi</p></button>
            <button className={choix} onClick={() => { setSport("Vélo"); setProtocole("lsct"); }}><p className="font-bold text-slate-800">Vélo</p><p className="text-sm text-slate-500">Test tranquille à fréquence cardiaque fixe</p></button>
          </>
        ) : !protocole ? (
          <>
            {(["tranquille", "defi"] as Protocole[]).map((p) => (
              <button key={p} className={choix} onClick={() => setProtocole(p)}>
                <p className="font-bold text-slate-800">{PROTOCOLES[p].titre}</p>
                <p className="text-sm text-slate-500">{PROTOCOLES[p].quoi} {PROTOCOLES[p].frequence}.</p>
              </button>
            ))}
            <button onClick={() => setSport(null)} className="text-sm font-semibold text-slate-500">← Retour</button>
          </>
        ) : occupe && !apercu ? <p className="text-slate-500">…</p> : erreur && !apercu ? (
          <p className="text-sm text-amber-700">{erreur}</p>
        ) : apercu ? (
          <>
            <p className="font-bold text-slate-800">{apercu.titre}</p>
            <p className="text-sm text-slate-600">{PROTOCOLES[apercu.protocole as Protocole].quoi}</p>
            {apercu.manque ? <p className="text-sm text-amber-700">{apercu.manque}</p> : (
              <>
                {apercu.allures && (
                  <p className="text-sm text-slate-500">
                    {apercu.deja_fixees ? "Les mêmes allures que les tests précédents" : `Allures calculées d'après ${apercu.source}, puis gardées identiques à chaque test`} : {apercu.allures.a} puis {apercu.allures.b}/km.
                  </p>
                )}
                <ConsignesTest protocole={apercu.protocole} texte={apercu.texte} />
                <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <span className="text-sm font-semibold text-slate-700">Date</span>
                  <input type="date" value={date} min={dayjs().format("YYYY-MM-DD")} onChange={(e) => setDate(e.target.value)} className="flex-1 outline-none text-slate-800" />
                </label>
                {erreur && <p className="text-sm text-rose-600">{erreur}</p>}
                <button disabled={occupe} onClick={programmer} className="w-full py-3 rounded-xl bg-violet-600 text-white font-bold disabled:opacity-50">Programmer le test</button>
              </>
            )}
            <button onClick={() => { setProtocole(null); setApercu(null); if (sport === "Vélo") setSport(null); }} className="text-sm font-semibold text-slate-500">← Retour</button>
          </>
        ) : null}
      </div>
    </div>
  );
}

const QUOI: Record<string, string> = {
  tranquille: "Ton cœur à la 2ᵉ allure. Plus il descend, plus tu es en forme.",
  lsct: "Ta puissance au 3ᵉ palier. Plus elle monte, plus tu es en forme.",
  defi: "Ton allure 10 km mesurée par le défi. Plus elle est rapide, mieux c'est.",
};
const valeur = (p: string, x: number) => (p === "tranquille" ? `${Math.round(x)} bpm` : p === "lsct" ? `${Math.round(x)} W` : `${allure(x)}/km`);

export function SuiviTests({ userId, soi }: { userId: string; soi: boolean }) {
  const [resultats, setResultats] = useState<Record<string, any>[]>([]);
  const [prevus, setPrevus] = useState<Record<string, any>[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const charger = useCallback(async () => {
    const [{ data: r }, { data: p }] = await Promise.all([
      supabase.from("test_resultats").select("session_id, jour, protocole, valide, indicateur, verdict, phrase").eq("user_id", userId).order("jour"),
      supabase.from("sessions").select("id, date, title, status").eq("user_id", userId).not("test", "is", null).gte("date", dayjs().format("YYYY-MM-DD")).order("date"),
    ]);
    setResultats(r ?? []);
    setPrevus((p ?? []).filter((s) => s.status !== "valide"));
  }, [userId]);
  useEffect(() => { charger(); }, [charger]);
  const protocoles = (["tranquille", "lsct", "defi"] as Protocole[]).filter((p) => resultats.some((r) => r.protocole === p));
  const carte = "bg-white rounded-2xl border border-slate-200 p-5 space-y-3";

  return (
    <div className="space-y-4">
      <button onClick={() => setOuvert(true)} className="w-full py-3 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700">+ Programmer un test</button>
      {prevus.map((s) => (
        <a key={s.id} href={`/seance/${s.id}`} className="block rounded-xl bg-violet-50 p-3 text-sm font-semibold text-slate-700">{s.title} · {dayjs(s.date).format("dddd D MMMM")}</a>
      ))}
      {!resultats.length ? (
        <section className={carte}>
          <h2 className="font-bold text-slate-800">Pas encore de test</h2>
          <p className="text-sm text-slate-600">Un test tranquille toutes les 4 semaines, toujours sur le même parcours et dans les mêmes conditions : c&apos;est la façon la plus fiable de voir {soi ? "tes" : "ses"} vrais progrès, sans se mettre à fond.</p>
        </section>
      ) : protocoles.map((p) => {
        const liste = resultats.filter((r) => r.protocole === p);
        const pts = liste.filter((r) => r.valide && r.indicateur != null).map((r) => ({ jour: dayjs(r.jour).format("DD/MM"), v: Number(r.indicateur) }));
        const dernier = liste[liste.length - 1];
        const v = VERDICTS[dernier.verdict] ?? VERDICTS.stable;
        return (
          <section key={p} className={carte}>
            <h2 className="font-bold text-slate-800">{PROTOCOLES[p].titre} · {PROTOCOLES[p].sport}</h2>
            <p className={`text-sm font-bold ${v.couleur}`}>{v.libelle} · {dayjs(dernier.jour).format("DD/MM")}</p>
            <p className="font-semibold text-slate-800">{dernier.phrase}</p>
            {pts.length >= 2 && (
              <>
                <p className="text-sm text-slate-500">{QUOI[p]}</p>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={pts} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                      <CartesianGrid stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="jour" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                      <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
                      <Line type="monotone" dataKey="v" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
            <ul className="divide-y divide-slate-100">
              {[...liste].reverse().map((r) => {
                const vv = VERDICTS[r.verdict] ?? VERDICTS.stable;
                return (
                  <li key={r.session_id} className={`flex items-center gap-3 py-2 text-sm ${r.valide ? "" : "opacity-50"}`}>
                    <a href={`/seance/${r.session_id}`} className="w-12 text-slate-500 hover:underline">{dayjs(r.jour).format("DD/MM")}</a>
                    <span className="w-24 font-bold text-slate-800">{r.indicateur != null ? valeur(p, Number(r.indicateur)) : "—"}</span>
                    <span className={`font-semibold ${vv.couleur}`}>{vv.libelle}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <p className="text-xs text-slate-400">Un seul test ne prouve rien : le cœur varie de quelques battements d&apos;un jour à l&apos;autre. On n&apos;annonce un progrès que quand l&apos;écart dépasse cette marge, ou se confirme deux fois de suite.</p>
      {ouvert && <ProgrammerTest athleteId={userId} coach={!soi} onFait={charger} onFermer={() => setOuvert(false)} />}
    </div>
  );
}
