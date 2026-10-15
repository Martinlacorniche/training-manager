import { supabase } from "@/lib/supabaseClient";

// ─────────────────────────────────────────────────────────────────────────
// Le mode grossesse (15/10/2026), comme dans l'app (App-Coach,
// lib/grossesse.ts). Tables à part (grossesse, grossesse_rdv), protégées par
// la base : l'athlète voit tout, son duo voit tout si elle partage avec lui,
// le coach ne voit que des créneaux « Suivi grossesse » (grossesse_creneaux)
// si elle partage avec lui. Ne compte dans aucune statistique.
// ─────────────────────────────────────────────────────────────────────────

export type Grossesse = { user_id: string; active: boolean; dpa: string | null; titre: string; partage_duo: boolean; partage_coach: boolean };
export type RdvGrossesse = { id: string; user_id: string; jour: string; heure: string | null; genre: "rdv" | "prepa" | "deux"; titre: string; lieu: string | null; note: string | null };

export const GENRES: Record<RdvGrossesse["genre"], { libelle: string }> = {
  rdv: { libelle: "Rendez-vous" },
  prepa: { libelle: "Préparation" },
  deux: { libelle: "À deux" },
};
export const ROSE = "#db2777";
export const ROSE_FOND = "#fdf2f8";

export async function grossesseAutorisee(userId: string): Promise<boolean> {
  const { data } = await supabase.rpc("grossesse_autorisee", { p_user: userId });
  return !!data;
}

export async function maGrossesse(userId: string): Promise<Grossesse | null> {
  const { data } = await supabase.from("grossesse").select("*").eq("user_id", userId).maybeSingle();
  return (data as Grossesse) ?? null;
}

/** Les rendez-vous visibles (les siens, et ceux du duo s'il partage : la RLS filtre). */
export async function rdvDuPlanning(ids: (string | null | undefined)[], du: string, au: string): Promise<RdvGrossesse[]> {
  const qui = ids.filter(Boolean) as string[];
  if (!qui.length) return [];
  const { data } = await supabase.from("grossesse_rdv").select("*").in("user_id", qui).gte("jour", du).lte("jour", au).order("heure");
  return (data ?? []) as RdvGrossesse[];
}

/** Pour le coach : des créneaux sans détail, seulement si l'athlète partage. */
export async function creneauxCoach(athleteId: string, du: string, au: string): Promise<{ id: string; jour: string; heure: string | null }[]> {
  const { data } = await supabase.rpc("grossesse_creneaux", { p_athlete: athleteId, p_du: du, p_au: au });
  return (data ?? []) as { id: string; jour: string; heure: string | null }[];
}

/** Semaines d'aménorrhée à une date, depuis la date prévue d'accouchement (DPA = 41 SA en France). */
export function semaines(dpa: string | null, jour = new Date()): { sa: number; jours: number; trimestre: 1 | 2 | 3 } | null {
  if (!dpa) return null;
  const debut = new Date(dpa + "T12:00:00").getTime() - 41 * 7 * 86_400_000;
  const j = Math.floor((jour.getTime() - debut) / 86_400_000);
  if (j < 0) return null;
  const sa = Math.floor(j / 7);
  return { sa, jours: j % 7, trimestre: sa < 16 ? 1 : sa < 29 ? 2 : 3 };
}

export const heureCourte = (h: string | null) => (h ? h.slice(0, 5).replace(":", "h") : "");
