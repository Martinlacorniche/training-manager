// ─────────────────────────────────────────────────────────────────────────
// Home-trainer : écriture / renvoi de la copie de secours (site : localStorage).
// Fichier jumeau côté app (AsyncStorage) : seules les lignes « STOCKAGE » diffèrent.
// ─────────────────────────────────────────────────────────────────────────
import { supabase } from "@/lib/supabaseClient";
import { fichierFit } from "./fit";
import { fluxDesPoints } from "./flux";
import { versIcu } from "./seance";
import {
  CLE_BROUILLON, CLE_ENVOIS, ajouter, bloquees, aRenvoyer, lire, modifier, noterEssai, nettoyer, remettreEssais, retirer, serialiser,
  type Sortie,
} from "./secours";

const lis = async (k: string): Promise<string | null> => { try { return window.localStorage.getItem(k); } catch { return null; } };
const ecris = async (k: string, v: string) => { try { window.localStorage.setItem(k, v); } catch { /* plein ou indisponible */ } };
const efface = async (k: string) => { try { window.localStorage.removeItem(k); } catch { /* rien */ } };

export const versBase64 = (o: Uint8Array) => { let s = ""; for (let i = 0; i < o.length; i += 0x2000) s += String.fromCharCode(...o.subarray(i, i + 0x2000)); return btoa(s); };

export const lireEnvois = async () => nettoyer(lire(await lis(CLE_ENVOIS)), Date.now());
const ecrireEnvois = async (l: Sortie[]) => { if (l.length) await ecris(CLE_ENVOIS, serialiser(l)); else await efface(CLE_ENVOIS); };

/** La copie complète, dès la fin de la sortie. */
export const copier = async (s: Sortie) => { await ecrireEnvois(ajouter(await lireEnvois(), { ...s, flux: s.flux ?? fluxDesPoints(s.points, s.tours) })); await efface(CLE_BROUILLON); };
export const retirerCopie = async (id: string) => ecrireEnvois(retirer(await lireEnvois(), id));
export const majCopie = async (id: string, patch: Partial<Sortie>) => ecrireEnvois(modifier(await lireEnvois(), id, patch));

export const ecrireBrouillon = async (s: Sortie) => ecris(CLE_BROUILLON, JSON.stringify({ ...s, maj: Date.now() }));
export const effacerBrouillon = () => efface(CLE_BROUILLON);
export const lireBrouillon = async (): Promise<Sortie | null> => {
  const b = await lis(CLE_BROUILLON);
  if (!b) return null;
  try { const s = JSON.parse(b); return s && Array.isArray(s.points) ? (s as Sortie) : null; } catch { return null; }
};

const enCours = new Set<string>();
let courant: Promise<number> | null = null;

/** Envoie une copie (crée la séance si besoin). Retire la copie si c'est bon. */
export async function envoyerCopie(s: Sortie): Promise<boolean> {
  if (enCours.has(s.id)) return false;
  enCours.add(s.id);
  try {
    let sessionId = s.sessionId;
    if (sessionId) {
      // Déjà des courbes : la sortie est arrivée, on ne l'envoie pas deux fois.
      const { data: ex } = await supabase.from("session_streams").select("session_id").eq("session_id", sessionId).maybeSingle();
      if (ex) { await retirerCopie(s.id); return true; }
      await supabase.from("sessions").update({ status: "valide", rpe: s.rpe, ...(s.texteCourt && s.blocs.length ? { workout_text: versIcu(s.blocs), workout_target: "POWER" } : {}) }).eq("id", sessionId);
    } else {
      const { data, error } = await supabase.from("sessions").insert({
        user_id: s.userId, date: s.jour, sport: "Vélo", title: s.titre,
        planned_hour: Math.round((s.points.length / 3600) * 100) / 100,
        workout_text: s.blocs.length ? versIcu(s.blocs) : null, workout_target: s.blocs.length ? "POWER" : null, status: "valide", rpe: s.rpe,
      }).select("id").single();
      if (error) throw new Error(error.message);
      sessionId = data.id as string;
      await majCopie(s.id, { sessionId });   // un nouvel essai ne recrée pas la séance
    }
    const { data: r, error } = await supabase.functions.invoke("ht-envoi", {
      body: { fit: versBase64(fichierFit(s.points, s.tours, s.rr)), flux: s.flux ?? fluxDesPoints(s.points, s.tours), session_id: sessionId, compliment: s.compliment },
    });
    if (error) throw new Error(error.message);
    if (r?.status !== "not_connected" && r?.error) throw new Error(r.error);
    await retirerCopie(s.id);
    if (r?.activity_id) await supabase.functions.invoke("strava-force-sync", { body: { action: "attach", user_id: s.userId, target_type: "session", target_id: sessionId, activity_id: r.activity_id } }).catch(() => {});
    return true;
  } catch {
    await ecrireEnvois(noterEssai(await lireEnvois(), s.id));
    return false;
  } finally { enCours.delete(s.id); }
}

/** Renvoie les copies en attente de cette personne ; rend le nombre de copies bloquées (3 essais). */
export function renvoyerEnAttente(userId: string): Promise<number> {
  if (courant) return courant;
  courant = (async () => {
    try {
      for (const s of aRenvoyer(await lireEnvois(), userId)) await envoyerCopie(s);
      return bloquees(await lireEnvois(), userId).length;
    } catch { return 0; } finally { courant = null; }
  })();
  return courant;
}

/** « Réessayer » : on remet les essais à zéro et on renvoie. */
export async function reessayer(userId: string): Promise<number> {
  await ecrireEnvois(remettreEssais(await lireEnvois(), userId));
  return renvoyerEnAttente(userId);
}

export const nombreBloquees = async (userId: string) => bloquees(await lireEnvois(), userId).length;
