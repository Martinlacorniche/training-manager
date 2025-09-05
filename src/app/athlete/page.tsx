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
  PencilSimple, Trash, Plus, ChatCircleDots,
  CaretLeft, CaretRight, CheckCircle, XCircle, SignOut,
  ChartLineUp as LoadIcon, Bicycle, SwimmingPool, Mountains, PersonSimpleRun, Clock, ChartLineUp
} from "@phosphor-icons/react";

// Animations
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

// DnD
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

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

// ---------- Smooth height for comments
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

// ---------- Modal validation/edition (athlete)
function ValidateModal({ open, onClose, onSaved, initial }:{ open: boolean; onClose: ()=>void; onSaved: (s: SessionType)=>void; initial: SessionType | null; }) {
  const [status, setStatus] = useState<string>(initial?.status || "");
  const [rpe, setRpe] = useState<number | null>(initial?.rpe ?? null);
  const [comment, setComment] = useState<string>(initial?.athlete_comment || "");
  const [hours, setHours] = useState<number>(Math.floor(initial?.planned_hour || 0));
  const [minutes, setMinutes] = useState<number>(Math.round(((initial?.planned_hour || 0) % 1) * 60));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStatus(initial?.status || "");
    setRpe(initial?.rpe ?? null);
    setComment(initial?.athlete_comment || "");
    const ph = initial?.planned_hour || 0;
    setHours(Math.floor(ph));
    setMinutes(Math.round((ph % 1) * 60));
  }, [open, initial]);

  if (!open || !initial) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: Partial<SessionType> = {
        status,
        rpe,
        athlete_comment: comment,
        planned_hour: hours + minutes / 60,
      };
      const { data, error } = await supabase.from("sessions").update(payload).eq("id", initial!.id).select().single();
      if (error) throw error;
      if (data) onSaved(data as SessionType);
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
            className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-5 space-y-4"
          >
            <h3 className="text-lg font-semibold text-slate-800">Valider / Modifier</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm text-slate-700">Statut
                <select value={status} onChange={(e)=>setStatus(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2">
                  <option value="">—</option>
                  <option value="valide">Validée</option>
                  <option value="non_valide">Non validée</option>
                </select>
              </label>
              <label className="text-sm text-slate-700">RPE
                <input type="number" min={1} max={10} value={rpe ?? ""} onChange={(e)=>setRpe(e.target.value ? Number(e.target.value) : null)} className="mt-1 w-full rounded-lg border border-slate-200 p-2" placeholder="1–10"/>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm text-slate-700">Heures
                <select value={hours} onChange={(e)=>setHours(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 p-2">
                  {Array.from({length:15}, (_,i)=> <option key={i} value={i}>{i} h</option>)}
                </select>
              </label>
              <label className="text-sm text-slate-700">Minutes
                <select value={minutes} onChange={(e)=>setMinutes(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 p-2">
                  {Array.from({length:12}, (_,i)=> <option key={i} value={i*5}>{String(i*5).padStart(2,"0")} min</option>)}
                </select>
              </label>
            </div>
            <label className="text-sm text-slate-700">Mon commentaire
              <textarea value={comment} onChange={(e)=>setComment(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 min-h-[90px]" placeholder="Ressenti, conditions, douleurs…"/>
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700">Annuler</button>
              <button disabled={loading} className="px-4 py-2 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700">
                {loading ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------- Modal absence/compétition (create/edit)
function AbsenceModal({ open, onClose, onSaved, initial, athleteId, date }:{
  open: boolean; onClose: ()=>void; onSaved: (a: AbsenceType, isEdit: boolean)=>void;
  initial?: AbsenceType | null; athleteId: string; date: string;
}) {
  const isEdit = !!initial;
  const [type, setType] = useState<string>(initial?.type || "off");
  const [name, setName] = useState<string>(initial?.name || "");
  const [distance, setDistance] = useState<string>(initial?.distance_km?.toString() || "");
  const [elev, setElev] = useState<string>(initial?.elevation_d_plus?.toString() || "");
  const [comment, setComment] = useState<string>(initial?.comment || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setType(initial.type || "off");
      setName(initial.name || "");
      setDistance(initial.distance_km?.toString() || "");
      setElev(initial.elevation_d_plus?.toString() || "");
      setComment(initial.comment || "");
    } else {
      setType("off"); setName(""); setDistance(""); setElev(""); setComment("");
    }
  }, [open, initial]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const payload: any = {
      user_id: athleteId,
      date,
      type,
      name: name || null,
      distance_km: distance ? Number(distance) : null,
      elevation_d_plus: elev ? Number(elev) : null,
      comment: comment || null
    };
    try {
      let data: any, error: any;
      if (isEdit) ({ data, error } = await supabase.from("absences_competitions").update(payload).eq("id", initial!.id).select().single());
      else ({ data, error } = await supabase.from("absences_competitions").insert(payload).select().single());
      if (error) throw error;
      if (data) onSaved(data as AbsenceType, isEdit);
    } catch (err:any) {
      alert("Erreur: " + (err?.message || "inconnue"));
    } finally {
      setLoading(false);
    }
  }

  async function del() {
    if (!isEdit) return;
    if (!confirm("Supprimer cet élément ?")) return;
    const { error } = await supabase.from("absences_competitions").delete().eq("id", initial!.id);
    if (error) alert(error.message);
    else { onClose(); }
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
            <h3 className="text-lg font-semibold text-slate-800">{isEdit ? "Modifier" : "Déclarer"} {type === "competition" ? "une compétition" : "un jour off"}</h3>
            <label className="text-sm text-slate-700">Type
              <select value={type} onChange={(e)=>setType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2">
                <option value="off">Off</option>
                <option value="competition">Compétition</option>
              </select>
            </label>
            {type === "competition" && (
              <>
                <label className="text-sm text-slate-700">Nom
                  <input value={name} onChange={(e)=>setName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2"/>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm text-slate-700">Distance (km)
                    <input value={distance} onChange={(e)=>setDistance(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2" inputMode="decimal"/>
                  </label>
                  <label className="text-sm text-slate-700">D+ (m)
                    <input value={elev} onChange={(e)=>setElev(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2" inputMode="numeric"/>
                  </label>
                </div>
              </>
            )}
            <label className="text-sm text-slate-700">Commentaire (optionnel)
              <textarea value={comment} onChange={(e)=>setComment(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 min-h-[80px]"/>
            </label>
            <div className="flex justify-between pt-1">
              {isEdit ? (
                <button type="button" onClick={del} className="px-3 py-2 rounded-lg text-rose-700 border border-rose-200 hover:bg-rose-50 inline-flex items-center gap-2">
                  <Trash size={16}/> Supprimer
                </button>
              ) : <span />}
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700">Annuler</button>
                <button disabled={loading} className="px-4 py-2 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700">
                  {loading ? "Enregistrement…" : (isEdit ? "Enregistrer" : "Créer")}
                </button>
              </div>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------- Cards
const SessionCard = React.memo(function SessionCard({ s, onEdit }:{ s: SessionType; onEdit: ()=>void; }) {
  const [showComment, setShowComment] = useState(false);

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
      className={`relative rounded-2xl shadow-sm border p-3 overflow-hidden ${statusTint} ${statusOverlay} after:absolute after:inset-0 after:pointer-events-none`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] ring-1 ${sportBadgeClasses(s.sport)}`}>
          {sportIcon(s.sport, 14)} <span className="font-medium">{s.sport}</span>
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {(s.athlete_comment || s.rpe) && (
            <button onClick={()=>setShowComment(v=>!v)} aria-expanded={showComment} title="Voir mon commentaire" className="p-2 rounded-lg hover:bg-emerald-50">
              <ChatCircleDots size={16}/>
            </button>
          )}
          <button onClick={onEdit} className="p-2 rounded-lg hover:bg-emerald-50" title="Valider / Modifier"><PencilSimple size={16}/></button>
        </div>
      </div>
      <div className={`mt-2 h-1 rounded-full ${intensityBar(s.intensity)}`} />
      {s.title && <div className="mt-2 text-sm font-semibold text-slate-800 break-words">{s.title}</div>}
      {s.planned_hour !== undefined && <div className="mt-1 text-[12px] text-slate-600 inline-flex items-center gap-1"><Clock size={12}/>{fmtTime(s.planned_hour)}</div>}
      {s.planned_inter && (
        <div className="mt-2 rounded-md bg-emerald-50/50 p-2 text-[13px] text-slate-700 whitespace-pre-line">
          {s.planned_inter}
        </div>
      )}
      <AnimatePresence initial={false}>
        {showComment && (s.athlete_comment || s.rpe) && (
          <SmoothCollapsible open={showComment}>
            <div className="mt-2 rounded-md bg-slate-50 p-2 text-[13px] text-slate-700 whitespace-pre-line">
              {s.athlete_comment ? `“${s.athlete_comment}”` : ""}{s.athlete_comment && s.rpe ? "\n" : ""}{s.rpe ? `RPE ${s.rpe}` : ""}
            </div>
          </SmoothCollapsible>
        )}
      </AnimatePresence>
      <div className="mt-2 pt-2 border-t border-emerald-100 flex items-center justify-end text-[12px]">
        <div>
          {s.status === "valide" && <span className="inline-flex items-center gap-1 text-emerald-800"><CheckCircle size={12}/>Validée</span>}
          {s.status === "non_valide" && <span className="inline-flex items-center gap-1 text-rose-700"><XCircle size={12}/>Non validée</span>}
        </div>
      </div>
    </motion.div>
  );
});


const AbsenceCard = React.memo(function AbsenceCard({ a, onEdit }:{ a: AbsenceType; onEdit: ()=>void; }) {
  const isComp = a.type === "competition";
  const cls = isComp ? "bg-amber-50 ring-amber-200 text-amber-800" : "bg-slate-50 ring-slate-200 text-slate-700";
  const title = isComp ? "Compétition" : "Repos";
  return (
    <motion.div
      layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.2 }} whileHover={{ y: -1 }}
      className="relative rounded-2xl bg-white shadow-sm border border-emerald-100 p-3 overflow-visible"
    >
      {/* ABSOLUTE, ALWAYS VISIBLE EDIT BUTTON */}
      <button
        onClick={onEdit}
        className="absolute top-2 right-2 p-2 rounded-full bg-white/90 shadow ring-1 ring-emerald-200 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
        title="Modifier / Supprimer"
        aria-label="Modifier / Supprimer"
      >
        <PencilSimple size={16} />
      </button>

      <div className="flex items-start justify-between gap-2 pr-8">
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
    </motion.div>
  );
});

// ---------- Main page
export default function AthletePage() {
  const router = useRouter();
  const prefersReduced = useReducedMotion();

  const [athlete, setAthlete] = useState<UserType | null>(null);

  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = useMemo(() => dayjs().startOf("week").add(weekOffset, "week"), [weekOffset]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => weekStart.add(i, "day")), [weekStart]);

  const [sessions, setSessions] = useState<SessionType[]>([]);
  const [absences, setAbsences] = useState<AbsenceType[]>([]);

  const [validateOpen, setValidateOpen] = useState(false);
  const [currentSession, setCurrentSession] = useState<SessionType | null>(null);

  const [absenceOpen, setAbsenceOpen] = useState(false);
  const [absenceDate, setAbsenceDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const [editAbsence, setEditAbsence] = useState<AbsenceType | null>(null);

  const [prevWeekLoad, setPrevWeekLoad] = useState<number>(0);
  const [nextRaceText, setNextRaceText] = useState<string>("");

  // boot
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) { router.push("/login"); return; }
      const { data: user } = await supabase.from("users").select("*").eq("id_auth", session.user.id).single();
      setAthlete(user as UserType);
    })();
  }, [router]);

  // load week data
  useEffect(() => {
    (async () => {
      if (!athlete?.id_auth) return;
      const start = weekStart.format("YYYY-MM-DD");
      const end = weekStart.add(6, "day").format("YYYY-MM-DD");
      const { data: sess } = await supabase
        .from("sessions")
        .select("id,user_id,sport,title,planned_hour,planned_inter,intensity,status,rpe,athlete_comment,date")
        .eq("user_id", athlete.id_auth).gte("date", start).lte("date", end);
      setSessions((sess || []) as SessionType[]);

      const { data: abs } = await supabase
        .from("absences_competitions")
        .select("id,user_id,date,type,name,distance_km,elevation_d_plus,comment")
        .eq("user_id", athlete.id_auth).gte("date", start).lte("date", end);
      setAbsences((abs || []) as AbsenceType[]);
    })();
  }, [athlete?.id_auth, weekStart]);

  // prev week load + next race (based on displayed week)
  useEffect(() => {
    (async () => {
      if (!athlete?.id_auth) return;
      const prevStart = weekStart.add(-7, "day").format("YYYY-MM-DD");
      const prevEnd = weekStart.add(-1, "day").format("YYYY-MM-DD");
      const { data: prevSessions } = await supabase
        .from("sessions").select("planned_hour,rpe,status,user_id,date")
        .eq("user_id", athlete.id_auth).gte("date", prevStart).lte("date", prevEnd);
      const load = (prevSessions || []).filter(s=> s.status === "valide")
        .reduce((acc:any, s:any)=> acc + ((Number(s.rpe)||0) * (Number(s.planned_hour)||0)), 0);
      setPrevWeekLoad(load);

      const base = weekStart.startOf("day");
      const { data: nextComp } = await supabase
        .from("absences_competitions")
        .select("date,type").eq("user_id", athlete.id_auth)
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
  }, [athlete?.id_auth, weekStart]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  // DnD
  const dayId = (d: dayjs.Dayjs) => d.format("YYYY-MM-DD");
  const sessionsByDay = useMemo(() => {
    const map: Record<string, SessionType[]> = {};
    weekDays.forEach(d => map[dayId(d)] = []);
    sessions.forEach(s => { if (map[s.date]) map[s.date].push(s); });
    return map;
  }, [sessions, weekDays]);

  const absencesByDay = useMemo(() => {
    const map: Record<string, AbsenceType[]> = {};
    weekDays.forEach(d => map[dayId(d)] = []);
    absences.forEach(a => { if (map[a.date]) map[a.date].push(a); });
    return map;
  }, [absences, weekDays]);

  const onDragEnd = useCallback(async (result: DropResult) => {
    const { destination, draggableId } = result;
    if (!destination) return;
    const destDate = destination.droppableId;
    if ((absencesByDay[destDate] || []).length > 0) return; // blocked day
    setSessions(prev => prev.map(s => s.id === draggableId ? { ...s, date: destDate } : s));
    await supabase.from("sessions").update({ date: destDate }).eq("id", draggableId);
  }, [absencesByDay]);

  const stats = useMemo(() => {
    const total = sessions.length;
    const validated = sessions.filter(s => s.status === "valide").length;
    const time = sessions.reduce((acc, s) => acc + (Number(s.planned_hour) || 0), 0);
    const load = sessions.filter(s => s.status === "valide").reduce((acc, s) => acc + ((Number(s.rpe) || 0) * (Number(s.planned_hour) || 0)), 0);
    const progress = total ? Math.round((validated / total) * 100) : 0;
    return { total, validated, time, load, progress };
  }, [sessions]);

  const progressVariants = useReducedMotion()
    ? {}
    : { initial: { width: 0 }, animate: { width: `${stats.progress}%`, transition: { duration: 0.45 } } };

  return (
    <main className={`${jakarta.className} min-h-screen bg-gradient-to-br from-emerald-50 via-sky-50 to-white text-slate-800`}>
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-emerald-100 bg-white/80 backdrop-blur">
        <div className="max-w-screen-2xl mx-auto px-3 py-3 flex items-center gap-3">
          <div className="text-sm text-emerald-900">Bonjour {athlete?.name?.split(" ")[0] || "Athlète"}</div>
          <div className="mx-auto flex items-center gap-2">
            <button onClick={() => setWeekOffset(w => w - 1)} className="p-2 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-100" aria-label="Semaine précédente"><CaretLeft size={18}/></button>
            <div className="text-sm font-semibold text-emerald-900">Semaine du {weekStart.format("DD/MM/YYYY")}</div>
            <button onClick={() => setWeekOffset(w => w + 1)} className="p-2 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-100" aria-label="Semaine suivante"><CaretRight size={18}/></button>
          </div>
          <div className="flex items-center gap-2">
            <a href="/athlete/stats/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-900">
              <ChartLineUp size={14}/> Stats
            </a>
            <button onClick={logout} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-rose-200 bg-white hover:bg-rose-50 text-rose-700">
              <SignOut size={14}/> Déconnexion
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto px-3 py-5 grid grid-cols-12 gap-4">
        {/* Sidebar quick recap */}
        <aside className="col-span-12 md:col-span-3 space-y-3">
          <div className="rounded-2xl border border-emerald-100 bg-white p-4">
            <div className="text-sm font-semibold text-emerald-950 mb-2">Ma semaine</div>
            <div className="flex items-center gap-4 text-sm text-emerald-900">
              <div className="flex items-center gap-2"><CheckCircle size={16} className="text-emerald-600"/><span>{stats.validated}/{stats.total}</span></div>
              <div className="flex items-center gap-2"><Clock size={16} className="text-slate-700"/><span>{fmtTime(stats.time)}</span></div>
              <div className="flex items-center gap-2"><LoadIcon size={16} className="text-amber-600"/><span>{stats.load.toFixed(1)}</span></div>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-emerald-100 overflow-hidden">
              <motion.div className="h-full bg-emerald-500 rounded-full" initial="initial" animate="animate" {...progressVariants}/>
            </div>
          </div>

          {/* Next competition + previous week load */}
          <div className="rounded-2xl border border-emerald-100 bg-white p-4 text-sm text-slate-700">
            <div className="font-semibold text-emerald-950 mb-1.5">Repères</div>
            <div className="space-y-1">
              <div>Prochaine compétition : <span className="font-medium text-emerald-900">{nextRaceText}</span></div>
              <div>Charge semaine précédente : <span className="font-medium text-emerald-900">{prevWeekLoad.toFixed(1)}</span></div>
            </div>
          </div>
        </aside>

        {/* Main week grid */}
        <section className="col-span-12 md:col-span-9">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid grid-cols-7 gap-3">
              {weekDays.map((d) => {
                const iso = d.format("YYYY-MM-DD");
                const daySessions = sessionsByDay[iso] || [];
                const dayAbs = absencesByDay[iso] || [];
                const blocked = dayAbs.length > 0;
                return (
                  <Droppable droppableId={iso} key={iso}>
                    {(provided, snapshot) => (
                      <div ref={provided.innerRef} {...provided.droppableProps}
                        className={`rounded-2xl border border-emerald-100 bg-white p-3 min-h-[240px] flex flex-col transition-colors ${snapshot.isDraggingOver && !blocked ? "bg-emerald-50" : ""} ${blocked ? "opacity-80" : ""}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs font-medium text-emerald-900">{d.format("ddd DD/MM")}</div>
                          <motion.button
                            whileTap={{ scale: 0.96, rotate: 90 }}
                            onClick={() => { setAbsenceDate(iso); setEditAbsence(null); setAbsenceOpen(true); }}
                            className="p-2 rounded-lg hover:bg-emerald-50" aria-label="Déclarer Off/Compétition">
                            <Plus size={18}/>
                          </motion.button>
                        </div>
                        <div className="space-y-2">
                          {dayAbs.map((a) => (
                            <AbsenceCard key={a.id} a={a} onEdit={() => { setAbsenceDate(iso); setEditAbsence(a); setAbsenceOpen(true); }} />
                          ))}
                          <AnimatePresence initial={false}>
                            {daySessions.map((s, idx) => (
                              <Draggable key={s.id} draggableId={s.id} index={idx}>
                                {(prov) => (
                                  <div ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps}>
                                    <SessionCard s={s} onEdit={()=>{ setCurrentSession(s); setValidateOpen(true); }} />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                          </AnimatePresence>
                          {provided.placeholder}
                        </div>
                      </div>
                    )}
                  </Droppable>
                );
              })}
            </div>
          </DragDropContext>
        </section>
      </div>

      {/* Modals */}
      <ValidateModal
        open={validateOpen}
        onClose={()=>setValidateOpen(false)}
        initial={currentSession}
        onSaved={(ss)=>{
          setValidateOpen(false);
          setSessions(prev => prev.map(x => x.id === ss.id ? ss : x));
        }}
      />
      {athlete && (
        <AbsenceModal
          open={absenceOpen}
          onClose={()=>{ setAbsenceOpen(false); }}
          onSaved={(aa, isEdit)=>{
            setAbsenceOpen(false);
            if (isEdit) setAbsences(prev => prev.map(x => x.id === aa.id ? aa : x));
            else setAbsences(prev => [...prev, aa]);
          }}
          initial={editAbsence}
          athleteId={athlete.id_auth}
          date={absenceDate}
        />
      )}
    </main>
  );
}
