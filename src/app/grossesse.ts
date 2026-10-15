import { supabase } from "@/lib/supabaseClient";

// ─────────────────────────────────────────────────────────────────────────
// Le mode grossesse (15/10/2026), comme dans l'app (App-Coach,
// lib/grossesse.ts). Tables à part (grossesse, grossesse_rdv), protégées par
// la base : l'athlète voit tout, son duo voit tout si elle partage avec lui,
// le coach ne voit que des créneaux « Suivi grossesse » (grossesse_creneaux)
// si elle partage avec lui. Ne compte dans aucune statistique.
// ─────────────────────────────────────────────────────────────────────────

export type Grossesse = { user_id: string; active: boolean; dpa: string | null; titre: string; partage_duo: boolean; partage_coach: boolean; naissance?: string | null };
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

// ── La couche privée (15/10/2026) : la version adaptée d'une séance du coach ──
// Superposée à l'affichage chez elle (et chez son duo s'il voit : la RLS
// filtre ; le coach ne lit jamais `seance_adaptee`). La séance du coach, en
// base, ne change jamais. `original` garde la version du coach.
type Base = { id: string; status?: string | null; title?: string | null; planned_inter?: string | null; planned_hour?: number | null; intensity?: string | null; timer_sequence?: unknown };
export type Adaptable = { adaptee?: boolean; changements?: string[]; original?: { title?: string | null; planned_inter?: string | null; planned_hour?: number | null; intensity?: string | null; timer_sequence?: unknown } };
type LigneAdaptee = { session_id: string; adaptee: boolean; titre: string | null; planned_hour: number | null; intensite: string | null; consignes: string | null; changements: string[] | null; timer_sequence: unknown };

export async function superposerAdaptees<T extends Base>(seances: T[]): Promise<(T & Adaptable)[]> {
  if (!seances.length) return seances;
  const ids = seances.map((s) => s.id).filter(Boolean);
  const lignes: LigneAdaptee[] = [];
  // Par paquets : une année entière ferait une URL trop longue.
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase.from("seance_adaptee").select("*").in("session_id", ids.slice(i, i + 150));
    lignes.push(...((data ?? []) as LigneAdaptee[]));
  }
  const parId = new Map(lignes.filter((a) => a.adaptee).map((a) => [a.session_id, a]));
  return seances.map((s) => {
    const a = parId.get(s.id);
    if (!a) return s;
    return {
      ...s,
      title: a.titre || s.title,
      planned_hour: s.status === "valide" ? s.planned_hour : a.planned_hour ?? s.planned_hour,
      intensity: a.intensite ?? s.intensity,
      planned_inter: a.consignes ?? s.planned_inter,
      timer_sequence: a.timer_sequence ?? null,
      adaptee: true,
      changements: a.changements ?? [],
      original: { title: s.title, planned_inter: s.planned_inter, planned_hour: s.planned_hour, intensity: s.intensity, timer_sequence: s.timer_sequence },
    };
  });
}

export type Proposition = { titre: string; duree_minutes: number; intensite: string; consignes: string; changements: string[] };

/** Adapter une séance (fonction serveur adapter-seance) : elle seule, jamais son coach. */
export async function adapter(sessionId: string, mode: "proposer" | "enregistrer" | "retirer", proposition?: Proposition): Promise<{ proposition?: Proposition; plafond?: number | null; ok?: boolean }> {
  const { data, error } = await supabase.functions.invoke("adapter-seance", { body: { sessionId, mode, proposition } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const corps = await ctx?.json?.().catch(() => null);
    throw new Error(corps?.error ?? error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// ── Le carnet (15/10/2026) ───────────────────────────────────────────────
// Repères de taille et de poids : calendrier de grossesse des Hôpitaux
// universitaires de Genève (HUG). En objets de sport, pour parler à des sportifs.
export const BEBE: { des: number; taille: string; poids: string; objet: string; emoji: string }[] = [
  { des: 9, taille: "3 cm", poids: "9 g", objet: "une balle de ping-pong", emoji: "🏓" },
  { des: 12, taille: "6-7 cm", poids: "90 g", objet: "une balle de tennis", emoji: "🎾" },
  { des: 15, taille: "13-14 cm", poids: "200 g", objet: "une chaussure de running légère", emoji: "👟" },
  { des: 20, taille: "20-22 cm", poids: "450-550 g", objet: "un ballon de foot", emoji: "⚽" },
  { des: 24, taille: "28-35 cm", poids: "700-800 g", objet: "un ballon de basket", emoji: "🏀" },
  { des: 30, taille: "37 cm", poids: "1,5-1,8 kg", objet: "un haltère de 1,5 kg", emoji: "🏋️" },
  { des: 34, taille: "40-45 cm", poids: "2,8-3,1 kg", objet: "un haltère de 3 kg", emoji: "🏋️" },
  { des: 38, taille: "48-52 cm", poids: "3,5-3,7 kg", objet: "un kettlebell de 3,5 kg", emoji: "🔔" },
];
export const bebeA = (sa: number) => [...BEBE].reverse().find((b) => sa >= b.des) ?? null;

// Les signes d'alerte qui imposent d'arrêter et de consulter (HAS 2019, tableau 4).
export const SIGNES_ARRET = [
  "Essoufflement qui ne passe pas au repos",
  "Douleur ou pression dans la poitrine",
  "Contractions régulières et douloureuses",
  "Saignement",
  "Perte de liquide",
  "Vertiges, malaise ou mal de tête",
  "Faiblesse qui gêne l'équilibre",
  "Douleur ou gonflement du mollet",
];

/** FC max observée sur un an (2e plus haut maximum de séance), comme côté serveur. */
export async function fcMaxObservee(userId: string): Promise<number | null> {
  const depuis = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
  const { data } = await supabase.from("activite_series").select("activite_id, fc_max, activites!inner(jour)")
    .eq("user_id", userId).not("fc_max", "is", null).gte("activites.jour", depuis).limit(5000);
  const m = new Map<string, number>();
  for (const r of (data ?? []) as { activite_id: string; fc_max: number }[]) m.set(r.activite_id, Math.max(m.get(r.activite_id) ?? 0, Number(r.fc_max)));
  const t = [...m.values()].sort((a, b) => b - a);
  return t.length >= 2 ? t[1] : t[0] ?? null;
}
