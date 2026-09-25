"use client";
import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import { supabase } from "@/lib/supabaseClient";

// L'état d'un athlète, vu par son COACH : niveau par domaine et une phrase,
// jamais de chiffre de santé. Lu par etats_de_mes_athletes(), qui ne rend
// rien si l'athlète a coupé le partage. Calculé côté serveur, sans IA
// (App-Coach, supabase/functions/analyse) — l'app montre le même.

type Etat = { user_id: string; jour: string; domaine: string; niveau: string; confiance: string; raison: string };

const DOMAINE: Record<string, string> = {
  recuperation: "Récupération", sommeil: "Sommeil", ressenti: "Ressenti",
  performance: "Forme", mecanique: "Foulée", volume: "Volume",
};
const STYLE: Record<string, { pastille: string; texte: string; libelle: string }> = {
  habituel: { pastille: "bg-emerald-500", texte: "text-emerald-700", libelle: "Habituel" },
  a_surveiller: { pastille: "bg-amber-500", texte: "text-amber-700", libelle: "À surveiller" },
  ecart: { pastille: "bg-rose-500", texte: "text-rose-700", libelle: "Écart marqué" },
  inconnu: { pastille: "bg-slate-300", texte: "text-slate-400", libelle: "Pas assez de données" },
};

export default function EtatAthlete({ athleteId }: { athleteId: string }) {
  const [etats, setEtats] = useState<Etat[] | null>(null);

  useEffect(() => {
    let annule = false;
    setEtats(null);
    supabase.rpc("etats_de_mes_athletes", { p_depuis: dayjs().subtract(3, "day").format("YYYY-MM-DD") })
      .then(({ data }) => {
        if (annule) return;
        const miens = ((data ?? []) as Etat[]).filter((e) => e.user_id === athleteId);
        const dernier = miens.reduce((j, e) => (e.jour > j ? e.jour : j), "");
        setEtats(miens.filter((e) => e.jour === dernier));
      });
    return () => { annule = true; };
  }, [athleteId]);

  if (etats === null) return <div className="text-xs text-slate-300 italic">…</div>;
  if (!etats.length) return <div className="text-xs text-slate-300 italic">Non partagé</div>;
  const global = etats.find((e) => e.domaine === "global");
  const signaux = etats.filter((e) => e.domaine !== "global" && (e.niveau === "a_surveiller" || e.niveau === "ecart"));
  const s = STYLE[global?.niveau ?? "inconnu"];

  return (
    <div className="relative group cursor-help">
      <div className={`flex items-center gap-1.5 text-xs font-bold ${s.texte}`}>
        <span className={`h-2.5 w-2.5 rounded-full ${s.pastille}`} />
        {s.libelle}{global?.confiance === "provisoire" ? " ·" : ""}
      </div>
      <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-72 p-3 bg-slate-800 text-white text-xs rounded-xl shadow-xl z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none space-y-1.5 text-left">
        {signaux.length
          ? signaux.map((e) => <div key={e.domaine}><strong>{DOMAINE[e.domaine]} :</strong> {e.raison}</div>)
          : <div>{global?.raison ?? "Rien d'inhabituel."}</div>}
        <div className="text-slate-400 pt-1 border-t border-slate-700">
          Comparé à sa propre normale, au {dayjs(global?.jour).format("DD/MM")}{global?.confiance === "provisoire" ? " · provisoire (sa normale se construit)" : ""}. Jamais un diagnostic.
        </div>
      </div>
    </div>
  );
}
