"use client";
import { useEffect, useState } from "react";
import {
  Barbell, Bed, CheckCircle, CloudFog, CloudLightning, CloudSun, Heartbeat, Leaf, Lightbulb, Lightning,
  Moon, MoonStars, Smiley, Sun, WarningCircle, Watch,
} from "@phosphor-icons/react";
import { supabase } from "@/lib/supabaseClient";

// La météo du corps (Martin, 15/10/2026) — comme dans l'app (components/MeteoCorps.tsx) :
// l'état du jour dit comme une météo, quatre signaux (détail au clic), ce que ses
// nuits ont appris de lui (recup_athlete, seulement s'il prédit bien), et un mot
// sur la séance de demain. Peu de texte, pas de courbe. L'athlète seul.

type EtatDomaine = { domaine: string; niveau: string; raison: string; jour: string };
type Recup = {
  lisible: boolean; n_nuits: number; nuits_seance_dure: number | null; facteur: string | null;
  pourquoi_pas: string | null; rupture: string | null; montre: string | null;
  demain: { jour: string; niveau: "pret" | "juste" | "facile"; titre: string; phrase: string } | null;
};

const CIEL: Record<string, { mot: string; Icone: any; fond: string }> = {
  habituel: { mot: "Grand beau", Icone: Sun, fond: "linear-gradient(135deg,#0ea5e9,#38bdf8 55%,#fbbf24)" },
  a_surveiller: { mot: "Éclaircies", Icone: CloudSun, fond: "linear-gradient(135deg,#475569,#0ea5e9 60%,#7dd3fc)" },
  ecart: { mot: "Orageux", Icone: CloudLightning, fond: "linear-gradient(135deg,#1e293b,#4c1d95 60%,#7c3aed)" },
  inconnu: { mot: "On fait connaissance", Icone: CloudFog, fond: "linear-gradient(135deg,#0f766e,#14b8a6 60%,#99f6e4)" },
};
const PASTILLE: Record<string, string> = { habituel: "#22c55e", a_surveiller: "#f59e0b", ecart: "#f43f5e", inconnu: "#cbd5e1" };
const SIGNAUX = [
  { domaine: "recuperation", nom: "Nuits", Icone: MoonStars },
  { domaine: "sommeil", nom: "Sommeil", Icone: Bed },
  { domaine: "ressenti", nom: "Ressenti", Icone: Smiley },
  { domaine: "performance", nom: "Cœur", Icone: Heartbeat },
];
const FACTEUR: Record<string, { mot: string; Icone: any; dit: string }> = {
  charge: { mot: "La quantité", Icone: Barbell, dit: "Chez toi, c'est surtout la durée et la dureté de la journée qui marquent tes nuits." },
  intensite: { mot: "L'intensité", Icone: Lightning, dit: "Chez toi, ce sont surtout les séances rapides qui marquent tes nuits, plus que la durée." },
  sommeil: { mot: "Le sommeil", Icone: Bed, dit: "Chez toi, une courte nuit pèse plus sur ta récupération que l'entraînement lui-même." },
};
const DEMAIN: Record<string, { Icone: any; couleur: string; fond: string }> = {
  pret: { Icone: CheckCircle, couleur: "#15803d", fond: "#dcfce7" },
  juste: { Icone: WarningCircle, couleur: "#b45309", fond: "#fef3c7" },
  facile: { Icone: Leaf, couleur: "#0369a1", fond: "#e0f2fe" },
};
const N_MIN = 60;
const premiere = (r: string) => { const i = r.search(/(?<=\.)\s/); return i > 0 ? r.slice(0, i) : r; };
const hm = (s: number) => `${Math.floor(s / 3600)} h ${String(Math.round((s % 3600) / 60)).padStart(2, "0")}`;

