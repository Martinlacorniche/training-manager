"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { supabase } from "@/lib/supabaseClient";
import { dateCarte, parcours, prochainTestConseille, reperesDe, reperesVides, REPERES, texteValeur, type CleRepere, type ResTest } from "./resultatTest";
import { allure, apercuTest, CONSIGNES, programmerTest, Protocole, VERDICTS } from "./tests";

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
  rampe: ["🚲 Home-trainer", "⏱ ≈ 40 min", "⚡ À fond à la fin"],
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
  if (protocole === "rampe") return "10 min facile, puis +20 W chaque minute jusqu'à ne plus suivre, et 10 min de retour au calme.";
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
      <p className="text-sm text-slate-400">{protocole === "lsct" || protocole === "rampe" ? "Lance-le depuis le home-trainer (ici ou dans l’app) : il règle les watts pour toi." : "Envoie-le sur ta montre depuis l’app : elle te guide."}</p>
      <button onClick={() => setOuvert((o) => !o)} className="text-sm font-bold text-violet-700">{ouvert ? "Masquer les consignes" : "Voir les consignes"}</button>
      {ouvert && <ul className="space-y-1">{(CONSIGNES[protocole] ?? []).map((c) => <li key={c} className="text-sm text-slate-600">• {c}</li>)}</ul>}
    </section>
  );
}

export function ResultatTest({ sessionId, protocole, texte, faite }: { sessionId: string; protocole: string; texte?: string | null; faite: boolean }) {
  const [r, setR] = useState<Record<string, any> | null>(null);
  const [details, setDetails] = useState(false);
  // Rampe vélo : FTP et FC max vélo actuelles, pour proposer la mise à jour.
  const [actuel, setActuel] = useState<{ ftp: number | null; fcVelo: number | null } | null>(null);
  const [maj, setMaj] = useState<"non" | "en_cours" | "ok" | "erreur">("non");
  useEffect(() => {
    supabase.from("test_resultats").select("*").eq("session_id", sessionId).maybeSingle().then(({ data }) => {
      setR(data ?? null);
      if (data?.protocole === "rampe") supabase.from("athlete_metrics").select("ftp_w, fc_max_velo").eq("user_id", data.user_id).maybeSingle()
        .then(({ data: m }) => setActuel({ ftp: m?.ftp_w != null ? Number(m.ftp_w) : null, fcVelo: m?.fc_max_velo != null ? Number(m.fc_max_velo) : null }));
    });
  }, [sessionId]);

  // Rien ne change sans l'accord de l'athlète : un geste.
  const appliquer = async () => {
    if (!r) return;
    const d = r.detail ?? {};
    setMaj("en_cours");
    const { error } = await supabase.from("athlete_metrics").upsert({
      user_id: r.user_id, ftp_w: d.ftp, ...(d.fc_max ? { fc_max_velo: d.fc_max, fc_max_velo_le: r.jour } : {}), updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) { setMaj("erreur"); return; }
    // Les zones vélo partent aussi sur intervals.icu (séances envoyées à la montre).
    supabase.functions.invoke("zones-icu", { body: { athleteId: r.user_id } }).catch(() => {});
    setActuel({ ftp: d.ftp, fcVelo: d.fc_max ?? actuel?.fcVelo ?? null });
    setMaj("ok");
  };
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
  } else if (protocole === "rampe") {
    const d = r.detail ?? {};
    if (d.ftp) chiffres.push([`${d.ftp} W`, "FTP"]);
    if (d.pma) chiffres.push([`${d.pma} W`, "Meilleure minute"]);
    if (d.fc_max) chiffres.push([`${Math.round(d.fc_max)} bpm`, "Cœur max à vélo"]);
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
      {chiffres.length > 0 && protocole !== "progressif" && protocole !== "rampe" && (
        <button onClick={() => setDetails((x) => !x)} className="text-sm font-bold text-violet-700">{details ? "Masquer le détail" : "Voir le détail"}</button>
      )}
      {chiffres.length > 0 && (details || protocole === "progressif" || protocole === "rampe") && (
        <div className="flex flex-wrap gap-2">
          {chiffres.map(([val, lib]) => (
            <div key={lib} className="rounded-xl bg-slate-50 px-3 py-2"><p className="font-extrabold text-slate-800">{val}</p><p className="text-xs text-slate-400">{lib}</p></div>
          ))}
        </div>
      )}
      {protocole === "rampe" && r.detail?.ftp && actuel && (
        actuel.ftp === r.detail.ftp && (!r.detail.fc_max || actuel.fcVelo === Math.round(r.detail.fc_max)) ? (
          <p className="text-sm font-extrabold text-green-600">✓ Ta FTP et tes zones vélo sont à jour</p>
        ) : (
          <button disabled={maj === "en_cours"} onClick={appliquer} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 disabled:opacity-50">
            {maj === "en_cours" ? <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : "✓"} Mettre ma FTP à {r.detail.ftp} W{r.detail.fc_max ? " et mes zones vélo à jour" : ""}
          </button>
        )
      )}
      {protocole === "rampe" && actuel?.ftp != null && actuel.ftp !== r.detail?.ftp && <p className="text-xs text-slate-400 text-center">Aujourd’hui : {actuel.ftp} W</p>}
      {maj === "erreur" && <p className="text-sm text-rose-600">Je n’ai pas pu enregistrer. Réessaie.</p>}
      <p className="text-xs text-slate-400">Chaleur déjà retirée, selon ta propre sensibilité.</p>
    </section>
  );
}

