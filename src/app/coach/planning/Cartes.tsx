"use client";
// Les cartes du planning coach, communes à la semaine d'un athlète et à la vue
// de toute l'équipe : carte de séance, ajout rapide « Footing 1h facile ↵ ».
import Link from "next/link";
import React, { useState } from "react";
import dayjs from "dayjs";
import { WarningCircle } from "@phosphor-icons/react";
import { ETAT, INTENSITE, IconeSport, SPORT_COULEUR, SPORT_NOM, alerteSeance, duree, etatSeance, lireDuree } from "../../commun";
import type { Seance } from "./Panneau";

// « Footing 1h facile » → une séance : le sport, la durée et l'intensité se lisent dans le texte.
export function lireSaisie(t: string): { sport: string; title: string; planned_hour: number | null; intensity: string } {
  const b = t.toLowerCase();
  const sport = /v[ée]lo|home|ht\b|route|vtt|gravel/.test(b) ? "Vélo"
    : /nat|piscine|crawl|swim/.test(b) ? "Natation"
    : /trail|d\+|montagne|c[ôo]te/.test(b) ? "Trail"
    : /renfo|gainage|abdo|pilates|yoga|mobilit/.test(b) ? "Renfo"
    : /muscu|squat|soulev|force/.test(b) ? "Muscu"
    : /repos|marche|autre/.test(b) ? "Autre" : "Run";
  const m = b.match(/(\d{1,2}\s?h\s?\d{0,2}|\d{1,3}\s?(?:min|mn|'|′))/);
  const h = m ? lireDuree(m[1].replace(/mn/, "min")) : null;
  const intensity = /facile|ef\b|tranquille|r[ée]cup|endurance|z1|z2|balade/.test(b) ? "basse"
    : /vma|fractionn|seuil|intense|dur\b|sprint|test|côtes|cotes|\d+\s?[x×]/.test(b) ? "haute" : "moyenne";
  return { sport, title: t.trim(), planned_hour: h, intensity };
}

export function CarteSeance({ s, ouverte, onOuvrir, vu }: { s: Seance; ouverte: boolean; onOuvrir: () => void; vu: boolean }) {
  const auj = dayjs().format("YYYY-MM-DD");
  const e = ETAT[etatSeance(s, auj)];
  const alerte = alerteSeance(s);
  const t = INTENSITE[s.intensity ?? "moyenne"];
  return (
    <button onClick={onOuvrir}
      className={`w-full text-left rounded-xl bg-white p-2 flex flex-col gap-1 border transition hover:shadow-md ${ouverte ? "ring-[3px] ring-blue-200 border-blue-400" : alerte === "douleur" ? "border-red-200" : "border-slate-200"}`}
      style={{ borderLeft: `5px solid ${SPORT_COULEUR[s.sport] ?? "#64748b"}` }}>
      <span className="text-[13.5px] font-extrabold leading-tight text-slate-800 line-clamp-2 break-words">{s.title || SPORT_NOM[s.sport] || "Séance"}</span>
      <span className="flex items-center gap-1 text-xs font-semibold text-slate-500"><IconeSport sport={s.sport} size={13} /><span className="truncate">{[duree(s.planned_hour), t?.nom.toLowerCase()].filter(Boolean).join(" · ")}</span></span>
      <span className="flex flex-wrap items-center gap-1">
        <span className="text-[11px] font-extrabold rounded-full px-2 py-0.5" style={{ background: e.fond, color: e.couleur }}>{e.nom}</span>
        {s.test && <span className="text-[11px] font-extrabold rounded-full px-2 py-0.5 bg-violet-100 text-violet-700">Test</span>}
        {alerte && <WarningCircle size={15} weight="fill" className="text-red-500" />}
      </span>
      {(s.rpe != null || s.athlete_comment) && (
        <span className={`text-xs leading-snug ${alerte === "douleur" ? "text-red-700 font-semibold" : "text-slate-600"}`}>
          {s.rpe != null && <b className="not-italic">{s.rpe}/10 </b>}
          {s.athlete_comment && <i className="line-clamp-3">« {s.athlete_comment} »</i>}
          {vu && <span className="block text-[11px] font-bold text-green-600 not-italic">✓ vu</span>}
        </span>
      )}
    </button>
  );
}

export function AjoutRapide({ onAjout, petit }: { onAjout: (t: string) => Promise<void>; petit?: boolean }) {
  const [ouvert, setOuvert] = useState(false);
  const [t, setT] = useState("");
  const [occupe, setOccupe] = useState(false);
  if (!ouvert) return (
    <button onClick={() => setOuvert(true)} className={`w-full rounded-xl border-[1.5px] border-dashed border-slate-300 font-extrabold text-slate-400 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/40 ${petit ? "py-1 text-xs" : "py-2 text-[13px]"}`}>{petit ? "+" : "+ Ajouter"}</button>
  );
  return (
    <form onSubmit={async (e) => { e.preventDefault(); if (!t.trim()) return; setOccupe(true); await onAjout(t); setOccupe(false); setT(""); setOuvert(false); }}>
      <input autoFocus value={t} disabled={occupe} onChange={(e) => setT(e.target.value)} onBlur={() => { if (!t.trim()) setOuvert(false); }}
        onKeyDown={(e) => { if (e.key === "Escape") { setT(""); setOuvert(false); } }}
        placeholder={petit ? "Footing 1h ↵" : "Footing 1h facile ↵"} className={`w-full rounded-xl border-2 border-blue-400 font-bold focus:outline-none ${petit ? "px-1.5 py-1 text-xs" : "px-2.5 py-2 text-[13px]"}`} />
    </form>
  );
}


/** La carte compacte de la vue équipe : titre, durée, pastille d'état, l'alerte en clair. */
export function CartePetite({ s, ouverte, onOuvrir }: { s: Seance; ouverte: boolean; onOuvrir: () => void }) {
  const e = ETAT[etatSeance(s, dayjs().format("YYYY-MM-DD"))];
  const alerte = alerteSeance(s);
  return (
    <button onClick={onOuvrir} title={[s.title, duree(s.planned_hour), e.nom, s.athlete_comment ? `« ${s.athlete_comment} »` : ""].filter(Boolean).join(" · ")}
      className={`w-full text-left rounded-lg bg-white px-2 py-1.5 border transition hover:shadow-md ${ouverte ? "ring-[3px] ring-blue-200 border-blue-400" : "border-slate-200"}`}
      style={{ borderLeft: `4px solid ${SPORT_COULEUR[s.sport] ?? "#64748b"}` }}>
      <span className="flex items-center gap-1.5">
        <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: e.couleur === "#475569" ? "#cbd5e1" : e.couleur }} />
        <span className="text-xs font-extrabold text-slate-800 truncate">{s.title || SPORT_NOM[s.sport] || "Séance"}</span>
      </span>
      <span className="block text-[11px] font-semibold text-slate-500 truncate">{duree(s.planned_hour)}</span>
      {alerte === "douleur" && <span className="block text-[11px] italic font-semibold text-red-700 truncate">« {s.athlete_comment} »</span>}
      {alerte === "surmenage" && <span className="flex items-center gap-1 text-[11px] font-bold text-red-700"><WarningCircle size={11} weight="fill" />très dur</span>}
    </button>
  );
}

/** « Un athlète » / « Toute l'équipe » : les deux vues du planning. */
export function Bascule({ equipe, lundi, athleteId }: { equipe: boolean; lundi: string; athleteId?: string | null }) {
  const un = `/coach/planning?${athleteId ? `athlete=${athleteId}&` : ""}semaine=${lundi}`;
  const tous = `/coach/planning?vue=equipe&semaine=${lundi}`;
  const cls = (on: boolean) => `px-3 py-[7px] rounded-[9px] ${on ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`;
  return (
    <div className="flex rounded-xl bg-slate-200/70 p-[3px] text-[13px] font-extrabold">
      <Link href={un} className={cls(!equipe)}>Un athlète</Link>
      <Link href={tous} className={cls(equipe)}>Toute l&apos;équipe</Link>
    </div>
  );
}
