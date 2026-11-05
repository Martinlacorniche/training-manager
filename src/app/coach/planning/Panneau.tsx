"use client";
// ─────────────────────────────────────────────────────────────────────────
// Le panneau de droite du planning coach (refonte du 05/11/2026, maquette
// validée par Martin) : il remplace les pop-up. La semaine reste visible.
// — séance à faire : tout se modifie sur place et s'enregistre seul ;
// — séance faite : lecture seule, le réalisé appartient à l'athlète (comme
//   l'app, components/coach/CoachSessionSheet.tsx) ;
// — dupliquer une séance, copier la semaine : vers lui ou d'autres athlètes.
// ─────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { X, CaretLeft, Copy, Trash, Check, ArrowSquareOut, Flask, Timer, Sparkle } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabaseClient";
import { Avatar, ETAT, INTENSITE, IconeSport, SPORT_COULEUR, SPORT_NOM, SPORTS, duree, etatSeance, lireDuree } from "../../commun";
import { useCoque } from "../../Coque";
import DemandeVsFait from "../../DemandeVsFait";
import SuiviSeance from "../../SuiviSeance";
import { ResultatTest, ProgrammerTest } from "../../Tests";
import { copierSemaine, dupliquerSeance, type Copie } from "../copie";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Seance = Record<string, any> & {
  id: string; user_id: string; date: string; status?: string | null; rpe?: number | null;
  athlete_comment?: string | null; intensity?: string | null; planned_hour?: number | null;
};

export type Vue =
  | { quoi: "seance"; id: string }
  | { quoi: "dupliquer"; id: string }
  | { quoi: "copier" }
  | null;