const MENU: { p: Protocole; titre: string; ligne: string }[] = [
  { p: "progressif", titre: "Calibrage", ligne: "Règle tes zones. Une fois, au stade." },
  { p: "tranquille", titre: "Check-up course", ligne: "Chaque mois, sans forcer." },
  { p: "lsct", titre: "Check-up vélo", ligne: "Chaque mois, sur home-trainer." },
  { p: "rampe", titre: "Calibrage vélo", ligne: "Règle ta FTP et tes zones vélo. Sur home-trainer." },
  { p: "defi", titre: "Test allure 10 km", ligne: "Optionnel, si pas de course récente." },
];

export function ProgrammerTest({ athleteId, coach, onFait, onFermer, protocoleInitial = null }: { athleteId: string; coach: boolean; onFait: () => void; onFermer: () => void; protocoleInitial?: Protocole | null }) {
  const [protocole, setProtocole] = useState<Protocole | null>(protocoleInitial);
  const [vmaFait, setVmaFait] = useState(false);
  const [apercu, setApercu] = useState<Record<string, any> | null>(null);
  const [date, setDate] = useState(dayjs().add(1, "day").format("YYYY-MM-DD"));
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fait, setFait] = useState(false);
  // Les fiches préparées dès l'ouverture, en parallèle : au clic, elles sont là.
  const [cache] = useState<Partial<Record<Protocole, Promise<Record<string, any>>>>>(() => {
    const c: Partial<Record<Protocole, Promise<Record<string, any>>>> = {};
    for (const p of ["progressif", "tranquille", "lsct", "defi", "rampe"] as Protocole[]) { c[p] = apercuTest(athleteId, p); c[p]!.catch(() => {}); }
    return c;
  });

  useEffect(() => {
    supabase.from("test_references").select("source").eq("user_id", athleteId).eq("protocole", "tranquille").maybeSingle()
      .then(({ data }) => setVmaFait(data?.source === "progressif"));
  }, [athleteId]);
  useEffect(() => {
    if (!protocole) return;
    setApercu(null); setErreur(null); setOccupe(true);
    (cache[protocole] ?? apercuTest(athleteId, protocole)).then(setApercu).catch((e) => setErreur(e.message)).finally(() => setOccupe(false));
  }, [protocole, athleteId, cache]);

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
            <p className="text-sm text-slate-600">{dayjs(date).format("dddd D MMMM")}.{coach ? "" : protocole === "lsct" || protocole === "rampe" ? " Lance-le depuis le home-trainer." : " Envoie-le sur ta montre depuis l'app."}</p>
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

