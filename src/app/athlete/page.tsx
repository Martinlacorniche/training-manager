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
  CaretLeft, CaretRight, SignOut,
  ChartLineUp as LoadIcon, Bicycle, SwimmingPool, Mountains, PersonSimpleRun, Clock, ChartLineUp,
  Smiley, SmileySad, SmileyMeh, Notebook, WarningCircle, Fire, Question, X
} from "@phosphor-icons/react";

// DnD
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { AnimatePresence, motion } from "framer-motion";

// ---------- HELPERS & STYLES (COHÉRENCE COACH) ----------

const EST_RPE: Record<string, number> = { basse: 3, moyenne: 6, haute: 9 };

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

function fmtTime(h?: number | null) {
  if (h === undefined || h === null) return "";
  const H = Math.floor(h || 0);
  const M = Math.round(((h || 0) % 1) * 60);
  return `${H}h${String(M).padStart(2,"0")}`;
}

// ---------- TYPES ----------
type UserType = { id_auth: string; name: string; coach_code?: string; coach_id?: string; ordre: number | null; };
type SessionType = { id: string; user_id: string; sport?: string; title?: string; planned_hour?: number; planned_inter?: string; intensity?: string; status?: string; rpe?: number | null; athlete_comment?: string | null; date: string; };
type AbsenceType = {
  id: string; user_id: string; date: string; type: string; name?: string | null;
  distance_km?: number | null; elevation_d_plus?: number | null; comment?: string | null;
  rpe?: number | null; duration_hour?: number | null; status?: string | null;
};
type WeeklyReviewType = { week_start: string; rpe_life: number; comment: string; };

// ---------- COMPONENTS ----------

