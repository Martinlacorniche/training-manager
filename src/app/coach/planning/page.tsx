"use client";
// ─────────────────────────────────────────────────────────────────────────
// Planning coach : la semaine d'un athlète (refonte du 05/11/2026, maquette
// validée par Martin). Plus de pop-up : un clic ouvre la séance dans le
// panneau de droite, la semaine reste visible. « + Ajouter » est toujours là,
// on glisse une carte d'un jour à l'autre, on duplique et on copie la semaine
// vers lui ou d'autres athlètes. L'adresse garde l'athlète, la semaine et la
// séance ouverte (?athlete=…&semaine=…&seance=…), pour les liens de l'accueil.
// ─────────────────────────────────────────────────────────────────────────
import Link from "next/link";
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import "dayjs/locale/fr";
import isoWeek from "dayjs/plugin/isoWeek";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { CaretLeft, CaretRight, CaretDown, Copy, Trash, BabyCarriage, Heartbeat } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabaseClient";
import { useCoque, NIVEAU } from "../../Coque";
import { Avatar, Bandeau, alerteSeance, duree, type Message } from "../../commun";
import CarteCourse from "../../CarteCourse";
import { creneauxCoach, heureCourte, ROSE } from "../../grossesse";
import Panneau, { type Seance, type Vue } from "./Panneau";
import { AjoutRapide, Bascule, CarteSeance, lireSaisie } from "./Cartes";
import Equipe from "./Equipe";
import { annulerCopie, copierSemaine, type Copie } from "../copie";
dayjs.locale("fr");
dayjs.extend(isoWeek);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Absence = Record<string, any> & { id: string; date: string; type: string };
type Bilan = { id: string; rpe_life: number | null; comment: string | null; fatigue: number | null; sommeil: number | null; stress: number | null; jambes: number | null; douleur: boolean | null; douleur_zone: string | null };
type Bande = { lundi: string; prevu: number; fait: number; theme: string | null; course: string | null };

