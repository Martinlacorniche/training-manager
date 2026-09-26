"use client";
import { useCallback, useEffect, useState } from "react";
import dayjs from "dayjs";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { supabase } from "@/lib/supabaseClient";
import { allure, apercuTest, CONSIGNES, programmerTest, Protocole, PROTOCOLES, VERDICTS } from "./tests";

// ─────────────────────────────────────────────────────────────────────────
// Les tests de forme sur le site : consignes, résultat d'une séance-test,
// onglet « Mes tests » de Progrès et programmation. Pendant des composants
// de l'app (App-Coach, components/ConsignesTest, ResultatTest, SuiviTests,
// ProgrammerTest).
// ─────────────────────────────────────────────────────────────────────────

const PASTILLES: Record<string, string[]> = {
  progressif: ["🏟️ Au stade", "⏱ ≈ 35 min", "⚡ À fond à la fin"],
  tranquille: ["📍 Même parcours", "⏱ ≈ 40 min", "🙂 Sans forcer"],
  lsct: ["🚲 Home-trainer", "⏱ ≈ 40 min", "❤️ Cœur dans la cible"],
  defi: ["📍 Piste ou plat", "⏱ ≈ 1 h", "⚡ 2 efforts à fond"],
};
// Une phrase à la place de la liste des paliers (le détail part sur la montre).
function resume(protocole: string, texte?: string | null): string {
  const t = texte ?? "";
  if (protocole === "progressif") return "5 min facile, puis tu accélères un peu chaque minute jusqu'à ne plus suivre.";
  if (protocole === "tranquille") {
    const a = t.match(/6' à ([\d:]+)\/km/g)?.map((x) => x.replace("6' à ", "")) ?? [];
    return a.length === 2 ? `15 min facile, puis 6 min à ${a[0]} et 6 min à ${a[1]}.` : "15 min facile, puis 2 × 6 min à allure fixe.";
  }
  if (protocole === "lsct") {
    const f = t.match(/cœur à (\d+) bpm/g)?.map((x) => x.replace(/\D/g, "")) ?? [];
    return f.length === 3 ? `10 min facile, puis 3 paliers en gardant ton cœur à ${f[0]}, ${f[1]} et ${f[2]}.` : "10 min facile, puis 3 paliers à cœur fixe.";
  }
  return "3 min à fond, 20 min de récup, 12 min à fond.";
}

// La fiche d'un test, lisible en 8 secondes : trois pastilles, une phrase,
// les consignes repliées. Même fiche que l'app (App-Coach, components/ConsignesTest.tsx).
export function ConsignesTest({ protocole, texte }: { protocole: string; texte?: string | null }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <section className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {(PASTILLES[protocole] ?? []).map((x) => <div key={x} className="rounded-xl bg-violet-50 py-2 text-center text-sm font-bold text-slate-700">{x}</div>)}
      </div>
      <p className="font-semibold text-slate-800">{resume(protocole, texte)}</p>
      <p className="text-sm text-slate-400">Envoie-le sur ta montre depuis l&apos;app : elle te guide.</p>
      <button onClick={() => setOuvert((o) => !o)} className="text-sm font-bold text-violet-700">{ouvert ? "Masquer les consignes" : "Voir les consignes"}</button>
      {ouvert && <ul className="space-y-1">{(CONSIGNES[protocole] ?? []).map((c) => <li key={c} className="text-sm text-slate-600">• {c}</li>)}</ul>}
    </section>
  );
}