const couleurSport = (cle: CleRepere) => (REPERES[cle].sport === "velo" ? "text-violet-600" : "text-blue-600");

function Titre({ children }: { children: string }) {
  return <h3 className="pt-2 text-[13px] font-extrabold uppercase tracking-[0.12em] text-slate-500">{children}</h3>;
}

// Mini-marches (vélo) ou petite piste vectorielle (course).
function Vignette({ cle }: { cle: CleRepere }) {
  if (REPERES[cle].sport === "velo") {
    const n = 6;
    return (
      <span className="flex h-[26px] w-11 shrink-0 items-end gap-[2px]" aria-hidden>
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className={`flex-1 rounded-sm ${i === n - 1 ? "bg-violet-600" : "bg-violet-200"}`} style={{ height: 6 + (i * 20) / (n - 1) }} />
        ))}
      </span>
    );
  }
  return (
    <svg width="40" height="26" viewBox="0 0 40 26" aria-hidden className="shrink-0">
      <rect x="2" y="2" width="36" height="22" rx="11" fill="none" stroke="#bfdbfe" strokeWidth="3" />
      <rect x="9" y="9" width="22" height="8" rx="4" fill="none" stroke="#2563eb" strokeWidth="2" />
    </svg>
  );
}

export function SuiviTests({ userId, soi }: { userId: string; soi: boolean }) {
  const [resultats, setResultats] = useState<Record<string, any>[]>([]);
  const [prevus, setPrevus] = useState<Record<string, any>[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [protocoleInitial, setProtocoleInitial] = useState<Protocole | null>(null);
  const [toutVoir, setToutVoir] = useState(false);
  const charger = useCallback(async () => {
    const [{ data: r }, { data: p }] = await Promise.all([
      supabase.from("test_resultats").select("session_id, jour, protocole, valide, indicateur, verdict, phrase, detail").eq("user_id", userId).order("jour"),
      supabase.from("sessions").select("id, date, title, status, test").eq("user_id", userId).not("test", "is", null).gte("date", dayjs().format("YYYY-MM-DD")).order("date"),
    ]);
    setResultats(r ?? []);
    setPrevus((p ?? []).filter((s) => s.status !== "valide"));
  }, [userId]);
  useEffect(() => { charger(); }, [charger]);
  const reperes = useMemo(() => reperesDe(resultats as unknown as ResTest[]), [resultats]);
  const vides = useMemo(() => reperesVides(reperes), [reperes]);
  const prochain = useMemo(() => prochainTestConseille(reperes), [reperes]);
  const historique = useMemo(() => parcours(resultats as unknown as ResTest[]), [resultats]);
  const ouvrir = (p: Protocole | null) => { setProtocoleInitial(p); setOuvert(true); };
  const carte = "rounded-3xl border border-white/90 bg-white/70 shadow-sm backdrop-blur";
  const tuile = `${carte} flex flex-col gap-1 p-4 text-left`;

  return (
    <div className="space-y-4">
      {prevus.map((s) => (
        <a key={s.id} href={`/seance/${s.id}`} className="block rounded-xl bg-violet-50 p-3 text-sm font-semibold text-slate-700">{s.title} · {dayjs(s.date).format("dddd D MMMM")}</a>
      ))}

      <Titre>Tes repères</Titre>
      <div className="grid grid-cols-2 gap-3">
        {reperes.map((r) => (
          <a key={r.cle} href={`/seance/${r.session_id}`} className={`${tuile} hover:bg-white/90`}>
            <span className={`text-[11px] font-extrabold tracking-[0.12em] ${couleurSport(r.cle)}`}>{REPERES[r.cle].sport === "velo" ? "VÉLO" : "COURSE"}</span>
            <span className="flex items-baseline gap-1">
              <span className="text-[30px] font-extrabold leading-tight text-slate-900">{texteValeur(r.cle, r.valeur)}</span>
              <span className="text-[13px] text-slate-500">{REPERES[r.cle].unite}</span>
            </span>
            <span className="text-[13.5px] font-bold text-slate-800">{REPERES[r.cle].mot}</span>
            <span className="text-[12.5px] text-slate-400">{dateCarte(r.jour)}</span>
            <span className="mt-1 flex items-center justify-between">
              <span className={`rounded-[10px] px-2 py-0.5 text-[11.5px] font-bold ${r.aJour ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>{r.aJour ? "à jour" : "à refaire"}</span>
              <Vignette cle={r.cle} />
            </span>
          </a>
        ))}
        {vides.map((cle) => (
          <button key={cle} onClick={() => ouvrir(REPERES[cle].protocole as Protocole)} className="flex flex-col gap-1 rounded-3xl border-[1.5px] border-dashed border-slate-300 bg-white/40 p-4 text-left hover:bg-white/60">
            <span className={`text-[11px] font-extrabold tracking-[0.12em] ${couleurSport(cle)}`}>{REPERES[cle].sport === "velo" ? "VÉLO" : "COURSE"}</span>
            <span className="mt-1 text-[15px] font-extrabold text-slate-800">{REPERES[cle].mot}</span>
            <span className="text-[13px] text-slate-400">pas encore {cle === "dix_km" ? "testé" : "testée"}</span>
            <span className="mt-1.5 text-[13.5px] font-extrabold text-violet-700">+ Programmer</span>
          </button>
        ))}
      </div>

      {prochain && (
        <>
          <Titre>Ton prochain test</Titre>
          <section className={`${carte} space-y-2 p-5`}>
            {prochain.cle ? (
              <>
                <p className="text-[22px] font-extrabold leading-tight text-slate-900">{prochain.titre}</p>
                <p className="text-[14.5px] leading-snug text-slate-500">{prochain.phrase}</p>
                <button onClick={() => ouvrir(prochain.protocole as Protocole)} className="w-full py-3.5 rounded-2xl bg-slate-900 text-white font-bold hover:bg-slate-800">Programmer ce test</button>
              </>
            ) : (
              <p className="font-bold leading-snug text-slate-800">{prochain.phrase}</p>
            )}
            <div className="text-center">
              <button onClick={() => ouvrir(null)} className="text-[13.5px] text-slate-500 underline">Programmer un autre test</button>
            </div>
          </section>
        </>
      )}

      {historique.length > 0 && (
        <>
          <Titre>Ton parcours</Titre>
          <section className={`${carte} px-4 py-1.5`}>
            <ul className="divide-y divide-slate-100">
              {(toutVoir ? historique : historique.slice(0, 6)).map((l) => (
                <li key={l.session_id}>
                  <a href={`/seance/${l.session_id}`} className="flex items-center gap-3 py-2.5 text-sm hover:bg-white/50">
                    <span className="w-16 text-slate-500">{dateCarte(l.jour)}</span>
                    <span className="flex-1 font-bold text-slate-800">{l.nom}</span>
                    <span className="font-extrabold text-slate-800">{l.valeur}</span>
                    <span className="w-16 text-right text-[12.5px] text-slate-400">{l.ecart}</span>
                  </a>
                </li>
              ))}
            </ul>
            {historique.length > 6 && (
              <button onClick={() => setToutVoir((v) => !v)} className="w-full border-t border-slate-100 py-3 text-[13.5px] font-extrabold text-violet-700">{toutVoir ? "Voir moins" : "Voir tout"}</button>
            )}
          </section>
        </>
      )}

      {ouvert && <ProgrammerTest athleteId={userId} coach={!soi} onFait={charger} onFermer={() => setOuvert(false)} protocoleInitial={protocoleInitial} />}
    </div>
  );
}
