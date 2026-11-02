"use client";
// Le bandeau flottant (Document Picture-in-Picture de Chrome) : une fenêtre
// étroite, toujours au-dessus, que Martin pose à côté de son film. Il prend
// la couleur de la zone, comme la grande carte de l'écran.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { mdiArrowExpand, mdiFlagCheckered, mdiHeart, mdiMinus, mdiPause, mdiPlay, mdiPlus, mdiRotateRight, mdiSkipNext, mdiSkipPrevious } from "@mdi/js";
import type { Etat } from "./ht/moteur";
import type { Etape } from "./ht/seance";
import { ecart, zoneEtape, ZONE_PAUSE } from "./ht/zones";
import { degrade, Icone } from "./ui";

/* eslint-disable @typescript-eslint/no-explicit-any */
export const bandeauDispo = () => typeof window !== "undefined" && "documentPictureInPicture" in window;

export async function ouvrirFenetre(): Promise<Window> {
  const w: Window = await (window as any).documentPictureInPicture.requestWindow({ width: 1180, height: 96 });
  // Les styles de la page (Tailwind, polices) suivent dans la fenêtre
  for (const ss of Array.from(document.styleSheets)) {
    try {
      const st = w.document.createElement("style");
      // Les polices pointent vers « /_next/… » : dans la fenêtre (about:blank) il faut l'adresse complète
      st.textContent = Array.from(ss.cssRules).map((r) => r.cssText).join("\n").replace(/url\((["']?)\//g, `url($1${location.origin}/`);
      w.document.head.appendChild(st);
    } catch {
      if (ss.href) { const l = w.document.createElement("link"); l.rel = "stylesheet"; l.href = ss.href; w.document.head.appendChild(l); }
    }
  }
  w.document.body.style.margin = "0";
  w.document.title = "Home-trainer";
  return w;
}

export const chrono = (s: number | null) => {
  if (s == null) return "—";
  const t = Math.max(0, Math.round(s)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), r = t % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
};

/** L'objectif d'une étape en clair : « 300 W », « 302-342 W », « 100 → 200 W », « 140 bpm », « libre ». */
const objectif = (e: Etape | null, ajust = 1) => {
  if (!e) return "libre";
  const r = (w: number) => Math.round(w * ajust);
  if (e.rampe) return `${r(e.rampe.de)} → ${r(e.rampe.a)} W`;
  if (e.cible.type === "w") return e.cible.min === e.cible.max ? `${r(e.cible.min)} W` : `${r(e.cible.min)}-${r(e.cible.max)} W`;
  if (e.cible.type === "bpm") return e.cible.min === e.cible.max ? `${e.cible.min} bpm` : `${e.cible.min}-${e.cible.max} bpm`;
  return "libre";
};

export type Actions = { pause: () => void; suivante: () => void; precedente: () => void; plus: () => void; moins: () => void; terminer: () => void };

const Rond = ({ onClick, d, titre, gros }: { onClick: () => void; d: string; titre: string; gros?: boolean }) => (
  <button type="button" title={titre} onClick={onClick}
    className={`${gros ? "h-14 w-14 bg-white text-slate-800" : "h-11 w-11 bg-white/20 hover:bg-white/30 text-white"} rounded-full flex items-center justify-center shrink-0`}>
    <Icone d={d} taille={gros ? 30 : 20} />
  </button>
);

const Valeur = ({ titre, children, icone }: { titre: string; children: React.ReactNode; icone?: string }) => (
  <div className="flex flex-col justify-center shrink-0">
    <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/80 leading-none">{icone && <Icone d={icone} taille={11} />}{titre}</span>
    <span className="text-white font-black tabular-nums leading-tight text-[26px]">{children}</span>
  </div>
);

export function Bandeau({ fenetre, zoneFc, etat, etapes, ftp, position, police, perdu, actions, onFermer }: {
  fenetre: Window; zoneFc?: number | null; etat: Etat; etapes: Etape[]; ftp: number; position: number; police: string; perdu: string | null; actions: Actions; onFermer: () => void;
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

  const z = etat.pause !== "non" ? ZONE_PAUSE : zoneEtape(etat.etape, ftp);
  const ec = ecart(etat.w3s, etat.cible);
  const total = etapes.reduce((a, e) => a + e.s, 0);
  const message = perdu ?? etat.alerte ?? (etat.pause === "auto" ? "En pause — repédale pour reprendre" : etat.pause === "manuelle" ? "En pause" : null);

  return createPortal(
    <div className="h-screen flex flex-col select-none" style={{ ...degrade(z.degrade), fontFamily: `${police}, system-ui, sans-serif` }}>
      <div className="flex-1 flex items-center gap-5 px-4 min-w-0">
        <div className="flex flex-col justify-center shrink-0 min-w-[190px]">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/80 leading-none">{message ?? z.mot}{ec && !message ? ` · ${ec.texte}` : ""}</span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-[44px] font-black text-white tabular-nums leading-none tracking-tight">{etat.w3s ?? "—"}</span>
            <span className="text-white/85 text-lg font-black">/ {etat.cible ?? "—"} W</span>
          </span>
        </div>
        {/* Le temps qui reste de l'étape, juste à côté des watts (02/11/2026) */}
        {!etat.col && <Valeur titre={`Étape · ${objectif(etat.etape, etat.ajust)}`}>{etat.attendLap ? "⏭" : chrono(etat.resteEtape ?? etat.tEtape)}</Valeur>}
        <Valeur titre="Cadence" icone={mdiRotateRight}>{etat.cadence ?? "—"}</Valeur>
        <Valeur titre="Cœur" icone={mdiHeart}>{etat.bpm ?? "—"}{zoneFc ? <span className="text-xs text-slate-400"> Z{zoneFc}</span> : null}</Valeur>
        {etat.col ? (
          <>
            <Valeur titre="Pente">{etat.col.pente.toFixed(1).replace(".", ",")} %</Valeur>
            <Valeur titre="Reste">{((etat.col.total - etat.col.d) / 1000).toFixed(1).replace(".", ",")} <span className="text-base">km</span></Valeur>
            <Valeur titre="Vitesse">{etat.col.kmh.toFixed(1).replace(".", ",")}</Valeur>
          </>
        ) : <>
        <Valeur titre="Ensuite">{etat.suivante ? <>{chrono(etat.suivante.s)} <span className="text-white/80 text-base">· {objectif(etat.suivante, etat.ajust)}</span></> : <span className="text-base">fin 🏁</span>}</Valeur>
        </>}
        <Valeur titre="Tour moy.">{etat.tour.w ?? "—"}</Valeur>
        {etat.reserve != null && (
          <div className="flex flex-col justify-center shrink-0 w-[70px]">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/80 leading-none">Réserve</span>
            <div className="h-2.5 rounded-full bg-black/20 overflow-hidden mt-2"><div className="h-full rounded-full bg-white" style={{ width: `${etat.reserve * 100}%` }} /></div>
          </div>
        )}
        <Valeur titre="Total">{chrono(etat.tTotal)}{etat.dureeTotale ? <span className="text-white/70 text-base"> / {chrono(etat.dureeTotale)}</span> : null}</Valeur>
        <div className="flex items-center gap-1.5 ml-auto">
          <Rond titre="Moins dur (flèche bas)" d={mdiMinus} onClick={actions.moins} />
          <span className="w-11 text-center text-xs font-black text-white tabular-nums">{etat.erg ? `${Math.round(etat.ajust * 100)}%` : `${etat.pente}%`}</span>
          <Rond titre="Plus dur (flèche haut)" d={mdiPlus} onClick={actions.plus} />
          <span className="w-2" />
          <Rond titre="Précédent (flèche gauche)" d={mdiSkipPrevious} onClick={actions.precedente} />
          <Rond gros titre="Pause (espace)" d={etat.pause === "non" ? mdiPause : mdiPlay} onClick={actions.pause} />
          <Rond titre="Suivant (flèche droite)" d={mdiSkipNext} onClick={actions.suivante} />
          <span className="w-2" />
          {surStop
            ? <button type="button" onClick={actions.terminer} className="h-11 px-4 rounded-full bg-white text-rose-600 font-black text-sm shrink-0">Terminer ?</button>
            : <Rond titre="Terminer et enregistrer" d={mdiFlagCheckered} onClick={() => setSurStop(true)} />}
          <Rond titre="Revenir à la grande vue" d={mdiArrowExpand} onClick={onFermer} />
        </div>
      </div>
      {total > 0 && (
        <div className="h-1.5 bg-black/15">
          <div className="h-full bg-white/90 rounded-r-full" style={{ width: `${Math.min(100, (position / total) * 100)}%`, transition: "width 0.25s linear" }} />
        </div>
      )}
    </div>,
    fenetre.document.body,
  );
}
