"use client";
// Les pièces du home-trainer, dans le design de l'app (Météo du corps,
// Progression) : icônes Material Design de l'app, cartes blanches, grandes
// cartes en dégradé, petites étiquettes en capitales.
import { useMemo, type CSSProperties, type ReactNode } from "react";
import { aplatir, LIBRE_PCT, type Bloc, type Etape } from "./ht/seance";
import { zoneEtape } from "./ht/zones";

export const C = { bg: "#F8FAFC", text: "#1e293b", sub: "#64748b", muted: "#94a3b8", border: "#eef2f7", blue: "#2563eb", violet: "#7c3aed" };

export function Icone({ d, taille = 20, coul = "currentColor", style }: { d: string; taille?: number; coul?: string; style?: CSSProperties }) {
  return <svg viewBox="0 0 24 24" width={taille} height={taille} style={style} aria-hidden><path d={d} fill={coul} /></svg>;
}

export const degrade = (c: readonly string[]) => ({ backgroundImage: `linear-gradient(135deg, ${c.join(", ")})` });

/** Grande carte en dégradé, l'icône qui flotte dans le coin (comme la Météo du corps). */
export function Ciel({ couleurs, icone, children, className = "" }: { couleurs: readonly string[]; icone?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-[26px] p-5 text-white ${className}`} style={degrade(couleurs)}>
      {icone && <Icone d={icone} taille={130} coul="rgba(255,255,255,0.85)" style={{ position: "absolute", right: -18, top: -12, animation: "flotte 5.2s ease-in-out infinite" }} />}
      <div className="relative">{children}</div>
      <style>{`@keyframes flotte { 0%,100% { transform: translateY(0) } 50% { transform: translateY(8px) } }`}</style>
    </div>
  );
}

export const Sur = ({ children }: { children: ReactNode }) => (
  <div className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-white/85">{children}</div>
);

export function Bulle({ icone, texte, fort, onClick }: { icone: string; texte: ReactNode; fort?: boolean; onClick?: () => void }) {
  const cls = `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-extrabold ${fort ? "bg-white text-slate-800" : "bg-white/20 text-white"} ${onClick ? "hover:bg-white/30 cursor-pointer" : ""}`;
  return onClick
    ? <button type="button" onClick={onClick} className={cls}><Icone d={icone} taille={15} />{texte}</button>
    : <span className={cls}><Icone d={icone} taille={15} />{texte}</span>;
}

export const Titre = ({ children }: { children: ReactNode }) => (
  <div className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-slate-400 mt-1">{children}</div>
);

export const Carte = ({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) => (
  <div className={`rounded-[20px] bg-white border border-[#eef2f7] p-4 ${className}`} style={style}>{children}</div>
);

export function Bouton({ onClick, children, icone, couleur = C.blue, desactive, petit, large }: { onClick: () => void; children: ReactNode; icone?: string; couleur?: string; desactive?: boolean; petit?: boolean; large?: boolean }) {
  return (
    <button type="button" disabled={desactive} onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full font-black text-white transition active:scale-[0.98] ${petit ? "px-4 py-2 text-[13px]" : "px-5 py-3.5 text-[15.5px]"} ${large ? "w-full" : ""}`}
      style={{ background: desactive ? "#cbd5e1" : couleur, boxShadow: desactive ? "none" : `0 4px 14px ${couleur}55` }}>
      {icone && <Icone d={icone} taille={petit ? 16 : 19} />}{children}
    </button>
  );
}

export function Onglets<K extends string>({ valeur, choix, onChange }: { valeur: K; choix: readonly (readonly [K, string])[]; onChange: (k: K) => void }) {
  return (
    <div className="flex rounded-xl bg-[#eef2f7] p-[3px]">
      {choix.map(([k, t]) => (
        <button key={k} type="button" onClick={() => onChange(k)} className={`flex-1 rounded-[10px] py-2.5 text-[14px] font-extrabold ${valeur === k ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>{t}</button>
      ))}
    </div>
  );
}

/** La séance en blocs ; pendant l'effort, les vrais watts (un point toutes les 5 s) par-dessus.
 *  Les blocs et le tracé ne se redessinent que quand ils changent (léger sur 2 h). */
export function Profil({ etapes, ftp, ecoule, hauteur = 64, trace }: { etapes: Etape[]; ftp: number; ecoule?: number; hauteur?: number; trace?: { x: number; w: number }[] }) {
  const nTrace = trace?.length ?? 0;
  const blocs = useMemo(() => <Blocs etapes={etapes} ftp={ftp} hauteur={hauteur} estompe={!trace} ecoule={trace ? undefined : ecoule} />, [etapes, ftp, hauteur, trace, trace ? 0 : Math.round((ecoule ?? 0) / 5)]); // eslint-disable-line react-hooks/exhaustive-deps
  const ligne = useMemo(() => {
    if (!trace || nTrace < 2) return null;
    const total = etapes.reduce((a, e) => a + e.s, 0) || 1;
    const wMax = Math.max(ftp * 1.3, ...etapes.map((e) => (e.cible.type === "w" ? e.cible.max : ftp * LIBRE_PCT)));
    const h = (w: number) => Math.max(4, (w / wMax) * (hauteur - 2));
    return trace.map((p) => `${((p.x / total) * 1000).toFixed(1)},${(hauteur - Math.min(hauteur - 1, h(p.w))).toFixed(1)}`).join(" ");
  }, [trace, nTrace, etapes, ftp, hauteur]);
  const total = etapes.reduce((a, e) => a + e.s, 0) || 1;
  const curseur = ecoule != null ? (ecoule / total) * 1000 : null;
  return (
    <div className="relative">
      {blocs}
      <svg viewBox={`0 0 1000 ${hauteur}`} preserveAspectRatio="none" className="w-full block absolute inset-0" style={{ height: hauteur }}>
        {ligne && <polyline points={ligne} fill="none" stroke={C.text} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity={0.85} />}
        {curseur != null && <rect x={Math.min(996, curseur) - 2} y={0} width={4} height={hauteur} rx={2} fill={C.text} />}
      </svg>
    </div>
  );
}

