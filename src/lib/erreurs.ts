// ─────────────────────────────────────────────────────────────────────────
// Remontée de plantage maison (11/11/2026), jumelle de celle de l'app : chaque
// erreur non rattrapée s'enregistre dans la table `erreurs_app` (insertion
// seule, lecture réservée à la clé service).
//
// Ce fichier ne doit JAMAIS aggraver un plantage : tout est dans un try/catch,
// une erreur d'envoi est avalée (pas de boucle), et rien ne part en
// développement. Aucune donnée personnelle hors l'identifiant utilisateur (posé
// par la base avec auth.uid()) : la route est prise SANS ses paramètres, car
// ceux des liens de réinitialisation de mot de passe contiennent un jeton.
// ─────────────────────────────────────────────────────────────────────────
import { supabase } from "./supabaseClient";

// Mêmes bornes que les contraintes de la table.
const MAX_MESSAGE = 2000;
const MAX_PILE = 8000;
const MAX_CONTEXTE = 4000;
/** Garde-fou par chargement de page : un bug en boucle ne doit pas inonder la base. */
const MAX_ENVOIS = 10;
/** Une même erreur répétée dans cette fenêtre n'est envoyée qu'une fois. */
const FENETRE_DOUBLON_MS = 60_000;

let envois = 0;
let enCours = false;
const vus = new Map<string, number>();

function enTexte(erreur: unknown): { message: string; pile: string | null } {
  if (erreur instanceof Error) return { message: String(erreur.message || erreur.name), pile: erreur.stack ?? null };
  if (typeof erreur === "string") return { message: erreur, pile: null };
  try { return { message: JSON.stringify(erreur) ?? String(erreur), pile: null }; } catch { return { message: String(erreur), pile: null }; }
}

/** Le contexte doit rester petit et sérialisable, sinon on l'écarte plutôt que de perdre l'erreur. */
function contexteBorne(contexte?: Record<string, unknown>): Record<string, unknown> | null {
  if (!contexte) return null;
  try {
    const json = JSON.stringify(contexte);
    return json.length <= MAX_CONTEXTE ? JSON.parse(json) : { tronque: true };
  } catch { return { illisible: true }; }
}

export async function signalerErreur(erreur: unknown, contexte?: Record<string, unknown>): Promise<void> {
  try {
    // Rien en développement, ni côté serveur (pas de navigateur, pas de session).
    if (process.env.NODE_ENV !== "production" || typeof window === "undefined") return;
    if (envois >= MAX_ENVOIS || enCours) return;

    const { message: brut, pile } = enTexte(erreur);
    const message = brut.slice(0, MAX_MESSAGE);

    // Dédoublonnage : le même message dans la minute est ignoré.
    const maintenant = Date.now();
    const dernier = vus.get(message);
    if (dernier !== undefined && maintenant - dernier < FENETRE_DOUBLON_MS) return;
    vus.set(message, maintenant);
    if (vus.size > 50) vus.delete(vus.keys().next().value as string);

    envois++;
    enCours = true;
    // Le navigateur (type et version) suffit à situer un bug ; rien de plus fin.
    const ligne = {
      source: "site",
      plateforme: `web ${navigator.userAgent}`.slice(0, 300),
      version: process.env.NEXT_PUBLIC_BUILD_ID ?? "inconnue",
      ecran: window.location.pathname,
      message,
      pile: pile ? pile.slice(0, MAX_PILE) : null,
      contexte: contexteBorne(contexte),
    };
    // Le résultat (y compris une erreur renvoyée par la base) est volontairement ignoré.
    await supabase.from("erreurs_app").insert(ligne);
  } catch {
    // Avalé : signaler ne doit jamais faire planter, ni se signaler lui-même.
  } finally {
    enCours = false;
  }
}
