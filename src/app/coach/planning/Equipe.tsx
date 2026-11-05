"use client";
// ─────────────────────────────────────────────────────────────────────────
// Toute l'équipe sur une semaine (05/11/2026, maquette validée par Martin) :
// une ligne par athlète, une colonne par jour. On glisse une séance d'un jour
// à l'autre (déplacer) ou sur un autre athlète (la lui copier, à ses allures).
// Un clic ouvre le même panneau que la semaine d'un athlète. C'est la vue que
// les coachs réclament à intervals.icu.
// ─────────────────────────────────────────────────────────────────────────
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { CaretLeft, CaretRight, Copy, Flag } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabaseClient";
import { useCoque, NIVEAU } from "../../Coque";
import { Avatar, Bandeau, duree, type Message } from "../../commun";
import Panneau, { type Seance, type Vue } from "./Panneau";
import { AjoutRapide, Bascule, CartePetite, lireSaisie } from "./Cartes";
import { annulerCopie, copierSemaine, dupliquerSeance, type Copie } from "../copie";

type Course = { id: string; user_id: string; date: string; name: string | null };

export default function Equipe() {
  const { moi, athletes, etats, setEtroit } = useCoque();
  const [lundi, setLundi] = useState(() => {
    const p = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("semaine") : null;
    return (p && dayjs(p).isValid() ? dayjs(p) : dayjs()).startOf("isoWeek").format("YYYY-MM-DD");
  });
  const [seances, setSeances] = useState<Seance[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [vue, setVue] = useState<Vue>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [n, setN] = useState(0);
  const recharger = useCallback(() => setN((x) => x + 1), []);
  const finMessage = useCallback(() => setMessage(null), []);
  const jours = useMemo(() => Array.from({ length: 7 }, (_, i) => dayjs(lundi).add(i, "day").format("YYYY-MM-DD")), [lundi]);
  const ids = useMemo(() => athletes.map((a) => a.id_auth), [athletes]);
  const auj = dayjs().format("YYYY-MM-DD");
  const semaineCourante = dayjs().startOf("isoWeek").format("YYYY-MM-DD");

  useEffect(() => { setEtroit(!!vue); return () => setEtroit(false); }, [vue, setEtroit]);
  useEffect(() => { window.history.replaceState(null, "", `/coach/planning?vue=equipe&semaine=${lundi}`); }, [lundi]);

  useEffect(() => {
    if (!ids.length) return;
    let annule = false;
    Promise.all([
      supabase.from("sessions").select("*").in("user_id", ids).gte("date", jours[0]).lte("date", jours[6]),
      supabase.from("absences_competitions").select("id, user_id, date, name").in("user_id", ids).eq("type", "competition").gte("date", jours[0]).lte("date", jours[6]),
    ]).then(([s, c]) => {
      if (annule) return;
      setSeances((s.data ?? []) as Seance[]);
      setCourses((c.data ?? []) as Course[]);
    });
    return () => { annule = true; };
  }, [ids, jours, n]);

  const nom = (uid: string) => { const a = athletes.find((x) => x.id_auth === uid); return a?.moi ? "moi" : a?.name.split(" ")[0] ?? "lui"; };

  async function lacher(r: DropResult) {
    if (!r.destination || r.destination.droppableId === r.source.droppableId) return;
    const [uid, date] = r.destination.droppableId.split("|");
    const s = seances.find((x) => x.id === r.draggableId);
    if (!s) return;
    if (uid === s.user_id) {
      // Même athlète : on déplace.
      if (s.status === "valide") { setMessage({ texte: "Une séance faite ne change pas de jour" }); return; }
      setSeances((l) => l.map((x) => (x.id === s.id ? { ...x, date } : x)));
      const { error } = await supabase.from("sessions").update({ date }).eq("id", s.id);
      if (error) { recharger(); setMessage({ texte: `Pas déplacée : ${error.message}` }); return; }
      setMessage({ texte: `Séance déplacée à ${dayjs(date).format("dddd")}`, annuler: async () => { await supabase.from("sessions").update({ date: s.date }).eq("id", s.id); recharger(); } });
    } else {
      // Un autre athlète : on lui copie la séance (le plan seulement).
      try {
        const c = await dupliquerSeance(s.id, [uid], date);
        recharger();
        setMessage({ texte: `Séance copiée pour ${nom(uid)}, ${dayjs(date).format("dddd")}`, annuler: async () => { await annulerCopie(c); recharger(); } });
      } catch (e) { setMessage({ texte: `Pas copiée : ${(e as Error).message}` }); }
    }
  }

  async function ajouter(uid: string, date: string, texte: string) {
    const { data, error } = await supabase.from("sessions").insert({ user_id: uid, coach_id: moi?.id, date, ...lireSaisie(texte) }).select().single();
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

  async function copierTout() {
    const suivante = dayjs(lundi).add(1, "week").format("YYYY-MM-DD");
    const avecSeances = ids.filter((id) => seances.some((s) => s.user_id === id));
    if (!avecSeances.length) { setMessage({ texte: "Rien à copier : la semaine est vide" }); return; }
    const copies: Copie[] = [];
    try {
      for (const id of avecSeances) copies.push(await copierSemaine(id, lundi, [id], suivante));
    } catch (e) { setMessage({ texte: `La copie s'est arrêtée : ${(e as Error).message}` }); }
    const total = copies.reduce((t, c) => t + c.ids.length, 0);
    if (total) setMessage({ texte: `${total} séance${total > 1 ? "s" : ""} copiée${total > 1 ? "s" : ""} sur la semaine du ${dayjs(suivante).format("D MMM")}`, annuler: async () => { for (const c of copies) await annulerCopie(c); } });
  }

  if (moi && moi.role !== "coach") { window.location.replace("/athlete"); return null; }
  const ouverte = vue && vue.quoi !== "copier" ? seances.find((x) => x.id === vue.id) : null;
  const faites = seances.filter((s) => s.status === "valide").length;

  return (
    <div className="flex min-h-screen">
      <div className="flex-1 min-w-0 px-4 py-5 lg:px-7 lg:py-6 flex flex-col gap-4">
        <header className="flex flex-wrap items-center gap-3.5">
          <div className="flex-1 min-w-[260px]">
            <h1 className="text-[26px] font-extrabold leading-tight">Toute l&apos;équipe</h1>
            <p className="text-sm font-semibold text-slate-500 mt-0.5">Glisse une séance d&apos;un jour à l&apos;autre, ou sur un autre athlète pour la lui copier.</p>
          </div>
          <Bascule equipe lundi={lundi} />
        </header>

        <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5">
          <button aria-label="Semaine d'avant" onClick={() => setLundi(dayjs(lundi).subtract(1, "week").format("YYYY-MM-DD"))} className="p-1 rounded-lg text-slate-500 hover:bg-slate-100"><CaretLeft size={18} weight="bold" /></button>
          <span className="text-sm font-extrabold first-letter:uppercase">{lundi === semaineCourante ? "Cette semaine" : "Semaine"} · {dayjs(lundi).format("D")} → {dayjs(jours[6]).format("D MMM")}</span>
          <button aria-label="Semaine d'après" onClick={() => setLundi(dayjs(lundi).add(1, "week").format("YYYY-MM-DD"))} className="p-1 rounded-lg text-slate-500 hover:bg-slate-100"><CaretRight size={18} weight="bold" /></button>
          {lundi !== semaineCourante && <button onClick={() => setLundi(semaineCourante)} className="text-xs font-extrabold text-blue-600 hover:underline">revenir à aujourd&apos;hui</button>}
          <span className="flex-1" />
          <span className="text-sm font-bold text-slate-500">{faites} faite{faites > 1 ? "s" : ""} / {seances.length} prévue{seances.length > 1 ? "s" : ""}</span>
          <button onClick={copierTout} className="rounded-xl border border-slate-200 px-3 py-1.5 text-[13px] font-extrabold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"><Copy size={14} weight="bold" />Copier toute la semaine vers la suivante</button>
        </section>

        <div className="overflow-x-auto -mx-1 px-1">
          <DragDropContext onDragEnd={lacher}>
            <div className="grid gap-1.5 min-w-[900px]" style={{ gridTemplateColumns: "170px repeat(7, minmax(0, 1fr))" }}>
              <div />
              {jours.map((j) => (
                <div key={j} className={`px-1 text-[12.5px] font-extrabold first-letter:uppercase flex items-center gap-1.5 ${j === auj ? "text-blue-600" : "text-slate-500"}`}>
                  {dayjs(j).format("ddd D")}{j === auj && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                </div>
              ))}
              {athletes.map((a) => {
                const siennes = seances.filter((s) => s.user_id === a.id_auth);
                const fait = siennes.filter((s) => s.status === "valide").reduce((t, s) => t + (s.planned_hour ?? 0), 0);
                const prevu = siennes.reduce((t, s) => t + (s.planned_hour ?? 0), 0);
                const g = etats.get(a.id_auth)?.find((e) => e.domaine === "global");
                return (
                  <React.Fragment key={a.id_auth}>
                    <Link href={`/coach/planning?athlete=${a.id_auth}&semaine=${lundi}`} className="flex items-center gap-2 py-1.5 pr-1 rounded-xl hover:bg-white min-w-0">
                      <Avatar id={a.id_auth} nom={a.name} taille={30} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-sm font-extrabold truncate">{a.moi ? "Moi" : a.name.split(" ")[0]}{!a.moi && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: NIVEAU[g?.niveau ?? "inconnu"].couleur }} />}</span>
                        <span className="block text-[11.5px] font-bold text-slate-500">{duree(fait) || "0"} / {duree(prevu) || "0"}</span>
                      </span>
                    </Link>
                    {jours.map((j) => {
                      const cle = `${a.id_auth}|${j}`;
                      const ici = siennes.filter((s) => s.date === j);
                      const course = courses.find((c) => c.user_id === a.id_auth && c.date === j);
                      return (
                        <Droppable droppableId={cle} key={cle}>
                          {(p, snap) => (
                            <div ref={p.innerRef} {...p.droppableProps} className={`group flex flex-col gap-1 min-h-[64px] p-1 rounded-xl transition ${snap.isDraggingOver ? "bg-blue-100 ring-2 ring-blue-300" : j === auj ? "bg-blue-50/60" : "bg-slate-100/70"}`}>
                              {course && <div className="rounded-lg px-2 py-1 text-[11.5px] font-extrabold text-white truncate flex items-center gap-1" style={{ background: "linear-gradient(90deg,#f97316,#e11d48)" }}><Flag size={11} weight="fill" />{course.name ?? "Course"}</div>}
                              {ici.map((s, i) => (
                                <Draggable key={s.id} draggableId={s.id} index={i} disableInteractiveElementBlocking>
                                  {(d) => (
                                    <div ref={d.innerRef} {...d.draggableProps} {...d.dragHandleProps}>
                                      <CartePetite s={s} ouverte={ouverte?.id === s.id} onOuvrir={() => setVue({ quoi: "seance", id: s.id })} />
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {p.placeholder}
                              <div className={ici.length ? "opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition" : ""}>
                                <AjoutRapide petit onAjout={(t) => ajouter(a.id_auth, j, t)} />
                              </div>
                            </div>
                          )}
                        </Droppable>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          </DragDropContext>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-slate-400">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-600" />faite</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-600" />pas faite</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-600" />pas renseignée</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-300" />prévue</span>
          <span>Un clic sur une carte l&apos;ouvre à droite. Un clic sur un prénom ouvre sa semaine.</span>
        </div>
      </div>

      {vue && (
        <>
          <div className="xl:hidden fixed inset-0 z-30 bg-slate-900/30" onClick={() => setVue(null)} />
          <aside aria-label="Panneau" className="fixed xl:sticky right-0 top-0 z-40 xl:z-auto h-screen w-full sm:w-[440px] xl:w-[420px] shrink-0 bg-white border-l border-slate-200 shadow-[-8px_0_24px_rgba(15,23,42,0.06)]">
            <Panneau vue={vue} setVue={setVue} seances={seances} jours={jours} lundi={lundi} athleteId={ouverte?.user_id ?? ""}
              onChange={(s) => setSeances((l) => (s.date >= jours[0] && s.date <= jours[6] ? l.map((x) => (x.id === s.id ? s : x)) : l.filter((x) => x.id !== s.id)))}
              onSupprimer={supprimer} onCopie={(c: Copie, texte: string) => { recharger(); setMessage({ texte, annuler: async () => { await annulerCopie(c); recharger(); } }); }} />
          </aside>
        </>
      )}
      <Bandeau message={message} onFin={finMessage} />
    </div>
  );
}
