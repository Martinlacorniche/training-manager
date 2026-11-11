"use client";
// Écran de secours d'une page qui plante à l'affichage : l'erreur est remontée
// au développeur, la personne ne voit qu'un message simple (rien de technique).
import { useEffect } from "react";
import { signalerErreur } from "@/lib/erreurs";

export default function Erreur({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { signalerErreur(error, { barriere: true, digest: error.digest }); }, [error]);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-extrabold text-slate-900">Oups, quelque chose a cassé.</h1>
      <p className="max-w-sm text-[15px] text-slate-500">Rien n&apos;est perdu. Tu peux réessayer.</p>
      <button onClick={() => reset()} className="h-[52px] rounded-2xl bg-blue-600 px-8 text-[16px] font-extrabold text-white shadow-[0_10px_24px_rgba(37,99,235,0.35)] transition hover:bg-blue-700">
        Réessayer
      </button>
    </main>
  );
}
