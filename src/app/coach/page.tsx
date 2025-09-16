
"use client";
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import "dayjs/locale/fr";
import isoWeek from "dayjs/plugin/isoWeek";
dayjs.locale("fr");
dayjs.extend(isoWeek);

// Font
import { Plus_Jakarta_Sans } from "next/font/google";
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["500","600","700"], display: "swap" });

// Icons (Phosphor)
import {
  PencilSimple, Trash, Plus, Info, ChartLineUp,
  CaretLeft, CaretRight, CheckCircle, XCircle,
  ChartLineUp as LoadIcon, Bicycle, SwimmingPool, Mountains, PersonSimpleRun, Clock, SignOut
} from "@phosphor-icons/react";

// Animations
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

// ---------- helpers
function sportIcon(s?: string, size: number = 16) {
  switch (s) {
    case "Vélo": return <Bicycle size={size} />;
    case "Run": return <PersonSimpleRun size={size} />;
    case "Natation": return <SwimmingPool size={size} />;
    case "Trail": return <Mountains size={size} />;
    case "Renfo":
    case "Muscu": return <ChartLineUp size={size} />;
    default: return <ChartLineUp size={size} />;
  }
}
function sportBadgeClasses(s?: string) {
  switch (s) {
    case "Vélo": return "bg-sky-50 text-sky-700 ring-sky-200";
    case "Run": return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "Natation": return "bg-cyan-50 text-cyan-700 ring-cyan-200";
    case "Trail": return "bg-green-50 text-green-700 ring-green-200";
    case "Renfo":
    case "Muscu": return "bg-amber-50 text-amber-700 ring-amber-200";
    default: return "bg-gray-50 text-gray-700 ring-gray-200";
  }
}
function intensityBar(level?: string) {
  switch (level) {
    case "haute": return "bg-red-400";
    case "moyenne": return "bg-amber-400";
    default: return "bg-emerald-500";
  }
}
function fmtTime(h?: number) {
  if (h === undefined || h === null) return "";
  const H = Math.floor(h || 0);
  const M = Math.round(((h || 0) % 1) * 60);
  return `${H}h${String(M).padStart(2,"0")}`;
}

// ---------- types
type UserType = { id_auth: string; name: string; coach_code?: string; coach_id?: string; ordre: number | null; };
type SessionType = { id: string; user_id: string; sport?: string; title?: string; planned_hour?: number; planned_inter?: string; intensity?: string; status?: string; rpe?: number | null; athlete_comment?: string | null; date: string; };
type AbsenceType = { id: string; user_id: string; date: string; type: string; name?: string | null; distance_km?: number | null; elevation_d_plus?: number | null; comment?: string | null; };