export function ResultatTest({ sessionId, protocole, texte, faite }: { sessionId: string; protocole: string; texte?: string | null; faite: boolean }) {
  const [r, setR] = useState<Record<string, any> | null>(null);
  const [details, setDetails] = useState(false);
  useEffect(() => {
    supabase.from("test_resultats").select("*").eq("session_id", sessionId).maybeSingle().then(({ data }) => setR(data ?? null));
  }, [sessionId]);
  if (!faite) return <ConsignesTest protocole={protocole} texte={texte} />;
  if (!r) return <p className="text-sm text-slate-500">Le résultat du test arrive dès que la montre a envoyé la séance.</p>;
  const v = VERDICTS[r.verdict] ?? VERDICTS.stable;
  const chiffres: [string, string][] = [];
  if (protocole === "progressif") {
    const d = r.detail ?? {};
    if (d.vma_kmh) chiffres.push([`${Number(d.vma_kmh).toFixed(1).replace(".", ",")} km/h`, "VMA"]);
    if (d.fc_max) chiffres.push([`${Math.round(d.fc_max)} bpm`, "Cœur max"]);
    if (d.allure_a) chiffres.push([`${allure(d.allure_a)} · ${allure(d.allure_b)}`, "Allures des tests"]);
  } else if (protocole === "tranquille") {
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
      {chiffres.length > 0 && protocole !== "progressif" && (
        <button onClick={() => setDetails((x) => !x)} className="text-sm font-bold text-violet-700">{details ? "Masquer le détail" : "Voir le détail"}</button>
      )}
      {chiffres.length > 0 && (details || protocole === "progressif") && (
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

const MENU: { p: Protocole; titre: string; ligne: string }[] = [
  { p: "progressif", titre: "Calibrage", ligne: "Règle tes zones. Une fois, au stade." },
  { p: "tranquille", titre: "Check-up course", ligne: "Chaque mois, sans forcer." },
  { p: "lsct", titre: "Check-up vélo", ligne: "Chaque mois, sur home-trainer." },
  { p: "defi", titre: "Test allure 10 km", ligne: "Optionnel, si pas de course récente." },
];

function ProgrammerTest({ athleteId, coach, onFait, onFermer }: { athleteId: string; coach: boolean; onFait: () => void; onFermer: () => void }) {
  const [protocole, setProtocole] = useState<Protocole | null>(null);
  const [vmaFait, setVmaFait] = useState(false);
  const [apercu, setApercu] = useState<Record<string, any> | null>(null);
  const [date, setDate] = useState(dayjs().add(1, "day").format("YYYY-MM-DD"));
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fait, setFait] = useState(false);

  useEffect(() => {
    supabase.from("test_references").select("source").eq("user_id", athleteId).eq("protocole", "tranquille").maybeSingle()
      .then(({ data }) => setVmaFait(data?.source === "progressif"));
  }, [athleteId]);
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

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" onClick={onFermer}>
      <div className="absolute inset-0 bg-slate-900/55" />
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-slate-50 rounded-2xl shadow-xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          {protocole && !fait && <button onClick={() => { setProtocole(null); setApercu(null); setErreur(null); }} className="text-slate-500 font-bold">←</button>}
          <h3 className="flex-1 text-lg font-extrabold text-slate-800">{apercu ? apercu.titre : "Test de forme"}</h3>
          <button onClick={onFermer} className="text-slate-400 font-bold">✕</button>
        </div>
        {fait ? (
          <div className="space-y-3 text-center py-4">
            <p className="text-lg font-bold text-emerald-700">✓ C&apos;est dans le planning</p>
            <p className="text-sm text-slate-600">{dayjs(date).format("dddd D MMMM")}.{coach ? "" : " Envoie-le sur ta montre depuis l'app."}</p>
            <button onClick={onFermer} className="px-6 py-2 rounded-xl bg-blue-600 text-white font-bold">OK</button>
          </div>
        ) : !protocole ? (
          <>
            {MENU.map(({ p, titre, ligne }) => {
              const bloque = p === "tranquille" && !vmaFait;
              const enPremier = p === "progressif" && !vmaFait;
              return (
                <button key={p} disabled={bloque} onClick={() => setProtocole(p)}
                  className={`w-full flex items-center gap-3 text-left rounded-xl bg-white p-4 ${enPremier ? "border-2 border-violet-600" : "border border-slate-200 hover:border-violet-300"} ${bloque ? "opacity-45 cursor-not-allowed" : ""}`}>
                  <span className="flex-1"><span className="block font-bold text-slate-800">{titre}</span><span className="block text-sm text-slate-500">{bloque ? "Après le calibrage." : ligne}</span></span>
                  {enPremier && <span className="rounded-lg bg-violet-600 px-2 py-1 text-xs font-bold text-white">En premier</span>}
                </button>
              );
            })}
          </>
        ) : occupe && !apercu ? <p className="text-slate-500">…</p> : erreur && !apercu ? (
          <p className="text-sm text-amber-700">{erreur}</p>
        ) : apercu ? (
          apercu.manque ? <p className="text-sm text-amber-700">{apercu.manque}</p> : (
            <>
              <ConsignesTest protocole={apercu.protocole} texte={apercu.texte} />
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                <span className="text-sm font-semibold text-slate-700">Date</span>
                <input type="date" value={date} min={dayjs().format("YYYY-MM-DD")} onChange={(e) => setDate(e.target.value)} className="flex-1 outline-none text-slate-800" />
              </label>
              {erreur && <p className="text-sm text-rose-600">{erreur}</p>}
              <button disabled={occupe} onClick={programmer} className="w-full py-3 rounded-xl bg-violet-600 text-white font-bold disabled:opacity-50">Programmer</button>
            </>
          )
        ) : null}
      </div>
    </div>
  );
}

const QUOI: Record<string, string> = {
  progressif: "Ta VMA, calibrage après calibrage.",
  tranquille: "Ton cœur à la 2ᵉ allure. Plus il descend, plus tu es en forme.",
  lsct: "Ta puissance au 3ᵉ palier. Plus elle monte, plus tu es en forme.",
  defi: "Ton allure 10 km mesurée par le test. Plus elle est rapide, mieux c'est.",
};
const valeur = (p: string, x: number) => (p === "progressif" ? `${(x * 3.6).toFixed(1).replace(".", ",")} km/h` : p === "tranquille" ? `${Math.round(x)} bpm` : p === "lsct" ? `${Math.round(x)} W` : `${allure(x)}/km`);

export function SuiviTests({ userId, soi }: { userId: string; soi: boolean }) {
  const [resultats, setResultats] = useState<Record<string, any>[]>([]);
  const [prevus, setPrevus] = useState<Record<string, any>[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const charger = useCallback(async () => {
    const [{ data: r }, { data: p }] = await Promise.all([
      supabase.from("test_resultats").select("session_id, jour, protocole, valide, indicateur, verdict, phrase").eq("user_id", userId).order("jour"),
      supabase.from("sessions").select("id, date, title, status, test").eq("user_id", userId).not("test", "is", null).gte("date", dayjs().format("YYYY-MM-DD")).order("date"),
    ]);
    setResultats(r ?? []);
    setPrevus((p ?? []).filter((s) => s.status !== "valide"));
  }, [userId]);
  useEffect(() => { charger(); }, [charger]);
  const protocoles = (["tranquille", "lsct", "progressif", "defi"] as Protocole[]).filter((p) => resultats.some((r) => r.protocole === p));
  const preTestFait = resultats.some((r) => r.protocole === "progressif" && r.valide);
  const preTestPrevu = prevus.some((s) => s.test === "progressif");
  const carte = "bg-white rounded-2xl border border-slate-200 p-5 space-y-3";

  return (
    <div className="space-y-4">
      <button onClick={() => setOuvert(true)} className="w-full py-3 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700">+ Programmer un test</button>
      {prevus.map((s) => (
        <a key={s.id} href={`/seance/${s.id}`} className="block rounded-xl bg-violet-50 p-3 text-sm font-semibold text-slate-700">{s.title} · {dayjs(s.date).format("dddd D MMMM")}</a>
      ))}
      {!resultats.length ? (
        <section className="rounded-2xl bg-violet-50 p-4">
          <p className="font-bold text-slate-800">{preTestFait || preTestPrevu ? "Ton calibrage est prévu" : "Commence par le calibrage"}</p>
          <p className="text-sm text-slate-600">Au stade, une fois. Ensuite, un test par mois.</p>
        </section>
      ) : protocoles.map((p) => {
        const liste = resultats.filter((r) => r.protocole === p);
        const pts = liste.filter((r) => r.valide && r.indicateur != null).map((r) => ({ jour: dayjs(r.jour).format("DD/MM"), v: Number(r.indicateur) }));
        const dernier = liste[liste.length - 1];
        const v = VERDICTS[dernier.verdict] ?? VERDICTS.stable;
        return (
          <section key={p} className={carte}>
            <h2 className="font-bold text-slate-800">{PROTOCOLES[p].titre}</h2>
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
      {resultats.length >= 2 && <p className="text-xs text-slate-400">On ne dit « tu progresses » que quand l&apos;écart est net.</p>}
      {ouvert && <ProgrammerTest athleteId={userId} coach={!soi} onFait={charger} onFermer={() => setOuvert(false)} />}
    </div>
  );
}
