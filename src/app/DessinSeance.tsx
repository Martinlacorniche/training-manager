"use client";
// Dessin de la séance prévue (pendant web de App-Coach/components/seance/DessinSeance.tsx) :
// largeur = durée, hauteur = effort. Jamais de rouge. Rend null si le texte est
// illisible ou trop court : l'appelant garde alors le texte seul.
import { useEffect, useMemo, useState } from "react";
import { CaretDown, CaretRight } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabaseClient";
import { lireDessin, legende, effortMots, dureeMots, type Niveau, type PartieDessin } from "./dessin-seance";

const HAUT = 96, BLEU = "#a9c8f5";
const HAUTEUR: Record<Niveau, number> = { tranquille: 0.36, moyen: 0.62, vite: 1 };
const COULEUR_MOT: Record<Niveau, string> = { tranquille: "#3b82f6", moyen: "#2563eb", vite: "#c2410c" };
const FOND: Record<Niveau, string> = { tranquille: BLEU, moyen: "#fdba74", vite: "#f99a24" };
const ARRONDI = "5px 5px 2px 2px";

// La FTP de l'athlète à qui appartient la séance, seulement pour un vélo.
export function useFtp(userId: string | null | undefined, sport: string | null | undefined): number | null {
  const [ftp, setFtp] = useState<number | null>(null);
  const veut = !!userId && sport === "Vélo";
  useEffect(() => {
    if (!veut) return;
    let vivant = true;
    supabase.from("athlete_metrics").select("ftp_w").eq("user_id", userId).maybeSingle()
      .then(({ data }) => { if (vivant) setFtp(data && Number(data.ftp_w) > 0 ? Number(data.ftp_w) : null); });
    return () => { vivant = false; };
  }, [userId, veut]);
  return veut ? ftp : null;
}

function Mini({ niveau, petit }: { niveau: Niveau; petit: boolean }) {
  const w = petit ? 6 : niveau === "vite" ? 9 : 18, h = petit ? 5 : niveau === "vite" ? 22 : niveau === "moyen" ? 14 : 8;
  return (
    <div className="flex h-[22px] w-[22px] shrink-0 items-end justify-center">
      <div style={{ width: w, height: h, borderRadius: "3px 3px 1px 1px", background: FOND[niveau] }} />
    </div>
  );
}

function Frise({ parties }: { parties: PartieDessin[] }) {
  const total = (p: PartieDessin) => p.etapes.reduce((a, e) => a + e.secondes, 0) * p.repetitions;
  return (
    <div>
      <div className="flex items-end gap-[3px]">
        {parties.map((p, i) => {
          const large = p.repetitions === 1;
          const e0 = p.etapes[0];
          const mot = large ? dureeMots(e0.secondes) : `${p.repetitions} fois ${effortMots(e0)}`;
          const h = Math.round(HAUT * Math.max(...p.etapes.map((e) => HAUTEUR[e.niveau])));
          return (
            <div key={i} className="flex min-w-0 flex-col justify-end" style={{ flexGrow: Math.max(total(p), 1), flexBasis: large ? 0 : 33 }}>
              {(large ? total(p) >= 420 || e0.niveau !== "tranquille" : true) && (
                <div className="mb-[5px] truncate text-center text-[11px] font-extrabold" style={{ color: COULEUR_MOT[e0.niveau] }}>{mot}</div>
              )}
              <div className="flex items-end gap-[3px]" style={{ height: h }}>
                {Array.from({ length: p.repetitions }).flatMap((_, r) =>
                  p.etapes.map((e, k) => (
                    <div key={`${r}-${k}`} style={{ flexGrow: e.secondes, flexBasis: 0, minWidth: 0, borderRadius: ARRONDI, background: FOND[e.niveau],
                      height: p.repetitions > 1 && k > 0 ? Math.round(HAUT * 0.2) : Math.round(HAUT * HAUTEUR[e.niveau]) }} />
                  )))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-[3px] h-[2px] rounded-sm bg-slate-200" />
    </div>
  );
}

export default function DessinSeance({ texte, workoutText, ftp }: { texte: string; workoutText: string | null | undefined; ftp?: number | null }) {
  const parties = useMemo(() => lireDessin(workoutText), [workoutText]);
  const lignes = useMemo(() => legende(parties, ftp), [parties, ftp]);
  const [ouvert, setOuvert] = useState(false);
  if (parties.length < 2) return null;
  return (
    <div className="space-y-3.5">
      <Frise parties={parties} />
      <div>
        {lignes.map((l, i) => (
          <div key={i} className={`flex items-center gap-3 py-2.5 ${i ? "border-t border-slate-900/[0.07]" : ""}`}>
            <Mini niveau={l.niveau} petit={l.petit} />
            <span className="flex-1 text-[15px] font-bold text-slate-900">{l.texte}</span>
            {l.valeur ? <span className="text-sm font-bold text-slate-500">{l.valeur}</span> : null}
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setOuvert((o) => !o)} aria-expanded={ouvert}
        className="flex min-h-10 w-full items-center justify-center gap-1 border-t border-slate-900/[0.07] pt-1 text-[15px] font-bold text-slate-500 hover:text-slate-700">
        Lire les mots du coach {ouvert ? <CaretDown size={16} weight="bold" /> : <CaretRight size={16} weight="bold" />}
      </button>
      {ouvert && <p className="whitespace-pre-line text-[15px] font-semibold leading-6 text-slate-800">{texte}</p>}
    </div>
  );
}
