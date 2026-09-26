"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// La carte « Chaleur » de Ma forme : court. Même carte que l'app (App-Coach,
// components/CarteChaleur.tsx). Le détail : le connecteur IA.
export function Chaleur({ userId, soi }: { userId: string; soi: boolean }) {
  const [d, setD] = useState<Record<string, any> | null>(null);
  useEffect(() => {
    supabase.functions.invoke("chaleur", { body: { athleteId: userId } }).then(({ data }) => setD(data ?? null));
  }, [userId]);
  if (!d || (!d.course && !d.preparer_ete && !d.saison)) return null;
  const pct = Math.round((d.acclimatation ?? 0) * 100), c = d.course;
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
      <h2 className="font-bold text-slate-800">☀️ Chaleur</h2>
      {c && (
        <div className="rounded-xl bg-orange-50 p-3 space-y-1">
          <p className="font-bold text-slate-800">{c.nom || "Ta course"}, {new Date(`${c.date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</p>
          <p className="text-sm text-slate-500">Prévu {c.temperature} °C, {c.humidite} % d&apos;humidité.</p>
          {c.conseils.slice(0, 3).map((x: string) => <p key={x} className="text-sm text-slate-700">• {x}</p>)}
        </div>
      )}
      {d.preparer_ete && <p className="text-sm text-slate-700">{soi ? "Tu es sensible" : "Sensible"} à la chaleur. Prépare l&apos;été : 10 jours avec une sortie facile au chaud, ou un bain chaud après l&apos;entraînement.</p>}
      {d.saison && (
        <>
          <p className="text-sm text-slate-700">Acclimaté à la chaleur : <strong>{pct} %</strong></p>
          <div className="h-1.5 rounded bg-slate-100"><div className="h-1.5 rounded bg-orange-600" style={{ width: `${Math.max(3, pct)}%` }} /></div>
          {d.sorties_restantes > 0 && <p className="text-xs text-slate-400">Encore environ {d.sorties_restantes} sorties au chaud (45 min et plus) pour être prêt.</p>}
        </>
      )}
    </section>
  );
}
