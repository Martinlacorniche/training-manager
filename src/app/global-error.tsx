"use client";
// Dernier filet : quand c'est le layout racine lui-même qui plante. Cette page
// remplace tout le document, donc elle porte ses propres <html> et <body> et
// n'a ni la police ni les classes du site à coup sûr : styles en ligne.
import { useEffect } from "react";
import { signalerErreur } from "@/lib/erreurs";

export default function ErreurGlobale({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { signalerErreur(error, { barriere: true, globale: true, digest: error.digest }); }, [error]);
  return (
    <html lang="fr">
      <body style={{ margin: 0, background: "#fbfcfe", color: "#1e293b", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24, textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Oups, quelque chose a cassé.</h1>
          <p style={{ margin: 0, maxWidth: 360, fontSize: 15, color: "#64748b" }}>Rien n&apos;est perdu. Tu peux réessayer.</p>
          <button onClick={() => reset()} style={{ height: 52, padding: "0 32px", border: 0, borderRadius: 16, background: "#2563eb", color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer" }}>
            Réessayer
          </button>
        </main>
      </body>
    </html>
  );
}
