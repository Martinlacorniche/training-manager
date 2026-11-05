"use client";
// ─────────────────────────────────────────────────────────────────────────
// Équipe (refonte du 05/11/2026, validée par Martin) : remplace les podiums
// « Record » et le « Classement saison ». Règle produit : pas de record, pas
// de classement, chacun est comparé à lui-même. On montre, par athlète, ce
// qu'il a fait ces dernières semaines et une phrase sur la tendance.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import "dayjs/locale/fr";
import { supabase } from "@/lib/supabaseClient";
import { useCoque, NIVEAU } from "../../Coque";
import { Avatar, duree } from "../../commun";
import VolumeAnnee from "../../VolumeAnnee";

dayjs.extend(isoWeek);
dayjs.locale("fr");

type Ligne = { user_id: string; date: string; planned_hour: number | null; sport: string | null; status: string | null };

// Volume fait des 4 dernières semaines contre les 4 d'avant : une phrase, pas un score.
function tendance(r: number, avant: number): string {
  if (!r && !avant) return "Rien de fait ces 8 dernières semaines.";
  if (!avant) return "Reprend depuis un mois.";
  const x = r / avant;
  if (x > 1.25) return "Fait nettement plus qu'il y a un mois.";
  if (x > 1.08) return "Augmente doucement depuis un mois.";
  if (x >= 0.92) return "Stable par rapport au mois d'avant.";
  if (x >= 0.75) return "Un peu moins qu'il y a un mois.";
  return "Nettement moins qu'il y a un mois.";
}

function Equipe() {
  const { moi, athletes, etats } = useCoque();
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [courses, setCourses] = useState<{ user_id: string; date: string; name: string | null }[]>([]);
  const ids = useMemo(() => athletes.map((a) => a.id_auth), [athletes]);
  const lundi = dayjs().startOf("isoWeek");
  const semaines = useMemo(() => Array.from({ length: 8 }, (_, i) => lundi.subtract(7 - i, "week").format("YYYY-MM-DD")), [lundi.valueOf()]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ids.length) return;
    Promise.all([
      supabase.from("sessions").select("user_id, date, planned_hour, sport, status").in("user_id", ids).gte("date", semaines[0]).lte("date", lundi.add(6, "day").format("YYYY-MM-DD")),
      supabase.from("absences_competitions").select("user_id, date, name").in("user_id", ids).eq("type", "competition").gte("date", dayjs().format("YYYY-MM-DD")).order("date"),
    ]).then(([s, c]) => { setLignes((s.data ?? []) as Ligne[]); setCourses(c.data ?? []); });
  }, [ids, semaines]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!choisi && athletes.length) setChoisi((athletes.find((a) => !a.moi) ?? athletes[0]).id_auth); }, [athletes, choisi]);
  if (moi && moi.role !== "coach") { window.location.replace("/athlete"); return null; }
  const fini = (uid: string, de: string, a: string) => lignes.filter((s) => s.user_id === uid && s.status === "valide" && s.date >= de && s.date <= a).reduce((t, s) => t + (s.planned_hour ?? 0), 0);
  const cible = athletes.find((a) => a.id_auth === choisi);

  return (
    <div className="space-y-6 max-w-[1700px]">
      <header>
        <h1 className="text-[28px] font-extrabold">Équipe</h1>
        <p className="text-[15px] font-semibold text-slate-500">Chacun comparé à lui-même : ce qu&apos;il fait, et comment ça évolue.</p>
      </header>

      <section className="bg-white rounded-2xl border border-slate-200 p-5 overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[200px_220px_150px_minmax(0,1fr)_190px] gap-4 pb-2 text-[11px] font-extrabold tracking-wider text-slate-400 border-b border-slate-100">
            <span>ATHLÈTE</span><span>FAIT, 8 SEMAINES</span><span>RÉGULARITÉ (4 SEM.)</span><span>TENDANCE</span><span>PROCHAINE COURSE</span>
          </div>
          {athletes.map((a) => {
            const h = semaines.map((w) => fini(a.id_auth, w, dayjs(w).add(6, "day").format("YYYY-MM-DD")));
            const max = Math.max(1, ...h);
            const depuis = semaines[4], aujourdhui = dayjs().format("YYYY-MM-DD");
            const passees = lignes.filter((s) => s.user_id === a.id_auth && s.date >= depuis && s.date < aujourdhui);
            const faites = passees.filter((s) => s.status === "valide").length;
            const recent = h.slice(4).reduce((x, y) => x + y, 0), avant = h.slice(0, 4).reduce((x, y) => x + y, 0);
            const g = etats.get(a.id_auth)?.find((e) => e.domaine === "global");
            const course = courses.find((c) => c.user_id === a.id_auth);
            return (
              <button key={a.id_auth} onClick={() => setChoisi(a.id_auth)} className={`w-full text-left grid grid-cols-[200px_220px_150px_minmax(0,1fr)_190px] gap-4 items-center py-3 border-b border-slate-100 last:border-0 rounded-xl px-2 -mx-2 ${choisi === a.id_auth ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                <span className="flex items-center gap-2.5 font-extrabold min-w-0">
                  <Avatar id={a.id_auth} nom={a.name} taille={32} />
                  <span className="truncate">{a.moi ? "Moi" : a.name.split(" ")[0]}</span>
                  {!a.moi && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: NIVEAU[g?.niveau ?? "inconnu"].couleur }} />}
                </span>
                <span className="flex items-end gap-1 h-9" title={h.map((x, i) => `${dayjs(semaines[i]).format("D MMM")} : ${duree(x) || "0"}`).join("\n")}>
                  {h.map((x, i) => <span key={i} className={`flex-1 rounded-t ${i === 7 ? "bg-blue-300" : "bg-blue-500"}`} style={{ height: `${Math.max(6, (x / max) * 100)}%`, opacity: x ? 1 : 0.15 }} />)}
                  <span className="ml-2 text-xs font-extrabold text-slate-600 whitespace-nowrap self-center">{duree(recent / 4) || "0"}<span className="font-semibold text-slate-400"> /sem.</span></span>
                </span>
                <span className="text-sm font-bold text-slate-700">{passees.length ? `${faites} sur ${passees.length} faites` : "—"}</span>
                <span className="text-sm font-semibold text-slate-600 truncate">{tendance(recent, avant)}</span>
                <span className="text-[13px] font-bold text-slate-500 truncate">{course ? `${course.name ?? "Course"} · ${dayjs(course.date).format("D MMM")}` : "—"}</span>
              </button>
            );
          })}
        </div>
      </section>

      {cible && <VolumeAnnee userId={cible.id_auth} titre={cible.moi ? "Mon année" : `L'année de ${cible.name.split(" ")[0]}`} />}
    </div>
  );
}

export default function Page() {
  return <Equipe />;
}
