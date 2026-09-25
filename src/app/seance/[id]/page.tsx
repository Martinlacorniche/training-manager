"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dayjs from "dayjs";
import "dayjs/locale/fr";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ArrowLeft } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabaseClient";
import DemandeVsFait from "../../DemandeVsFait";
import StravaMetrics from "../../StravaMetrics";
import SuiviSeance from "../../SuiviSeance";

dayjs.locale("fr");
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["500", "600", "700", "800"], display: "swap" });

// L'analyse d'une séance sur le site, pour l'athlète et pour son coach : la
// RLS décide qui la voit. Pendant de l'écran d'analyse de l'app
// (App-Coach, app/session/[id].tsx).
export default function Seance() {
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
      setS(data);
      setCoachView(data.user_id !== session.user.id);
    })();
  }, [id]);

  return (
    <main className={`${jakarta.className} min-h-screen bg-slate-100 px-4 py-8`}>
      <div className="max-w-2xl mx-auto space-y-4">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800">
          <ArrowLeft size={16} /> Retour
        </button>
        {introuvable && <p className="text-slate-500">Séance introuvable, ou tu n&apos;y as pas accès.</p>}
        {s && (
          <>
            <header>
              <p className="text-xs uppercase font-bold text-slate-400">{dayjs(s.date).format("dddd D MMMM YYYY")} · {s.sport}</p>
              <h1 className="text-2xl font-extrabold text-slate-800">{s.title || "Séance"}</h1>
            </header>
            {s.planned_inter && (
              <section className="bg-white rounded-2xl border border-slate-200 p-4">
                <h3 className="font-bold text-slate-800 mb-1">Consignes</h3>
                <p className="text-sm text-slate-600 whitespace-pre-line">{s.planned_inter}</p>
              </section>
            )}
            <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <DemandeVsFait data={s} coachView={coachView} />
              <StravaMetrics data={s} />
              {s.athlete_comment && <p className="text-sm text-slate-600 italic">« {s.athlete_comment} »</p>}
            </section>
            <SuiviSeance sessionId={s.id} sport={s.sport} rpe={s.rpe ?? null} />
          </>
        )}
      </div>
    </main>
  );
}
