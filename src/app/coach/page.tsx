"use client";
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import "dayjs/locale/fr";
import isoWeek from "dayjs/plugin/isoWeek";
import isBetween from "dayjs/plugin/isBetween"; 
dayjs.locale("fr");
dayjs.extend(isoWeek);
dayjs.extend(isBetween); 

// Font
import { Plus_Jakarta_Sans } from "next/font/google";
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["500","600","700"], display: "swap" });

// Icons (Phosphor)
import {
  PencilSimple, Trash, Plus, Info, ChartLineUp,
  CaretLeft, CaretRight, CheckCircle, XCircle,
  ChartLineUp as LoadIcon, Bicycle, SwimmingPool, Mountains, PersonSimpleRun, Clock, SignOut,
  WarningCircle, Fire, Smiley, SmileySad, SmileyMeh, Notebook, X, Question
} from "@phosphor-icons/react";

// Animations
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

// ---------- HELPERS INTELLIGENTS & COULEURS ----------

const EST_RPE: Record<string, number> = { basse: 3, moyenne: 6, haute: 9 };
function getPlannedLoad(s: SessionType) {
  const rpe = EST_RPE[s.intensity || "moyenne"] || 6;
  return (s.planned_hour || 0) * rpe;
}

function getSessionAlert(s: SessionType): string | null {
  if (s.athlete_comment && /(mal|douleur|blessure|gêne|bob)/i.test(s.athlete_comment)) return "douleur";
  if (s.status === "valide" && s.intensity === "basse" && (s.rpe || 0) > 8) return "surmenage";
  return null;
}

function getSportStyle(s?: string) {
  switch (s) {
    case "Vélo": return { bg: "bg-emerald-100", text: "text-emerald-900", border: "border-emerald-300", icon: "text-emerald-700" };
    case "Run": return { bg: "bg-slate-200", text: "text-slate-800", border: "border-slate-400", icon: "text-slate-600" };
    case "Natation": return { bg: "bg-cyan-100", text: "text-cyan-900", border: "border-cyan-300", icon: "text-cyan-700" };
    case "Trail": return { bg: "bg-lime-100", text: "text-lime-900", border: "border-lime-300", icon: "text-lime-700" };
    case "Renfo":
    case "Muscu": return { bg: "bg-orange-100", text: "text-orange-900", border: "border-orange-300", icon: "text-orange-700" };
    default: return { bg: "bg-gray-100", text: "text-gray-800", border: "border-gray-300", icon: "text-gray-600" };
  }
}

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

