import { supabase } from "@/lib/supabaseClient";

// Les tests de forme côté site : le calcul est sur le serveur (App-Coach,
// supabase/functions/tests et analyse). Mêmes textes que l'app
// (App-Coach, lib/tests.ts et components/ConsignesTest.tsx).

export type Protocole = "progressif" | "tranquille" | "lsct" | "defi";

export const PROTOCOLES: Record<Protocole, { titre: string; quoi: string }> = {
  progressif: { titre: "Pré-test au stade", quoi: "À faire une fois avant les tests course : il mesure ta VMA et ton cœur max, et fixe les allures de tes tests." },
  tranquille: { titre: "Test forme course", quoi: "Tous les mois, 2 × 6 min à allure fixe, sans forcer. Si ton cœur bat moins vite qu'avant, tu as progressé." },
  lsct: { titre: "Test forme vélo", quoi: "Tous les mois, sur home-trainer : 3 paliers à cœur fixe. Si tu pousses plus fort pour le même cœur, tu as progressé." },
  defi: { titre: "Mini-défi 3 + 12 min", quoi: "Pas obligatoire. Il mesure ton allure 10 km si tu n'as pas fait de course récemment. Pas plus d'une fois tous les 2 à 3 mois." },
};

export const VERDICTS: Record<string, { libelle: string; couleur: string }> = {
  repetition: { libelle: "1er test", couleur: "text-slate-500" },
  stable: { libelle: "Pareil qu'avant", couleur: "text-blue-600" },
  probable_progres: { libelle: "Ça progresse ?", couleur: "text-emerald-600" },
  net_progres: { libelle: "Tu progresses", couleur: "text-emerald-700" },
  probable_baisse: { libelle: "Un peu moins bien", couleur: "text-amber-600" },
  net_baisse: { libelle: "Moins bien", couleur: "text-rose-600" },
  fatigue_possible: { libelle: "Fatigué ?", couleur: "text-amber-600" },
  ecarte: { libelle: "Ne compte pas", couleur: "text-slate-400" },
};

export const CONSIGNES: Record<string, string[]> = {
  progressif: [
    "Au stade, sur la piste.",
    "Reposé : rien de dur les 2 jours avant.",
    "Lance la séance sur ta montre : elle te donne l'allure de chaque minute, un peu plus vite à chaque fois.",
    "Va jusqu'au bout : arrête-toi seulement quand tu ne peux plus suivre. C'est dur, c'est normal, c'est ce qui rend le test juste.",
    "Une ou deux fois par an suffit.",
  ],
  tranquille: [
    "Même parcours plat, même heure.",
    "Reposé : rien de dur les 2 jours avant.",
    "Suis l'allure affichée sur ta montre, même si tu te sens bien.",
    "Malade ou très chaud ? Reporte.",
  ],
  lsct: [
    "Sur home-trainer, obligatoirement.",
    "Reposé : rien de dur les 2 jours avant.",
    "Garde ton cœur autour de la cible affichée : pédale plus ou moins fort pour y rester.",
    "Fais le zéro de ton capteur de puissance avant.",
  ],
  defi: [
    "Il sert seulement à mesurer ton allure 10 km si tu n'as pas fait de course récemment. Pas obligatoire.",
    "Bien reposé, sur piste ou parcours plat, sans arrêt.",
    "Les deux efforts vraiment à fond, et récupère bien entre les deux.",
    "Pas plus d'une fois tous les 2 à 3 mois.",
  ],
};

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