// 1. RPE GUIDE (Popover) - CORRIGÉ
function RpeGuidePopover({ open, onClose }:{ open:boolean; onClose:()=>void }) {
    // Tableau de référence
    const rows = [
        { score: 10, label: "Maximal", desc: "Sprint final, nausée", bg: "bg-purple-100", text: "text-purple-900" },
        { score: 9, label: "Agonie", desc: "Tenable qqs secondes", bg: "bg-red-100", text: "text-red-900" },
        { score: 8, label: "Extrême", desc: "Impossible de parler", bg: "bg-red-50", text: "text-red-800" },
        { score: 7, label: "Très dur", desc: "Un mot à la fois", bg: "bg-orange-100", text: "text-orange-900" },
        { score: 6, label: "Dur", desc: "Quelques mots", bg: "bg-orange-50", text: "text-orange-800" },
        { score: 5, label: "Un peu dur", desc: "Conversation hachée", bg: "bg-amber-100", text: "text-amber-900" },
        { score: 4, label: "Moyen", desc: "On raconte l'essentiel", bg: "bg-amber-50", text: "text-amber-800" },
        { score: 3, label: "Facile (Z2)", desc: "Conversation facile", bg: "bg-emerald-100", text: "text-emerald-900" },
        { score: 2, label: "Très facile", desc: "Respiration nasale", bg: "bg-emerald-50", text: "text-emerald-800" },
        { score: 1, label: "Récup", desc: "Marche / Effort nul", bg: "bg-slate-100", text: "text-slate-700" },
    ];

    if(!open) return null;

    return (
        // CHANGEMENT ICI : top-full (en bas) et right-0 (aligné à droite pour s'étendre vers la gauche)
        <div className="absolute top-full right-0 mt-2 z-50 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 text-xs font-bold text-slate-500 flex justify-between items-center">
                <span>Échelle RPE</span>
                <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded"><X size={14}/></button>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
                {rows.map(r => (
                    <div key={r.score} className="flex items-center text-xs border-b last:border-0 border-slate-50">
                        <div className={`w-8 py-2 text-center font-bold ${r.bg} ${r.text}`}>{r.score}</div>
                        <div className="flex-1 px-3 py-1.5">
                            <div className={`font-bold ${r.text}`}>{r.label}</div>
                            <div className="text-[10px] text-slate-500">{r.desc}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// 2. MODALE "BILAN HEBDO" (Charge Vie Perso)
function WeeklyReviewModal({ open, onClose, weekStart, userId, initial, onSaved }: { open: boolean; onClose: ()=>void; weekStart: string; userId: string; initial: WeeklyReviewType | null; onSaved: (r: WeeklyReviewType)=>void; }) {
    const [rpe, setRpe] = useState<number>(initial?.rpe_life || 5);
    const [comment, setComment] = useState<string>(initial?.comment || "");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if(open) {
            setRpe(initial?.rpe_life || 5);
            setComment(initial?.comment || "");
        }
    }, [open, initial]);

    if(!open) return null;

    async function save() {
        setLoading(true);
        const payload = { user_id: userId, week_start: weekStart, rpe_life: rpe, comment: comment };
        const { error } = await supabase.from("weekly_reviews").upsert(payload, { onConflict: "user_id, week_start" });
        setLoading(false);
        if(error) alert(error.message);
        else {
            onSaved(payload as WeeklyReviewType);
            onClose();
        }
    }

    return (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 space-y-4">
                <div className="text-center">
                    <h3 className="text-lg font-bold text-slate-800">Bilan Hebdomadaire</h3>
                    <p className="text-xs text-slate-500">Comment s'est passée ta semaine (hors sport) ?</p>
                </div>

                {/* Selecteur Smiley/Note */}
                <div className="flex justify-between px-2">
                    {[1,3,5,7,9].map(n => {
                        const selected = rpe === n || rpe === n+1; // Simplification visuelle
                        return (
                            <button key={n} onClick={()=>setRpe(n)} className={`flex flex-col items-center gap-1 transition ${rpe === n ? "scale-110 opacity-100" : "opacity-40"}`}>
                                {n <= 2 ? <Smiley size={32} className="text-emerald-500" weight="fill"/> : 
                                 n <= 6 ? <SmileyMeh size={32} className="text-amber-500" weight="fill"/> : 
                                 <SmileySad size={32} className="text-rose-500" weight="fill"/>}
                                <span className="text-xs font-bold text-slate-600">{n}</span>
                            </button>
                        )
                    })}
                </div>
                <div className="text-center text-sm font-bold text-slate-700 border-b border-slate-100 pb-2">
                    Note : {rpe}/10
                </div>

                <label className="block text-sm text-slate-700">
                    Commentaire (Boulot, Stress, Sommeil...)
                    <textarea value={comment} onChange={e=>setComment(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 min-h-[80px] focus:ring-2 focus:ring-emerald-200 outline-none"/>
                </label>

                <div className="flex gap-2 pt-2">
                    <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-slate-100 text-slate-700 font-medium">Annuler</button>
                    <button onClick={save} disabled={loading} className="flex-1 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700">{loading?"...":"Enregistrer"}</button>
                </div>
            </div>
        </div>
    );
}

// 3. MODALE VALIDATION (Avec Aide RPE)
function ValidateModal({ open, onClose, onSaved, initial }:{ open: boolean; onClose: ()=>void; onSaved: (s: SessionType)=>void; initial: SessionType | null; }) {
  const [status, setStatus] = useState<string>(initial?.status || "");
  const [rpe, setRpe] = useState<number | null>(initial?.rpe ?? null);
  const [comment, setComment] = useState<string>(initial?.athlete_comment || "");
  const [hours, setHours] = useState<number>(Math.floor(initial?.planned_hour || 0));
  const [minutes, setMinutes] = useState<number>(Math.round(((initial?.planned_hour || 0) % 1) * 60));
  const [loading, setLoading] = useState(false);
  const [showRpeHelp, setShowRpeHelp] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStatus(initial?.status || "");
    setRpe(initial?.rpe ?? null);
    setComment(initial?.athlete_comment || "");
    const ph = initial?.planned_hour || 0;
    setHours(Math.floor(ph));
    setMinutes(Math.round((ph % 1) * 60));
    setShowRpeHelp(false);
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
    <>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <form onSubmit={submit} className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="w-2 h-6 bg-emerald-500 rounded-full"/> Valider la séance
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <label className="text-sm font-bold text-slate-700">Statut
                <select value={status} onChange={(e)=>setStatus(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 bg-slate-50 focus:bg-white transition">
                  <option value="">A faire</option>
                  <option value="valide">✅ Faite</option>
                  <option value="non_valide">❌ Non faite</option>
                </select>
              </label>
              
              <div className="relative">
                  <label className="text-sm font-bold text-slate-700 flex justify-between items-center">
                      RPE
                      <button type="button" onClick={()=>setShowRpeHelp(!showRpeHelp)} className="text-emerald-600 hover:bg-emerald-50 p-0.5 rounded"><Question size={16} weight="bold"/></button>
                  </label>
                  <input type="number" min={1} max={10} value={rpe ?? ""} onChange={(e)=>setRpe(e.target.value ? Number(e.target.value) : null)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 bg-slate-50 focus:bg-white transition" placeholder="1–10"/>
                  
                  {/* POPUP AIDE RPE DANS LA MODALE */}
                  <RpeGuidePopover open={showRpeHelp} onClose={()=>setShowRpeHelp(false)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="text-sm font-bold text-slate-700">Heures
                <select value={hours} onChange={(e)=>setHours(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 bg-slate-50 focus:bg-white">
                  {Array.from({length:15}, (_,i)=> <option key={i} value={i}>{i} h</option>)}
                </select>
              </label>
              <label className="text-sm font-bold text-slate-700">Minutes
                <select value={minutes} onChange={(e)=>setMinutes(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 p-2 bg-slate-50 focus:bg-white">
                  {Array.from({length:12}, (_,i)=> <option key={i} value={i*5}>{String(i*5).padStart(2,"0")} min</option>)}
                </select>
              </label>
            </div>

            <label className="block text-sm font-bold text-slate-700">Mon commentaire
              <textarea value={comment} onChange={(e)=>setComment(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 min-h-[90px] bg-slate-50 focus:bg-white transition" placeholder="Sensations, douleurs..."/>
            </label>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 font-medium hover:bg-slate-50">Annuler</button>
              <button disabled={loading} className="px-6 py-2 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 font-bold shadow-md shadow-emerald-200">
                {loading ? "..." : "Valider"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

// ---------- Modal Absence (inchangée fonctionnellement, juste style)
function AbsenceModal({ open, onClose, onSaved, initial, athleteId, date }:{ open: boolean; onClose: ()=>void; onSaved: (a: AbsenceType, isEdit: boolean)=>void; initial?: AbsenceType | null; athleteId: string; date: string; }) {
  // ... (Logique identique, je simplifie le rendu pour la lisibilité, reprends ton code de base si besoin de détails spécifiques, mais ici je mets le style "Coach")
  const isEdit = !!initial;
  const [type, setType] = useState<string>(initial?.type || "off");
  const [name, setName] = useState<string>(initial?.name || "");
  const [distance, setDistance] = useState<string>(initial?.distance_km?.toString() || "");
  const [elev, setElev] = useState<string>(initial?.elevation_d_plus?.toString() || "");
  const [comment, setComment] = useState<string>(initial?.comment || "");
  const [rpe, setRpe] = useState<string>(initial?.rpe != null ? String(initial.rpe) : "");
  const [durHour, setDurHour] = useState<number>(() => initial?.duration_hour ? Math.floor(initial.duration_hour) : 0);
  const [durMin, setDurMin] = useState<number>(() => initial?.duration_hour ? Math.round((initial.duration_hour % 1) * 60) : 0);
  const [status, setStatus] = useState<string>(initial?.status || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setType(initial.type || "off"); setName(initial.name || ""); setDistance(initial.distance_km?.toString() || ""); setElev(initial.elevation_d_plus?.toString() || ""); setComment(initial.comment || ""); setRpe(initial.rpe != null ? String(initial.rpe) : "");
      if (initial.duration_hour != null) { const h = Math.floor(initial.duration_hour); const m = Math.round((initial.duration_hour - h) * 60); setDurHour(h); setDurMin(m); } else { setDurHour(0); setDurMin(0); }
      setStatus(initial.status || "");
    } else {
      setType("off"); setName(""); setDistance(""); setElev(""); setComment(""); setRpe(""); setDurHour(0); setDurMin(0); setStatus("");
    }
  }, [open, initial]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const duration_hour = type === "competition" ? durHour + durMin / 60 : null;
    const rpeNum = type === "competition" && rpe ? Number(rpe) : null;
    const payload: any = { user_id: athleteId, date, type, name: name || null, distance_km: distance ? Number(distance) : null, elevation_d_plus: elev ? Number(elev) : null, comment: comment || null, rpe: rpeNum, duration_hour, status: type === "competition" ? (status || null) : null };

    try {
      let data: any, error: any;
      if (isEdit) ({ data, error } = await supabase.from("absences_competitions").update(payload).eq("id", initial!.id).select().single());
      else ({ data, error } = await supabase.from("absences_competitions").insert(payload).select().single());
      if (error) throw error;
      if (data) onSaved(data as AbsenceType, isEdit);
    } catch (err: any) { alert("Erreur: " + (err?.message || "inconnue")); } finally { setLoading(false); }
  }

  async function del() {
    if (!isEdit || !confirm("Supprimer ?")) return;
    await supabase.from("absences_competitions").delete().eq("id", initial!.id);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={submit} className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-4">
        <h3 className="text-lg font-bold text-slate-800">{isEdit ? "Modifier" : "Ajouter"} {type==="competition"?"Compétition":"Off"}</h3>
        <label className="block text-sm font-bold text-slate-700">Type <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 bg-slate-50"><option value="off">Off / Repos</option><option value="competition">Compétition</option></select></label>
        {type === "competition" && (
          <>
            <label className="block text-sm font-bold text-slate-700">Nom <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 bg-slate-50" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm text-slate-600">Dist (km) <input value={distance} onChange={(e) => setDistance(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2" /></label>
              <label className="text-sm text-slate-600">D+ (m) <input value={elev} onChange={(e) => setElev(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2" /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <label className="text-sm text-slate-600">Heures <select value={durHour} onChange={(e) => setDurHour(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 p-2">{Array.from({ length: 15 }, (_, i) => <option key={i} value={i}>{i} h</option>)}</select></label>
                <label className="text-sm text-slate-600">Minutes <select value={durMin} onChange={(e) => setDurMin(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 p-2">{Array.from({ length: 12 }, (_, i) => <option key={i} value={i * 5}>{String(i * 5).padStart(2, "0")} min</option>)}</select></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <label className="text-sm text-slate-600">RPE <input type="number" value={rpe} onChange={(e) => setRpe(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2" /></label>
                <label className="text-sm text-slate-600">Résultat <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2"><option value="">-</option><option value="finisher">Finisher</option><option value="dnf">DNF</option></select></label>
            </div>
          </>
        )}
        <label className="block text-sm font-bold text-slate-700">Commentaire <textarea value={comment} onChange={(e) => setComment(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 bg-slate-50 min-h-[80px]" /></label>
        <div className="flex justify-between pt-2">
          {isEdit ? <button type="button" onClick={del} className="px-3 py-2 rounded-lg text-rose-600 border border-rose-100 hover:bg-rose-50"><Trash size={18}/></button> : <span/>}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700">Annuler</button>
            <button disabled={loading} className="px-4 py-2 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 font-bold">{loading?"...":isEdit?"Sauver":"Créer"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ---------- Cards (Nouveau Design "Coach-Like")
const SessionCard = React.memo(function SessionCard({ s, onEdit, onDelete }:{ s: SessionType; onEdit: ()=>void; onDelete: ()=>void; }) {
  const [showComment, setShowComment] = useState(false);
  const style = getSportStyle(s.sport);

  // Logique Bordure/Alerte (Miroir du coach)
  let borderClass = "border border-transparent";
  // Alerte Douleur ?
  const hasPain = s.athlete_comment && /(mal|douleur|blessure|gêne|bob)/i.test(s.athlete_comment);
  const hasBadRpe = s.status === "valide" && s.intensity === "basse" && (s.rpe || 0) > 8;
  
  if (hasPain || hasBadRpe) borderClass = "border-2 border-rose-500 shadow-red-100";
  else if (s.status === "valide") borderClass = "border border-emerald-400 ring-1 ring-emerald-400 shadow-sm";

  return (
    <div className={`relative rounded-xl p-3 mb-2 overflow-hidden transition-all shadow-sm ${style.bg} ${borderClass}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <div className="flex items-center gap-1.5">
           <span className={`${style.icon}`}>{sportIcon(s.sport, 16)}</span>
           <span className={`text-[11px] font-bold uppercase tracking-wider ${style.text}`}>{s.sport}</span>
        </div>
        <div className="flex gap-1">
             {/* Indicateur Alerte visuel pour l'athlète aussi */}
             {(hasPain || hasBadRpe) && <div className="text-rose-600 animate-pulse"><WarningCircle size={16} weight="fill"/></div>}
             <button onClick={onEdit} className={`${style.text} opacity-60 hover:opacity-100 p-0.5 hover:bg-white/50 rounded`} title="Valider/Modifier"><PencilSimple size={15}/></button>
             <button onClick={onDelete} className={`${style.text} opacity-60 hover:text-rose-600 p-0.5 hover:bg-white/50 rounded`} title="Supprimer"><Trash size={15}/></button>
        </div>
      </div>

      {/* Barre Intensité */}
      <div className={`h-1 w-10 rounded-full mb-2 ${intensityBar(s.intensity)}`} />

      {/* Titre */}
      {s.title && <div className={`text-sm font-bold leading-tight mb-1 ${style.text}`}>{s.title}</div>}
      
      {/* Metrics */}
      <div className={`flex items-center justify-between text-xs font-medium ${style.text} opacity-90`}>
        <div className="flex items-center gap-1"><Clock size={12}/> {fmtTime(s.planned_hour)}</div>
        {s.status === "valide" && s.rpe ? (
            <div className="flex items-center gap-1 font-bold">
               {hasBadRpe && <Fire size={12} className="text-rose-500"/>}
               <span>RPE {s.rpe}</span>
            </div>
        ) : (
            <div className="opacity-60 italic text-[10px]">Prévu ~{EST_RPE[s.intensity || "moyenne"] || 6}</div>
        )}
      </div>

      {/* Consigne Coach */}
      {s.planned_inter && (
        <div className={`mt-2 pt-2 border-t border-black/5 text-[11px] whitespace-pre-line ${style.text} opacity-90`}>
           {s.planned_inter}
        </div>
      )}

      {/* Commentaire Athlète */}
      {(s.athlete_comment || s.rpe) && (
        <div className={`mt-2 p-2 bg-white/80 rounded-lg text-[11px] italic text-slate-700 border border-white/50 ${hasPain ? "border-rose-300 bg-rose-50 text-rose-800 font-medium" : ""}`}>
          {s.athlete_comment ? `“${s.athlete_comment}”` : ""}{!s.athlete_comment && s.rpe ? `RPE ${s.rpe}/10` : ""}
        </div>
      )}
    </div>
  );
});

const AbsenceCard = React.memo(function AbsenceCard({ a, onEdit }:{ a: AbsenceType; onEdit: () => void; }) {
  const isComp = a.type === "competition";
  let cls = "bg-slate-50 border-slate-200 text-slate-500";
  if (isComp) {
    if (a.status === "finisher") cls = "bg-emerald-50 border-emerald-200 text-emerald-800";
    else if (a.status === "dnf") cls = "bg-rose-50 border-rose-200 text-rose-800";
    else cls = "bg-amber-50 border-amber-200 text-amber-800";
  }
  const title = isComp ? "Compétition" : "Repos / Off";

  return (
    <div className={`rounded-xl border shadow-sm p-3 mb-2 overflow-hidden ${cls}`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide">{title}</span>
        <button onClick={onEdit} className="opacity-50 hover:opacity-100"><PencilSimple size={14}/></button>
      </div>
      {isComp && (
        <div className="text-xs space-y-1">
          {a.name && <div className="font-bold text-sm">{a.name}</div>}
          <div className="opacity-80">
              {a.distance_km ? `${a.distance_km}km` : ""}{a.distance_km && a.elevation_d_plus ? " • " : ""}{a.elevation_d_plus ? `${a.elevation_d_plus}d+` : ""}
          </div>
          {(a.duration_hour || a.rpe) && <div className="opacity-80"> {fmtTime(a.duration_hour)} {a.rpe ? `• RPE ${a.rpe}` : ""} </div>}
        </div>
      )}
      {!isComp && a.comment && <div className="text-xs italic mt-1 opacity-80">"{a.comment}"</div>}
    </div>
  );
});

// ---------- Athlete Metrics (VMA / FTP) (inchangé, style clean)
function paceFromKmh(kmh: number) {
  if (!kmh || kmh <= 0) return "—";
  const minPerKm = 60 / kmh;
  const totalSec = Math.round(minPerKm * 60);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2,"0")}/km`;
}
const PCTS = [60,70,80,85,90,95,100,110,120,130];

function AthleteMetrics({ athleteId }: { athleteId: string }) {
  const [vma, setVma] = React.useState<string>("");
  const [ftp, setFtp] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("athlete_metrics").select("vma_kmh, ftp_w").eq("user_id", athleteId).single();
      if (data) { setVma(data.vma_kmh ? String(data.vma_kmh) : ""); setFtp(data.ftp_w ? String(data.ftp_w) : ""); }
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
    <div className="mt-4 rounded-2xl border border-emerald-100 bg-white p-4 text-sm text-slate-700 space-y-3 shadow-sm">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] uppercase font-bold text-slate-500">VMA (km/h)<input type="number" step="0.1" value={vma} onChange={e=>setVma(e.target.value)} className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm"/></label>
        <label className="text-[10px] uppercase font-bold text-slate-500">FTP (w)<input type="number" value={ftp} onChange={e=>setFtp(e.target.value)} className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm"/></label>
      </div>
      <button onClick={save} disabled={loading} className="w-full py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wide">{loading ? "..." : "Sauvegarder"}</button>
      {(vmaNum || ftpNum) && (
        <table className="w-full text-xs border-collapse mt-2">
          <thead><tr><th className="border-b text-left py-1 text-slate-400">%</th><th className="border-b text-center text-slate-400">Allure</th><th className="border-b text-center text-slate-400">Watt</th></tr></thead>
          <tbody>{PCTS.map(pct => { const frac = pct/100; return (<tr key={pct}><td className="py-0.5 font-bold text-slate-600">{pct}%</td><td className="py-0.5 text-center text-slate-500">{vmaNum ? paceFromKmh(vmaNum*frac) : "-"}</td><td className="py-0.5 text-center text-slate-500">{ftpNum ? Math.round(ftpNum*frac) + "w" : "-"}</td></tr>); })}</tbody>
        </table>
      )}
    </div>
  );
}

// ---------- Main page
export default function AthletePage() {
  const router = useRouter();
  const [athlete, setAthlete] = useState<UserType | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = useMemo(() => dayjs().startOf("week").add(weekOffset, "week"), [weekOffset]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => weekStart.add(i, "day")), [weekStart]);

  const [sessions, setSessions] = useState<SessionType[]>([]);
  const [absences, setAbsences] = useState<AbsenceType[]>([]);
  const [weeklyReview, setWeeklyReview] = useState<WeeklyReviewType | null>(null);

  const [validateOpen, setValidateOpen] = useState(false);
  const [currentSession, setCurrentSession] = useState<SessionType | null>(null);
  const [absenceOpen, setAbsenceOpen] = useState(false);
  const [absenceDate, setAbsenceDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
  const [editAbsence, setEditAbsence] = useState<AbsenceType | null>(null);
  
  // Etat pour la modale bilan
  const [reviewOpen, setReviewOpen] = useState(false);

  const [prevWeekLoad, setPrevWeekLoad] = useState<number>(0);
  const [nextRaceText, setNextRaceText] = useState<string>("");

  // RPE Help state global (header)
  const [showRpeHelp, setShowRpeHelp] = useState(false);

  // Boot
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) { router.push("/login"); return; }
      const { data: user } = await supabase.from("users").select("*").eq("id_auth", session.user.id).single();
      setAthlete(user as UserType);
    })();
  }, [router]);

  // Load Data
  useEffect(() => {
    (async () => {
      if (!athlete?.id_auth) return;
      const start = weekStart.format("YYYY-MM-DD");
      const end = weekStart.add(6, "day").format("YYYY-MM-DD");
      
      const { data: sess } = await supabase.from("sessions").select("*").eq("user_id", athlete.id_auth).gte("date", start).lte("date", end);
      setSessions((sess || []) as SessionType[]);

      const { data: abs } = await supabase.from("absences_competitions").select("*").eq("user_id", athlete.id_auth).gte("date", start).lte("date", end);
      setAbsences((abs || []) as AbsenceType[]);

      // Load Weekly Review
      const { data: review } = await supabase.from("weekly_reviews").select("rpe_life, comment").eq("user_id", athlete.id_auth).eq("week_start", start).single();
      setWeeklyReview(review as WeeklyReviewType);

    })();
  }, [athlete?.id_auth, weekStart]);

  // Prev load + race
  useEffect(() => {
    (async () => {
      if (!athlete?.id_auth) return;
      const prevStart = weekStart.add(-7, "day").format("YYYY-MM-DD");
      const prevEnd = weekStart.add(-1, "day").format("YYYY-MM-DD");
      const { data: prevSessions } = await supabase.from("sessions").select("planned_hour,rpe,status").eq("user_id", athlete.id_auth).gte("date", prevStart).lte("date", prevEnd);
      const loadSessions = (prevSessions || []).filter((s) => s.status === "valide").reduce((acc, s) => acc + (Number(s.rpe) || 0) * (Number(s.planned_hour) || 0), 0);
      setPrevWeekLoad(loadSessions); // Pas de compet dans le calcul simplifie ici, on peut rajouter si besoin

      const base = weekStart.startOf("day");
      const { data: nextComp } = await supabase.from("absences_competitions").select("date,type").eq("user_id", athlete.id_auth).eq("type", "competition").gte("date", base.format("YYYY-MM-DD")).order("date", { ascending: true }).limit(1);
      if (nextComp && nextComp.length) {
        const d = dayjs(nextComp[0].date).startOf("day");
        if (d.isSame(base, "week")) setNextRaceText("cette semaine");
        else {
          const diffDays = d.diff(base, "day");
          const weeks = Math.floor(diffDays / 7) + (diffDays % 7 > 0 ? 1 : 0);
          setNextRaceText(`dans ${weeks} sem.`);
        }
      } else setNextRaceText("-");
    })();
  }, [athlete?.id_auth, weekStart]);

  async function logout() { await supabase.auth.signOut(); router.push("/login"); }

  // DnD
  const dayId = (d: dayjs.Dayjs) => d.format("YYYY-MM-DD");
  const sessionsByDay = useMemo(() => {
    const map: Record<string, SessionType[]> = {};
    weekDays.forEach(d => { map[dayId(d)] = []; });
    sessions.forEach(s => { if (map[s.date]) map[s.date].push(s); });
    return map;
  }, [sessions, weekDays]);
  const absencesByDay = useMemo(() => {
    const map: Record<string, AbsenceType[]> = {};
    weekDays.forEach(d => { map[dayId(d)] = []; });
    absences.forEach(a => { if (map[a.date]) map[a.date].push(a); });
    return map;
  }, [absences, weekDays]);

  const onDragEnd = useCallback(async (result: DropResult) => {
    const { destination, draggableId } = result;
    if (!destination) return;
    const destDate = destination.droppableId;
    if ((absencesByDay[destDate] || []).length > 0) return;
    setSessions(prev => prev.map(s => s.id === draggableId ? { ...s, date: destDate } : s));
    await supabase.from("sessions").update({ date: destDate }).eq("id", draggableId);
  }, [absencesByDay]);

 const stats = useMemo(() => {
  const total = sessions.length;
  const validated = sessions.filter(s => s.status === "valide").length;
  const timeSessions = sessions.reduce((acc, s) => acc + (Number(s.planned_hour) || 0), 0);
  const loadSessions = sessions.filter(s => s.status === "valide").reduce((acc, s) => acc + (Number(s.rpe) || 0) * (Number(s.planned_hour) || 0), 0);
  return { total, validated, time: timeSessions, load: loadSessions }; // Simplifié sans compet pour l'instant
}, [sessions]);

  return (
    <main className={`${jakarta.className} min-h-screen bg-slate-100 text-slate-800`}>
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-md shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-3 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="bg-blue-600 text-white px-2 py-1 rounded font-bold text-sm tracking-tight">ATHLÈTE</div>
             <div className="text-sm font-medium text-slate-600 hidden sm:block">Bonjour {athlete?.name?.split(" ")[0]}</div>
          </div>
          
          <div className="flex items-center bg-slate-100 rounded-full p-1 gap-2 border border-slate-200">
            <button onClick={() => setWeekOffset(w => w - 1)} className="p-1.5 rounded-full hover:bg-white hover:shadow-sm transition"><CaretLeft size={18}/></button>
            <div className="text-sm font-bold text-slate-700 w-32 text-center">S{weekStart.isoWeek()} • {weekStart.format("DD MMM")}</div>
            <button onClick={() => setWeekOffset(w => w + 1)} className="p-1.5 rounded-full hover:bg-white hover:shadow-sm transition"><CaretRight size={18}/></button>
          </div>

          <div className="flex items-center gap-2">
            <a href="/athlete/stats/" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-50" title="Mes Statistiques">
              <ChartLineUp size={20} weight="bold"/>
            </a>
            {/* Aide RPE Global */}
            <div className="relative">
                <button onClick={()=>setShowRpeHelp(!showRpeHelp)} className={`p-2 rounded-lg transition ${showRpeHelp ? "bg-blue-100 text-blue-700" : "text-slate-400 hover:text-blue-600 hover:bg-slate-50"}`} title="Aide RPE">
                    <Question size={20} weight="bold"/>
                </button>
                <RpeGuidePopover open={showRpeHelp} onClose={()=>setShowRpeHelp(false)} />
            </div>
            <button onClick={logout} className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg"><SignOut size={18}/></button>
          </div>
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto px-3 py-5 grid grid-cols-12 gap-4">
        
        {/* Sidebar */}
        <aside className="col-span-12 md:col-span-3 space-y-4">
          {/* Bilan Hebdo (Nouveau) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                  <div className="text-xs font-bold uppercase text-slate-400 tracking-wider">Ma Semaine</div>
                  <button onClick={()=>setReviewOpen(true)} className="text-emerald-600 hover:bg-emerald-50 p-1 rounded transition"><Notebook size={18}/></button>
              </div>
              
              <div className="flex flex-col gap-2">
                  {/* Charge Sport */}
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-2 text-slate-600"><LoadIcon size={16} weight="duotone"/> <span className="text-xs font-bold">Charge Sport</span></div>
                      <div className="text-sm font-bold text-slate-800">{stats.load.toFixed(0)}</div>
                  </div>
                  {/* Charge Vie */}
                  <button onClick={()=>setReviewOpen(true)} className={`flex items-center justify-between p-2 rounded-lg border transition hover:shadow-md ${weeklyReview ? "bg-white border-emerald-200" : "bg-white border-dashed border-slate-300"}`}>
                      <div className="flex items-center gap-2 text-slate-600"><Smiley size={16} weight="duotone"/> <span className="text-xs font-bold">Charge Vie</span></div>
                      {weeklyReview ? (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${weeklyReview.rpe_life <= 3 ? "bg-emerald-100 text-emerald-700" : weeklyReview.rpe_life <= 6 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                              {weeklyReview.rpe_life}/10
                          </span>
                      ) : (
                          <span className="text-[10px] text-slate-400 italic">Noter</span>
                      )}
                  </button>
              </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-3">Progression</div>
            <div className="flex items-center gap-4 text-sm text-slate-700 mb-2">
              <div className="flex items-center gap-2"><Clock size={16} className="text-slate-400"/><span>{fmtTime(stats.time)}</span></div>
              <div className="flex items-center gap-2"><span className={`inline-block w-2 h-2 rounded-full ${stats.validated === stats.total ? "bg-emerald-500" : "bg-slate-300"}`} /> <span>{stats.validated}/{stats.total} séances</span></div>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{width: `${stats.progress}%`}} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
            <div className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-2">Infos</div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span>Prochaine course</span> <span className="font-bold text-slate-900">{nextRaceText}</span></div>
              <div className="flex justify-between"><span>Charge S-1</span> <span className="font-bold text-slate-900">{prevWeekLoad.toFixed(0)}</span></div>
            </div>
          </div>

          {athlete && <AthleteMetrics athleteId={athlete.id_auth} />}
        </aside>

        {/* Main Grid */}
        <section className="col-span-12 md:col-span-9">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
              {weekDays.map((d) => {
                const iso = d.format("YYYY-MM-DD");
                const isToday = iso === dayjs().format("YYYY-MM-DD");
                const daySessions = sessionsByDay[iso] || [];
                const dayAbs = absencesByDay[iso] || [];
                const blocked = dayAbs.length > 0;
                
                return (
                  <Droppable droppableId={iso} key={iso}>
                    {(provided, snapshot) => (
                      <div ref={provided.innerRef} {...provided.droppableProps}
                        className={`rounded-xl border p-2 min-h-[220px] flex flex-col transition-colors 
                        ${isToday ? "bg-blue-50/50 border-blue-200 ring-1 ring-blue-100" : "bg-white border-slate-200"}
                        ${snapshot.isDraggingOver && !blocked ? "bg-emerald-50 ring-2 ring-emerald-200" : ""}
                        ${blocked ? "opacity-90 bg-slate-50" : ""}`}>
                        
                        <div className="flex items-center justify-between mb-2 px-1">
                          <div className={`text-xs font-bold uppercase ${isToday ? "text-blue-700" : "text-slate-400"}`}>{d.format("ddd DD")}</div>
                          <button
                            onClick={() => { setAbsenceDate(iso); setEditAbsence(null); setAbsenceOpen(true); }}
                            className="text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded p-1 transition" title="Ajouter Off / Compétition">
                            <Plus size={16}/>
                          </button>
                        </div>

                        <div className="space-y-2 flex-1">
                          {dayAbs.map((a) => (
                            <AbsenceCard key={a.id} a={a} onEdit={() => { setAbsenceDate(iso); setEditAbsence(a); setAbsenceOpen(true); }} />
                          ))}
                          {daySessions.map((s, idx) => (
                            <Draggable key={s.id} draggableId={s.id} index={idx}>
                              {(prov, snap) => (
                                <div ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps} style={{...prov.draggableProps.style, opacity: snap.isDragging ? 0.8 : 1}}>
                                  <SessionCard
                                    s={s}
                                    onEdit={()=>{ setCurrentSession(s); setValidateOpen(true); }}
                                    onDelete={async ()=>{
                                      if (confirm("Supprimer cette séance ?")) {
                                        await supabase.from("sessions").delete().eq("id", s.id);
                                        setSessions(prev => prev.filter(x => x.id !== s.id));
                                      }
                                    }}
                                  />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                          {daySessions.length === 0 && dayAbs.length === 0 && !snapshot.isDraggingOver && (
                              <div className="h-full border-2 border-dashed border-slate-100 rounded-lg flex items-center justify-center opacity-50 mt-2">
                                  <span className="text-[10px] text-slate-300 font-medium">Repos</span>
                              </div>
                          )}
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
        <>
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
            <WeeklyReviewModal 
                open={reviewOpen} 
                onClose={()=>setReviewOpen(false)} 
                weekStart={weekStart.format("YYYY-MM-DD")} 
                userId={athlete.id_auth}
                initial={weeklyReview}
                onSaved={(r) => setWeeklyReview(r)}
            />
        </>
      )}
    </main>
  );
}