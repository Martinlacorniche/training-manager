import { supabase } from "@/lib/supabaseClient";

// Les tests de forme côté site : le calcul est sur le serveur (App-Coach,
// supabase/functions/tests et analyse). Mêmes textes que l'app
// (App-Coach, lib/tests.ts et components/ConsignesTest.tsx).

export type Protocole = "tranquille" | "lsct" | "defi";

export const PROTOCOLES: Record<Protocole, { titre: string; sport: string; quoi: string; frequence: string }> = {
  tranquille: { titre: "Test tranquille", sport: "Course", quoi: "2 × 6 min à allure fixe, sans forcer. On regarde ton cœur : s'il bat moins vite qu'avant, tu as progressé.", frequence: "Toutes les 4 semaines" },
  lsct: { titre: "Test tranquille", sport: "Vélo", quoi: "3 paliers à fréquence cardiaque fixe. On regarde ta puissance : si tu pousses plus fort pour le même cœur, tu as progressé.", frequence: "Toutes les 3 à 4 semaines" },
  defi: { titre: "Mini-défi 3 + 12 min", sport: "Course", quoi: "Deux efforts à fond, 3 min puis 12 min. Il mesure ton allure 10 km quand l'entraînement ne suffit pas.", frequence: "Pas plus d'une fois tous les 2 à 3 mois" },
};

export const VERDICTS: Record<string, { libelle: string; couleur: string }> = {
  repetition: { libelle: "Répétition", couleur: "text-slate-500" },
  stable: { libelle: "Stable", couleur: "text-blue-600" },
  probable_progres: { libelle: "Probable progrès", couleur: "text-emerald-600" },
  net_progres: { libelle: "Progrès", couleur: "text-emerald-700" },
  probable_baisse: { libelle: "Un peu moins bien", couleur: "text-amber-600" },
  net_baisse: { libelle: "Moins bien", couleur: "text-rose-600" },
  fatigue_possible: { libelle: "Fatigue possible", couleur: "text-amber-600" },
  ecarte: { libelle: "Ne compte pas", couleur: "text-slate-400" },
};

export const CONSIGNES = [
  "Même parcours à chaque fois, bien plat. Même heure de préférence.",
  "Reposé : pas de séance dure ni de course dans les 2 jours avant.",
  "Au début de ta sortie, après l'échauffement. Jamais à la fin.",
  "Même montre, et la ceinture cardio si tu en as une.",
  "Tiens l'allure demandée, pas plus vite même si tu te sens bien : le test mesure ton cœur, pas tes jambes.",
  "Malade, mal dormi, ou très chaud dehors ? Reporte, le test ne vaudrait rien.",
  "À la fin, note l'effort ressenti comme d'habitude.",
  "Le premier test sert de répétition : on compare à partir du deuxième.",
];
export const CONSIGNES_DEFI = [
  "Bien reposé, comme avant une course.",
  "Sur piste ou parcours plat, sans arrêt ni feu rouge.",
  "Les deux efforts vraiment à fond : c'est ce qui rend le résultat juste.",
  "Récupère complètement entre les deux (20 min très facile).",
  "Pas plus d'une fois tous les 2 à 3 mois.",
];
export const CONSIGNE_VELO = "Vélo : home-trainer de préférence, et fais le zéro de ton capteur de puissance avant de partir.";

async function appeler(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("tests", { body });
  if (error) {
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(detail?.error ?? error.message);
  }
  return data;
}
export const apercuTest = (athleteId: string, protocole: Protocole) => appeler({ mode: "apercu", athleteId, protocole });
export const programmerTest = (athleteId: string, protocole: Protocole, date: string) => appeler({ mode: "programmer", athleteId, protocole, date });

export const allure = (v: unknown) => {
  const x = Number(v);
  if (!Number.isFinite(x) || x <= 0) return "—";
  const s = Math.round(1000 / x);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
