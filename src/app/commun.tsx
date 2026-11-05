// Ce que le site partage avec l'app (App-Coach) : couleurs des sports, état
// d'une séance, alerte coach, initiales. Mêmes règles que lib/coachHelpers.ts
// et app/athleteConstants.ts, pour que coach et athlète voient la même chose
// partout.
import React from "react";
import { Bicycle, Barbell, Mountains, PersonSimpleRun, SwimmingPool, Sneaker } from "@phosphor-icons/react";

export const SPORTS = ["Run", "Vélo", "Natation", "Trail", "Renfo", "Muscu", "Autre"] as const;

export const SPORT_COULEUR: Record<string, string> = {
  Run: "#2563eb", Trail: "#16a34a", "Vélo": "#7c3aed", Natation: "#06b6d4",
  Renfo: "#f59e0b", Muscu: "#f59e0b", Autre: "#64748b",
};

export const SPORT_NOM: Record<string, string> = {
  Run: "Course", Trail: "Trail", "Vélo": "Vélo", Natation: "Natation", Renfo: "Renfo", Muscu: "Muscu", Autre: "Autre",
};

export function IconeSport({ sport, size = 16, color }: { sport?: string | null; size?: number; color?: string }) {
  const p = { size, color: color ?? SPORT_COULEUR[sport ?? "Autre"] ?? "#64748b", weight: "bold" as const };
  switch (sport) {
    case "Vélo": return <Bicycle {...p} />;
    case "Run": return <PersonSimpleRun {...p} />;
    case "Natation": return <SwimmingPool {...p} />;
    case "Trail": return <Mountains {...p} />;
    case "Renfo": case "Muscu": return <Barbell {...p} />;
    default: return <Sneaker {...p} />;
  }
}

export const INTENSITE: Record<string, { nom: string; couleur: string; fond: string; bord: string }> = {
  basse: { nom: "Facile", couleur: "#047857", fond: "#ecfdf5", bord: "#a7f3d0" },
  moyenne: { nom: "Moyen", couleur: "#b45309", fond: "#fffbeb", bord: "#fde68a" },
  haute: { nom: "Difficile", couleur: "#be123c", fond: "#fff1f2", bord: "#fecaca" },
};

// Mots de douleur en DÉBUT de mot : « normal » ne déclenche pas « mal ».
export const DOULEUR = /(^|[^a-zà-ÿ])(mal|douleur|bless|gên|gene|bobo)/i;

export type Alerte = "douleur" | "surmenage";
export function alerteSeance(s: { athlete_comment?: string | null; status?: string | null; intensity?: string | null; rpe?: number | null }): Alerte | null {
  if (s.athlete_comment && DOULEUR.test(s.athlete_comment)) return "douleur";
  // Séance prévue facile, ressentie comme très dure.
  if (s.status === "valide" && s.intensity === "basse" && (s.rpe ?? 0) > 8) return "surmenage";
  return null;
}

export type Etat = "faite" | "pas_faite" | "pas_renseignee" | "a_faire";
export function etatSeance(s: { status?: string | null; date: string }, aujourdhui: string): Etat {
  if (s.status === "valide") return "faite";
  if (s.status === "non_valide") return "pas_faite";
  if (s.date < aujourdhui) return "pas_renseignee";
  return "a_faire";
}
export const ETAT: Record<Etat, { nom: string; couleur: string; fond: string }> = {
  faite: { nom: "Faite", couleur: "#15803d", fond: "#dcfce7" },
  pas_faite: { nom: "Pas faite", couleur: "#b91c1c", fond: "#fee2e2" },
  pas_renseignee: { nom: "Pas renseignée", couleur: "#b45309", fond: "#fef3c7" },
  a_faire: { nom: "Prévue", couleur: "#475569", fond: "#e2e8f0" },
};

export function initiales(nom?: string | null): string {
  const p = (nom ?? "").trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "?") + (p[1]?.[0] ?? "")).toUpperCase();
}

// Un fond pastel stable par personne, comme des initiales de messagerie.
const TEINTES = [
  ["#e0e7ff", "#3730a3"], ["#fee2e2", "#991b1b"], ["#dcfce7", "#166534"], ["#fef3c7", "#92400e"],
  ["#e0f2fe", "#075985"], ["#f3e8ff", "#6b21a8"], ["#ffe4e6", "#9f1239"], ["#ccfbf1", "#115e59"],
];
export function Avatar({ id, nom, taille = 32 }: { id: string; nom?: string | null; taille?: number }) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const [fond, texte] = TEINTES[Math.abs(h) % TEINTES.length];
  return (
    <span className="shrink-0 rounded-full flex items-center justify-center font-extrabold"
      style={{ width: taille, height: taille, background: fond, color: texte, fontSize: Math.round(taille * 0.36) }}>
      {initiales(nom)}
    </span>
  );
}

// Durée en heures décimales → « 1 h 15 », « 45 min ».
export function duree(h?: number | null): string {
  if (h == null || !(h > 0)) return "";
  const t = Math.round(h * 60);
  const H = Math.floor(t / 60), M = t % 60;
  if (!H) return `${M} min`;
  return M ? `${H} h ${String(M).padStart(2, "0")}` : `${H} h`;
}

// « 1h15 », « 1h », « 45 », « 45' », « 1:30 » → heures décimales.
export function lireDuree(t: string): number | null {
  const s = t.trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;
  let m = s.match(/^(\d{1,2})[h:](\d{1,2})?(min|m|')?$/);
  if (m) return Number(m[1]) + (m[2] ? Number(m[2]) / 60 : 0);
  m = s.match(/^(\d{1,3})(min|m|'|′)?$/);
  if (m) return Number(m[1]) / 60;
  return null;
}

// Un bandeau en bas de l'écran : « 5 séances copiées · Annuler ». Il remplace
// les confirm() et alert() : on agit tout de suite, on peut défaire.
export type Message = { texte: string; annuler?: () => void | Promise<void> };
export function Bandeau({ message, onFin }: { message: Message | null; onFin: () => void }) {
  React.useEffect(() => {
    if (!message) return;
    const t = setTimeout(onFin, message.annuler ? 8000 : 4000);
    return () => clearTimeout(t);
  }, [message, onFin]);
  if (!message) return null;
  return (
    <div role="status" className="fixed bottom-5 left-1/2 -translate-x-1/2 lg:ml-30 z-[60] flex items-center gap-4 rounded-2xl bg-slate-900 text-white pl-5 pr-2 py-2 shadow-2xl">
      <span className="text-sm font-bold">{message.texte}</span>
      {message.annuler && (
        <button onClick={async () => { await message.annuler!(); onFin(); }} className="rounded-xl bg-white/15 hover:bg-white/25 px-3 py-1.5 text-sm font-extrabold">Annuler</button>
      )}
      {!message.annuler && <span className="w-1" />}
    </div>
  );
}