// ---------- Modal create/edit
function SessionModal({ open, onClose, onSaved, initial, athlete, date }:{
  open: boolean; onClose: ()=>void; onSaved: (s: SessionType, isEdit: boolean)=>void;
  initial?: SessionType | null; athlete: UserType; date: string;
}) {
  const [sport, setSport] = useState("Run");
  const [title, setTitle] = useState("");
  const [plannedHour, setPlannedHour] = useState(0);
  const [plannedMinute, setPlannedMinute] = useState(0);
  const [intensity, setIntensity] = useState("moyenne");
  const [planned_inter, setPlannedInter] = useState("");

  useEffect(() => {
    if (!open) return;
    if (initial) {
      const ph = initial.planned_hour || 0;
      setSport(initial.sport || "Run");
      setTitle(initial.title || "");
      setPlannedHour(Math.floor(ph));
      setPlannedMinute(Math.round((ph % 1) * 60));
      setIntensity(initial.intensity || "moyenne");
      setPlannedInter(initial.planned_inter || "");
    } else {
      setSport("Run"); setTitle(""); setPlannedHour(0); setPlannedMinute(0);
      setIntensity("moyenne"); setPlannedInter("");
    }
  }, [open, initial]);

  const [loading, setLoading] = useState(false);
  if (!open) return null;
  const isEdit = !!initial;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const payload: any = { user_id: athlete.id_auth, date, sport, title, planned_hour: plannedHour + plannedMinute / 60, planned_inter, intensity };
    try {
      let data: any, error: any;
      if (isEdit) ({ data, error } = await supabase.from("sessions").update(payload).eq("id", initial!.id).select().single());
      else ({ data, error } = await supabase.from("sessions").insert(payload).select().single());
      if (error) throw error;
      if (data) onSaved(data as SessionType, isEdit);
    } catch (err:any) {
      alert("Erreur: " + (err?.message || "inconnue"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center p-4" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <motion.form
            onSubmit={submit}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-5 space-y-3"
          >
            <h3 className="text-lg font-semibold text-slate-800">{isEdit ? "Modifier la séance" : `Nouvelle séance – ${athlete.name}`}</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm text-slate-700">Sport
                <select value={sport} onChange={(e)=>setSport(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 focus:outline-none focus:ring-2 focus:ring-emerald-300">
                  <option>Run</option><option>Vélo</option><option>Natation</option><option>Renfo</option><option>Muscu</option><option>Trail</option><option>Autre</option>
                </select>
              </label>
              <label className="text-sm text-slate-700">Intensité
                <select value={intensity} onChange={(e)=>setIntensity(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 focus:outline-none focus:ring-2 focus:ring-emerald-300">
                  <option value="basse">Basse</option><option value="moyenne">Moyenne</option><option value="haute">Haute</option>
                </select>
              </label>
            </div>
            <label className="text-sm text-slate-700">Titre
              <input value={title} onChange={(e)=>setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 focus:outline-none focus:ring-2 focus:ring-emerald-300"/>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm text-slate-700">Heures
                <select value={plannedHour} onChange={(e)=>setPlannedHour(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 focus:outline-none focus:ring-2 focus:ring-emerald-300">
                  {Array.from({length:15}, (_,i)=> <option key={i} value={i}>{i} h</option>)}
                </select>
              </label>
              <label className="text-sm text-slate-700">Minutes
                <select value={plannedMinute} onChange={(e)=>setPlannedMinute(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 focus:outline-none focus:ring-2 focus:ring-emerald-300">
                  {Array.from({length:12}, (_,i)=> <option key={i} value={i*5}>{String(i*5).padStart(2,"0")} min</option>)}
                </select>
              </label>
            </div>
            <label className="text-sm text-slate-700">Consignes du coach
              <textarea value={planned_inter} onChange={(e)=>setPlannedInter(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 min-h-[90px] focus:outline-none focus:ring-2 focus:ring-emerald-300"/>
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700">Annuler</button>
              <button disabled={loading} className="px-4 py-2 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700">
                {loading ? "Enregistrement…" : (isEdit ? "Enregistrer" : "Créer")}
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------- Smooth height animation helper
function SmoothCollapsible({ open, children }:{ open: boolean; children: React.ReactNode; }) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">(0);

  useEffect(() => {
    if (open && ref.current) {
      setHeight(ref.current.scrollHeight);
      const to = setTimeout(() => setHeight("auto"), 220);
      return () => clearTimeout(to);
    }
    if (!open) {
      if (ref.current) setHeight(ref.current.scrollHeight);
      const to = setTimeout(() => setHeight(0), 0);
      return () => clearTimeout(to);
    }
  }, [open]);

  return (
    <motion.div style={{ overflow: "hidden" }} initial={false} animate={{ height }} transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}>
      <div ref={ref}>{children}</div>
    </motion.div>
  );
}

// ---------- Cards
const SessionCard = React.memo(function SessionCard({ s, onEdit, onDelete }:{ s: SessionType; onEdit: ()=>void; onDelete: ()=>void; }) {
  const [showCoachNote, setShowCoachNote] = useState(false);

  const statusTint =
    s.status === "valide" ? "bg-emerald-50 border-emerald-200"
    : s.status === "non_valide" ? "bg-rose-50 border-rose-200"
    : "bg-white border-emerald-100";

  const statusOverlay =
    s.status === "valide" ? "after:bg-emerald-100/40"
    : s.status === "non_valide" ? "after:bg-rose-100/40"
    : "after:bg-transparent";

  return (
    <motion.div layout initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:6}} transition={{duration:0.2}} whileHover={{y:-1}}
      className={`card relative rounded-2xl shadow-sm border p-3 overflow-hidden ${statusTint} ${statusOverlay} after:absolute after:inset-0 after:pointer-events-none`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] ring-1 ${sportBadgeClasses(s.sport)}`}>
          {sportIcon(s.sport, 14)} <span className="font-medium">{s.sport}</span>
        </span>
        {s.planned_inter && (
          <button onClick={()=>setShowCoachNote(v=>!v)} aria-expanded={showCoachNote} title="Voir les consignes du coach" className="p-2 rounded-lg hover:bg-emerald-50">
            <Info size={16}/>
          </button>
        )}
      </div>
      <div className={`mt-2 h-1 rounded-full ${intensityBar(s.intensity)}`} />
      {s.title && <div className="mt-2 text-sm font-semibold text-slate-800 break-words">{s.title}</div>}
      {s.planned_hour !== undefined && <div className="mt-1 text-[12px] text-slate-600">{fmtTime(s.planned_hour)}</div>}
      {(s.athlete_comment || s.rpe) && (
        <div className="mt-1 text-[12px] italic text-slate-600 break-words">
          {s.athlete_comment ? `“${s.athlete_comment}”` : ""}{s.rpe && s.athlete_comment ? " • " : ""}{s.rpe ? `RPE ${s.rpe}` : ""}
        </div>
      )}
      <AnimatePresence initial={false}>
        {s.planned_inter && (
          <SmoothCollapsible open={showCoachNote}>
            <div className="mt-2 rounded-md bg-emerald-50/50 p-2 text-[13px] text-slate-700 whitespace-pre-line">
              {s.planned_inter}
            </div>
          </SmoothCollapsible>
        )}
      </AnimatePresence>
      <div className="mt-2 pt-2 border-t border-emerald-100 flex items-center justify-between text-[12px]">
        <div className="flex gap-1">
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-emerald-50 active:scale-[0.98]" aria-label="Modifier"><PencilSimple size={16}/></button>
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-rose-50 active:scale-[0.98]" aria-label="Supprimer"><Trash size={16}/></button>
        </div>
      </div>
    </motion.div>
  );
});

const AbsenceCard = React.memo(function AbsenceCard({ a, onDelete }:{ a: AbsenceType; onDelete: ()=>void; }) {
  const isComp = a.type === "competition";
  const cls = isComp ? "bg-amber-50 ring-amber-200 text-amber-800" : "bg-slate-50 ring-slate-200 text-slate-700";
  const title = isComp ? "Compétition" : "Repos";
  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.2 }} whileHover={{ y: -1 }}
      className="card rounded-2xl bg-white shadow-sm border border-emerald-100 p-3 overflow-hidden">
      <div className="flex items-start justify-between gap-2">
        <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[12px] ring-1 ${cls}`}>
          <span className="font-medium">{title}</span>
        </span>
      </div>
      {isComp && (
        <div className="mt-2 text-[13px] text-slate-700 space-y-0.5">
          {a.name && <div className="font-medium">{a.name}</div>}
          {(a.distance_km || a.elevation_d_plus) && (
            <div className="text-[12px] text-slate-600">
              {a.distance_km ? `${a.distance_km} km` : ""}
              {a.distance_km && a.elevation_d_plus ? " • " : ""}
              {a.elevation_d_plus ? `D+ ${a.elevation_d_plus} m` : ""}
            </div>
          )}
          {a.comment && <div className="whitespace-pre-line">{a.comment}</div>}
        </div>
      )}
      {!isComp && a.comment && <div className="mt-2 text-[13px] text-slate-700 whitespace-pre-line">{a.comment}</div>}
      <div className="mt-2 pt-2 border-t border-emerald-100 flex justify-end">
        <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-rose-50 active:scale-[0.98]" aria-label="Supprimer"><Trash size={16}/></button>
      </div>
    </motion.div>
  );
});
// ---------- Athlete Metrics Editor (Coach)
function paceFromKmh(kmh: number) {
  if (!kmh || kmh <= 0) return "—";
  const minPerKm = 60 / kmh;
  const totalSec = Math.round(minPerKm * 60);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2,"0")}/km`;
}
const PCTS = [60,70,80,85,90,95,100,110,120,130];

function AthleteMetricsCoach({ athleteId }: { athleteId: string }) {
  const [vma, setVma] = React.useState<string>("");
  const [ftp, setFtp] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);

  useEffect(() => {
    if (!athleteId) return;
    (async () => {
      const { data } = await supabase
        .from("athlete_metrics")
        .select("vma_kmh, ftp_w")
        .eq("user_id", athleteId)
        .single();
      if (data) {
        setVma(data.vma_kmh ? String(data.vma_kmh) : "");
        setFtp(data.ftp_w ? String(data.ftp_w) : "");
      } else {
        setVma("");
        setFtp("");
      }
    })();
  }, [athleteId]);

  async function save() {
    setLoading(true);
    const payload = {
      user_id: athleteId,
      vma_kmh: vma ? Number(vma) : null,
      ftp_w: ftp ? Number(ftp) : null,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase
      .from("athlete_metrics")
      .upsert(payload, { onConflict: "user_id" });
    setLoading(false);
    if (error) alert(error.message);
  }

  const vmaNum = vma ? Number(vma) : null;
  const ftpNum = ftp ? Number(ftp) : null;

  return (
    <div className="mt-4 rounded-2xl border border-emerald-100 bg-white p-4 text-sm text-slate-700 space-y-3">

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-slate-600">
          VMA (km/h)
          <input
            type="number"
            step="0.1"
            value={vma}
            onChange={e=>setVma(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs text-slate-600">
          FTP (w)
          <input
            type="number"
            value={ftp}
            onChange={e=>setFtp(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
          />
        </label>
      </div>
      <button
        onClick={save}
        disabled={loading}
        className="w-full py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
      >
        {loading ? "Enregistrement…" : "Enregistrer"}
      </button>

      {(vmaNum || ftpNum) && (
        <table className="w-full text-xs border-collapse mt-3">
          <thead>
            <tr>
              <th className="border-b text-left py-1">%</th>
              <th className="border-b text-center">Allure VMA</th>
              <th className="border-b text-center">FTP</th>
            </tr>
          </thead>
          <tbody>
            {PCTS.map(pct => {
              const frac = pct/100;
              const vmaPace = vmaNum ? paceFromKmh(vmaNum*frac) : "—";
              const ftpVal = ftpNum ? Math.round(ftpNum*frac) + " w" : "—";
              return (
                <tr key={pct}>
                  <td className="py-0.5">{pct}%</td>
                  <td className="py-0.5 text-center">{vmaPace}</td>
                  <td className="py-0.5 text-center">{ftpVal}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------- Main page
export default function CoachAthleteFocusV7_3() {
  const router = useRouter();
  const prefersReduced = useReducedMotion();

  const [coach, setCoach] = useState<UserType | null>(null);
  const [athletes, setAthletes] = useState<UserType[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);

  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = useMemo(() => dayjs().startOf("week").add(weekOffset, "week"), [weekOffset]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => weekStart.add(i, "day")), [weekStart]);

  const [sessions, setSessions] = useState<SessionType[]>([]);
  const [absences, setAbsences] = useState<AbsenceType[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const [editSession, setEditSession] = useState<SessionType | null>(null);

  const [prevWeekLoad, setPrevWeekLoad] = useState<number>(0);
  const [nextRaceText, setNextRaceText] = useState<string>("");

  // boot
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) { router.push("/login"); return; }
      const { data: user } = await supabase.from("users").select("*").eq("id_auth", session.user.id).single();
      setCoach(user as UserType);

      const { data: athletesList } = await supabase
        .from("users").select("id_auth,name,ordre,coach_code,coach_id")
        .eq("role", "athlete").eq("coach_id", session.user.id)
        .order("ordre", { ascending: true });
      const list = (athletesList || []) as UserType[];
      setAthletes(list);
      setSelectedAthleteId(prev => prev ?? list[0]?.id_auth ?? null);
    })();
  }, [router]);

  // load week data
  useEffect(() => {
    if (!selectedAthleteId) return;
    (async () => {
      const start = weekStart.format("YYYY-MM-DD");
      const end = weekStart.add(6, "day").format("YYYY-MM-DD");
      const { data: sess } = await supabase
        .from("sessions")
        .select("id,user_id,sport,title,planned_hour,planned_inter,intensity,status,rpe,athlete_comment,date")
        .eq("user_id", selectedAthleteId).gte("date", start).lte("date", end);
      setSessions((sess || []) as SessionType[]);

      const { data: abs } = await supabase
        .from("absences_competitions")
        .select("id,user_id,date,type,name,distance_km,elevation_d_plus,comment")
        .eq("user_id", selectedAthleteId).gte("date", start).lte("date", end);
      setAbsences((abs || []) as AbsenceType[]);
    })();
  }, [selectedAthleteId, weekStart]);

  // prev week load + next race (based on displayed week)
  useEffect(() => {
    if (!selectedAthleteId) return;
    (async () => {
      const prevStart = weekStart.add(-7, "day").format("YYYY-MM-DD");
      const prevEnd = weekStart.add(-1, "day").format("YYYY-MM-DD");
      const { data: prevSessions } = await supabase
        .from("sessions").select("planned_hour,rpe,status,user_id,date")
        .eq("user_id", selectedAthleteId).gte("date", prevStart).lte("date", prevEnd);
      const load = (prevSessions || []).filter(s=> s.status === "valide")
        .reduce((acc:any, s:any)=> acc + ((Number(s.rpe)||0) * (Number(s.planned_hour)||0)), 0);
      setPrevWeekLoad(load);

      const base = weekStart.startOf("day");
      const { data: nextComp } = await supabase
        .from("absences_competitions")
        .select("date,type").eq("user_id", selectedAthleteId)
        .eq("type","competition").gte("date", base.format("YYYY-MM-DD"))
        .order("date", { ascending: true }).limit(1);
      if (nextComp && nextComp.length) {
        const d = dayjs(nextComp[0].date).startOf("day");
        if (d.isSame(base, "week")) setNextRaceText("cette semaine");
        else {
          const diffDays = d.diff(base, "day");
          const weeks = Math.floor(diffDays / 7) + (diffDays % 7 > 0 ? 1 : 0);
          setNextRaceText(`dans ${weeks} semaine${weeks>1?"s":""}`);
        }
      } else setNextRaceText("aucune à venir");
    })();
  }, [selectedAthleteId, weekStart]);

  const deleteSession = useCallback(async (id: string) => {
    if (!confirm("Supprimer cette séance ?")) return;
    const { error } = await supabase.from("sessions").delete().eq("id", id);
    if (error) alert(error.message);
    else setSessions(prev => prev.filter(s => s.id !== id));
  }, []);

  const moveAthlete = useCallback(async (index: number, direction: number) => {
    if ((direction === -1 && index === 0) || (direction === 1 && index === athletes.length - 1)) return;
    const next = [...athletes];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    next.forEach((a, i) => (a.ordre = i));
    setAthletes(next);
    await Promise.all(next.map((a, i) => supabase.from("users").update({ ordre: i }).eq("id_auth", a.id_auth)));
  }, [athletes]);

  const stats = useMemo(() => {
    const total = sessions.length;
    const validated = sessions.filter(s => s.status === "valide").length;
    const time = sessions.reduce((acc, s) => acc + (Number(s.planned_hour) || 0), 0);
    const load = sessions.filter(s => s.status === "valide").reduce((acc, s) => acc + ((Number(s.rpe) || 0) * (Number(s.planned_hour) || 0)), 0);
    const progress = total ? Math.round((validated / total) * 100) : 0;
    return { total, validated, time, load, progress };
  }, [sessions]);

  const athlete = athletes.find(a => a.id_auth === selectedAthleteId) || null;

  const progressVariants = prefersReduced
    ? {}
    : { initial: { width: 0 }, animate: { width: `${stats.progress}%`, transition: { duration: 0.45 } } };

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main className={`${jakarta.className} min-h-screen bg-gradient-to-br from-emerald-50 via-sky-50 to-white text-slate-800`}>
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-emerald-100 bg-white/80 backdrop-blur">
        <div className="max-w-screen-2xl mx-auto px-3 py-3 flex items-center gap-3">
          <div className="text-sm text-emerald-900">Bonjour {coach?.name?.split(" ")[0] || "Coach"}</div>
          <div className="mx-auto flex items-center gap-2">
            <button onClick={() => setWeekOffset(w => w - 1)} className="p-2 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-100" aria-label="Semaine précédente"><CaretLeft size={18}/></button>
            <div className="text-sm font-semibold text-emerald-900">Semaine du {weekStart.format("DD/MM/YYYY")}</div>
            <button onClick={() => setWeekOffset(w => w + 1)} className="p-2 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-100" aria-label="Semaine suivante"><CaretRight size={18}/></button>
          </div>
          <div className="flex items-center gap-2">
            {coach?.coach_code && (
              <div className="text-xs text-emerald-900 bg-emerald-50 border border-emerald-100 rounded-md px-2 py-1">Code coach : <span className="font-semibold">{coach.coach_code}</span></div>
            )}
            <a href="/coach/stats/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-900">
              <ChartLineUp size={14}/> Stats
            </a>
            {/* Déconnexion */}
            <button onClick={logout} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-rose-200 bg-white hover:bg-rose-50 text-rose-700">
              <SignOut size={14}/> 
            </button>
          </div>
        </div>
      </header>

      {/* Layout wider: sidebar smaller, content larger */}
      <div className="max-w-screen-2xl mx-auto px-3 py-5 grid grid-cols-12 gap-4">
        {/* Sidebar Athletes */}
        <aside className="col-span-12 md:col-span-2">
          <div className="mb-2 text-xs uppercase tracking-wide text-emerald-800/70">Athlètes</div>
          <div className="space-y-2">
            {athletes.map((a, i) => {
  const active = a.id_auth === selectedAthleteId;
  const [firstName, ...rest] = (a.name || "").split(" ");
  const lastName = rest.join(" ");
  return (
    <div key={a.id_auth} className={`p-2 rounded-xl border ${active ? "border-emerald-300 bg-white" : "border-emerald-100 bg-white/70 hover:bg-white"}`}>
      <div className="flex items-center gap-2">
        <button onClick={() => setSelectedAthleteId(a.id_auth)} className="flex-1 text-left">
          <div className="text-sm font-semibold text-emerald-950 truncate">{firstName}</div>
          <div className="text-[12px] text-emerald-900 truncate">{lastName}</div>
        </button>
        <div className="flex gap-1">
          <button onClick={() => moveAthlete(i, -1)} disabled={i === 0} className="p-1 rounded-lg disabled:opacity-30 hover:bg-emerald-100" aria-label="Monter">↑</button>
          <button onClick={() => moveAthlete(i, 1)} disabled={i === athletes.length - 1} className="p-1 rounded-lg disabled:opacity-30 hover:bg-emerald-100" aria-label="Descendre">↓</button>
        </div>
      </div>

      {/* 👉 Ici on injecte le tableau si sélectionné */}
      {active && (
        <div className="mt-2">
          <AthleteMetricsCoach athleteId={a.id_auth} />
        </div>
      )}
    </div>
  );
})}

          </div>
        </aside>

        {/* Main content */}
        <section className="col-span-12 md:col-span-10 space-y-5">
          {/* Athlete stats header */}
          {athlete && (
            <div className="rounded-2xl border border-emerald-100 bg-white p-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="font-semibold text-emerald-950 text-lg">{athlete.name}</div>
                  <div className="text-xs text-emerald-800/80">Prochaine compétition : {nextRaceText}</div>
                  <div className="text-xs text-emerald-800/80 mt-0.5">Charge semaine précédente : {prevWeekLoad.toFixed(1)}</div>
                </div>
                <div className="flex items-center gap-6 text-sm text-emerald-900">
                  <div className="flex items-center gap-2"><CheckCircle size={16} className="text-emerald-600"/><span>{stats.validated}/{stats.total}</span></div>
                  <div className="flex items-center gap-2"><Clock size={16} className="text-slate-700"/><span>{fmtTime(stats.time)}</span></div>
                  <div className="flex items-center gap-2"><LoadIcon size={16} className="text-amber-600"/><span>{stats.load.toFixed(1)}</span></div>
                </div>
              </div>
              <div className="mt-3 h-2 w-full rounded-full bg-emerald-100 overflow-hidden">
                <motion.div className="h-full bg-emerald-500 rounded-full" initial="initial" animate="animate" {...progressVariants} />
              </div>

            </div>
            
          )}

          {/* Week grid */}
          <div className="grid grid-cols-7 gap-3">
            {weekDays.map((d) => {
              const iso = d.format("YYYY-MM-DD");
              const daySessions = sessions.filter((s) => s.date === iso);
              const dayAbs = absences.filter((a) => a.date === iso);
              return (
                <div key={iso} className="rounded-2xl border border-emerald-100 bg-white p-3 flex flex-col min-h-[220px]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-medium text-emerald-900">{d.format("ddd DD/MM")}</div>
                    <motion.button whileTap={{ scale: 0.96, rotate: 90 }} onClick={() => { setModalDate(iso); setEditSession(null); setModalOpen(true); }} className="p-2 rounded-lg hover:bg-emerald-50" aria-label="Ajouter">
                      <Plus size={18}/>
                    </motion.button>
                  </div>
                  <div className="space-y-2">
                    <AnimatePresence initial={false}>
                      {dayAbs.map((a) => (
                        <AbsenceCard key={a.id} a={a} onDelete={async () => {
                          if (!confirm("Supprimer ?")) return;
                          await supabase.from("absences_competitions").delete().eq("id", a.id);
                          setAbsences((prev) => prev.filter((x) => x.id !== a.id));
                        }} />
                      ))}
                      {daySessions.map((s) => (
                        <SessionCard key={s.id} s={s} onEdit={() => { setModalDate(s.date); setEditSession(s); setModalOpen(true); }} onDelete={() => deleteSession(s.id)} />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Modal */}
      {athlete && (
        <SessionModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSaved={(ss, isEdit) => {
            setModalOpen(false);
            if (isEdit) setSessions((prev) => prev.map((x) => (x.id === ss.id ? ss : x)));
            else setSessions((prev) => [...prev, ss]);
          }}
          initial={editSession}
          athlete={athlete}
          date={modalDate}
        />
      )}
    </main>
  );
}
