// Dupliquer une séance ou copier une semaine, vers le même athlète ou vers
// d'autres (05/11/2026, validé par Martin). Mêmes règles que l'app
// (App-Coach, lib/copie.ts) :
// — seul le PLAN est copié : jamais le ressenti, le statut ni le réalisé ;
// — rien n'est écrasé : une séance copiée s'ajoute à ce qui existe déjà ;
// — les consignes sont en zones et en %, donc chaque athlète reçoit la séance
//   à ses allures et ses watts ; la séance déjà traduite pour la montre suit,
//   l'athlète l'envoie comme n'importe quelle séance ;
// — le thème de la semaine suit, seulement là où il n'y en a pas déjà un ;
// — tout se défait juste après (annulerCopie).
import dayjs from "dayjs";
import { supabase } from "@/lib/supabaseClient";

const PLAN = "sport, title, planned_hour, prescribed_hour, planned_inter, intensity, session_type, timer_sequence, workout_text, workout_target, workout_parcours, test";

type Ligne = Record<string, unknown> & { date: string };

export type Copie = { ids: string[]; themes: { user_id: string; week_start: string }[] };

async function inserer(lignes: Ligne[], vers: string[], decaler: (date: string) => string): Promise<string[]> {
  const { data: { session } } = await supabase.auth.getSession();
  const coach = session?.user?.id ?? null;
  const rows = vers.flatMap((uid) => lignes.map((l) => ({ ...l, user_id: uid, coach_id: coach, date: decaler(l.date) })));
  if (!rows.length) return [];
  const { data, error } = await supabase.from("sessions").insert(rows).select("id");
  if (error) throw error;
  return (data ?? []).map((r: { id: string }) => r.id);
}

/** Une séance, vers un ou plusieurs athlètes, au jour voulu. */
export async function dupliquerSeance(seanceId: string, vers: string[], date: string): Promise<Copie> {
  const { data, error } = await supabase.from("sessions").select(`date, ${PLAN}`).eq("id", seanceId).single();
  if (error || !data) throw error ?? new Error("Séance introuvable");
  const ids = await inserer([data as unknown as Ligne], vers, () => date);
  return { ids, themes: [] };
}

/** Toute une semaine (lundi → dimanche) vers une autre semaine, pour un ou plusieurs athlètes. */
export async function copierSemaine(de: string, deLundi: string, vers: string[], versLundi: string): Promise<Copie> {
  const fin = dayjs(deLundi).add(6, "day").format("YYYY-MM-DD");
  const [{ data: seances, error }, { data: theme }] = await Promise.all([
    supabase.from("sessions").select(`date, ${PLAN}`).eq("user_id", de).gte("date", deLundi).lte("date", fin),
    supabase.from("weekly_thematics").select("thematic").eq("user_id", de).eq("week_start", deLundi).maybeSingle(),
  ]);
  if (error) throw error;
  const ecart = dayjs(versLundi).diff(dayjs(deLundi), "day");
  const ids = await inserer((seances ?? []) as unknown as Ligne[], vers, (d) => dayjs(d).add(ecart, "day").format("YYYY-MM-DD"));
  const themes: Copie["themes"] = [];
  if (theme?.thematic) {
    const { data: deja } = await supabase.from("weekly_thematics").select("user_id").in("user_id", vers).eq("week_start", versLundi);
    const pris = new Set((deja ?? []).map((t: { user_id: string }) => t.user_id));
    const nouveaux = vers.filter((v) => !pris.has(v)).map((user_id) => ({ user_id, week_start: versLundi, thematic: theme.thematic }));
    if (nouveaux.length) {
      const { error: e } = await supabase.from("weekly_thematics").insert(nouveaux);
      if (!e) themes.push(...nouveaux.map(({ user_id, week_start }) => ({ user_id, week_start })));
    }
  }
  return { ids, themes };
}

/** Défait une copie : retire ce qu'elle a ajouté, et rien d'autre. */
export async function annulerCopie(c: Copie): Promise<void> {
  if (c.ids.length) await supabase.from("sessions").delete().in("id", c.ids);
  for (const t of c.themes) await supabase.from("weekly_thematics").delete().eq("user_id", t.user_id).eq("week_start", t.week_start);
}
