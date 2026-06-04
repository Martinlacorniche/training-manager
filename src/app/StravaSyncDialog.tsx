"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Lightning, X, CheckCircle, ArrowsClockwise, WarningCircle, MagnifyingGlass, LinkBreak } from "@phosphor-icons/react";

const SUPABASE_FUNCTIONS_URL = "https://ihigmlpgliasczlvxttd.supabase.co/functions/v1";

type Candidate = {
  activity_id: number; name: string; sport_app: string; strava_type: string;
  start_time: string | null; distance_km: number | null; duration_min: number | null;
  elevation_m: number | null; avg_hr: number | null;
};
type Target = { session_id: string; title: string; sport: string; planned_hour: number | null; intensity?: string };
type Phase = "loading" | "propose" | "matched" | "none" | "not_connected" | "error";
type Mode = "sync" | "merge";

type Props = {
  open: boolean;
  onClose: () => void;
  athleteId: string;
  session: { id: string; title?: string } | null;
  mode: Mode;
  onDone: () => void;
};

function fmtTime(iso: string | null) { const t = iso?.split("T")[1]; return t ? t.slice(0, 5) : ""; }
function fmtDuration(min: number | null) {
  if (min == null) return "–";
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m}min`;
}

export default function StravaSyncDialog({ open, onClose, athleteId, session, mode, onDone }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [selected, setSelected] = useState<string | number | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [matchedName, setMatchedName] = useState<string | null>(null);

  useEffect(() => {
    if (open && session) scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session?.id, mode]);

  async function callFn(body: Record<string, unknown>) {
    const { data: { session: auth } } = await supabase.auth.getSession();
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/strava-force-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth?.access_token}` },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async function scan() {
    setPhase("loading"); setErrorMsg(""); setCandidates([]); setTargets([]); setSelected(null); setMatchedName(null);
    try {
      if (mode === "merge") {
        const data = await callFn({ action: "planned_targets", user_id: athleteId, target_id: session!.id });
        if (data.error) { setErrorMsg(data.error); setPhase("error"); return; }
        const list: Target[] = data.targets ?? [];
        if (!list.length) { setPhase("none"); return; }
        setTargets(list); setSelected(list[0].session_id); setPhase("propose");
        return;
      }
      const data = await callFn({ action: "scan", user_id: athleteId, target_type: "session", target_id: session!.id });
      if (data.error) { setErrorMsg(data.error); setPhase("error"); return; }
      switch (data.status) {
        case "matched": setMatchedName(data.candidate?.name ?? null); setPhase("matched"); break;
        case "propose":
          setCandidates(data.candidates ?? []);
          setSelected(data.preselected_activity_id ?? data.candidates?.[0]?.activity_id ?? null);
          setPhase("propose"); break;
        case "not_connected": setPhase("not_connected"); break;
        default: setPhase("none");
      }
    } catch (e: any) { setErrorMsg(e?.message ?? "Erreur réseau"); setPhase("error"); }
  }

  async function confirm() {
    if (selected == null) return;
    setBusy(true);
    try {
      let data: any;
      if (mode === "merge") {
        data = await callFn({ action: "merge_orphan", user_id: athleteId, target_id: session!.id, planned_session_id: selected });
        if (!data.error) setMatchedName(targets.find(t => t.session_id === selected)?.title ?? null);
      } else {
        data = await callFn({ action: "attach", user_id: athleteId, target_type: "session", target_id: session!.id, activity_id: selected });
        if (!data.error) setMatchedName(candidates.find(c => c.activity_id === selected)?.name ?? null);
      }
      if (data.error) { setErrorMsg(data.error); setPhase("error"); return; }
      setPhase("matched");
    } catch (e: any) { setErrorMsg(e?.message ?? "Erreur réseau"); setPhase("error"); }
    finally { setBusy(false); }
  }

  if (!open) return null;
  const headerTxt = mode === "merge" ? "Rattacher à une séance" : "Synchro Strava";

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Lightning size={20} weight="fill" className="text-orange-500" />
          <h3 className="flex-1 text-lg font-bold text-orange-600">{headerTxt}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400"><X size={20} /></button>
        </div>

        {phase === "loading" && (
          <div className="py-10 text-center text-slate-500 text-sm">
            <ArrowsClockwise size={28} className="mx-auto mb-3 animate-spin text-orange-500" />
            {mode === "merge" ? "Recherche des séances planifiées du jour…" : "Recherche des activités Strava du jour…"}
          </div>
        )}

        {phase === "matched" && (
          <div className="py-8 text-center space-y-3">
            <CheckCircle size={48} weight="fill" className="mx-auto text-emerald-500" />
            <div className="font-bold text-slate-800">{mode === "merge" ? "Activité rattachée" : "Séance rattachée"}</div>
            {matchedName && <div className="text-sm text-slate-500">{matchedName}</div>}
            <button onClick={onDone} className="mt-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold">Terminé</button>
          </div>
        )}

        {phase === "not_connected" && (
          <div className="py-8 text-center space-y-3">
            <LinkBreak size={40} className="mx-auto text-slate-400" />
            <div className="text-sm text-slate-500">Cet athlète n'a pas connecté son compte Strava.</div>
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold">Fermer</button>
          </div>
        )}

        {phase === "none" && (
          <div className="py-8 text-center space-y-3">
            <MagnifyingGlass size={40} className="mx-auto text-slate-400" />
            <div className="text-sm text-slate-500">
              {mode === "merge"
                ? "Aucune séance planifiée à rattacher ce jour-là (même sport, pas encore synchronisée)."
                : "Aucune activité Strava trouvée ce jour-là pour ce sport."}
            </div>
            <div className="flex justify-center gap-2">
              <button onClick={scan} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold">Réessayer</button>
              <button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold">Fermer</button>
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="py-8 text-center space-y-3">
            <WarningCircle size={40} className="mx-auto text-rose-500" />
            <div className="text-sm text-rose-600">{errorMsg || "Une erreur est survenue."}</div>
            <button onClick={scan} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold">Réessayer</button>
          </div>
        )}

        {phase === "propose" && mode === "sync" && (
          <>
            <p className="text-sm text-slate-500 mb-2">Plusieurs activités possibles — choisis celle à rattacher :</p>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {candidates.map((c) => {
                const sel = c.activity_id === selected;
                return (
                  <button key={c.activity_id} onClick={() => setSelected(c.activity_id)}
                    className={`w-full text-left rounded-xl border p-3 flex items-center gap-3 ${sel ? "border-orange-500 bg-orange-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100"}`}>
                    {sel ? <CheckCircle size={20} weight="fill" className="text-orange-500 shrink-0" /> : <span className="w-5 h-5 rounded-full border border-slate-300 shrink-0" />}
                    <span className="min-w-0">
                      <span className="block font-semibold text-slate-800 truncate">{c.name}</span>
                      <span className="block text-xs text-slate-500">
                        {c.sport_app}{c.start_time ? ` · ${fmtTime(c.start_time)}` : ""}{` · ${fmtDuration(c.duration_min)}`}
                        {c.distance_km != null ? ` · ${c.distance_km} km` : ""}{c.elevation_m ? ` · ${Math.round(c.elevation_m)} m D+` : ""}
                        {c.avg_hr != null ? ` · ${Math.round(c.avg_hr)} bpm` : ""}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <button disabled={selected == null || busy} onClick={confirm}
              className="mt-3 w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold">
              {busy ? "Rattachement…" : "Rattacher cette activité"}
            </button>
          </>
        )}

        {phase === "propose" && mode === "merge" && (
          <>
            <p className="text-sm text-slate-500 mb-2">À quelle séance planifiée rattacher cette activité Strava ?</p>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {targets.map((t) => {
                const sel = t.session_id === selected;
                return (
                  <button key={t.session_id} onClick={() => setSelected(t.session_id)}
                    className={`w-full text-left rounded-xl border p-3 flex items-center gap-3 ${sel ? "border-orange-500 bg-orange-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100"}`}>
                    {sel ? <CheckCircle size={20} weight="fill" className="text-orange-500 shrink-0" /> : <span className="w-5 h-5 rounded-full border border-slate-300 shrink-0" />}
                    <span className="min-w-0">
                      <span className="block font-semibold text-slate-800 truncate">{t.title || "Séance"}</span>
                      <span className="block text-xs text-slate-500">
                        {t.sport}{t.planned_hour ? ` · ${fmtDuration(Math.round(t.planned_hour * 60))} prévu` : ""}{t.intensity ? ` · ${t.intensity}` : ""}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <button disabled={selected == null || busy} onClick={confirm}
              className="mt-3 w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold">
              {busy ? "Rattachement…" : "Rattacher à cette séance"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