function intensityBar(level?: string) {
  switch (level) {
    case "haute": return "bg-red-500";
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
function formatDuration(h?: number | null) {
  if (!h && h !== 0) return "—";
  const H = Math.floor(h);
  const M = Math.round((h - H) * 60);
  return `${H}h${String(M).padStart(2, "0")}`;
}

// ---------- TYPES ----------
type UserType = { id_auth: string; name: string; coach_code?: string; coach_id?: string; ordre: number | null; alert?: boolean };
type SessionType = { id: string; user_id: string; sport?: string; title?: string; planned_hour?: number; planned_inter?: string; intensity?: string; status?: string; rpe?: number | null; athlete_comment?: string | null; date: string; };
type AbsenceType = { id: string; user_id: string; date: string; type: string; name?: string | null; distance_km?: number | null; elevation_d_plus?: number | null; comment?: string | null; rpe?: number | null; duration_hour?: number | null; status?: string | null; };
type WeeklyReviewType = { week_start: string; rpe_life: number; comment: string; };
type WeeklyThematicType = { user_id: string; week_start: string; thematic: string; };

// ---------- COMPONENTS ----------

// 1. RPE POPOVER
function RpeGuidePopover({ open, onClose }:{ open:boolean; onClose:()=>void }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) onClose();
        }
        if(open) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open, onClose]);

    const rows = [
        { score: 10, label: "Maximal", desc: "Sprint final, nausée", bg: "bg-purple-100", text: "text-purple-900" },
        { score: 9, label: "Agonie", desc: "Tenable qqs secondes", bg: "bg-red-100", text: "text-red-900" },
        { score: 8, label: "Extrême", desc: "Impossible de parler", bg: "bg-red-50", text: "text-red-800" },
        { score: 7, label: "Très dur", desc: "Un mot à la fois", bg: "bg-orange-100", text: "text-orange-900" },
        { score: 6, label: "Dur", desc: "Quelques mots", bg: "bg-orange-50", text: "text-orange-800" },
        { score: 5, label: "Un peu dur", desc: "Conversation hachée", bg: "bg-amber-100", text: "text-amber-900" },
        { score: 4, label: "Moyen", desc: "On raconte que l'essentiel", bg: "bg-amber-50", text: "text-amber-800" },
        { score: 3, label: "Facile (Z2)", desc: "Conversation facile", bg: "bg-emerald-100", text: "text-emerald-900" },
        { score: 2, label: "Très facile", desc: "Respiration nasale", bg: "bg-emerald-50", text: "text-emerald-800" },
        { score: 1, label: "Récup", desc: "Marche / Effort nul", bg: "bg-slate-100", text: "text-slate-700" },
    ];

    return (
        <AnimatePresence>
            {open && (
                <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }} 
                    animate={{ opacity: 1, y: 0, scale: 1 }} 
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full right-0 mt-2 z-50 w-72 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden"
                    ref={ref}
                >
                    <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wide flex justify-between items-center">
                        <span>Échelle RPE</span>
                        <span className="text-[10px] font-normal normal-case text-slate-400">Ressenti Perçu</span>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
                        {rows.map(r => (
                            <div key={r.score} className={`flex items-center text-xs border-b last:border-0 border-slate-50`}>
                                <div className={`w-8 py-2 text-center font-bold ${r.bg} ${r.text}`}>{r.score}</div>
                                <div className="flex-1 px-3 py-1.5">
                                    <div className={`font-bold ${r.text}`}>{r.label}</div>
                                    <div className="text-[10px] text-slate-500">{r.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// 2. Modal Séance
function SessionModal({ open, onClose, onSaved, initial, athlete, date }:{ open: boolean; onClose: ()=>void; onSaved: (s: SessionType, isEdit: boolean)=>void; initial?: SessionType | null; athlete: UserType; date: string; }) {
    const [sport, setSport] = useState("Run");
    const [title, setTitle] = useState("");
    const [plannedHour, setPlannedHour] = useState(0);
    const [plannedMinute, setPlannedMinute] = useState(0);
    const [intensity, setIntensity] = useState("moyenne");
    const [planned_inter, setPlannedInter] = useState("");
    const [loading, setLoading] = useState(false);
  
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
            <motion.form onSubmit={submit} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.18 }} className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-5 space-y-3">
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
              <label className="text-sm text-slate-700">Titre <input value={title} onChange={(e)=>setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 focus:outline-none focus:ring-2 focus:ring-emerald-300"/></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm text-slate-700">Heures <select value={plannedHour} onChange={(e)=>setPlannedHour(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 focus:outline-none focus:ring-2 focus:ring-emerald-300">{Array.from({length:15}, (_,i)=> <option key={i} value={i}>{i} h</option>)}</select></label>
                <label className="text-sm text-slate-700">Minutes <select value={plannedMinute} onChange={(e)=>setPlannedMinute(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 focus:outline-none focus:ring-2 focus:ring-emerald-300">{Array.from({length:12}, (_,i)=> <option key={i} value={i*5}>{String(i*5).padStart(2,"0")} min</option>)}</select></label>
              </div>
              <label className="text-sm text-slate-700">Consignes <textarea value={planned_inter} onChange={(e)=>setPlannedInter(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 min-h-[90px] focus:outline-none focus:ring-2 focus:ring-emerald-300"/></label>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700">Annuler</button>
                <button disabled={loading} className="px-4 py-2 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700">{loading ? "..." : "OK"}</button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    );
}

function SmoothCollapsible({ open, children }:{ open: boolean; children: React.ReactNode; }) {
    const ref = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState<number | "auto">(0);
    useEffect(() => {
      if (open && ref.current) { setHeight(ref.current.scrollHeight); setTimeout(() => setHeight("auto"), 220); }
      if (!open) { if (ref.current) setHeight(ref.current.scrollHeight); setTimeout(() => setHeight(0), 0); }
    }, [open]);
    return (<motion.div style={{ overflow: "hidden" }} initial={false} animate={{ height }} transition={{ duration: 0.22 }}> <div ref={ref}>{children}</div></motion.div>);
}

// 3. Panneau Latéral Historique
function LifeHistoryPanel({ open, onClose, athleteId }:{ open: boolean; onClose: ()=>void; athleteId: string; }) {
    const [history, setHistory] = useState<WeeklyReviewType[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && athleteId) {
            setLoading(true);
            supabase.from("weekly_reviews")
                .select("*")
                .eq("user_id", athleteId)
                .order("week_start", { ascending: false })
                .limit(5)
                .then(({ data }) => {
                    if (data) setHistory(data as WeeklyReviewType[]);
                    setLoading(false);
                });
        }
    }, [open, athleteId]);

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose} className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm" />
                    <motion.div 
                        initial={{x:"100%"}} animate={{x:0}} exit={{x:"100%"}} transition={{type:"spring", stiffness:300, damping:30}}
                        className="fixed inset-y-0 right-0 w-full max-w-sm bg-white shadow-2xl z-50 p-6 border-l border-slate-100 flex flex-col"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Notebook size={24} className="text-emerald-600"/> Historique Vie</h3>
                            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100"><X size={20}/></button>
                        </div>
                        {loading ? (
                            <div className="text-slate-400 text-sm italic">Chargement...</div>
                        ) : (
                            <div className="space-y-4 overflow-y-auto flex-1">
                                {history.length === 0 ? (
                                    <div className="text-slate-400 text-sm text-center py-10">Aucun bilan enregistré récemment.</div>
                                ) : (
                                    history.map((rev) => (
                                        <div key={rev.week_start} className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="text-xs uppercase font-bold text-slate-400">
                                                    Sem. du {dayjs(rev.week_start).format("DD/MM")}
                                                </div>
                                                <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold border 
                                                    ${rev.rpe_life <= 3 ? "bg-emerald-100 text-emerald-700 border-emerald-200" : 
                                                      rev.rpe_life <= 6 ? "bg-amber-100 text-amber-700 border-amber-200" : 
                                                      "bg-rose-100 text-rose-700 border-rose-200"}`}>
                                                    Charge {rev.rpe_life}/10
                                                </div>
                                            </div>
                                            {rev.comment ? (
                                                <div className="text-sm text-slate-700 italic">"{rev.comment}"</div>
                                            ) : (
                                                <div className="text-xs text-slate-300 italic">Pas de commentaire</div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

// 4. SessionCard
const SessionCard = React.memo(function SessionCard({ s, onEdit, onDelete }:{ s: SessionType; onEdit: ()=>void; onDelete: ()=>void; }) {
  const [showCoachNote, setShowCoachNote] = useState(false);
  const style = getSportStyle(s.sport);
  const alertType = getSessionAlert(s);
  const isPast = dayjs(s.date).isBefore(dayjs(), 'day');

  let borderClass = "";
  if (alertType) {
    // 1. ALERTE DOULEUR / SURMENAGE (PRIORITAIRE)
    borderClass = "border-2 border-rose-500 shadow-red-100";
  } else if (s.status === "valide") {
    // 2. SÉANCE VALIDÉE
    borderClass = "border border-emerald-400 ring-1 ring-emerald-400 shadow-sm";
  } else if (isPast) {
    // 3. NOUVEL INDICATEUR : NON VALIDÉE & PASSÉE
    borderClass = "border-2 border-amber-500 shadow-amber-100";
  } else {
    // 4. PLANIFIÉE FUTURE / JOUR J (Bordure Neutre)
    borderClass = "border border-transparent";
  }

  return (
    <motion.div layout initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:6}} transition={{duration:0.2}} whileHover={{y:-1}}
      className={`relative rounded-xl p-3 mb-2 overflow-hidden transition-all shadow-sm ${style.bg} ${borderClass}`}>
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <div className="flex items-center gap-1.5">
           <span className={`${style.icon}`}>{sportIcon(s.sport, 16)}</span>
           <span className={`text-[11px] font-bold uppercase tracking-wider ${style.text}`}>{s.sport}</span>
        </div>
        <div className="flex gap-1">
             {alertType && <div className="text-rose-600 animate-pulse"><WarningCircle size={18} weight="fill" /></div>}
             {s.planned_inter && <button onClick={()=>setShowCoachNote(v=>!v)} className={`${style.text} hover:bg-white/50 rounded p-0.5`}><Info size={15}/></button>}
             <button onClick={onEdit} className={`${style.text} opacity-60 hover:opacity-100 rounded p-0.5`}><PencilSimple size={15}/></button>
             <button onClick={onDelete} className={`${style.text} opacity-60 hover:text-rose-600 rounded p-0.5`}><Trash size={15}/></button>
        </div>
      </div>
      <div className={`h-1 w-12 rounded-full mb-2 ${intensityBar(s.intensity)}`} />
      {s.title && <div className={`text-sm font-bold leading-tight mb-1 ${style.text}`}>{s.title}</div>}
      <div className={`flex items-center justify-between text-xs font-medium ${style.text} opacity-90`}>
        <div className="flex items-center gap-1"><Clock size={12}/> {fmtTime(s.planned_hour)}</div>
        {s.status === "valide" && s.rpe ? (
            <div className="flex items-center gap-1 font-bold">{alertType === "surmenage" && <Fire size={12} className="text-rose-500"/>}<span>RPE {s.rpe}</span></div>
        ) : (<div className="opacity-60 italic text-[10px]">Prev. RPE ~{EST_RPE[s.intensity || "moyenne"] || 6}</div>)}
      </div>
      {(s.athlete_comment || s.rpe) && (
        <div className={`mt-2 p-2 bg-white/80 rounded-lg text-[11px] italic text-slate-700 border border-white/50 ${alertType === "douleur" ? "border-rose-300 bg-rose-50 text-rose-800 font-medium" : ""}`}>
          {s.athlete_comment ? `“${s.athlete_comment}”` : ""}{!s.athlete_comment && s.rpe ? `Ressenti: ${s.rpe}/10` : ""}
        </div>
      )}
      <AnimatePresence initial={false}>
        {s.planned_inter && (
          <SmoothCollapsible open={showCoachNote}>
            <div className={`mt-2 pt-2 border-t border-black/5 text-[11px] whitespace-pre-line ${style.text}`}><span className="font-bold">Coach:</span> {s.planned_inter}</div>
          </SmoothCollapsible>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

// 5. AbsenceCard
const AbsenceCard = React.memo(function AbsenceCard({ a, onDelete }:{ a: AbsenceType; onDelete: ()=>void; }) {
    const isComp = a.type === "competition";
    let cls = "bg-slate-50 border-slate-200 text-slate-500";
    if (isComp) {
      if (a.status === "finisher") cls = "bg-emerald-50 border-emerald-200 text-emerald-800";
      else if (a.status === "dnf") cls = "bg-rose-50 border-rose-200 text-rose-800";
      else cls = "bg-amber-50 border-amber-200 text-amber-800";
    }
    const title = isComp ? "Compétition" : "Repos / Off";
    return (
      <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} whileHover={{ y: -1 }} className={`rounded-xl border shadow-sm p-3 mb-2 overflow-hidden ${cls}`}>
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide">{title}</span>
          <button onClick={onDelete} className="opacity-50 hover:opacity-100 hover:text-rose-600"><Trash size={14}/></button>
        </div>
        {isComp && (
          <div className="text-xs space-y-1">
            {a.name && <div className="font-bold text-sm">{a.name}</div>}
            <div className="opacity-80">{a.distance_km ? `${a.distance_km}km` : ""}{a.distance_km && a.elevation_d_plus ? " • " : ""}{a.elevation_d_plus ? `${a.elevation_d_plus}d+` : ""}</div>
            {(a.duration_hour || a.rpe) && <div className="opacity-80"> {formatDuration(a.duration_hour)} {a.rpe ? `• RPE ${a.rpe}` : ""} </div>}
          </div>
        )}
        {!isComp && a.comment && <div className="text-xs italic mt-1 opacity-80">"{a.comment}"</div>}
      </motion.div>
    );
  });

// 6. AthleteMetricsCoach
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
        const { data } = await supabase.from("athlete_metrics").select("vma_kmh, ftp_w").eq("user_id", athleteId).single();
        if (data) { setVma(data.vma_kmh ? String(data.vma_kmh) : ""); setFtp(data.ftp_w ? String(data.ftp_w) : ""); }
        else { setVma(""); setFtp(""); }
      })();
    }, [athleteId]);
    async function save() {
      setLoading(true);
      const payload = { user_id: athleteId, vma_kmh: vma ? Number(vma) : null, ftp_w: ftp ? Number(ftp) : null, updated_at: new Date().toISOString() };
      const { error } = await supabase.from("athlete_metrics").upsert(payload, { onConflict: "user_id" });
      setLoading(false);
      if (error) alert(error.message);
    }
    const vmaNum = vma ? Number(vma) : null;
    const ftpNum = ftp ? Number(ftp) : null;
    return (
      <div className="mt-4 rounded-xl border border-emerald-100 bg-white p-3 text-sm text-slate-700 space-y-2 shadow-sm">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] uppercase text-slate-500 font-bold">VMA (km/h)<input type="number" step="0.1" value={vma} onChange={e=>setVma(e.target.value)} className="mt-0.5 w-full rounded border border-slate-200 px-1 py-0.5 text-xs"/></label>
          <label className="text-[10px] uppercase text-slate-500 font-bold">FTP (w)<input type="number" value={ftp} onChange={e=>setFtp(e.target.value)} className="mt-0.5 w-full rounded border border-slate-200 px-1 py-0.5 text-xs"/></label>
        </div>
        <button onClick={save} disabled={loading} className="w-full py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold">{loading ? "..." : "Sauvegarder Profil"}</button>
        {(vmaNum || ftpNum) && (
          <table className="w-full text-[10px] border-collapse mt-1">
            <thead><tr><th className="border-b text-left py-0.5">%</th><th className="border-b text-center">VMA</th><th className="border-b text-center">FTP</th></tr></thead>
            <tbody>{PCTS.map(pct => { const frac = pct/100; return (<tr key={pct}><td className="py-0.5 font-medium text-slate-500">{pct}%</td><td className="py-0.5 text-center">{vmaNum ? paceFromKmh(vmaNum*frac) : "-"}</td><td className="py-0.5 text-center">{ftpNum ? Math.round(ftpNum*frac) + "w" : "-"}</td></tr>); })}</tbody>
          </table>
        )}
      </div>
    );
  }

// NOUVEAU COMPOSANT : Calendrier Thématique
function CoachThematicCalendar({ athleteId }:{ athleteId: string; }) {
    const [monthOffset, setMonthOffset] = useState(0);
    const [thematics, setThematics] = useState<WeeklyThematicType[]>([]);
    const [races, setRaces] = useState<AbsenceType[]>([]);
    const [sessions, setSessions] = useState<SessionType[]>([]);
    
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState<{ week_start: string, thematic: string } | null>(null);
    const ref = useRef<HTMLInputElement>(null);

    const currentMonth = useMemo(() => dayjs().add(monthOffset, "month").startOf("month"), [monthOffset]);
    const calendarStart = useMemo(() => currentMonth.startOf("week"), [currentMonth]);
    const numWeeks = useMemo(() => {
        const end = currentMonth.endOf("month").endOf("week");
        return end.diff(calendarStart, 'week') + 1;
    }, [currentMonth, calendarStart]);
    const weeks = useMemo(() => Array.from({ length: numWeeks }, (_, i) => calendarStart.add(i, "week")), [numWeeks, calendarStart]);
    const weeksKeys = useMemo(() => weeks.map(w => w.startOf("isoWeek").format("YYYY-MM-DD")), [weeks]);

    // Charger les thématiques, courses et sessions pour la charge
    useEffect(() => {
        if (!athleteId) return;
        const monthStart = calendarStart.format("YYYY-MM-DD");
        const monthEnd = calendarStart.add(numWeeks, "week").add(6, "day").format("YYYY-MM-DD");
        
        setLoading(true);
        Promise.all([
            supabase.from("weekly_thematics").select("week_start, thematic").eq("user_id", athleteId).gte("week_start", monthStart).lte("week_start", monthEnd),
            supabase.from("absences_competitions").select("date, name, type").eq("user_id", athleteId).eq("type", "competition").gte("date", monthStart).lte("date", monthEnd),
            supabase.from("sessions").select("date, planned_hour, intensity").eq("user_id", athleteId).gte("date", monthStart).lte("date", monthEnd),
        ]).then(([thematicsRes, racesRes, sessionsRes]) => {
            // CORRECTION: Filtrage des entrées nulles pour éviter le TypeError
            setThematics((thematicsRes.data?.filter(t => t) || []) as WeeklyThematicType[]); 
            setRaces((racesRes.data || []) as AbsenceType[]);
            setSessions((sessionsRes.data || []) as SessionType[]);
            setLoading(false);
        }).catch(err => {
            console.error("Erreur chargement calendrier thématique:", err);
            setLoading(false);
        });
    }, [athleteId, calendarStart, numWeeks]);

    // Calculer la charge prévue par semaine (Load et Heures)
    const weeklyMetrics = useMemo(() => {
        const metrics: Record<string, { load: number, hours: number }> = {};
        for(const key of weeksKeys) metrics[key] = { load: 0, hours: 0 };

        sessions.forEach(s => {
            const weekStart = dayjs(s.date).startOf('isoWeek').format("YYYY-MM-DD");
            if (metrics[weekStart]) {
                metrics[weekStart].hours += s.planned_hour || 0;
                metrics[weekStart].load += getPlannedLoad(s);
            }
        });
        return metrics;
    }, [sessions, weeksKeys]);

    // Focus sur l'input d'édition
    useEffect(() => {
        if (editing && ref.current) ref.current.focus();
    }, [editing]);

    // Fonctions CRUD Thématique
    const getThematic = useCallback((week_start: string) => {
        return thematics.find(t => t.week_start === week_start)?.thematic || "";
    }, [thematics]);

    const getRace = useCallback((week_start: string) => {
        const weekEnd = dayjs(week_start).add(6, 'day').format('YYYY-MM-DD');
        return races.find(r => dayjs(r.date).isBetween(dayjs(week_start).subtract(1, 'day'), dayjs(weekEnd).add(1, 'day'), 'day')) || null;
    }, [races]);

    const handleSave = async (week_start: string, thematic: string) => {
        const trimmedThematic = thematic.trim();
        const currentThematic = getThematic(week_start);

        if (!trimmedThematic) {
            // Suppression
            if (currentThematic) {
                await supabase.from("weekly_thematics").delete().eq("user_id", athleteId).eq("week_start", week_start);
                setThematics(prev => prev.filter(t => t.week_start !== week_start));
            }
        } else {
            const payload: WeeklyThematicType = { user_id: athleteId, week_start, thematic: trimmedThematic };
            let data: WeeklyThematicType | null = null;
            if (currentThematic) {
                // Mise à jour
                const { data: d } = await supabase.from("weekly_thematics").update(payload).eq("user_id", athleteId).eq("week_start", week_start).select().single();
                data = d as WeeklyThematicType;
                setThematics(prev => prev.map(t => t.week_start === week_start ? data! : t));
            } else {
                // Insertion
                const { data: d } = await supabase.from("weekly_thematics").insert(payload).select().single();
                data = d as WeeklyThematicType;
                setThematics(prev => [...prev, data!]);
            }
        }
        setEditing(null);
    };

    const handleCellClick = (week_start: string) => {
        const currentThematic = getThematic(week_start);
        setEditing({ week_start, thematic: currentThematic });
    };

    const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (editing) setEditing({ ...editing, thematic: e.target.value });
    };

    const isCurrentWeek = (week_start: string) => dayjs(week_start).isSame(dayjs(), 'week');

    return (
        <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2"><ChartLineUp size={20} className="text-emerald-600"/> Planification Thématique</h3>
                <div className="flex items-center bg-slate-100 rounded-full p-1 gap-2 border border-slate-200">
                    <button onClick={() => setMonthOffset(m => m - 1)} className="p-1.5 rounded-full hover:bg-white hover:shadow-sm transition"><CaretLeft size={18}/></button>
                    <div className="text-sm font-bold text-slate-700 w-32 text-center">{currentMonth.format("MMMM YYYY").toUpperCase()}</div>
                    <button onClick={() => setMonthOffset(m => m + 1)} className="p-1.5 rounded-full hover:bg-white hover:shadow-sm transition"><CaretRight size={18}/></button>
                </div>
            </div>

            {loading ? (
                <div className="text-slate-400 text-sm italic py-4 text-center">Chargement...</div>
            ) : (
                <div className="grid grid-cols-7 gap-2">
                    {weeksKeys.map((week_start) => {
                        const thematic = getThematic(week_start);
                        const race = getRace(week_start);
                        const isEditing = editing?.week_start === week_start;
                        const isCurrent = isCurrentWeek(week_start);
                        const metrics = weeklyMetrics[week_start];
                        const displayRaceName = race?.name;
                        
                        let baseClasses = 'bg-slate-50 hover:bg-slate-100 border-slate-200';
                        let textClasses = 'text-slate-500';
                        if (isCurrent) { baseClasses = 'bg-blue-100 border-blue-400 shadow-md'; textClasses = 'text-blue-800'; }
                        else if (thematic) { baseClasses = 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200'; textClasses = 'text-emerald-800'; }
                        else if (displayRaceName) { baseClasses = 'bg-amber-50 hover:bg-amber-100 border-amber-200'; textClasses = 'text-amber-800'; }


                        return (
                            <div key={week_start} 
                                onClick={() => handleCellClick(week_start)}
                                className={`group relative flex flex-col justify-between h-20 p-2 rounded-lg cursor-pointer transition-all border ${baseClasses}`}>
                                
                                <div className={`text-xs font-bold ${textClasses}`}>
                                    S{dayjs(week_start).isoWeek()}
                                </div>

                                {isEditing ? (
                                    <form onSubmit={(e) => { e.preventDefault(); handleSave(week_start, editing.thematic); }}>
                                        <input
                                            ref={ref}
                                            value={editing.thematic}
                                            onChange={handleEditChange}
                                            onBlur={(e) => handleSave(week_start, e.target.value)}
                                            className="w-full text-xs p-1 bg-white rounded shadow-sm border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                            placeholder="Thématique..."
                                        />
                                    </form>
                                ) : (
                                    <div className={`text-[11px] font-medium leading-tight mt-0.5 truncate ${textClasses}`}>
                                        {thematic || displayRaceName || "—"}
                                    </div>
                                )}
                                
                                {/* AFFICHAGE DE L'INDICE DE CHARGE (IC) & HEURES */}
                                {metrics && metrics.hours > 0 && !isEditing && (
                                    <div className={`mt-0.5 flex justify-between text-[10px] font-semibold p-0.5 rounded-full ${isCurrent ? 'text-blue-900' : 'text-slate-600'} `}>
                                        <span className="font-bold">IC: {metrics.load.toFixed(0)}</span> {/* MODIFIÉ : Ld -> IC */}
                                        <span>H: {fmtTime(metrics.hours)}</span>
                                    </div>
                                )}

                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}


// ---------- MAIN PAGE ----------
export default function CoachAthleteFocusV13() {
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
  
  // Données hebdo
  const [weeklyReview, setWeeklyReview] = useState<WeeklyReviewType | null>(null);

  // UI State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const [editSession, setEditSession] = useState<SessionType | null>(null);
  const [lifeHistoryOpen, setLifeHistoryOpen] = useState(false);
  
  // RPE Help state
  const [showRpeHelp, setShowRpeHelp] = useState(false);

  const [prevWeekLoad, setPrevWeekLoad] = useState<number>(0);
  const [nextRaceText, setNextRaceText] = useState<string>("");

  // Boot & Alert Check
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
      
      // Check alertes
      const alertsMap: Record<string, boolean> = {};
      const sevenDaysAgo = dayjs().subtract(7, 'day').format("YYYY-MM-DD");
      
      await Promise.all(list.map(async (ath) => {
         const { data: badSess } = await supabase.from("sessions")
            .select("athlete_comment, rpe, intensity")
            .eq("user_id", ath.id_auth)
            .gte("date", sevenDaysAgo)
            .or("athlete_comment.ilike.%mal%,athlete_comment.ilike.%douleur%,athlete_comment.ilike.%blessure%,athlete_comment.ilike.%gêne%");
         
         if (badSess && badSess.length > 0) alertsMap[ath.id_auth] = true;
      }));
      
      const listWithAlerts = list.map(a => ({ ...a, alert: alertsMap[a.id_auth] || false }));
      setAthletes(listWithAlerts);
      
      if (!selectedAthleteId) setSelectedAthleteId(list[0]?.id_auth ?? null);
    })();
  }, [router]);

  // Load data
  useEffect(() => {
    if (!selectedAthleteId) return;
    (async () => {
      const start = weekStart.format("YYYY-MM-DD");
      const end = weekStart.add(6, "day").format("YYYY-MM-DD");
      const { data: sess } = await supabase.from("sessions").select("*").eq("user_id", selectedAthleteId).gte("date", start).lte("date", end);
      setSessions((sess || []) as SessionType[]);

      const { data: abs } = await supabase.from("absences_competitions").select("*").eq("user_id", selectedAthleteId).gte("date", start).lte("date", end);
      setAbsences((abs || []) as AbsenceType[]);

      const { data: review } = await supabase.from("weekly_reviews").select("rpe_life, comment").eq("user_id", selectedAthleteId).eq("week_start", start).single();
      setWeeklyReview(review as WeeklyReviewType);
    })();
  }, [selectedAthleteId, weekStart]);

  // Stats comparatives
  useEffect(() => {
    if (!selectedAthleteId) return;
    (async () => {
      const prevStart = weekStart.add(-7, "day").format("YYYY-MM-DD");
      const prevEnd = weekStart.add(-1, "day").format("YYYY-MM-DD");
      const { data: prevSessions } = await supabase.from("sessions").select("planned_hour,rpe,status").eq("user_id", selectedAthleteId).gte("date", prevStart).lte("date", prevEnd);
      const loadSessions = (prevSessions || []).filter((s) => s.status === "valide").reduce((acc, s) => acc + (Number(s.rpe) || 0) * (Number(s.planned_hour) || 0), 0);
      setPrevWeekLoad(loadSessions);

      const base = weekStart.startOf("day");
      const { data: nextComp } = await supabase.from("absences_competitions").select("date,name,type").eq("user_id", selectedAthleteId).eq("type", "competition").gte("date", base.format("YYYY-MM-DD")).order("date", { ascending: true }).limit(1);
      if (nextComp && nextComp.length) {
        const d = dayjs(nextComp[0].date).startOf("day");
        if (d.isSame(base, "week")) setNextRaceText("cette semaine");
        else {
           const diff = d.diff(base, "day");
           const w = Math.floor(diff/7) + (diff%7>0?1:0);
           setNextRaceText(`dans ${w} sem.`);
        }
      } else setNextRaceText("-");
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
    const validatedSessions = sessions.filter(s => s.status === "valide");
    const loadRealized = validatedSessions.reduce((acc, s) => acc + (Number(s.rpe) || 0) * (Number(s.planned_hour) || 0), 0);
    const timeRealized = validatedSessions.reduce((acc, s) => acc + (Number(s.planned_hour) || 0), 0);
    const totalPlannedHours = sessions.reduce((acc, s) => acc + (Number(s.planned_hour)||0), 0);
    const totalPlannedLoad = sessions.reduce((acc, s) => acc + getPlannedLoad(s), 0);

    return { count: sessions.length, valCount: validatedSessions.length, loadRealized, loadPlanned: totalPlannedLoad, timeRealized, timePlanned: totalPlannedHours };
  }, [sessions]);

  const athlete = athletes.find(a => a.id_auth === selectedAthleteId) || null;
  async function logout() { await supabase.auth.signOut(); router.push("/login"); }

  return (
    <main className={`${jakarta.className} min-h-screen bg-slate-100 text-slate-800 flex flex-col`}>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="bg-emerald-600 text-white px-2 py-1 rounded font-bold text-sm tracking-tight">COACH</div>
             <div className="text-sm font-medium text-slate-600 hidden md:block">Bonjour {coach?.name?.split(" ")[0]}</div>
          </div>
          
          <div className="flex items-center bg-slate-100 rounded-full p-1 gap-2 border border-slate-200">
            <button onClick={() => setWeekOffset(w => w - 1)} className="p-1.5 rounded-full hover:bg-white hover:shadow-sm transition"><CaretLeft size={18}/></button>
            <div className="text-sm font-bold text-slate-700 w-32 text-center">S{weekStart.isoWeek()} • {weekStart.format("DD MMM")}</div>
            <button onClick={() => setWeekOffset(w => w + 1)} className="p-1.5 rounded-full hover:bg-white hover:shadow-sm transition"><CaretRight size={18}/></button>
          </div>

          <div className="flex items-center gap-2 relative">
             {/* STATS GLOBALES */}
             <a href="/coach/stats" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-slate-50" title="Statistiques Globales">
                <ChartLineUp size={20} weight="bold"/>
             </a>

             {/* AIDE RPE AVEC POPOVER */}
             <div className="relative">
                <button onClick={()=>setShowRpeHelp(!showRpeHelp)} className={`p-2 rounded-lg transition ${showRpeHelp ? "bg-emerald-100 text-emerald-700" : "text-slate-400 hover:text-emerald-600 hover:bg-slate-50"}`} title="Aide RPE">
                    <Question size={20} weight="bold"/>
                </button>
                <RpeGuidePopover open={showRpeHelp} onClose={()=>setShowRpeHelp(false)} />
             </div>
             
             <button onClick={logout} className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg"><SignOut size={18}/></button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-[1600px] w-full mx-auto p-4 grid grid-cols-12 gap-6">
        <aside className="col-span-12 md:col-span-3 lg:col-span-2 flex flex-col gap-4">
          <div>
              <div className="text-[11px] font-bold uppercase text-slate-400 mb-2 tracking-wider px-1">Mes Athlètes</div>
              <div className="space-y-1">
                {athletes.map((a, i) => {
                    const active = a.id_auth === selectedAthleteId;
                    const [fName, ...lName] = a.name.split(" ");
                    return (
                        <div key={a.id_auth} className={`w-full p-2.5 rounded-xl border transition-all flex items-center gap-2 group ${active ? "border-emerald-500 bg-emerald-50 shadow-sm ring-1 ring-emerald-200" : "border-transparent bg-white hover:shadow-sm"}`}>
                            <button onClick={() => setSelectedAthleteId(a.id_auth)} className="flex-1 text-left">
                                <div className={`text-sm font-bold ${active?"text-emerald-900":"text-slate-700"}`}>{fName} <span className="font-normal text-xs">{lName.join(" ")}</span></div>
                                {active && <div className="text-[10px] text-emerald-600 font-medium">Sélectionné</div>}
                            </button>
                             {a.alert && (<div title="Attention" className="bg-rose-500 text-white p-1.5 rounded-full shadow-sm shadow-rose-200 animate-pulse"><WarningCircle weight="bold" size={14} /></div>)}
                            <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => moveAthlete(i, -1)} disabled={i === 0} className="text-[10px] px-1 hover:bg-slate-200 rounded">▲</button>
                                <button onClick={() => moveAthlete(i, 1)} disabled={i === athletes.length - 1} className="text-[10px] px-1 hover:bg-slate-200 rounded">▼</button>
                            </div>
                        </div>
                    );
                })}
              </div>
          </div>
          {selectedAthleteId && <AthleteMetricsCoach athleteId={selectedAthleteId} />}
        </aside>

        <section className="col-span-12 md:col-span-9 lg:col-span-10 space-y-6">
          {athlete && (
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                        <h2 className="text-xl font-bold text-slate-800">{athlete.name}</h2>
                        {stats.valCount === stats.count && stats.count > 0 && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full uppercase tracking-wide">Semaine Complète</span>}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex gap-3">
                        <span>Prochaine course: <strong className="text-slate-700">{nextRaceText}</strong></span>
                        <span>Charge S-1: <strong className="text-slate-700">{prevWeekLoad.toFixed(0)}</strong></span>
                    </div>
                </div>

                {/* BLOC CHARGE VIE PERSO */}
                <div className="flex items-center gap-4 px-4 border-l border-r border-slate-100">
                    <div className="flex flex-col items-center min-w-[100px]">
                        <div className="flex items-center gap-2 mb-1">
                             <span className="text-[10px] uppercase font-bold text-slate-400">Charge Vie Perso</span>
                             {/* Bouton Historique */}
                             <button onClick={()=>setLifeHistoryOpen(true)} className="text-slate-400 hover:text-emerald-600" title="Historique"><Notebook size={14}/></button>
                        </div>
                        {weeklyReview ? (
                            <div className="relative group cursor-help">
                                <div className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 
                                    ${weeklyReview.rpe_life <= 3 ? "bg-emerald-100 text-emerald-700 border-emerald-200" : 
                                      weeklyReview.rpe_life <= 6 ? "bg-amber-100 text-amber-700 border-amber-200" : 
                                      "bg-rose-100 text-rose-700 border-rose-200 animate-pulse"}`}>
                                    {weeklyReview.rpe_life <= 3 ? <Smiley size={16}/> : weeklyReview.rpe_life <= 6 ? <SmileyMeh size={16}/> : <SmileySad size={16}/>}
                                    <span>{weeklyReview.rpe_life}/10</span>
                                </div>
                                {weeklyReview.comment && (
                                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-64 p-3 bg-slate-800 text-white text-xs rounded-xl shadow-xl z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-center leading-relaxed">"{weeklyReview.comment}"</div>
                                )}
                            </div>
                        ) : (<div className="text-xs text-slate-300 italic">Non renseigné</div>)}
                    </div>
                </div>

                <div className="flex gap-8 pr-4">
                    <div className="flex flex-col w-32">
                        <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400 mb-1">
                            <span>Charge</span>
                            <span className={stats.loadRealized > stats.loadPlanned ? "text-emerald-600" : "text-slate-600"}>{stats.loadRealized.toFixed(0)} <span className="text-slate-300">/ {stats.loadPlanned.toFixed(0)}</span></span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden relative">
                            <div className="absolute top-0 left-0 h-full bg-slate-200 w-full" /> 
                            <motion.div className="absolute top-0 left-0 h-full bg-emerald-500 rounded-full" initial={{width:0}} animate={{width: `${Math.min((stats.loadRealized/Math.max(stats.loadPlanned,1))*100, 100)}%`}} />
                        </div>
                    </div>
                    <div className="flex flex-col w-32">
                         <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400 mb-1">
                            <span>Volume</span>
                            <span>{fmtTime(stats.timeRealized)} <span className="text-slate-300">/ {fmtTime(stats.timePlanned)}</span></span>
                        </div>
                         <div className="h-2 bg-slate-100 rounded-full overflow-hidden relative">
                            <motion.div className="absolute top-0 left-0 h-full bg-blue-500 rounded-full" initial={{width:0}} animate={{width: `${Math.min((stats.timeRealized/Math.max(stats.timePlanned,0.1))*100, 100)}%`}} />
                        </div>
                    </div>
                </div>
            </div>
          )}
          
          {/* NOUVEAU : CALENDRIER THÉMATIQUE */}
          {selectedAthleteId && <CoachThematicCalendar athleteId={selectedAthleteId} />}


          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {weekDays.map((d) => {
              const iso = d.format("YYYY-MM-DD");
              const isToday = iso === dayjs().format("YYYY-MM-DD");
              const daySessions = sessions.filter((s) => s.date === iso);
              const dayAbs = absences.filter((a) => a.date === iso);
              return (
                <div key={iso} className={`flex flex-col gap-2 min-h-[200px] p-2 rounded-xl border transition-colors ${isToday ? "bg-blue-50 border-blue-300" : "bg-slate-50 border-slate-200"}`}>
                  <div className="flex items-center justify-between px-1">
                    <div className={`text-xs font-bold uppercase ${isToday ? "text-blue-700" : "text-slate-400"}`}>{d.format("ddd DD")}</div>
                    <button onClick={() => { setModalDate(iso); setEditSession(null); setModalOpen(true); }} className="text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded p-1 transition"><Plus size={16}/></button>
                  </div>
                  <div className="space-y-2 flex-1">
                    <AnimatePresence initial={false}>
                      {dayAbs.map((a) => (
                        <AbsenceCard key={a.id} a={a} onDelete={async () => { if (!confirm("Supprimer ?")) return; await supabase.from("absences_competitions").delete().eq("id", a.id); setAbsences((prev) => prev.filter((x) => x.id !== a.id)); }} />
                      ))}
                      {daySessions.map((s) => (
                        <SessionCard key={s.id} s={s} onEdit={() => { setModalDate(s.date); setEditSession(s); setModalOpen(true); }} onDelete={() => deleteSession(s.id)} />
                      ))}
                    </AnimatePresence>
                    {daySessions.length === 0 && dayAbs.length === 0 && (<div className="h-full border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center opacity-30"><span className="text-[10px] text-slate-400 font-medium">Repos</span></div>)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Drawer Historique */}
      {selectedAthleteId && <LifeHistoryPanel open={lifeHistoryOpen} onClose={()=>setLifeHistoryOpen(false)} athleteId={selectedAthleteId} />}

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