export function MeteoCorps({ userId, etats, sommeilNuit }: { userId: string; etats: EtatDomaine[]; sommeilNuit: number | null }) {
  const [recup, setRecup] = useState<Recup | null>(null);
  const [pop, setPop] = useState<{ titre: string; texte: string; petit?: string } | null>(null);
  useEffect(() => {
    supabase.from("recup_athlete").select("lisible, n_nuits, nuits_seance_dure, facteur, pourquoi_pas, rupture, montre, demain")
      .eq("user_id", userId).maybeSingle().then(({ data }) => setRecup((data as Recup) ?? null));
  }, [userId]);

  const global = etats.find((e) => e.domaine === "global");
  if (!global) return null;
  const ciel = CIEL[global.niveau] ?? CIEL.inconnu;
  const de = (d: string) => etats.find((e) => e.domaine === d);
  const auj = new Date().toLocaleDateString("sv-SE");
  const nouvelleMontre = recup?.rupture && Date.parse(recup.rupture) > Date.now() - 63 * 86_400_000;
  const demain = recup?.demain && recup.demain.jour > auj ? recup.demain : null;
  const autres = etats.filter((e) => !["global", ...SIGNAUX.map((s) => s.domaine)].includes(e.domaine));
  const nd = recup?.nuits_seance_dure ?? 0;

  return (
    <div className="space-y-2.5">
      <style>{`@keyframes flotte{0%,100%{transform:translateY(0)}50%{transform:translateY(8px)}}`}</style>
      <button onClick={() => setPop({ titre: ciel.mot, texte: global.raison, petit: autres.map((e) => `${e.domaine === "mecanique" ? "Foulée" : "Volume"} : ${premiere(e.raison)}`).join("\n") || undefined })}
        className="relative w-full overflow-hidden rounded-3xl p-6 text-left text-white" style={{ background: ciel.fond }}>
        <ciel.Icone size={150} weight="fill" className="absolute -right-5 -top-5 text-white/90" style={{ animation: "flotte 5.2s ease-in-out infinite" }} />
        <p className="text-xs font-extrabold uppercase tracking-widest text-white/85">Météo du corps</p>
        <p className="mt-1.5 max-w-[70%] text-3xl font-black">{ciel.mot}</p>
        <p className="mt-1.5 max-w-[78%] text-[15px] font-semibold leading-snug">{premiere(global.raison)}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {sommeilNuit ? <Bulle Icone={Bed} texte={`Cette nuit ${hm(sommeilNuit)}`} /> : null}
          {nouvelleMontre ? <Bulle Icone={Watch} texte="Nouvelle montre" /> : null}
        </div>
      </button>

      <div className="grid grid-cols-4 gap-2">
        {SIGNAUX.map((s) => {
          const e = de(s.domaine); const n = e?.niveau ?? "inconnu";
          return (
            <button key={s.domaine} onClick={() => setPop({ titre: s.nom, texte: e?.raison ?? "Pas encore de données." })}
              className="flex flex-col items-center rounded-2xl border border-slate-100 bg-white py-3 hover:bg-slate-50">
              <span className="relative">
                <s.Icone size={26} weight="duotone" className={n === "inconnu" ? "text-slate-400" : "text-slate-900"} />
                <span className="absolute -right-1.5 -top-1 h-3 w-3 rounded-full border-2 border-white" style={{ background: PASTILLE[n] }} />
              </span>
              <span className="mt-1.5 text-xs font-extrabold text-slate-700">{s.nom}</span>
            </button>
          );
        })}
      </div>

      {recup?.lisible && nd ? (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setPop({ titre: "Après une grosse séance", texte: `Il te faut en général ${nd === 1 ? "une nuit" : `${nd} nuits`} pour revenir à ta normale.`, petit: `Appris sur tes ${recup.n_nuits} dernières nuits : ce qu'a fait ton cœur après chacune de tes séances.` })}
            className="rounded-2xl bg-indigo-950 p-4 text-left">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-indigo-200">Grosse séance</p>
            <div className="mt-2.5 flex gap-1">
              {[0, 1, 2].map((i) => <Moon key={i} size={22} weight="fill" className={i < nd ? "text-amber-200" : "text-white/20"} />)}
            </div>
            <p className="mt-2 font-black text-white">{nd === 1 ? "1 nuit" : `${nd} nuits`} pour t&apos;en remettre</p>
          </button>
          {recup.facteur && FACTEUR[recup.facteur] && (() => {
            const f = FACTEUR[recup.facteur!];
            return (
              <button onClick={() => setPop({ titre: "Ce qui te pèse le plus", texte: f.dit })} className="rounded-2xl bg-violet-50 p-4 text-left">
                <p className="text-[11px] font-extrabold uppercase tracking-wide text-violet-700">Ce qui te pèse</p>
                <f.Icone size={30} weight="duotone" className="mt-1.5 text-violet-600" />
                <p className="mt-1 font-black text-indigo-950">{f.mot}</p>
              </button>
            );
          })()}
        </div>
      ) : recup ? (
        <button onClick={() => setPop({ titre: "Ton corps", texte: "Chaque nuit, on regarde comment ton cœur réagit à ce que tu as fait la veille. Bientôt, on saura combien de nuits il te faut après une grosse séance, et ce qui te fatigue le plus.", petit: recup.pourquoi_pas && !recup.pourquoi_pas.startsWith("il faut") ? `Pour l'instant : ${recup.pourquoi_pas}.` : undefined })}
          className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-left">
          <Lightbulb size={24} weight="duotone" className="text-violet-600" />
          <div className="flex-1">
            <p className="text-sm font-extrabold text-slate-900">On apprend comment ton corps récupère</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-violet-100">
              <div className="h-1.5 rounded-full bg-violet-600" style={{ width: `${Math.min(100, Math.round((recup.n_nuits / N_MIN) * 100))}%` }} />
            </div>
          </div>
          <span className="text-xs font-extrabold text-violet-600">{Math.min(recup.n_nuits, N_MIN)}/{N_MIN}</span>
        </button>
      ) : null}

      {demain && (() => {
        const d = DEMAIN[demain.niveau];
        return (
          <div className="flex items-center gap-3 rounded-2xl p-4" style={{ background: d.fond }}>
            <d.Icone size={26} weight="fill" style={{ color: d.couleur }} />
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: d.couleur }}>Demain · {demain.titre}</p>
              <p className="text-sm font-bold text-slate-900">{demain.phrase}</p>
            </div>
          </div>
        );
      })()}

      {pop && (
        <div onClick={() => setPop(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-6">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl bg-white p-5">
            <p className="text-lg font-black text-slate-900">{pop.titre}</p>
            <p className="mt-2.5 whitespace-pre-line text-[15px] leading-relaxed text-slate-900">{pop.texte}</p>
            {pop.petit && <p className="mt-2.5 whitespace-pre-line text-sm text-slate-500">{pop.petit}</p>}
            <p className="mt-3 text-xs text-slate-400">Comparé à toi-même, jamais aux autres. Ton coach ne voit pas tes chiffres.</p>
            <div className="mt-2 text-right"><button onClick={() => setPop(null)} className="px-3 py-1.5 font-extrabold text-blue-600">OK</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function Bulle({ Icone, texte }: { Icone: any; texte: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-xs font-extrabold text-white">
      <Icone size={14} weight="bold" />{texte}
    </span>
  );
}