function Blocs({ etapes, ftp, ecoule, hauteur, estompe }: { etapes: Etape[]; ftp: number; ecoule?: number; hauteur: number; estompe: boolean }) {
  const total = etapes.reduce((a, e) => a + e.s, 0) || 1;
  const wMax = Math.max(ftp * 1.3, ...etapes.map((e) => (e.cible.type === "w" ? e.cible.max : ftp * LIBRE_PCT)));
  const h = (w: number) => Math.max(4, (w / wMax) * (hauteur - 2));
  const curseur = ecoule != null ? (ecoule / total) * 1000 : null;
  let x = 0;
  return (
    <svg viewBox={`0 0 1000 ${hauteur}`} preserveAspectRatio="none" className="w-full block" style={{ height: hauteur }}>
      {etapes.map((e, k) => {
        const larg = (e.s / total) * 1000, x0 = x;
        x += larg;
        const de = e.rampe ? e.rampe.de : e.cible.type === "w" ? (e.cible.min + e.cible.max) / 2 : ftp * LIBRE_PCT;
        const a = e.rampe ? e.rampe.a : de;
        const passe = estompe && curseur != null && x0 + larg <= curseur;
        const coul = zoneEtape(e, ftp).plein, g = larg > 6 ? 2 : 0;
        return e.rampe
          ? <path key={k} d={`M${x0 + g / 2},${hauteur} L${x0 + g / 2},${hauteur - h(de)} L${x0 + larg - g / 2},${hauteur - h(a)} L${x0 + larg - g / 2},${hauteur} Z`} fill={coul} opacity={passe ? 0.35 : 1} />
          : <rect key={k} x={x0 + g / 2} y={hauteur - h(de)} width={Math.max(1, larg - g)} height={h(de)} rx={larg > 12 ? 5 : 1} fill={coul} opacity={passe ? 0.35 : 1} />;
      })}
    </svg>
  );
}

export const profilDe = (blocs: Bloc[], ftp: number, hauteur?: number) => <Profil etapes={aplatir(blocs)} ftp={ftp} hauteur={hauteur} />;

export function Anneau({ part, taille = 64, coul }: { part: number; taille?: number; coul: string }) {
  const r = taille / 2 - 5, c = 2 * Math.PI * r;
  return (
    <svg width={taille} height={taille} className="-rotate-90">
      <circle cx={taille / 2} cy={taille / 2} r={r} stroke="#eef2f7" strokeWidth={7} fill="none" />
      <circle cx={taille / 2} cy={taille / 2} r={r} stroke={coul} strokeWidth={7} fill="none" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, part)))} style={{ transition: "stroke-dashoffset 0.25s linear" }} />
    </svg>
  );
}

export function Pas({ moins, plus, children }: { moins: () => void; plus: () => void; children: ReactNode }) {
  const b = "w-[30px] h-[30px] rounded-[10px] bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-800 font-black";
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={moins} className={b}>−</button>
      <div className="min-w-[60px] text-center font-black text-slate-800 tabular-nums">{children}</div>
      <button type="button" onClick={plus} className={b}>+</button>
    </div>
  );
}

/** Où l'on est par rapport aux watts visés, d'un coup d'œil (Chloé, 01/11) :
 *  la bande claire = la plage visée, le repère = la puissance 3 s. */
export function Jauge({ w, cible }: { w: number | null; cible: number | null }) {
  if (!cible) return null;
  const tol = Math.max(5, cible * 0.04), bas = cible * 0.7, haut = cible * 1.3;
  const x = (v: number) => ((Math.min(haut, Math.max(bas, v)) - bas) / (haut - bas)) * 100;
  const dedans = w != null && Math.abs(w - cible) <= tol;
  return (
    <div className="relative h-7 mt-3 mx-3 flex items-center">
      <div className="absolute inset-x-0 h-3.5 rounded-full bg-white/20" />
      <div className="absolute h-3.5 rounded-full bg-white/60" style={{ left: `${x(cible - tol)}%`, width: `${x(cible + tol) - x(cible - tol)}%` }} />
      {w != null && (
        <div className={`absolute w-7 h-7 -ml-3.5 rounded-full border-[3px] border-white flex items-center justify-center text-white text-sm font-black transition-[left] duration-500 ${dedans ? "bg-white" : "bg-slate-900"}`} style={{ left: `${x(w)}%` }}>
          {!dedans && (w < cible ? "▲" : "▼")}
        </div>
      )}
    </div>
  );
}
