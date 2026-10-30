"use client";
// Le bandeau flottant (Document Picture-in-Picture de Chrome) : une fenêtre
// étroite, toujours au-dessus, que Martin pose à côté de son film. Tout ce
// qu'il faut pendant l'effort, et rien d'autre.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Pause, Play, SkipBack, SkipForward, Stop, ArrowsOut, Minus, Plus } from "@phosphor-icons/react";
import type { Etat } from "./ht/moteur";
import type { Etape } from "./ht/seance";
import { Profil } from "./Profil";

/* eslint-disable @typescript-eslint/no-explicit-any */
export const bandeauDispo = () => typeof window !== "undefined" && "documentPictureInPicture" in window;

export async function ouvrirFenetre(): Promise<Window> {
  const w: Window = await (window as any).documentPictureInPicture.requestWindow({ width: 1180, height: 104 });
  // Les styles de la page (Tailwind) suivent dans la fenêtre
  for (const ss of Array.from(document.styleSheets)) {
    try {
      const st = w.document.createElement("style");
      st.textContent = Array.from(ss.cssRules).map((r) => r.cssText).join("\n");
      w.document.head.appendChild(st);
    } catch {
      if (ss.href) { const l = w.document.createElement("link"); l.rel = "stylesheet"; l.href = ss.href; w.document.head.appendChild(l); }
    }
  }
  w.document.body.style.margin = "0";
  w.document.body.style.background = "#0b1220";
  w.document.title = "Home-trainer";
  return w;
}

export const chrono = (s: number | null) => {
  if (s == null) return "—";
  const t = Math.max(0, Math.round(s)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), r = t % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
};

export type Actions = { pause: () => void; suivante: () => void; precedente: () => void; plus: () => void; moins: () => void; terminer: () => void };

const Bouton = ({ onClick, children, titre, rouge }: { onClick: () => void; children: React.ReactNode; titre: string; rouge?: boolean }) => (
  <button type="button" title={titre} onClick={onClick}
    className={`h-11 min-w-11 px-2 rounded-xl flex items-center justify-center ${rouge ? "bg-rose-600 text-white" : "bg-white/10 hover:bg-white/20 text-white"}`}>{children}</button>
);
const Case = ({ titre, children, large }: { titre: string; children: React.ReactNode; large?: boolean }) => (
  <div className={`flex flex-col justify-center ${large ? "min-w-[150px]" : "min-w-[80px]"}`}>
    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-none">{titre}</span>
    <span className="text-white font-extrabold tabular-nums leading-tight">{children}</span>
  </div>
);

export function Bandeau({ fenetre, etat, etapes, ftp, position, actions, onFermer }: {
  fenetre: Window; etat: Etat; etapes: Etape[]; ftp: number; position: number; actions: Actions; onFermer: () => void;
}) {
  const [surStop, setSurStop] = useState(false);
  useEffect(() => { if (!surStop) return; const h = setTimeout(() => setSurStop(false), 3000); return () => clearTimeout(h); }, [surStop]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); actions.pause(); }
      if (e.code === "ArrowRight") actions.suivante();
      if (e.code === "ArrowLeft") actions.precedente();
      if (e.code === "ArrowUp") actions.plus();
      if (e.code === "ArrowDown") actions.moins();
    };
    fenetre.addEventListener("keydown", k);
    return () => fenetre.removeEventListener("keydown", k);
  }, [fenetre, actions]);

  const ecart = etat.cible && etat.watts != null ? etat.watts - etat.cible : 0;
  const coulW = !etat.cible || etat.watts == null ? "text-white" : Math.abs(ecart) <= etat.cible * 0.05 ? "text-emerald-400" : ecart > 0 ? "text-orange-400" : "text-sky-400";
  return createPortal(
    <div className="h-screen flex flex-col bg-[#0b1220] select-none" style={{ fontFamily: "system-ui, sans-serif" }}>
      <div className="flex-1 flex items-center gap-4 px-3">
        <div className="flex items-baseline gap-2 min-w-[170px]">
          <span className={`text-4xl font-black tabular-nums ${coulW}`}>{etat.watts ?? "—"}</span>
          <span className="text-slate-400 text-sm font-bold">/ {etat.cible ?? "—"} W</span>
        </div>
        <Case titre="Cadence"><span className="text-2xl">{etat.cadence ?? "—"}</span></Case>
        <Case titre="Cœur"><span className="text-2xl text-rose-300">{etat.bpm ?? "—"}</span></Case>
        <Case titre="Étape" large><span className="text-2xl">{etat.attendLap ? "⏭ ?" : chrono(etat.resteEtape)}</span>
          {etat.suivante && <span className="text-[11px] text-slate-400 font-semibold"> puis {etat.suivante.cible.type === "w" ? `${Math.round((etat.suivante.cible.min + etat.suivante.cible.max) / 2 * etat.ajust)} W` : etat.suivante.cible.type === "bpm" ? `${etat.suivante.cible.min} bpm` : "libre"}</span>}</Case>
        <Case titre="Total" large><span className="text-xl">{chrono(etat.tTotal)}{etat.dureeTotale ? <span className="text-slate-400 text-sm"> / {chrono(etat.dureeTotale)}</span> : null}</span></Case>
        <div className="flex items-center gap-1.5 ml-auto">
          <Bouton titre="Moins dur (flèche bas)" onClick={actions.moins}><Minus size={16} weight="bold" /></Bouton>
          <span className="text-xs text-slate-300 font-bold w-10 text-center tabular-nums">{etat.erg ? `${Math.round(etat.ajust * 100)}%` : `${etat.pente}%`}</span>
          <Bouton titre="Plus dur (flèche haut)" onClick={actions.plus}><Plus size={16} weight="bold" /></Bouton>
          <span className="w-2" />
          <Bouton titre="Précédent (flèche gauche)" onClick={actions.precedente}><SkipBack size={20} weight="fill" /></Bouton>
          <Bouton titre="Pause (espace)" onClick={actions.pause}>{etat.pause === "non" ? <Pause size={22} weight="fill" /> : <Play size={22} weight="fill" />}</Bouton>
          <Bouton titre="Suivant (flèche droite)" onClick={actions.suivante}><SkipForward size={20} weight="fill" /></Bouton>
          <span className="w-2" />
          <Bouton titre="Terminer et enregistrer" rouge={surStop} onClick={() => (surStop ? actions.terminer() : setSurStop(true))}>
            {surStop ? <span className="text-xs font-bold px-1">Terminer ?</span> : <Stop size={20} weight="fill" />}
          </Bouton>
          <Bouton titre="Revenir à la grande vue" onClick={onFermer}><ArrowsOut size={20} /></Bouton>
        </div>
      </div>
      {etat.alerte && <div className="absolute top-1 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-400 text-slate-900 text-xs font-bold">{etat.alerte}</div>}
      {etat.pause !== "non" && !etat.fini && <div className="absolute top-1 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-sky-500 text-white text-xs font-bold">{etat.pause === "auto" ? "En pause — repédale pour reprendre" : "En pause"}</div>}
      {etapes.length > 0 && <Profil etapes={etapes} ftp={ftp} ecoule={position} hauteur={14} sombre />}
    </div>,
    fenetre.document.body,
  );
}