function Planning({ athleteDemande }: { athleteDemande: string | null }) {
  const { moi, athletes, etats, setEtroit } = useCoque();
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [lundi, setLundi] = useState(() => dayjs().startOf("isoWeek").format("YYYY-MM-DD"));
  const [vue, setVueBrute] = useState<Vue>(null);
  const [seances, setSeances] = useState<Seance[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [creneaux, setCreneaux] = useState<{ id: string; jour: string; heure: string | null }[]>([]);
  const [bilan, setBilan] = useState<Bilan | null>(null);
  const [theme, setTheme] = useState("");
  const [bandes, setBandes] = useState<Bande[]>([]);
  const [prochaineCourse, setProchaineCourse] = useState<string | null>(null);
  const [reperes, setReperes] = useState<{ vma_kmh: number | null; ftp_w: number | null } | null>(null);
  const [vus, setVus] = useState<Set<string>>(new Set());
  const [menuCopie, setMenuCopie] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [n, setN] = useState(0);
  const recharger = useCallback(() => setN((x) => x + 1), []);
  const finMessage = useCallback(() => setMessage(null), []);
  const themeEnregistre = useRef("");

  // L'adresse décide au départ : ?athlete=…&semaine=…&seance=…
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const sem = p.get("semaine");
    if (sem && dayjs(sem).isValid()) setLundi(dayjs(sem).startOf("isoWeek").format("YYYY-MM-DD"));
    if (p.get("athlete")) setAthleteId(p.get("athlete"));
    if (p.get("seance")) setVueBrute({ quoi: "seance", id: p.get("seance")! });
  }, []);
  useEffect(() => { if (!athleteId && athletes.length) setAthleteId((athletes.find((a) => !a.moi) ?? athletes[0]).id_auth); }, [athletes, athleteId]);
  // Un autre athlète choisi dans le menu (la page reste montée) : on passe à sa semaine.
  useEffect(() => { if (athleteDemande && athleteDemande !== athleteId) { setAthleteId(athleteDemande); setVueBrute(null); } }, [athleteDemande]); // eslint-disable-line react-hooks/exhaustive-deps
  // … et suit ce qu'on fait, sans recharger la page.
  useEffect(() => {
    if (!athleteId) return;
    const p = new URLSearchParams({ athlete: athleteId, semaine: lundi });
    if (vue && vue.quoi !== "copier") p.set("seance", vue.id);
    window.history.replaceState(null, "", `/coach/planning?${p}`);
    window.dispatchEvent(new Event("coque:athlete"));
  }, [athleteId, lundi, vue]);
  const setVue = useCallback((v: Vue) => setVueBrute(v), []);
  // Panneau ouvert : le menu de gauche se réduit à ses icônes, la semaine garde sa place.
  useEffect(() => { setEtroit(!!vue); return () => setEtroit(false); }, [vue, setEtroit]);

  const jours = useMemo(() => Array.from({ length: 7 }, (_, i) => dayjs(lundi).add(i, "day").format("YYYY-MM-DD")), [lundi]);
  const athlete = athletes.find((a) => a.id_auth === athleteId) ?? null;

  // La semaine affichée.
  useEffect(() => {
    if (!athleteId) return;
    let annule = false;
    (async () => {
      const fin = jours[6];
      const [s, a, b, t] = await Promise.all([
        supabase.from("sessions").select("*").eq("user_id", athleteId).gte("date", lundi).lte("date", fin),
        supabase.from("absences_competitions").select("*").eq("user_id", athleteId).gte("date", lundi).lte("date", fin),
        supabase.from("weekly_reviews").select("id, rpe_life, comment, fatigue, sommeil, stress, jambes, douleur, douleur_zone").eq("user_id", athleteId).eq("week_start", lundi).maybeSingle(),
        supabase.from("weekly_thematics").select("thematic").eq("user_id", athleteId).eq("week_start", lundi).maybeSingle(),
      ]);
      const cr = await creneauxCoach(athleteId, lundi, fin).catch(() => []);
      if (annule) return;
      const liste = (s.data ?? []) as Seance[];
      setSeances(liste);
      setAbsences((a.data ?? []) as Absence[]);
      setBilan((b.data as Bilan) ?? null);
      setTheme(t.data?.thematic ?? "");
      themeEnregistre.current = t.data?.thematic ?? "";
      setCreneaux(cr);
      // Le coach ne remplit rien : afficher la semaine vaut accusé de lecture
      // de ses ressentis et de son bilan (l'athlète voit « vu par ton coach »).
      await supabase.rpc("marquer_vu_par_coach", { p_athlete: athleteId, p_du: lundi, p_au: fin });
      const avecRessenti = liste.filter((x) => x.rpe != null || x.athlete_comment).map((x) => x.id);
      const { data: v } = avecRessenti.length ? await supabase.from("vus_coach").select("objet_id").in("objet_id", avecRessenti) : { data: [] };
      if (!annule) setVus(new Set(((v ?? []) as { objet_id: string }[]).map((x) => x.objet_id)));
    })();
    return () => { annule = true; };
  }, [athleteId, lundi, jours, n]);

  // Le bandeau des 8 semaines, la prochaine course, ses repères.
  useEffect(() => {
    if (!athleteId) return;
    let annule = false;
    (async () => {
      const debut = dayjs(lundi).subtract(3, "week").format("YYYY-MM-DD");
      const fin = dayjs(lundi).add(5, "week").subtract(1, "day").format("YYYY-MM-DD");
      const [s, t, c, prochaine, r] = await Promise.all([
        supabase.from("sessions").select("date, planned_hour, status").eq("user_id", athleteId).gte("date", debut).lte("date", fin),
        supabase.from("weekly_thematics").select("week_start, thematic").eq("user_id", athleteId).gte("week_start", debut).lte("week_start", fin),
        supabase.from("absences_competitions").select("date, name").eq("user_id", athleteId).eq("type", "competition").gte("date", debut).lte("date", fin),
        supabase.from("absences_competitions").select("date, name").eq("user_id", athleteId).eq("type", "competition").gte("date", dayjs().format("YYYY-MM-DD")).order("date").limit(1),
        supabase.from("athlete_metrics").select("vma_kmh, ftp_w").eq("user_id", athleteId).maybeSingle(),
      ]);
      if (annule) return;
      setBandes(Array.from({ length: 8 }, (_, i) => {
        const l = dayjs(debut).add(i, "week"), lf = l.add(6, "day").format("YYYY-MM-DD"), ls = l.format("YYYY-MM-DD");
        const dans = ((s.data ?? []) as { date: string; planned_hour: number | null; status: string | null }[]).filter((x) => x.date >= ls && x.date <= lf);
        return {
          lundi: ls,
          prevu: dans.reduce((a, x) => a + (x.planned_hour ?? 0), 0),
          fait: dans.filter((x) => x.status === "valide").reduce((a, x) => a + (x.planned_hour ?? 0), 0),
          theme: ((t.data ?? []) as { week_start: string; thematic: string }[]).find((x) => x.week_start === ls)?.thematic ?? null,
          course: ((c.data ?? []) as { date: string; name: string | null }[]).find((x) => x.date >= ls && x.date <= lf)?.name ?? null,
        };
      }));
      const pc = prochaine.data?.[0];
      setProchaineCourse(pc ? `${pc.name ?? "Course"} dans ${dayjs(pc.date).diff(dayjs().startOf("day"), "day")} jours` : null);
      setReperes(r.data ?? null);
    })();
    return () => { annule = true; };
  }, [athleteId, lundi, n]);

  async function enregistrerTheme() {
    const v = theme.trim();
    if (!athleteId || v === themeEnregistre.current) return;
    themeEnregistre.current = v;
    if (!v) await supabase.from("weekly_thematics").delete().eq("user_id", athleteId).eq("week_start", lundi);
    else {
      const { data: deja } = await supabase.from("weekly_thematics").select("week_start").eq("user_id", athleteId).eq("week_start", lundi).maybeSingle();
      if (deja) await supabase.from("weekly_thematics").update({ thematic: v }).eq("user_id", athleteId).eq("week_start", lundi);
      else await supabase.from("weekly_thematics").insert({ user_id: athleteId, week_start: lundi, thematic: v });
    }
    setBandes((b) => b.map((x) => (x.lundi === lundi ? { ...x, theme: v || null } : x)));
  }

  async function ajouter(date: string, texte: string) {
    if (!athleteId) return;
    const { data, error } = await supabase.from("sessions").insert({ user_id: athleteId, coach_id: moi?.id, date, ...lireSaisie(texte) }).select().single();
    if (error || !data) { setMessage({ texte: `Pas ajoutée : ${error?.message ?? "erreur"}` }); return; }
    setSeances((l) => [...l, data as Seance]);
    setVue({ quoi: "seance", id: (data as Seance).id });
  }

  async function supprimer(s: Seance) {
    const { error } = await supabase.from("sessions").delete().eq("id", s.id);
    if (error) { setMessage({ texte: `Pas supprimée : ${error.message}` }); return; }
    setSeances((l) => l.filter((x) => x.id !== s.id));
    setMessage({ texte: "Séance supprimée", annuler: async () => { await supabase.from("sessions").insert(s); recharger(); } });
  }

  async function supprimerAbsence(a: Absence) {
    const { error } = await supabase.from("absences_competitions").delete().eq("id", a.id);
    if (error) { setMessage({ texte: `Pas supprimée : ${error.message}` }); return; }
    setAbsences((l) => l.filter((x) => x.id !== a.id));
    setMessage({ texte: a.type === "competition" ? "Course retirée" : "Repos retiré", annuler: async () => { await supabase.from("absences_competitions").insert(a); recharger(); } });
  }

  async function deplacer(r: DropResult) {
    if (!r.destination || r.destination.droppableId === r.source.droppableId) return;
    const date = r.destination.droppableId, id = r.draggableId;
    const avant = seances.find((x) => x.id === id);
    if (!avant) return;
    setSeances((l) => l.map((x) => (x.id === id ? { ...x, date } : x)));
    const { error } = await supabase.from("sessions").update({ date }).eq("id", id);
    if (error) { setSeances((l) => l.map((x) => (x.id === id ? avant : x))); setMessage({ texte: `Pas déplacée : ${error.message}` }); return; }
    setMessage({ texte: `Séance déplacée à ${dayjs(date).format("dddd")}`, annuler: async () => { await supabase.from("sessions").update({ date: avant.date }).eq("id", id); recharger(); } });
  }

  function copieFaite(c: Copie, texte: string) {
    recharger();
    setMessage({ texte, annuler: async () => { await annulerCopie(c); recharger(); } });
  }

  async function copierVersSuivante() {
    setMenuCopie(false);
    if (!athleteId) return;
    try {
      const c = await copierSemaine(athleteId, lundi, [athleteId], dayjs(lundi).add(1, "week").format("YYYY-MM-DD"));
      copieFaite(c, c.ids.length ? `${c.ids.length} séance${c.ids.length > 1 ? "s" : ""} copiée${c.ids.length > 1 ? "s" : ""} sur la semaine suivante` : "Rien à copier : la semaine est vide");
    } catch (e) { setMessage({ texte: `La copie n'a pas marché : ${(e as Error).message}` }); }
  }

  if (moi && moi.role !== "coach") { window.location.replace("/athlete"); return null; }
  if (!athlete) return <div className="p-8 text-slate-400 font-semibold">{athletes.length || !moi ? "Chargement…" : "Pas encore d'athlète : donne ton code coach pour qu'il te rejoigne."}</div>;

  const e = etats.get(athlete.id_auth);
  const g = e?.find((x) => x.domaine === "global");
  const signal = e?.find((x) => x.domaine !== "global" && (x.niveau === "ecart" || x.niveau === "a_surveiller"));
  const douleur = seances.find((x) => alerteSeance(x) === "douleur");
  const phrase = douleur ? `« ${douleur.athlete_comment?.trim()} » ${dayjs(douleur.date).format("dddd")}` : signal?.raison ?? g?.raison ?? null;
  const couleurPhrase = douleur ? "#b91c1c" : NIVEAU[signal?.niveau ?? g?.niveau ?? "inconnu"].couleur;
  const faites = seances.filter((x) => x.status === "valide").length;
  const heures = seances.reduce((a, x) => a + (x.planned_hour ?? 0), 0);
  const auj = dayjs().format("YYYY-MM-DD");
  const semaineCourante = dayjs().startOf("isoWeek").format("YYYY-MM-DD");
  const bilanTexte = bilan ? [
    ...[["fatigue", "Fatigue"], ["sommeil", "Sommeil"], ["stress", "Stress"], ["jambes", "Jambes"]].filter(([k]) => typeof bilan[k as keyof Bilan] === "number").map(([k, l]) => `${l} ${bilan[k as keyof Bilan]}/5`),
    bilan.douleur ? `Douleur${bilan.douleur_zone ? ` : ${bilan.douleur_zone}` : ""}` : "",
  ].filter(Boolean).join(" · ") : "";
  const panneauOuvert = !!vue;

  return (
    <div className="flex min-h-screen">
      <div className="flex-1 min-w-0 px-4 py-5 lg:px-7 lg:py-6 flex flex-col gap-4">
        <header className="flex flex-wrap items-center gap-3.5">
          <Avatar id={athlete.id_auth} nom={athlete.name} taille={48} />
          <div className="flex-1 min-w-[220px]">
            <h1 className="text-[26px] font-extrabold leading-tight">{athlete.moi ? "Mon planning" : athlete.name}</h1>
            <p className="text-sm font-semibold text-slate-500 mt-0.5 flex flex-wrap gap-x-2">
              {phrase && <span className="font-extrabold" style={{ color: couleurPhrase === "#cbd5e1" ? "#64748b" : couleurPhrase }}>{phrase}</span>}
              {prochaineCourse && <span>{phrase ? "· " : ""}{prochaineCourse}</span>}
              {reperes && (reperes.vma_kmh || reperes.ftp_w) ? <span className="text-slate-400">· {[reperes.vma_kmh ? `VMA ${reperes.vma_kmh}` : "", reperes.ftp_w ? `FTP ${reperes.ftp_w} W` : ""].filter(Boolean).join(" · ")}</span> : null}
            </p>
          </div>
          <Bascule equipe={false} lundi={lundi} athleteId={athlete.id_auth} />
          <Link href={`/progres?athlete=${athlete.id_auth}`} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-extrabold text-slate-800 hover:bg-slate-50 flex items-center gap-1.5"><Heartbeat size={16} weight="bold" />Ses progrès</Link>
          <div className="relative">
            <button onClick={() => setMenuCopie((v) => !v)} className={`rounded-xl px-3.5 py-2.5 text-sm font-extrabold flex items-center gap-1.5 ${menuCopie ? "border-2 border-blue-600 bg-blue-50 text-blue-600" : "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"}`}>
              <Copy size={16} weight="bold" />Copier la semaine<CaretDown size={13} weight="bold" />
            </button>
            {menuCopie && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuCopie(false)} />
                <div className="absolute right-0 top-12 z-20 w-80 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                  <button onClick={copierVersSuivante} className="w-full text-left rounded-xl px-3 py-2.5 hover:bg-slate-50">
                    <div className="text-sm font-extrabold">Vers la semaine suivante</div>
                    <div className="text-[12.5px] font-semibold text-slate-500">pour {athlete.moi ? "moi" : athlete.name.split(" ")[0]}, du {dayjs(lundi).add(1, "week").format("D MMM")}</div>
                  </button>
                  <button onClick={() => { setMenuCopie(false); setVue({ quoi: "copier" }); }} className="w-full text-left rounded-xl px-3 py-2.5 hover:bg-slate-50">
                    <div className="text-sm font-extrabold">Vers d&apos;autres athlètes ou une autre semaine</div>
                    <div className="text-[12.5px] font-semibold text-slate-500">tu coches qui et la semaine d&apos;arrivée</div>
                  </button>
                  <div className="px-3 pt-1 pb-1.5 text-xs font-bold text-slate-400">Le thème suit. Tu peux annuler juste après.</div>
                </div>
              </>
            )}
          </div>
        </header>

        <section aria-label="Semaines" className="flex items-stretch gap-1.5">
          <button aria-label="Semaine d'avant" onClick={() => setLundi(dayjs(lundi).subtract(1, "week").format("YYYY-MM-DD"))} className="px-1.5 rounded-lg text-slate-500 hover:bg-slate-100"><CaretLeft size={18} weight="bold" /></button>
          <div className="flex-1 grid grid-cols-4 md:grid-cols-8 gap-1.5">
            {bandes.map((b) => {
              const ici = b.lundi === lundi, cette = b.lundi === semaineCourante;
              const vide = !b.prevu, avenir = b.lundi > semaineCourante;
              return (
                <button key={b.lundi} onClick={() => setLundi(b.lundi)} title={b.theme ?? undefined}
                  className={`h-12 rounded-xl px-2 py-1.5 text-left flex flex-col justify-between overflow-hidden ${ici ? "border-2 border-blue-600 bg-blue-50" : b.course ? "border border-rose-200 bg-rose-50" : vide && avenir ? "border border-dashed border-amber-400 bg-amber-50" : "border border-slate-200 bg-white hover:bg-slate-50"}`}>
                  <span className={`text-[11px] font-extrabold truncate ${ici ? "text-blue-600" : b.course ? "text-rose-700" : vide && avenir ? "text-amber-700" : "text-slate-500"}`}>
                    {cette ? "Cette semaine" : dayjs(b.lundi).format("D MMM")}{b.course ? ` · ${b.course}` : ""}
                  </span>
                  {b.prevu > 0
                    ? <span className="h-1.5 rounded-full bg-slate-200 overflow-hidden"><span className="block h-full bg-green-500 rounded-full" style={{ width: `${Math.min(100, (b.fait / b.prevu) * 100)}%` }} /></span>
                    : <span className="text-[10.5px] font-bold text-amber-700">{avenir ? "à préparer" : ""}</span>}
                </button>
              );
            })}
          </div>
          <button aria-label="Semaine d'après" onClick={() => setLundi(dayjs(lundi).add(1, "week").format("YYYY-MM-DD"))} className="px-1.5 rounded-lg text-slate-500 hover:bg-slate-100"><CaretRight size={18} weight="bold" /></button>
        </section>

        <section aria-label="La semaine" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5">
          <span className="text-sm font-extrabold text-slate-800 first-letter:uppercase">{lundi === semaineCourante ? "Cette semaine" : `Semaine du ${dayjs(lundi).format("D MMMM")}`}</span>
          {lundi !== semaineCourante && <button onClick={() => setLundi(semaineCourante)} className="text-xs font-extrabold text-blue-600 hover:underline">revenir à aujourd&apos;hui</button>}
          <label className="flex-1 min-w-[220px] flex items-center gap-2">
            <span className="text-[11px] font-extrabold tracking-wider text-slate-400">THÈME</span>
            <input value={theme} onChange={(e) => setTheme(e.target.value)} onBlur={enregistrerTheme} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              placeholder="Ex. : bloc seuil, on garde du jus" className="flex-1 bg-transparent text-[15px] font-bold border-b border-dashed border-slate-300 py-0.5 focus:outline-none focus:border-blue-500" />
          </label>
          <span className="text-sm font-extrabold">{faites} faite{faites > 1 ? "s" : ""} / {seances.length} prévue{seances.length > 1 ? "s" : ""}</span>
          {heures > 0 && <span className="text-sm font-bold text-slate-500">· {duree(heures)}</span>}
        </section>

        {bilan && (bilanTexte || bilan.comment) && (
          <section className={`rounded-2xl px-4 py-2.5 text-sm font-semibold ${bilan.douleur || (bilan.fatigue ?? 0) >= 4 ? "bg-amber-50 text-amber-900" : "bg-white border border-slate-200 text-slate-600"}`}>
            <b className="text-slate-800">Son bilan de la semaine</b>{bilanTexte ? ` · ${bilanTexte}` : ""}{bilan.comment ? <i> · « {bilan.comment} »</i> : null}
          </section>
        )}

        <DragDropContext onDragEnd={deplacer}>
          <section aria-label="Les 7 jours" className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 ${panneauOuvert ? "xl:grid-cols-7" : "lg:grid-cols-7"} gap-2 flex-1`}>
            {jours.map((j) => {
              const ajd = j === auj;
              const duJour = seances.filter((x) => x.date === j);
              const abs = absences.filter((x) => x.date === j);
              const cr = creneaux.filter((c) => c.jour === j);
              return (
                <Droppable droppableId={j} key={j}>
                  {(p, snap) => (
                    <div ref={p.innerRef} {...p.droppableProps} className={`flex flex-col gap-2 rounded-2xl p-1.5 min-h-[180px] transition ${snap.isDraggingOver ? "bg-blue-50 ring-2 ring-blue-200" : ""}`}>
                      <div className={`px-1 text-[13px] font-extrabold first-letter:uppercase flex items-center gap-1.5 ${ajd ? "text-blue-600" : "text-slate-500"}`} title={ajd ? "Aujourd'hui" : undefined}>{dayjs(j).format("ddd D")}{ajd && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}</div>
                      {cr.map((c) => (
                        <div key={c.id} className="flex items-center gap-1.5 px-1 text-xs font-bold" style={{ color: ROSE }}><BabyCarriage size={15} />Suivi{c.heure ? ` · ${heureCourte(c.heure)}` : ""}</div>
                      ))}
                      {abs.map((a) => a.type === "competition" ? (
                        <CarteCourse key={a.id} a={a} action={<button aria-label="Retirer" onClick={() => supprimerAbsence(a)} className="opacity-70 hover:opacity-100"><Trash size={14} /></button>} />
                      ) : (
                        <div key={a.id} className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-500 flex items-start justify-between gap-1">
                          <span>Repos{a.comment ? <i className="block font-semibold">« {a.comment} »</i> : null}</span>
                          <button aria-label="Retirer" onClick={() => supprimerAbsence(a)} className="opacity-60 hover:opacity-100"><Trash size={13} /></button>
                        </div>
                      ))}
                      {duJour.map((s, i) => (
                        <Draggable key={s.id} draggableId={s.id} index={i} isDragDisabled={s.status === "valide"} disableInteractiveElementBlocking>
                          {(d) => (
                            <div ref={d.innerRef} {...d.draggableProps} {...d.dragHandleProps}>
                              <CarteSeance s={s} vu={vus.has(s.id)} ouverte={!!vue && vue.quoi !== "copier" && vue.id === s.id} onOuvrir={() => setVue({ quoi: "seance", id: s.id })} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {p.placeholder}
                      <AjoutRapide onAjout={(t) => ajouter(j, t)} />
                    </div>
                  )}
                </Droppable>
              );
            })}
          </section>
        </DragDropContext>
        <p className="text-xs font-bold text-slate-400">Glisse une carte pour la changer de jour. Un clic l&apos;ouvre à droite. Écris « Footing 1h facile » dans « + Ajouter » puis Entrée.</p>
      </div>

      {panneauOuvert && (
        <>
          <div className="xl:hidden fixed inset-0 z-30 bg-slate-900/30" onClick={() => setVue(null)} />
          <aside aria-label="Panneau" className="fixed xl:sticky right-0 top-0 z-40 xl:z-auto h-screen w-full sm:w-[440px] xl:w-[420px] shrink-0 bg-white border-l border-slate-200 shadow-[-8px_0_24px_rgba(15,23,42,0.06)]">
            <Panneau vue={vue} setVue={setVue} seances={seances} jours={jours} lundi={lundi} athleteId={athlete.id_auth}
              onChange={(s) => setSeances((l) => (s.date >= jours[0] && s.date <= jours[6] ? l.map((x) => (x.id === s.id ? s : x)) : l.filter((x) => x.id !== s.id)))}
              onSupprimer={supprimer} onCopie={copieFaite} />
          </aside>
        </>
      )}
      <Bandeau message={message} onFin={finMessage} />
    </div>
  );
}

// ?vue=equipe : toute l'équipe sur la semaine ; sinon la semaine d'un athlète.
// La navigation est instantanée (le menu ne se recharge plus) : un autre athlète
// choisi dans le menu = une nouvelle semaine, d'où la clé sur l'athlète et la vue.
function Aiguillage() {
  const p = useSearchParams();
  const equipe = p.get("vue") === "equipe";
  return equipe ? <Equipe /> : <Planning athleteDemande={p.get("athlete")} />;
}

export default function Page() {
  return <Suspense fallback={null}><Aiguillage /></Suspense>;
}
