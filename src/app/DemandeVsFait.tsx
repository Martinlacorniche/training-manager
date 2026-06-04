"use client";
import React from "react";
import { compareSession, type SessionLike } from "@/lib/trainingCompare";

// Chantier 3 — bloc « Demandé vs Fait » (web).
// Athlète : factuel (coachView=false). Coach : + drapeaux colorés (coachView).
// Lecture seule. Logique de comparaison dans @/lib/trainingCompare.

function fmtHM(h: number) {
  const tot = Math.round(h * 60);
  const H = Math.floor(tot / 60);
  const M = tot % 60;
  return H > 0 ? `${H}h${M ? String(M).padStart(2, "0") : ""}` : `${M} min`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function DemandeVsFait({ data, coachView = false }: { data: SessionLike | null | undefined; coachView?: boolean }) {
  if (!data) return null;
  const c = compareSession(data);
  if (!c.done) return null;
  if (!c.duration && !c.intensity && !c.rpe && !c.drift) return null;

  const flagCls = (on: boolean) => on && coachView ? "text-amber-700 font-semibold" : "text-slate-700";

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3">
      <div className="text-[11px] font-black uppercase tracking-wide text-blue-700 mb-2">📋 Demandé vs Fait</div>
      <div className="space-y-1 text-sm">
        {c.duration && (
          <div className="flex items-center gap-2">
            <span className="text-slate-400 w-20 shrink-0">Durée</span>
            <span className="text-slate-500">Demandé {fmtHM(c.duration.prescribed)}</span>
            <span className="text-slate-300">→</span>
            <span className={flagCls(c.duration.flag)}>
              Fait {fmtHM(c.duration.actual)} ({c.duration.deltaPct > 0 ? "+" : ""}{c.duration.deltaPct}%)
            </span>
          </div>
        )}
        {c.intensity && (
          <div className="flex items-center gap-2">
            <span className="text-slate-400 w-20 shrink-0">Intensité</span>
            <span className="text-slate-500">Demandé {c.intensity.prescribed ? cap(c.intensity.prescribed) : "—"}</span>
            <span className="text-slate-300">→</span>
            <span className={flagCls(c.intensity.mismatch)}>Réalisé {c.intensity.realized ? cap(c.intensity.realized) : "—"}</span>
          </div>
        )}
        {c.rpe && (
          <div className="flex items-center gap-2">
            <span className="text-slate-400 w-20 shrink-0">Ressenti</span>
            <span className={flagCls(c.rpe.flag)}>RPE {c.rpe.value}/10</span>
            {coachView && c.rpe.note && <span className="text-amber-700 text-[12px]">⚠ {c.rpe.note}</span>}
          </div>
        )}
        {c.drift && (
          <div className="flex items-center gap-2">
            <span className="text-slate-400 w-20 shrink-0">Dérive FC</span>
            <span className={flagCls(c.drift.flag)}>{c.drift.value > 0 ? "+" : ""}{c.drift.value}%</span>
            {coachView && c.drift.flag && <span className="text-amber-700 text-[12px]">⚠ endurance / chaleur / fatigue</span>}
          </div>
        )}
      </div>
    </div>
  );
}
