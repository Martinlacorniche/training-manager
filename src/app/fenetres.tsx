"use client";
// Les fenêtres « Es-tu sûr ? » et « Oups » du site, à la place des boîtes
// grises du navigateur (confirm, alert) : même style que le reste des pages.
// Appel direct, sans rien placer dans la page : `if (!(await demander("…"))) return;`
import React from "react";
import { createRoot } from "react-dom/client";

function ouvrir(texte: string, avecChoix: boolean, oui: string, danger: boolean): Promise<boolean> {
  return new Promise((fin) => {
    const hote = document.createElement("div");
    document.body.appendChild(hote);
    const racine = createRoot(hote);
    const fermer = (v: boolean) => { racine.unmount(); hote.remove(); fin(v); };
    const [titre, ...suite] = texte.split("\n").filter((l) => l.trim());
    racine.render(
      <div className="fixed inset-0 z-[90] grid place-items-center p-4 font-sans" onClick={() => fermer(false)}>
        <div className="absolute inset-0 bg-slate-900/40" />
        <div role="dialog" className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl space-y-3" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-lg font-extrabold text-slate-800 whitespace-pre-line">{titre}</h3>
          {suite.map((l, i) => <p key={i} className="text-sm font-semibold text-slate-500">{l}</p>)}
          <div className="flex gap-2.5 pt-1">
            {avecChoix && <button autoFocus onClick={() => fermer(false)} className="flex-1 rounded-xl bg-slate-100 py-2.5 font-extrabold text-slate-600 hover:bg-slate-200">Non</button>}
            <button autoFocus={!avecChoix} onClick={() => fermer(true)} className={`flex-1 rounded-xl py-2.5 font-extrabold text-white ${danger ? "bg-rose-600 hover:bg-rose-700" : "bg-blue-600 hover:bg-blue-700"}`}>{oui}</button>
          </div>
        </div>
      </div>,
    );
  });
}

/** Une question oui / non. */
export const demander = (texte: string, oui = "Oui", danger = /supprim|déconnect|masquer/i.test(texte)) => ouvrir(texte, true, oui, danger);
/** Un message, avec un seul bouton. */
export const prevenir = (texte: string) => ouvrir(texte, false, "Compris", false).then(() => undefined);
