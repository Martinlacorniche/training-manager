"use client";
import React from "react";

// Les notes détaillées du bilan de la semaine (1 = très bien, 5 = très
// difficile) et la douleur, en une ligne. Mêmes libellés que l'app.
type Bilan = {
  fatigue?: number | null; sommeil?: number | null; stress?: number | null; jambes?: number | null;
  douleur?: boolean | null; douleur_zone?: string | null;
};
const LIBELLES: [keyof Bilan, string][] = [["fatigue", "Fatigue"], ["sommeil", "Sommeil"], ["stress", "Stress"], ["jambes", "Jambes"]];

export default function BilanDetails({ bilan, clair = false }: { bilan: Bilan | null | undefined; clair?: boolean }) {
  if (!bilan) return null;
  const notes = LIBELLES.filter(([k]) => typeof bilan[k] === "number");
  if (!notes.length && !bilan.douleur) return null;
  const couleur = (n: number) => (n <= 2 ? "text-emerald-600" : n === 3 ? "text-amber-600" : "text-rose-600");
  return (
    <div className={`flex flex-wrap gap-x-3 gap-y-1 text-xs ${clair ? "text-slate-200" : "text-slate-500"}`}>
      {notes.map(([k, l]) => (
        <span key={k}>{l} <strong className={clair ? "text-white" : couleur(bilan[k] as number)}>{bilan[k] as number}/5</strong></span>
      ))}
      {bilan.douleur && (
        <span className={clair ? "text-rose-300 font-bold" : "text-rose-600 font-bold"}>Douleur{bilan.douleur_zone ? ` : ${bilan.douleur_zone}` : ""}</span>
      )}
    </div>
  );
}
