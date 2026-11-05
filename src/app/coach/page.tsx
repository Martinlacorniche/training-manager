"use client";
// ─────────────────────────────────────────────────────────────────────────
// Accueil coach : « Qui a besoin de moi ? » (refonte du 05/11/2026, maquette
// validée par Martin). En un coup d'œil : qui va mal, ce qu'ils ont dit, la
// semaine de chacun en 7 pastilles, les semaines à préparer, les courses.
// Le coach ne saisit rien : tout vient des séances et des bilans des athlètes.
// Pendant de l'accueil coach de l'app (App-Coach, app/coach/index.tsx).
// ─────────────────────────────────────────────────────────────────────────
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/fr";
import isoWeek from "dayjs/plugin/isoWeek";
import { Check, Flag, Copy, CaretRight, Plus } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabaseClient";
import { useCoque, NIVEAU } from "../Coque";
import { Avatar, Bandeau, alerteSeance, etatSeance, duree, type Message } from "../commun";
import { copierSemaine, annulerCopie } from "./copie";
dayjs.locale("fr");
dayjs.extend(isoWeek);

type Seance = { id: string; user_id: string; date: string; sport: string | null; title: string | null; planned_hour: number | null; intensity: string | null; status: string | null; rpe: number | null; athlete_comment: string | null };
type Bilan = { id: string; user_id: string; week_start: string; comment: string | null; fatigue: number | null; sommeil: number | null; douleur: boolean | null; douleur_zone: string | null };
type Course = { id: string; user_id: string; date: string; name: string | null };

const lien = (uid: string, date?: string, seance?: string) =>
  `/coach/planning?athlete=${uid}${date ? `&semaine=${dayjs(date).startOf("isoWeek").format("YYYY-MM-DD")}` : ""}${seance ? `&seance=${seance}` : ""}`;

function quand(date: string): string {
  const j = dayjs().startOf("day").diff(dayjs(date), "day");
  if (j === 0) return "aujourd'hui";
  if (j === 1) return "hier";
  return dayjs(date).format("dddd");
}

// La pastille d'un jour : faite, pas faite, pas renseignée, prévue, repos, course.
function Pastille({ seances, course, aujourdhui, jour }: { seances: Seance[]; course?: Course; aujourdhui: string; jour: string }) {
  const etats = seances.map((s) => etatSeance(s, aujourdhui));
  const titre = [dayjs(jour).format("ddd D"), ...seances.map((s) => `${s.title || s.sport || "Séance"}${s.planned_hour ? ` ${duree(s.planned_hour)}` : ""}`), course ? `Course : ${course.name ?? ""}` : ""].filter(Boolean).join(" · ");
  let style: React.CSSProperties = { background: "#f8fafc", border: "1.5px dashed #cbd5e1" };
  if (course) style = { background: "#fde68a", border: "2px solid #f59e0b" };
  else if (etats.includes("pas_faite")) style = { background: "#ef4444" };
  else if (etats.includes("pas_renseignee")) style = { background: "#fff", border: "3px solid #f59e0b" };
  else if (etats.length && etats.every((e) => e === "faite")) style = { background: "#22c55e" };
  else if (etats.length) style = { background: "#e2e8f0" };
  const ajd = jour === aujourdhui;
  return (
    <span title={titre} className="w-7 h-7 rounded-full box-border shrink-0 flex items-center justify-center"
      style={{ ...style, boxShadow: ajd ? "0 0 0 2px #fff, 0 0 0 4px #2563eb" : undefined }}>
      {course ? <Flag size={12} weight="fill" color="#92400e" /> : null}
    </span>
  );
}

function Tuile({ chiffre, texte, ton, href }: { chiffre: string; texte: string; ton: "rouge" | "ambre" | "neutre" | "vert"; href?: string }) {
  const c = { rouge: ["#fecaca", "#dc2626"], ambre: ["#fde68a", "#b45309"], vert: ["#bbf7d0", "#15803d"], neutre: ["#e2e8f0", "#1e293b"] }[ton];
  const corps = (
    <>
      <span className="text-2xl xl:text-[28px] font-extrabold leading-tight" style={{ color: c[1] }}>{chiffre}</span>
      <span className="text-sm font-semibold text-slate-500">{texte}</span>
    </>
  );
  const cls = "bg-white rounded-2xl px-5 py-4 flex flex-col gap-0.5 border";
  return href
    ? <Link href={href} className={`${cls} hover:shadow-md transition`} style={{ borderColor: c[0] }}>{corps}</Link>
    : <div className={cls} style={{ borderColor: c[0] }}>{corps}</div>;
}

