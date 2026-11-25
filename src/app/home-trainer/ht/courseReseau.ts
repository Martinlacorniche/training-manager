// ─────────────────────────────────────────────────────────────────────────
// Le jeu des cols à plusieurs, côté réseau (25/11/2026) : fantômes (traces),
// salons, Supabase Realtime. Le client Supabase est passé en paramètre : le
// même fichier sert l'app et le site (Site-Coach/src/app/home-trainer/ht/courseReseau.ts).
// ─────────────────────────────────────────────────────────────────────────
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { decalageHorloge, echantillonner, estFige, MAX_SALON, traceValide, type Rival, type Trace } from "./course";

// ─── A. Fantômes ───

export type FantomeTrace = { id: string; prenom: string; duree_s: number; trace: Trace; moi: boolean };

/** Les montées disponibles sur ce col : la meilleure de chaque membre du groupe (toi compris). */
export async function chargerFantomes(sb: SupabaseClient, colId: string): Promise<FantomeTrace[]> {
  const { data, error } = await sb.rpc("fantomes_col", { p_col: colId });
  if (error || !Array.isArray(data)) return [];
  const liste: FantomeTrace[] = [];
  for (const x of data as { user_id: string; prenom: string; duree_s: number; pas: number; distances: unknown; moi: boolean }[]) {
    const tr = traceValide({ pas: x.pas, d: x.distances }, x.duree_s);
    if (tr) liste.push({ id: x.user_id, prenom: x.prenom, duree_s: x.duree_s, trace: tr, moi: !!x.moi });
  }
  return liste;
}

/** Garde la trace d'une montée terminée (une distance par seconde en entrée). Ne bloque jamais : échec silencieux. */
export async function garderTrace(sb: SupabaseClient, colId: string, distances: number[]): Promise<void> {
  if (distances.length < 60) return;
  const tr = echantillonner(distances);
  try { await sb.from("ht_cols_traces").insert({ col_id: colId, duree_s: tr.duree, pas: tr.pas, distances: tr.d }); } catch { /* la trace n'est qu'un bonus */ }
}

// ─── B. Salons ───

/** Le décalage (ms) entre l'heure du serveur et celle de l'appareil : 3 mesures, la plus courte gagne. */
export async function mesurerDecalage(sb: SupabaseClient): Promise<number> {
  const essais: { t0: number; serveur: number; t1: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now();
    const { data, error } = await sb.rpc("heure_serveur");
    const t1 = Date.now();
    if (!error && typeof data === "number") essais.push({ t0, serveur: data, t1 });
    else if (!error && typeof data === "string" && !isNaN(Number(data))) essais.push({ t0, serveur: Number(data), t1 });
  }
  return decalageHorloge(essais);
}

export type EtatSalon = { code: string; hote: string; hote_prenom: string; col_id: string | null; statut: "attente" | "en_cours" | "fini"; depart_ms: number | null };

export async function creerSalon(sb: SupabaseClient): Promise<string | null> {
  const { data, error } = await sb.rpc("creer_salon", { p_col: null });
  return error || typeof data !== "string" ? null : data;
}

export async function etatSalon(sb: SupabaseClient, code: string): Promise<EtatSalon | null> {
  const { data, error } = await sb.rpc("salon_etat", { p_code: code });
  const x = Array.isArray(data) ? data[0] : data;
  if (error || !x) return null;
  return { code: x.code, hote: x.hote, hote_prenom: x.hote_prenom, col_id: x.col_id ?? null, statut: x.statut, depart_ms: x.depart_ms != null ? Number(x.depart_ms) : null };
}

/** L'hôte lance : le serveur fixe l'heure de départ (10 s) et la rend. */
export async function lancerSalon(sb: SupabaseClient, code: string, colId: string): Promise<number | null> {
  const { data, error } = await sb.rpc("lancer_salon", { p_code: code, p_col: colId });
  return error || data == null ? null : Number(data);
}

export const terminerSalon = async (sb: SupabaseClient, code: string) => { try { await sb.rpc("terminer_salon", { p_code: code }); } catch { /* sans gravité */ } };

// ─── Le canal temps réel ───

export type Message = { id: string; prenom: string; m: number; v: number; t: number; f?: number; a?: boolean };
type Vu = Message & { vu: number };

export class Salle {
  readonly canal: RealtimeChannel;
  presents = new Map<string, string>();       // id → prénom, ceux qui sont dans le salon
  private vus = new Map<string, Vu>();
  connecte = true;                             // mon propre lien avec le canal
  /** L'hôte a lancé : (col, heure de départ du serveur en ms). */
  surDepart: ((col: string, departMs: number) => void) | null = null;

  constructor(private sb: SupabaseClient, readonly code: string, readonly moi: { id: string; prenom: string }, private surChangement: () => void) {
    this.canal = sb.channel("col:" + code, { config: { broadcast: { self: false }, presence: { key: moi.id } } });
  }

  /** Entre dans le salon. "plein" : déjà 10 coureurs. */
  connecter(): Promise<"ok" | "plein" | "erreur"> {
    return new Promise((resolve) => {
      let fini = false;
      const fin = (r: "ok" | "plein" | "erreur") => { if (!fini) { fini = true; resolve(r); } };
      this.canal
        .on("presence", { event: "sync" }, () => {
          const etat = this.canal.presenceState() as Record<string, { prenom?: string }[]>;
          this.presents = new Map(Object.entries(etat).map(([id, v]) => [id, v[0]?.prenom ?? "?"]));
          this.surChangement();
        })
        .on("broadcast", { event: "etat" }, ({ payload }) => {
          const p = payload as Message;
          if (!p || p.id === this.moi.id || typeof p.m !== "number") return;
          this.vus.set(p.id, { ...p, vu: Date.now() });
          this.surChangement();
        })
        .on("broadcast", { event: "depart" }, ({ payload }) => {
          const p = payload as { col?: string; depart?: number };
          if (p?.col && typeof p.depart === "number") this.surDepart?.(p.col, p.depart);
        })
        .subscribe(async (statut) => {
          if (statut === "SUBSCRIBED") {
            this.connecte = true;
            await this.canal.track({ prenom: this.moi.prenom });
            setTimeout(() => fin(this.presents.size > MAX_SALON ? "plein" : "ok"), 600);
          } else if (statut === "CHANNEL_ERROR" || statut === "TIMED_OUT" || statut === "CLOSED") {
            this.connecte = false; this.surChangement(); fin("erreur");
          }
        });
    });
  }

  /** Mon état, chaque seconde : { id, prenom, m, v, t } (+ f = arrivé en f s, a = abandon). */
  envoyer(e: { m: number; v: number; t: number; f?: number; a?: boolean }) {
    const msg: Message = { id: this.moi.id, prenom: this.moi.prenom, ...e };
    this.canal.send({ type: "broadcast", event: "etat", payload: msg }).catch(() => {});
  }

  annoncerDepart(col: string, departMs: number) {
    this.canal.send({ type: "broadcast", event: "depart", payload: { col, depart: departMs } }).catch(() => {});
  }

  /** Les autres coureurs : figés s'ils se taisent depuis 4 s, ou si leur présence a disparu. */
  rivaux(maintenant = Date.now()): Rival[] {
    return [...this.vus.values()].map((v) => ({
      id: v.id, prenom: v.prenom, m: v.m, v: v.v, fini: v.f ?? null, abandon: !!v.a,
      fige: v.f == null && !v.a && (estFige(v.vu, maintenant) || !this.presents.has(v.id)),
    }));
  }

  fermer() { this.sb.removeChannel(this.canal).catch(() => {}); }
}