const DUREES = [0.5, 0.75, 1, 1.25, 1.5, 2];
const FONCTIONS = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`;
const mmss = (sec: number) => { const m = Math.round(sec / 60); return m >= 60 ? duree(m / 60) : `${m} min`; };

// ── Renfo / muscu : le chrono (comme l'app, components/coach/CoachSessionSheet.tsx) ──
// Deux façons : l'IA met MES consignes en chrono sans les changer, ou l'IA compose
// la séance et son chrono dans le cadre que je donne (semaine, prochaine course).
// Claude, appelé par nos fonctions avec la clé de l'app.
function Chrono({ s, pret, onMaj }: { s: Seance; pret: boolean; onMaj: (s: Seance) => void }) {
  const [mode, setMode] = useState<"" | "compose">("");
  const [cadre, setCadre] = useState("");
  const [occupe, setOccupe] = useState<"" | "chrono" | "compose">("");
  const [retour, setRetour] = useState<{ ok: boolean; texte: string; notes: string[] } | null>(null);
  const seq = (s.timer_sequence ?? null) as { type?: string; duration?: number }[] | null;
  const total = seq?.reduce((a, x) => a + (Number(x.duration) || 0), 0) ?? 0;
  const efforts = seq?.filter((x) => x.type === "work").length ?? 0;

  async function appeler(fn: "transcribe-renfo" | "generate-renfo", corps: Record<string, unknown>) {
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch(`${FONCTIONS}/${fn}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ session_id: s.id, user_id: s.user_id, ...corps }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) throw new Error(d.error || `Erreur ${r.status}`);
    const { data: frais } = await supabase.from("sessions").select("*").eq("id", s.id).single();
    if (frais) onMaj(frais as Seance);
    return d as { notes?: string[]; text?: string };
  }
  async function faireChrono() {
    setOccupe("chrono"); setRetour(null);
    try { const d = await appeler("transcribe-renfo", {}); setRetour({ ok: true, texte: "Chrono prêt : l'athlète le lance depuis sa séance.", notes: d.notes?.filter(Boolean) ?? [] }); }
    catch (e) { setRetour({ ok: false, texte: `Pas de chrono : ${(e as Error).message}`, notes: [] }); }
    setOccupe("");
  }
  async function composer() {
    setOccupe("compose"); setRetour(null);
    try {
      const d = await appeler("generate-renfo", { coach_brief: cadre.trim(), save: true });
      setRetour({ ok: true, texte: "Séance écrite et chrono prêt. Tu peux retoucher les consignes : le chrono suivra.", notes: d.notes?.filter(Boolean) ?? [] });
      setMode(""); setCadre("");
    } catch (e) { setRetour({ ok: false, texte: `Pas générée : ${(e as Error).message}`, notes: [] }); }
    setOccupe("");
  }

  return (
    <div className="rounded-xl border border-slate-200 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-extrabold flex items-center gap-1.5"><Timer size={16} weight="bold" className="text-green-600" />Chrono</span>
        <span className="text-xs font-bold text-slate-500">{seq?.length ? `${mmss(total)} · ${efforts} effort${efforts > 1 ? "s" : ""}` : "pas encore"}</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button disabled={!pret || !!occupe || !(s.planned_inter ?? "").trim()} onClick={faireChrono} title={!(s.planned_inter ?? "").trim() ? "Écris d'abord les consignes" : undefined}
          className="rounded-xl border border-green-200 bg-green-50 px-2.5 py-2 text-[12.5px] font-extrabold text-green-700 hover:bg-green-100 disabled:opacity-40">
          {occupe === "chrono" ? "Je fais le chrono…" : seq?.length ? "Refaire le chrono" : "Chrono de mes consignes"}
        </button>
        <button disabled={!!occupe} onClick={() => setMode(mode ? "" : "compose")}
          className={`rounded-xl px-2.5 py-2 text-[12.5px] font-extrabold flex items-center justify-center gap-1 ${mode ? "bg-violet-600 text-white" : "border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"} disabled:opacity-40`}>
          <Sparkle size={14} weight="fill" />L&apos;IA compose
        </button>
      </div>
      {mode === "compose" && (
        <div className="space-y-1.5">
          <textarea value={cadre} onChange={(e) => setCadre(e.target.value)} rows={3}
            placeholder={"Le cadre : objectif, exercices imposés ou interdits, matériel, tours…\nEx : spécifique trail, excentrique quadris, pas de saut (genou), élastique."}
            className="w-full rounded-xl border border-violet-200 p-2.5 text-[13px] font-semibold focus:outline-none focus:border-violet-500 resize-none" />
          <button disabled={!pret || !!occupe} onClick={composer} className="w-full rounded-xl bg-violet-600 py-2 text-sm font-extrabold text-white disabled:opacity-40">
            {occupe === "compose" ? "L'IA compose… (environ 30 s)" : "Composer la séance"}
          </button>
          <p className="text-[11.5px] font-semibold text-slate-400">Elle tient compte de sa semaine et de sa prochaine course. Elle remplace les consignes.</p>
        </div>
      )}
      {retour && (
        <div className={`rounded-lg p-2.5 text-[12.5px] font-semibold ${retour.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
          {retour.texte}
          {retour.notes.length > 0 && <ul className="mt-1 list-disc pl-4 text-slate-600">{retour.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
        </div>
      )}
    </div>
  );
}

function Titre({ children, retour, onFermer }: { children: React.ReactNode; retour?: () => void; onFermer: () => void }) {
  return (
    <div className="flex items-center gap-2.5">
      {retour && <button aria-label="Retour" onClick={retour} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200"><CaretLeft size={15} weight="bold" /></button>}
      <div className="flex-1 min-w-0">{children}</div>
      <button aria-label="Fermer" onClick={onFermer} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200"><X size={15} weight="bold" /></button>
    </div>
  );
}
const Etiquette = ({ children }: { children: React.ReactNode }) => <div className="text-[11px] font-extrabold tracking-wider text-slate-400 mb-1.5">{children}</div>;

// ── Séance à faire : modifiée sur place, enregistrée toute seule ──
function Modifier({ s, jours, onChange, onDupliquer, onSupprimer, onFermer }: {
  s: Seance; jours: string[]; onChange: (s: Seance) => void; onDupliquer: () => void; onSupprimer: () => void; onFermer: () => void;
}) {
  const [f, setF] = useState(s);
  const [etat, setEtat] = useState<"" | "en_cours" | "ok" | "erreur">("");
  const [autreDuree, setAutreDuree] = useState("");
  const [test, setTest] = useState(false);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dernier = useRef(s);
  useEffect(() => { setF(s); dernier.current = s; setAutreDuree(""); }, [s.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function changer(p: Partial<Seance>) {
    const n = { ...f, ...p };
    setF(n);
    setEtat("en_cours");
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = setTimeout(async () => {
      const avant = dernier.current;
      const maj: Record<string, unknown> = { sport: n.sport, title: n.title, date: n.date, planned_hour: n.planned_hour, intensity: n.intensity, planned_inter: n.planned_inter };
      // Consignes modifiées : le chrono généré ne correspond plus (même règle que l'app coach).
      if (avant.timer_sequence && (avant.planned_inter || "") !== (n.planned_inter || "")) maj.timer_sequence = null;
      const { data, error } = await supabase.from("sessions").update(maj).eq("id", s.id).select().single();
      if (error || !data) { setEtat("erreur"); return; }
      dernier.current = data as Seance;
      setEtat("ok");
      onChange(data as Seance);
    }, 600);
  }
  useEffect(() => () => { if (minuteur.current) clearTimeout(minuteur.current); }, []);

  const auj = dayjs().format("YYYY-MM-DD");
  const e = ETAT[etatSeance(f, auj)];
  return (
    <div className="flex flex-col gap-4 min-h-full [&>*]:shrink-0">
      <Titre onFermer={onFermer}>
        <span className={`text-[13px] font-extrabold flex items-center gap-1 ${etat === "erreur" ? "text-red-600" : etat === "en_cours" ? "text-slate-400" : "text-green-600"}`}>
          {etat === "erreur" ? "Pas enregistré, réessaie" : etat === "en_cours" ? "Enregistrement…" : <><Check size={13} weight="bold" />Enregistré</>}
        </span>
      </Titre>
      <div className="grid grid-cols-4 gap-1.5">
        {SPORTS.map((sp) => {
          const on = f.sport === sp;
          return (
            <button key={sp} onClick={() => changer({ sport: sp })}
              className="h-11 rounded-xl text-[12.5px] font-extrabold flex items-center justify-center gap-1.5 border"
              style={on ? { borderColor: SPORT_COULEUR[sp], background: SPORT_COULEUR[sp] + "14", color: SPORT_COULEUR[sp], borderWidth: 2 } : { borderColor: "#e2e8f0", color: "#475569" }}>
              <IconeSport sport={sp} size={15} color={on ? SPORT_COULEUR[sp] : "#64748b"} />{SPORT_NOM[sp]}
            </button>
          );
        })}
      </div>
      <input value={f.title ?? ""} onChange={(ev) => changer({ title: ev.target.value })} placeholder="Nom de la séance"
        className="text-[22px] font-extrabold border-b border-slate-200 pb-1.5 focus:outline-none focus:border-blue-500 bg-transparent" />
      <div>
        <Etiquette>LE JOUR</Etiquette>
        <div className="grid grid-cols-7 gap-1">
          {jours.map((j) => (
            <button key={j} onClick={() => changer({ date: j })} title={dayjs(j).format("dddd D MMMM")}
              className={`py-1.5 rounded-xl text-xs font-extrabold flex flex-col items-center ${f.date === j ? "bg-slate-800 text-white" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}>
              <span>{dayjs(j).format("dd").slice(0, 1).toUpperCase()}</span><span className="text-[10.5px] opacity-75">{dayjs(j).format("D")}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <Etiquette>DURÉE</Etiquette>
        <div className="flex flex-wrap gap-1.5">
          {DUREES.map((d) => (
            <button key={d} onClick={() => { setAutreDuree(""); changer({ planned_hour: d }); }}
              className={`px-3 py-1.5 rounded-full text-[13px] font-extrabold ${Math.abs((f.planned_hour ?? 0) - d) < 0.01 ? "bg-slate-800 text-white" : "border border-slate-200 text-slate-700 hover:bg-slate-50"}`}>{duree(d).replace(" min", "′")}</button>
          ))}
          <input value={autreDuree} placeholder={DUREES.some((d) => Math.abs((f.planned_hour ?? 0) - d) < 0.01) || !f.planned_hour ? "autre : 1h40" : duree(f.planned_hour)}
            onChange={(ev) => { setAutreDuree(ev.target.value); const h = lireDuree(ev.target.value); if (h) changer({ planned_hour: h }); }}
            className="w-28 px-3 py-1.5 rounded-full text-[13px] font-extrabold border border-dashed border-slate-300 focus:outline-none focus:border-blue-500" />
        </div>
      </div>
      <div>
        <Etiquette>ÇA VA ÊTRE</Etiquette>
        <div className="grid grid-cols-3 gap-1.5">
          {(["basse", "moyenne", "haute"] as const).map((k) => {
            const t = INTENSITE[k], on = (f.intensity ?? "moyenne") === k;
            return <button key={k} onClick={() => changer({ intensity: k })} className="py-2 rounded-xl text-[13px] font-extrabold"
              style={{ background: t.fond, color: t.couleur, border: on ? `2px solid ${t.couleur}` : `1px solid ${t.bord}` }}>{t.nom}</button>;
          })}
        </div>
      </div>
      <div className="flex-1 flex flex-col min-h-[140px]">
        <Etiquette>CE QU&apos;IL FAUT FAIRE</Etiquette>
        <textarea value={f.planned_inter ?? ""} onChange={(ev) => changer({ planned_inter: ev.target.value })} placeholder={"20′ tranquille\n3 × 10′ allure semi, 3′ trot entre\nLe reste tranquille"}
          className="flex-1 min-h-[140px] rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-700 leading-relaxed focus:outline-none focus:border-blue-500 resize-none" />
        {s.workout_text && <p className="text-xs font-semibold text-slate-400 mt-1.5">Déjà prête pour la montre{s.intervals_pushed_at ? " et envoyée" : ""}. Si tu changes les consignes, l&apos;athlète la renverra.</p>}
      </div>
      {(f.sport === "Renfo" || f.sport === "Muscu") && (
        <Chrono s={f} pret={etat !== "en_cours"} onMaj={(n) => { setF(n); dernier.current = n; onChange(n); }} />
      )}
      <div className="flex items-center gap-2 text-xs font-bold">
        <span className="rounded-full px-2.5 py-1" style={{ background: e.fond, color: e.couleur }}>{e.nom}</span>
        {f.test && <span className="rounded-full px-2.5 py-1 bg-violet-100 text-violet-700">Séance-test</span>}
      </div>
      <div className="flex gap-2">
        <button onClick={onDupliquer} className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-extrabold text-slate-800 hover:bg-slate-50 flex items-center justify-center gap-1.5"><Copy size={16} weight="bold" />Dupliquer</button>
        <button onClick={() => setTest(true)} className="h-11 px-3 rounded-xl border border-violet-200 text-sm font-extrabold text-violet-700 hover:bg-violet-50 flex items-center gap-1.5" title="Programmer une séance-test"><Flask size={16} weight="bold" />Test</button>
        <button onClick={onSupprimer} className="flex-1 h-11 rounded-xl border border-red-200 text-sm font-extrabold text-red-600 hover:bg-red-50 flex items-center justify-center gap-1.5"><Trash size={16} weight="bold" />Supprimer</button>
      </div>
      {test && <ProgrammerTest athleteId={s.user_id} coach onFait={() => setTest(false)} onFermer={() => setTest(false)} />}
    </div>
  );
}

// ── Séance faite : lecture seule ──
function Lire({ s, onDupliquer, onFermer }: { s: Seance; onDupliquer: () => void; onFermer: () => void }) {
  const e = ETAT[etatSeance(s, dayjs().format("YYYY-MM-DD"))];
  return (
    <div className="flex flex-col gap-4">
      <Titre onFermer={onFermer}>
        <span className="text-[13px] font-bold text-slate-500 first-letter:uppercase block">{dayjs(s.date).format("dddd D MMMM")} · {SPORT_NOM[s.sport] ?? s.sport}</span>
      </Titre>
      <div>
        <h2 className="text-[22px] font-extrabold leading-tight">{s.title || SPORT_NOM[s.sport] || "Séance"}</h2>
        <div className="flex items-center gap-2 mt-1.5 text-xs font-bold">
          <span className="rounded-full px-2.5 py-1" style={{ background: e.fond, color: e.couleur }}>{e.nom}</span>
          {s.planned_hour ? <span className="text-slate-500">prévue {duree(s.planned_hour)}</span> : null}
        </div>
      </div>
      {(s.rpe != null || s.athlete_comment) && (
        <section className="rounded-2xl bg-blue-50 p-4 space-y-1">
          <div className="text-[11px] font-extrabold tracking-wider text-blue-700">CE QU&apos;IL EN A DIT</div>
          {s.rpe != null && <div className="text-sm font-extrabold text-slate-800">Ressenti {s.rpe}/10</div>}
          {s.athlete_comment && <p className="text-[15px] italic text-slate-700">« {s.athlete_comment} »</p>}
        </section>
      )}
      {s.test && <ResultatTest sessionId={s.id} protocole={s.test} texte={s.planned_inter} faite={s.status === "valide"} />}
      <DemandeVsFait data={s} coachView />
      {s.status === "valide" && <SuiviSeance sessionId={s.id} sport={s.sport} rpe={s.rpe ?? null} date={s.date} coach />}
      {s.planned_inter && (
        <details className="rounded-xl border border-slate-200 p-3">
          <summary className="text-sm font-extrabold cursor-pointer">Les consignes</summary>
          <p className="text-sm text-slate-600 whitespace-pre-line mt-2">{s.planned_inter}</p>
        </details>
      )}
      <div className="flex gap-2">
        <button onClick={onDupliquer} className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-extrabold text-slate-800 hover:bg-slate-50 flex items-center justify-center gap-1.5"><Copy size={16} weight="bold" />Dupliquer</button>
        <a href={`/seance/${s.id}`} className="flex-1 h-11 rounded-xl bg-blue-600 text-sm font-extrabold text-white hover:bg-blue-700 flex items-center justify-center gap-1.5"><ArrowSquareOut size={16} weight="bold" />Voir en grand</a>
      </div>
    </div>
  );
}

// ── Choisir des athlètes (dupliquer / copier) ──
function Choix({ athleteId, coches, setCoches, notes }: { athleteId: string; coches: Set<string>; setCoches: (s: Set<string>) => void; notes: Record<string, string> }) {
  const { athletes } = useCoque();
  return (
    <div className="flex flex-col gap-1.5">
      {athletes.map((a) => {
        const on = coches.has(a.id_auth);
        return (
          <button key={a.id_auth} onClick={() => { const n = new Set(coches); if (on) n.delete(a.id_auth); else n.add(a.id_auth); setCoches(n); }}
            className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left ${on ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
            <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${on ? "bg-blue-600 text-white" : "border-2 border-slate-300"}`}>{on && <Check size={12} weight="bold" />}</span>
            <Avatar id={a.id_auth} nom={a.name} taille={28} />
            <span className="text-sm font-extrabold truncate">{a.moi ? "Moi" : a.name.split(" ")[0]}{a.id_auth === athleteId ? <span className="font-semibold text-slate-400"> (cette fiche)</span> : null}</span>
            {notes[a.id_auth] && <span className="ml-auto text-xs font-bold text-amber-600 text-right">{notes[a.id_auth]}</span>}
          </button>
        );
      })}
    </div>
  );
}

const RAPPEL = (
  <div className="rounded-xl bg-slate-50 p-3 text-[13.5px] font-semibold text-slate-600 leading-relaxed">
    Chacun la reçoit <b>à ses allures et ses watts</b>.<br />
    Rien n&apos;est écrasé : elle s&apos;ajoute à ce qui est déjà prévu.<br />
    Elle part sur la montre comme une séance normale.<br />
    Le ressenti et le statut ne sont pas copiés.
  </div>
);

function Dupliquer({ s, onFait, retour, onFermer }: { s: Seance; onFait: (c: Copie, n: number) => void; retour: () => void; onFermer: () => void }) {
  const { athletes } = useCoque();
  const [coches, setCoches] = useState<Set<string>>(new Set());
  const [autre, setAutre] = useState(false);
  const [date, setDate] = useState(s.date);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");
  useEffect(() => {
    const ids = athletes.map((a) => a.id_auth);
    if (!ids.length) return;
    supabase.from("sessions").select("user_id").in("user_id", ids).eq("date", date).then(({ data }) => {
      const n: Record<string, string> = {};
      for (const r of (data ?? []) as { user_id: string }[]) n[r.user_id] = `a déjà une séance ${dayjs(date).format("dddd")}`;
      setNotes(n);
    });
  }, [athletes, date]);
  async function go() {
    setOccupe(true); setErreur("");
    try { onFait(await dupliquerSeance(s.id, [...coches], date), coches.size); }
    catch (e) { setErreur((e as Error).message); setOccupe(false); }
  }
  return (
    <div className="flex flex-col gap-4 h-full">
      <Titre retour={retour} onFermer={onFermer}><div className="text-xl font-extrabold truncate">Dupliquer « {s.title || SPORT_NOM[s.sport] || "la séance"} »</div></Titre>
      <div><Etiquette>POUR QUI</Etiquette><Choix athleteId={s.user_id} coches={coches} setCoches={setCoches} notes={notes} /></div>
      <div>
        <Etiquette>QUEL JOUR</Etiquette>
        <div className="flex flex-wrap gap-1.5 items-center">
          <button onClick={() => { setAutre(false); setDate(s.date); }} className={`px-3.5 py-2 rounded-full text-[13px] font-extrabold ${!autre ? "bg-slate-800 text-white" : "border border-slate-200"}`}>Le même · {dayjs(s.date).format("ddd D")}</button>
          <button onClick={() => setAutre(true)} className={`px-3.5 py-2 rounded-full text-[13px] font-extrabold ${autre ? "bg-slate-800 text-white" : "border border-slate-200"}`}>Un autre jour</button>
          {autre && <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-bold" />}
        </div>
      </div>
      {RAPPEL}
      {erreur && <p className="text-sm font-bold text-red-600">{erreur}</p>}
      <button disabled={!coches.size || occupe} onClick={go} className="mt-auto h-12 rounded-2xl bg-blue-600 text-white font-extrabold disabled:opacity-40">
        {occupe ? "Je duplique…" : coches.size ? `Dupliquer pour ${coches.size} athlète${coches.size > 1 ? "s" : ""}` : "Coche au moins un athlète"}
      </button>
    </div>
  );
}

function CopierSemaine({ athleteId, lundi, nb, onFait, onFermer }: { athleteId: string; lundi: string; nb: number; onFait: (c: Copie, qui: number) => void; onFermer: () => void }) {
  const [coches, setCoches] = useState<Set<string>>(new Set([athleteId]));
  const semaines = Array.from({ length: 8 }, (_, i) => dayjs(lundi).add(i + 1, "week").format("YYYY-MM-DD"));
  const [vers, setVers] = useState(semaines[0]);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");
  async function go() {
    setOccupe(true); setErreur("");
    try { onFait(await copierSemaine(athleteId, lundi, [...coches], vers), coches.size); }
    catch (e) { setErreur((e as Error).message); setOccupe(false); }
  }
  return (
    <div className="flex flex-col gap-4 h-full">
      <Titre onFermer={onFermer}><div className="text-xl font-extrabold">Copier la semaine du {dayjs(lundi).format("D MMM")}</div></Titre>
      <p className="text-sm font-semibold text-slate-500">{nb} séance{nb > 1 ? "s" : ""} et le thème de la semaine.</p>
      <div><Etiquette>POUR QUI</Etiquette><Choix athleteId={athleteId} coches={coches} setCoches={setCoches} notes={{}} /></div>
      <div>
        <Etiquette>VERS LA SEMAINE DU</Etiquette>
        <div className="flex flex-wrap gap-1.5">
          {semaines.map((w, i) => (
            <button key={w} onClick={() => setVers(w)} className={`px-3 py-1.5 rounded-full text-[13px] font-extrabold ${vers === w ? "bg-slate-800 text-white" : "border border-slate-200 hover:bg-slate-50"}`}>
              {i === 0 ? "suivante · " : ""}{dayjs(w).format("D MMM")}
            </button>
          ))}
        </div>
      </div>
      {RAPPEL}
      {erreur && <p className="text-sm font-bold text-red-600">{erreur}</p>}
      <button disabled={!coches.size || !nb || occupe} onClick={go} className="mt-auto h-12 rounded-2xl bg-blue-600 text-white font-extrabold disabled:opacity-40">
        {occupe ? "Je copie…" : !nb ? "La semaine est vide" : `Copier pour ${coches.size} athlète${coches.size > 1 ? "s" : ""}`}
      </button>
    </div>
  );
}

export default function Panneau({ vue, setVue, seances, jours, lundi, athleteId, onChange, onSupprimer, onCopie }: {
  vue: Vue; setVue: (v: Vue) => void; seances: Seance[]; jours: string[]; lundi: string; athleteId: string;
  onChange: (s: Seance) => void; onSupprimer: (s: Seance) => void; onCopie: (c: Copie, texte: string) => void;
}) {
  const [ext, setExt] = useState<Seance | null>(null);
  const id = vue && vue.quoi !== "copier" ? vue.id : null;
  const locale = id ? seances.find((x) => x.id === id) ?? null : null;
  // Une séance ouverte depuis l'accueil peut être hors de la semaine affichée.
  useEffect(() => {
    setExt(null);
    if (id && !locale) supabase.from("sessions").select("*").eq("id", id).maybeSingle().then(({ data }) => setExt((data as Seance) ?? null));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = locale ?? ext;
  if (!vue) return null;
  const fermer = () => setVue(null);
  const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;
  return (
    <div className="p-5 h-full overflow-y-auto">
      {vue.quoi === "copier" && (
        <CopierSemaine athleteId={athleteId} lundi={lundi} nb={seances.length} onFermer={fermer}
          onFait={(c, qui) => { onCopie(c, `${pluriel(c.ids.length, "séance")} copiée${c.ids.length > 1 ? "s" : ""} pour ${pluriel(qui, "athlète")}`); fermer(); }} />
      )}
      {vue.quoi === "seance" && s && (s.status === "valide"
        ? <Lire s={s} onDupliquer={() => setVue({ quoi: "dupliquer", id: s.id })} onFermer={fermer} />
        : <Modifier s={s} jours={jours.includes(s.date) ? jours : Array.from({ length: 7 }, (_, i) => dayjs(s.date).startOf("isoWeek").add(i, "day").format("YYYY-MM-DD"))}
            onChange={onChange} onDupliquer={() => setVue({ quoi: "dupliquer", id: s.id })} onSupprimer={() => { onSupprimer(s); fermer(); }} onFermer={fermer} />)}
      {vue.quoi === "dupliquer" && s && (
        <Dupliquer s={s} retour={() => setVue({ quoi: "seance", id: s.id })} onFermer={fermer}
          onFait={(c, qui) => { onCopie(c, `Séance dupliquée pour ${pluriel(qui, "athlète")}`); setVue({ quoi: "seance", id: s.id }); }} />
      )}
      {vue.quoi !== "copier" && !s && <div className="text-slate-400 font-semibold">Chargement…</div>}
    </div>
  );
}
