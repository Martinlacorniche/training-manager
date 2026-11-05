"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dayjs from "dayjs";
import "dayjs/locale/fr";
import { ArrowLeft } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabaseClient";
import DemandeVsFait from "../../DemandeVsFait";
import StravaMetrics from "../../StravaMetrics";
import { ResultatTest } from "../../Tests";
import SuiviSeance from "../../SuiviSeance";
import Coque from "../../Coque";
import { SPORT_NOM } from "../../commun";
import { ROSE, superposerAdaptees } from "../../grossesse";

dayjs.locale("fr");

// L'analyse d'une séance sur le site, pour l'athlète et pour son coach : la
// RLS décide qui la voit. Pendant de l'écran d'analyse de l'app
// (App-Coach, app/session/[id].tsx).
function Seance() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [s, setS] = useState<any | null>(null);
  const [coachView, setCoachView] = useState(false);
  const [introuvable, setIntrouvable] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      const { data } = await supabase.from("sessions").select("*").eq("id", id).maybeSingle();
      if (!data) { setIntrouvable(true); return; }
      // Grossesse (15/10/2026) : SA version, chez elle seulement (jamais en vue coach).
      const mine = data.user_id === session.user.id;
      setS(mine ? (await superposerAdaptees([data]).catch(() => [data]))[0] : data);
      setCoachView(!mine);
    })();
  }, [id]);

  return (
    <div className="space-y-4 max-w-[1500px]">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800">
          <ArrowLeft size={16} /> Retour
        </button>
        {introuvable && <p className="text-slate-500">Séance introuvable, ou tu n&apos;y as pas accès.</p>}
        {s && (
          <>
            <header>
              <p className="text-sm font-bold text-slate-500 first-letter:uppercase">{dayjs(s.date).format("dddd D MMMM YYYY")} · {SPORT_NOM[s.sport] ?? s.sport}</p>
              <h1 className="text-[28px] font-extrabold text-slate-800">{s.title || "Séance"}</h1>
            </header>
            {/* Grand écran : l'analyse à gauche (8/12), ce qu'il en a dit et les consignes à droite (4/12). */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            <div className="xl:col-span-8 space-y-4 min-w-0">
              <SuiviSeance sessionId={s.id} sport={s.sport} rpe={s.rpe ?? null} date={s.date ?? null} coach={coachView} />
            </div>
            <div className="xl:col-span-4 space-y-4 min-w-0 xl:sticky xl:top-6">
            {s.test && <ResultatTest sessionId={s.id} protocole={s.test} texte={s.planned_inter} faite={s.status === "valide"} />}
            {s.planned_inter && !(s.test && s.status !== "valide") && (
              <section className="bg-white rounded-2xl border border-slate-200 p-4">
                <h3 className="font-bold mb-1" style={{ color: s.adaptee ? ROSE : "#1e293b" }}>{s.adaptee ? "Ta version" : "Consignes"}</h3>
                <p className="text-sm text-slate-600 whitespace-pre-line">{s.planned_inter}</p>
              </section>
            )}
            <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <DemandeVsFait data={s} coachView={coachView} />
              <StravaMetrics data={s} />
              {s.athlete_comment && <p className="text-sm text-slate-600 italic">« {s.athlete_comment} »</p>}
            </section>
            </div>
            </div>
          </>
        )}
    </div>
  );
}

export default function Page() {
  return <Coque titre="Séance"><Seance /></Coque>;
}