function Accueil() {
  const { moi, athletes, etats } = useCoque();
  const [seances, setSeances] = useState<Seance[]>([]);
  const [bilans, setBilans] = useState<Bilan[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [themesProchains, setThemesProchains] = useState<Map<string, string>>(new Map());
  const [vus, setVus] = useState<Set<string>>(new Set());
  const [charge, setCharge] = useState(true);
  const [message, setMessage] = useState<Message | null>(null);
  const [n, setN] = useState(0);
  const finMessage = useCallback(() => setMessage(null), []);

  const aujourdhui = dayjs().format("YYYY-MM-DD");
  const lundi = dayjs().startOf("isoWeek");
  const jours = useMemo(() => Array.from({ length: 7 }, (_, i) => lundi.add(i, "day").format("YYYY-MM-DD")), [lundi.valueOf()]); // eslint-disable-line react-hooks/exhaustive-deps
  const lundiProchain = lundi.add(7, "day").format("YYYY-MM-DD");
  const ids = useMemo(() => athletes.map((a) => a.id_auth), [athletes]);
  const autres = useMemo(() => athletes.filter((a) => !a.moi), [athletes]);

  useEffect(() => {
    if (!moi || moi.role !== "coach") return;
    if (!ids.length) { setCharge(false); return; }
    let annule = false;
    (async () => {
      const depuis = dayjs().subtract(7, "day").isBefore(lundi) ? dayjs().subtract(7, "day").format("YYYY-MM-DD") : lundi.format("YYYY-MM-DD");
      const jusqua = lundi.add(13, "day").format("YYYY-MM-DD");
      const [s, b, c, t] = await Promise.all([
        supabase.from("sessions").select("id, user_id, date, sport, title, planned_hour, intensity, status, rpe, athlete_comment").in("user_id", ids).gte("date", depuis).lte("date", jusqua),
        supabase.from("weekly_reviews").select("id, user_id, week_start, comment, fatigue, sommeil, douleur, douleur_zone").in("user_id", ids).gte("week_start", lundi.subtract(7, "day").format("YYYY-MM-DD")),
        supabase.from("absences_competitions").select("id, user_id, date, name").in("user_id", ids).eq("type", "competition").gte("date", depuis).lte("date", dayjs().add(10, "week").format("YYYY-MM-DD")).order("date"),
        supabase.from("weekly_thematics").select("user_id, thematic").in("user_id", ids).eq("week_start", lundiProchain),
      ]);
      const listeSeances = (s.data ?? []) as Seance[];
      const listeBilans = (b.data ?? []) as Bilan[];
      const objets = [...listeSeances.map((x) => x.id), ...listeBilans.map((x) => x.id)];
      const { data: v } = objets.length ? await supabase.from("vus_coach").select("objet_id").in("objet_id", objets) : { data: [] };
      if (annule) return;
      setSeances(listeSeances);
      setBilans(listeBilans);
      setCourses((c.data ?? []) as Course[]);
      setThemesProchains(new Map(((t.data ?? []) as { user_id: string; thematic: string }[]).map((x) => [x.user_id, x.thematic])));
      setVus(new Set(((v ?? []) as { objet_id: string }[]).map((x) => x.objet_id)));
      setCharge(false);
    })();
    return () => { annule = true; };
  }, [moi, ids, n]); // eslint-disable-line react-hooks/exhaustive-deps

  const nom = useCallback((uid: string) => athletes.find((a) => a.id_auth === uid)?.name.split(" ")[0] ?? "Athlète", [athletes]);
  const dateDebut7 = dayjs().subtract(7, "day").format("YYYY-MM-DD");
  const deLaSemaine = seances.filter((s) => s.date >= jours[0] && s.date <= jours[6]);
  const prochaine = seances.filter((s) => s.date >= lundiProchain);

  // « À regarder » : douleur, séance facile ressentie très dure, bilan inquiétant, état en écart.
  const aRegarder = useMemo(() => {
    const out: { cle: string; uid: string; titre: string; texte: string; ton: "rouge" | "ambre"; href: string }[] = [];
    for (const s of seances) {
      if (s.date < dateDebut7 || s.date > aujourdhui || s.user_id === moi?.id) continue;
      const a = alerteSeance(s);
      if (a === "douleur") out.push({ cle: s.id, uid: s.user_id, titre: `${nom(s.user_id)} · ${quand(s.date)}`, texte: `« ${s.athlete_comment?.trim()} »`, ton: "rouge", href: lien(s.user_id, s.date, s.id) });
      if (a === "surmenage") out.push({ cle: s.id, uid: s.user_id, titre: `${nom(s.user_id)} · ${quand(s.date)}`, texte: `Séance facile ressentie très dure (${s.rpe}/10)`, ton: "ambre", href: lien(s.user_id, s.date, s.id) });
    }
    for (const b of bilans) {
      if (b.user_id === moi?.id) continue;
      const bouts = [b.douleur ? `Douleur${b.douleur_zone ? ` : ${b.douleur_zone}` : ""}` : "", (b.fatigue ?? 0) >= 4 ? `Fatigue ${b.fatigue}/5` : "", (b.sommeil ?? 9) <= 2 && b.sommeil != null ? `Sommeil ${b.sommeil}/5` : ""].filter(Boolean);
      if (bouts.length) out.push({ cle: b.id, uid: b.user_id, titre: `${nom(b.user_id)} · bilan de la semaine`, texte: bouts.join(", "), ton: b.douleur ? "rouge" : "ambre", href: lien(b.user_id, b.week_start) });
    }
    for (const a of autres) {
      const g = etats.get(a.id_auth)?.find((e) => e.domaine === "global");
      if (g?.niveau === "ecart") out.push({ cle: `etat-${a.id_auth}`, uid: a.id_auth, titre: nom(a.id_auth), texte: g.raison, ton: "ambre", href: lien(a.id_auth) });
    }
    return out;
  }, [seances, bilans, autres, etats, nom, moi, aujourdhui, dateDebut7]);

  // « Ce qu'ils t'ont dit » : les ressentis écrits et les mots des bilans, pas encore vus d'abord.
  const dits = useMemo(() => {
    const l: { id: string; objet: "seance" | "bilan"; uid: string; date: string; sous: string; texte: string }[] = [];
    for (const s of seances) if (s.athlete_comment?.trim() && s.date >= dateDebut7 && s.date <= aujourdhui && s.user_id !== moi?.id)
      l.push({ id: s.id, objet: "seance", uid: s.user_id, date: s.date, sous: `${quand(s.date)} · ${s.title || s.sport || "Séance"}`, texte: s.athlete_comment.trim() });
    for (const b of bilans) if (b.comment?.trim() && b.user_id !== moi?.id)
      l.push({ id: b.id, objet: "bilan", uid: b.user_id, date: dayjs(b.week_start).add(6, "day").format("YYYY-MM-DD"), sous: "bilan de la semaine", texte: b.comment.trim() });
    l.sort((a, b) => b.date.localeCompare(a.date));
    const nonVus = l.filter((x) => !vus.has(x.id));
    return { nonVus, vus: l.filter((x) => vus.has(x.id)).slice(0, 3) };
  }, [seances, bilans, vus, moi, aujourdhui, dateDebut7]);

  async function marquerVu(liste: { id: string; objet: "seance" | "bilan" }[]) {
    if (!liste.length) return;
    setVus((v) => new Set([...v, ...liste.map((x) => x.id)]));
    for (const objet of ["seance", "bilan"] as const) {
      const p = liste.filter((x) => x.objet === objet).map((x) => x.id);
      if (p.length) await supabase.rpc("marquer_vu", { p_objet: objet, p_ids: p });
    }
  }

  async function copierVersProchaine(uid: string) {
    try {
      const c = await copierSemaine(uid, jours[0], [uid], lundiProchain);
      setN((x) => x + 1);
      setMessage(c.ids.length
        ? { texte: `${c.ids.length} séance${c.ids.length > 1 ? "s" : ""} copiée${c.ids.length > 1 ? "s" : ""} pour ${nom(uid)}`, annuler: async () => { await annulerCopie(c); setN((x) => x + 1); } }
        : { texte: `Rien à copier : la semaine de ${nom(uid)} est vide` });
    } catch (e) {
      setMessage({ texte: `La copie n'a pas marché : ${(e as Error).message}` });
    }
  }

  if (!moi) return <div className="text-slate-400 font-semibold">Chargement…</div>;
  if (moi.role !== "coach") { if (typeof window !== "undefined") window.location.replace("/athlete"); return null; }

  if (!autres.length && !moi.selfCoached) {
    return (
      <div className="max-w-xl mx-auto mt-16 bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-4">
        <h1 className="text-2xl font-extrabold">Invite ton premier athlète</h1>
        <p className="text-slate-500 font-semibold">Donne-lui ton code coach : il le tape dans l&apos;app à son inscription, et sa semaine apparaît ici.</p>
        {moi.code && <div className="text-4xl font-extrabold tracking-[0.3em] text-blue-600">{moi.code}</div>}
      </div>
    );
  }

  const faites = deLaSemaine.filter((s) => s.status === "valide").length;
  const aPreparer = autres.filter((a) => !prochaine.some((s) => s.user_id === a.id_auth));
  const enEntrainement = new Set(seances.filter((s) => s.date === aujourdhui).map((s) => s.user_id)).size;
  const tri = [...athletes].sort((a, b) => {
    const pa = aRegarder.some((x) => x.uid === a.id_auth) ? 0 : 1, pb = aRegarder.some((x) => x.uid === b.id_auth) ? 0 : 1;
    return pa - pb || (a.ordre ?? 0) - (b.ordre ?? 0);
  });
  const coursesAVenir = courses.filter((c) => c.date >= aujourdhui);

  return (
    <div className="space-y-6 max-w-[1700px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] xl:text-[30px] font-extrabold text-slate-800">Bonjour {moi.nom.split(" ")[0]}</h1>
          <p className="text-[15px] font-semibold text-slate-500 mt-0.5 first-letter:uppercase">
            {dayjs().format("dddd D MMMM")} · {enEntrainement ? `${enEntrainement} athlète${enEntrainement > 1 ? "s" : ""} à l'entraînement aujourd'hui` : "personne à l'entraînement aujourd'hui"}
          </p>
        </div>
        <div className="flex gap-2.5">
          <Link href="#semaine-prochaine" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-800 hover:bg-slate-50">Préparer la semaine prochaine</Link>
          <Link href={`/coach/planning${autres[0] ? `?athlete=${autres[0].id_auth}` : ""}`} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-blue-700 inline-flex items-center gap-1.5"><Plus size={16} weight="bold" />Séance</Link>
        </div>
      </header>

      <section aria-label="Résumé" className="grid grid-cols-1 md:grid-cols-3 gap-4 xl:gap-5">
        {aRegarder.length
          ? <Tuile chiffre={`${aRegarder.length} à regarder`} texte="Une douleur, une fatigue ou un écart signalé" ton="rouge" href="#a-regarder" />
          : <Tuile chiffre="Tout va bien" texte="Rien d'inquiétant ces 7 derniers jours" ton="vert" />}
        <Tuile chiffre={`${faites} / ${deLaSemaine.length} séances`} texte="faites cette semaine, toute l'équipe" ton="neutre" />
        {aPreparer.length
          ? <Tuile chiffre={`${aPreparer.length} semaine${aPreparer.length > 1 ? "s" : ""} à préparer`} texte={`semaine prochaine vide pour ${aPreparer.slice(0, 3).map((a) => nom(a.id_auth)).join(", ")}${aPreparer.length > 3 ? "…" : ""}`} ton="ambre" href="#semaine-prochaine" />
          : <Tuile chiffre="Semaine prête" texte="tout le monde a sa semaine prochaine" ton="vert" />}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-8 flex flex-col gap-5 min-w-0">
        <section aria-label="Ton équipe" className="bg-white rounded-2xl border border-slate-200 p-5 min-w-0">
          <div className="flex items-baseline justify-between pb-2">
            <h2 className="text-lg font-extrabold">Ton équipe cette semaine</h2>
            <span className="hidden md:block text-xs font-bold text-slate-400">{lundi.format("D MMM")} → {lundi.add(6, "day").format("D MMM")}</span>
          </div>
          <div className="hidden md:grid grid-cols-[170px_220px_minmax(0,1fr)] gap-4 py-2 text-[11px] font-extrabold tracking-wider text-slate-400 border-b border-slate-100">
            <span>ATHLÈTE</span><span>LUN → DIM</span><span>COMMENT IL VA</span>
          </div>
          {charge && <div className="py-6 text-slate-400 font-semibold">Chargement…</div>}
          {!charge && tri.map((a) => {
            const alerte = aRegarder.find((x) => x.uid === a.id_auth);
            const e = etats.get(a.id_auth);
            const g = e?.find((x) => x.domaine === "global");
            const signal = e?.find((x) => x.domaine !== "global" && (x.niveau === "ecart" || x.niveau === "a_surveiller"));
            const phrase = alerte ? alerte.texte : signal?.raison ?? g?.raison ?? (a.moi ? "Ta propre semaine" : "Ne partage pas son état");
            const couleur = alerte ? (alerte.ton === "rouge" ? "#b91c1c" : "#b45309") : NIVEAU[signal?.niveau ?? g?.niveau ?? "inconnu"]?.couleur;
            const course = coursesAVenir.find((c) => c.user_id === a.id_auth);
            return (
              <Link key={a.id_auth} href={lien(a.id_auth)} className="grid grid-cols-1 md:grid-cols-[170px_220px_minmax(0,1fr)] items-center gap-x-4 gap-y-2 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 -mx-2 px-2 rounded-xl">
                <span className="flex items-center gap-2.5 min-w-0">
                  <Avatar id={a.id_auth} nom={a.name} taille={34} />
                  <span className="min-w-0">
                    <span className="block font-extrabold truncate">{a.moi ? "Moi" : a.name.split(" ")[0]}</span>
                    {course && <span className="block text-xs font-bold text-slate-400 truncate">{course.name ?? "Course"} · J-{dayjs(course.date).diff(dayjs().startOf("day"), "day")}</span>}
                  </span>
                </span>
                <span className="flex gap-1">
                  {jours.map((j) => <Pastille key={j} jour={j} aujourdhui={aujourdhui} seances={deLaSemaine.filter((s) => s.user_id === a.id_auth && s.date === j)} course={courses.find((c) => c.user_id === a.id_auth && c.date === j)} />)}
                </span>
                <span className="text-sm font-semibold min-w-0 flex items-center gap-2" style={{ color: a.moi ? "#64748b" : couleur === "#cbd5e1" ? "#64748b" : couleur }}>
                  {!a.moi && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: couleur }} />}
                  <span className="line-clamp-2">{phrase}</span>
                </span>
              </Link>
            );
          })}
          <div className="flex flex-wrap gap-x-5 gap-y-1 pt-3 text-xs font-bold text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500" />faite</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500" />pas faite</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full border-2 border-amber-500" />pas renseignée</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-200" />prévue</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full border border-dashed border-slate-300" />repos</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-200 border border-amber-500" />course</span>
          </div>
        </section>
        <section id="semaine-prochaine" aria-label="Semaine prochaine" className="bg-white rounded-2xl border border-slate-200 p-5 scroll-mt-6 min-w-0">
          <div className="flex items-baseline justify-between pb-2">
            <h2 className="text-lg font-extrabold">Semaine prochaine</h2>
            <span className="text-xs font-bold text-slate-400">du {dayjs(lundiProchain).format("D MMM")}</span>
          </div>
          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-x-6">
            {autres.map((a) => {
              const siennes = prochaine.filter((s) => s.user_id === a.id_auth);
              const total = siennes.reduce((t, s) => t + (s.planned_hour ?? 0), 0);
              const theme = themesProchains.get(a.id_auth);
              const cetteSemaine = deLaSemaine.filter((s) => s.user_id === a.id_auth).length;
              return (
                <div key={a.id_auth} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 border-b border-slate-100">
                  <Avatar id={a.id_auth} nom={a.name} taille={30} />
                  <div className="flex-1 min-w-[120px]">
                    <div className="text-sm font-extrabold truncate">{a.name.split(" ")[0]}{theme ? <span className="font-semibold text-slate-500"> · {theme}</span> : null}</div>
                    <div className={`text-[13px] font-bold ${siennes.length ? "text-slate-500" : "text-amber-600"}`}>{siennes.length ? `${siennes.length} séance${siennes.length > 1 ? "s" : ""}${total ? ` · ${duree(total)}` : ""}` : "Vide"}</div>
                  </div>
                  {!siennes.length && cetteSemaine > 0 && (
                    <button onClick={() => copierVersProchaine(a.id_auth)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-[13px] font-extrabold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 whitespace-nowrap"><Copy size={14} weight="bold" />Copier cette semaine</button>
                  )}
                  <Link href={`/coach/planning?athlete=${a.id_auth}&semaine=${lundiProchain}`} className="rounded-xl px-2.5 py-1.5 text-[13px] font-extrabold text-blue-600 hover:bg-blue-50 flex items-center">Ouvrir<CaretRight size={13} weight="bold" /></Link>
                </div>
              );
            })}
          </div>
        </section>
        </div>

        <div className="xl:col-span-4 flex flex-col gap-5 min-w-0">
          <section id="a-regarder" aria-label="À regarder" className={`bg-white rounded-2xl border p-5 space-y-2.5 ${aRegarder.length ? "border-red-200" : "border-green-200"}`}>
            <h2 className="text-lg font-extrabold">À regarder</h2>
            {!aRegarder.length && <p className="text-sm font-semibold text-green-700">Rien d&apos;inquiétant cette semaine.</p>}
            {aRegarder.map((x) => (
              <Link key={x.cle} href={x.href} className={`block rounded-xl px-3 py-2.5 ${x.ton === "rouge" ? "bg-rose-50" : "bg-amber-50"} hover:brightness-95`}>
                <span className="block text-sm font-extrabold text-slate-800 first-letter:uppercase">{x.titre}</span>
                <span className={`block text-sm font-semibold ${x.ton === "rouge" ? "text-red-800" : "text-amber-800"}`}>{x.texte}</span>
              </Link>
            ))}
          </section>

          <section aria-label="Ce qu'ils t'ont dit" className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-lg font-extrabold">Ce qu&apos;ils t&apos;ont dit</h2>
              {dits.nonVus.length > 1 && <button onClick={() => marquerVu(dits.nonVus)} className="text-[13px] font-bold text-blue-600 hover:underline">Tout marquer vu</button>}
            </div>
            {!dits.nonVus.length && <p className="text-sm font-semibold text-slate-400">Tu as tout lu.</p>}
            {[...dits.nonVus.slice(0, 10), ...dits.vus].map((x) => {
              const vu = vus.has(x.id);
              return (
                <div key={x.id} className={`flex gap-2.5 ${vu ? "opacity-55" : ""}`}>
                  <Avatar id={x.uid} nom={athletes.find((a) => a.id_auth === x.uid)?.name} taille={30} />
                  <Link href={lien(x.uid, x.date, x.objet === "seance" ? x.id : undefined)} className="flex-1 min-w-0">
                    <span className="block text-[13px] font-extrabold text-slate-800">{nom(x.uid)} · <span className="text-slate-500">{x.sous}</span></span>
                    <span className="block text-sm italic text-slate-600 line-clamp-3">« {x.texte} »</span>
                  </Link>
                  {vu
                    ? <span className="self-center text-[13px] font-extrabold text-green-600 flex items-center gap-1"><Check size={13} weight="bold" />Vu</span>
                    : <button onClick={() => marquerVu([x])} className="self-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-extrabold text-slate-800 hover:bg-blue-50 hover:border-blue-200 flex items-center gap-1"><Check size={13} weight="bold" />Vu</button>}
                </div>
              );
            })}
            {dits.nonVus.length > 0 && <p className="text-xs font-semibold text-slate-400 pt-1">L&apos;athlète voit « vu par ton coach ».</p>}
          </section>
        </div>
      </div>


      {coursesAVenir.length > 0 && (
        <section aria-label="Courses à venir" className="space-y-2.5">
          <h2 className="text-lg font-extrabold">Courses à venir</h2>
          <div className="flex flex-wrap gap-2">
            {coursesAVenir.map((c) => (
              <Link key={c.id} href={lien(c.user_id, c.date)} className="rounded-full bg-white border border-slate-200 px-3.5 py-2 text-[13px] font-bold text-slate-700 hover:border-amber-300 flex items-center gap-1.5">
                <Flag size={13} weight="fill" color="#f59e0b" />{nom(c.user_id)} · {c.name ?? "Course"} · {dayjs(c.date).format("D MMM")} · <span className="text-slate-400">J-{dayjs(c.date).diff(dayjs().startOf("day"), "day")}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
      <Bandeau message={message} onFin={finMessage} />
    </div>
  );
}

export default function Page() {
  return <Accueil />;
}
