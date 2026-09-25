"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Le partage de l'état avec le coach est activé d'office, mais l'athlète en
// est INFORMÉ une fois et peut le couper : l'état « récupération » vient de
// sa VFC et de son sommeil, des données de santé. Seulement pour un athlète
// coaché ET branché à intervals.icu (les seuls dont on a des données de
// santé). Même écran que l'app (App-Coach, app/athlete.tsx) : vu d'un côté,
// il n'apparaît plus de l'autre (`partage_informe_le`).

type Athlete = { id_auth: string; coach_id?: string | null; partage_etat_coach?: boolean | null; partage_informe_le?: string | null };

export default function PartageCoachInfo({ athlete }: { athlete: Athlete | null }) {
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(true);

  useEffect(() => {
    if (!athlete?.id_auth || athlete.partage_informe_le) return;
    if (!athlete.coach_id || athlete.coach_id === athlete.id_auth) return;
    supabase.rpc("intervals_est_connecte").then(({ data }) => {
      if (!data) return;
      setActif(athlete.partage_etat_coach !== false);
      setOuvert(true);
    });
  }, [athlete?.id_auth]);

  if (!ouvert || !athlete) return null;

  async function valider() {
    setOuvert(false);
    await supabase.from("users")
      .update({ partage_etat_coach: actif, partage_informe_le: new Date().toISOString() })
      .eq("id_auth", athlete!.id_auth);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 space-y-3">
        <h3 className="text-xl font-extrabold text-slate-800 text-center">Ton coach voit ton état de forme</h3>
        <p className="text-sm text-slate-600 leading-relaxed">
          Avec tes séances et ta montre, l&apos;app calcule chaque jour où tu en es : récupération, sommeil, ressenti, forme, foulée. Ton coach voit le <strong>niveau</strong> (habituel, à surveiller, écart) et une phrase d&apos;explication.
        </p>
        <p className="text-sm text-slate-600 leading-relaxed">
          Il ne voit <strong>jamais</strong> tes chiffres de santé : VFC, FC de repos, sommeil. Ceux-là restent pour toi.
        </p>
        <label className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 font-semibold text-slate-800 text-sm">
          Partager mon état avec mon coach
          <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} className="h-5 w-5 accent-blue-600" />
        </label>
        <p className="text-xs text-slate-400">Modifiable à tout moment dans Réglages.</p>
        <button onClick={valider} className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700">OK</button>
      </div>
    </div>
  );
}
