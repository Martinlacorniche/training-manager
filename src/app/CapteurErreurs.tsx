"use client";
// Écoute les erreurs que React ne voit pas (gestionnaires d'événements, code
// asynchrone, promesses sans `catch`) et les remonte. Ne dessine rien.
// Celles qui se produisent pendant l'affichage passent par error.tsx.
import { useEffect } from "react";
import { signalerErreur } from "@/lib/erreurs";

export default function CapteurErreurs() {
  useEffect(() => {
    const surErreur = (e: ErrorEvent) => { signalerErreur(e.error ?? e.message, { fichier: e.filename, ligne: e.lineno }); };
    const surPromesse = (e: PromiseRejectionEvent) => { signalerErreur(e.reason, { promesse: true }); };
    window.addEventListener("error", surErreur);
    window.addEventListener("unhandledrejection", surPromesse);
    return () => {
      window.removeEventListener("error", surErreur);
      window.removeEventListener("unhandledrejection", surPromesse);
    };
  }, []);
  return null;
}
