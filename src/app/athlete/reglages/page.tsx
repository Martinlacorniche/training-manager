"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ArrowLeft, Watch, Robot, UserCircleGear } from "@phosphor-icons/react";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["500", "600", "700", "800"], display: "swap" });
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;

// Réglages de l'athlète sur le site : les mêmes que dans l'app
// (App-Coach, app/ConnectionsModal.tsx et app/SettingsModal.tsx) — la
// montre via intervals.icu, le partage de l'état avec le coach, et le
// connecteur IA. Mêmes fonctions et mêmes règles côté serveur.

type Moi = { id_auth: string; coach_id: string | null; partage_etat_coach: boolean | null; partage_informe_le: string | null; consentement_ia_le: string | null };

export default function Reglages() {
  const router = useRouter();
  const [moi, setMoi] = useState<Moi | null>(null);
  const [icu, setIcu] = useState(false);
  const [mcp, setMcp] = useState<{ created_at: string; last_used_at: string | null } | null>(null);
  const [cle, setCle] = useState("");
  const [lienFrais, setLienFrais] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function charger() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/login"); return; }
    const [{ data: u }, { data: secret }, { data: m }] = await Promise.all([
      supabase.from("users").select("id_auth, coach_id, partage_etat_coach, partage_informe_le, consentement_ia_le").eq("id_auth", session.user.id).single(),
      supabase.rpc("intervals_est_connecte"),
      supabase.rpc("mcp_token_status"),
    ]);
    setMoi(u as Moi);
    setIcu(!!secret);
    setMcp(Array.isArray(m) ? m[0] ?? null : m ?? null);
  }
  useEffect(() => { charger(); }, []);

  async function jeton() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  }

  async function brancher(apiKey: string | null) {
    if (!moi) return;
    setOccupe(true); setMessage(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/connect-intervals`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await jeton()}` },
        body: JSON.stringify({ athleteId: moi.id_auth, apiKey }),
      });
      const data = await res.json();
      if (data.error === "cle_invalide") { setMessage("intervals.icu n'a pas reconnu cette clé. Vérifie que tu l'as copiée en entier."); return; }
      if (data.error) throw new Error(data.error);
      setMessage(apiKey ? (data.nom ? `Compte intervals.icu de ${data.nom} branché.` : "Compte intervals.icu branché.") : "intervals.icu débranché.");
      setCle("");
      await charger();
    } catch (e: any) {
      setMessage(e.message ?? "Connexion impossible.");
    } finally { setOccupe(false); }
  }

  async function basculerPartage(v: boolean) {
    if (!moi) return;
    const maj = { partage_etat_coach: v, partage_informe_le: moi.partage_informe_le ?? new Date().toISOString() };
    setMoi({ ...moi, ...maj });
    const { error } = await supabase.from("users").update(maj).eq("id_auth", moi.id_auth);
    if (error) { setMoi(moi); setMessage(error.message); }
  }

  // Brancher son assistant IA, c'est transmettre à un tiers (Anthropic) ses
  // données d'entraînement ET de santé : accord explicite, enregistré, exigé
  // aussi côté serveur (mcp_issue_token refuse sans lui).
  async function genererLien() {
    if (!moi?.consentement_ia_le) {
      const ok = confirm("Avec ce lien, ton assistant (Claude, d'Anthropic) pourra lire ton planning, tes séances, ton ressenti et ton suivi — y compris tes données de santé (VFC, FC de repos, sommeil) si ta montre les envoie. Il agit avec tes droits dans l'app, ni plus ni moins. Tu peux révoquer le lien à tout moment.\n\nTu acceptes ce partage ?");
      if (!ok) return;
      const { error } = await supabase.from("users").update({ consentement_ia_le: new Date().toISOString() }).eq("id_auth", moi!.id_auth);
      if (error) { setMessage(error.message); return; }
    }
    if (mcp && !confirm("Générer un nouveau lien désactive l'ancien : il faudra le recoller dans ton assistant. Continuer ?")) return;
    setOccupe(true);
    const { data, error } = await supabase.rpc("mcp_issue_token");
    setOccupe(false);
    if (error) { setMessage(error.message); return; }
    await charger();
    setLienFrais(`${SUPABASE_URL}/functions/v1/mcp/${data}`);
  }

  async function revoquer() {
    if (!confirm("Révoquer le lien ? L'assistant n'aura plus accès à ton entraînement.")) return;
    setOccupe(true);
    await supabase.rpc("mcp_revoke_tokens");
    setOccupe(false); setLienFrais(null);
    await charger();
  }

  const coache = !!moi?.coach_id && moi.coach_id !== moi.id_auth;
  const carte = "bg-white rounded-2xl border border-slate-200 p-5 space-y-3";

  return (
    <main className={`${jakarta.className} min-h-screen bg-slate-100 px-4 py-8`}>
      <div className="max-w-xl mx-auto space-y-5">
        <button onClick={() => router.push("/athlete")} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800">
          <ArrowLeft size={16} /> Retour au planning
        </button>
        <h1 className="text-2xl font-extrabold text-slate-800">Réglages</h1>
        {message && <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3">{message}</div>}

        <section className={carte}>
          <h2 className="flex items-center gap-2 font-bold text-slate-800"><Watch size={20} className="text-cyan-600" /> Ma montre</h2>
          {icu ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-700">intervals.icu connecté</p>
                <p className="text-sm text-slate-500">Tes séances peuvent partir vers ta montre, et ta montre enrichit ton suivi.</p>
              </div>
              <button disabled={occupe} onClick={() => confirm("Débrancher intervals.icu ? Tes séances ne partiront plus vers ta montre.") && brancher(null)}
                className="text-sm font-bold text-rose-600 hover:underline">Débrancher</button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-600">
                intervals.icu relaie tes séances vers Garmin, COROS, Suunto, Wahoo ou Zwift, et rapporte à l&apos;app ce que mesure ta montre (dynamique de course, VFC, sommeil).
              </p>
              <a href="https://intervals.icu/settings" target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-600 hover:underline">Ouvrir mes réglages intervals.icu</a>
              <p className="text-xs text-slate-500">Dans « Developer Settings », copie ta clé API et colle-la ici.</p>
              <div className="flex gap-2">
                <input type="password" value={cle} onChange={(e) => setCle(e.target.value)} placeholder="Clé API"
                  className="flex-1 rounded-lg border border-slate-200 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-200" />
                <button disabled={occupe || !cle.trim()} onClick={() => brancher(cle.trim())}
                  className="px-4 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50">{occupe ? "…" : "Valider"}</button>
              </div>
            </div>
          )}
        </section>

        {coache && icu && moi && (
          <section className={carte}>
            <h2 className="flex items-center gap-2 font-bold text-slate-800"><UserCircleGear size={20} className="text-blue-600" /> Mon coach</h2>
            <label className="flex items-center justify-between gap-4">
              <span>
                <span className="block font-semibold text-slate-700">Partager mon état avec mon coach</span>
                <span className="block text-sm text-slate-500">Il voit le niveau (habituel, à surveiller, écart) et une phrase. Jamais tes chiffres de santé : VFC, FC de repos, sommeil.</span>
              </span>
              <input type="checkbox" checked={moi.partage_etat_coach !== false} onChange={(e) => basculerPartage(e.target.checked)} className="h-5 w-5 accent-blue-600" />
            </label>
          </section>
        )}

        <section className={carte}>
          <h2 className="flex items-center gap-2 font-bold text-slate-800"><Robot size={20} className="text-violet-600" /> Connecter une IA</h2>
          <p className="text-sm text-slate-600">
            Un lien personnel à coller dans Claude (Réglages → Connecteurs) : ton assistant lit ton planning et ton suivi, avec exactement tes droits dans l&apos;app. Il peut aussi traduire tes séances pour ta montre.
          </p>
          {lienFrais && (
            <div className="rounded-xl bg-violet-50 border border-violet-200 p-3 space-y-2">
              <p className="text-sm font-bold text-violet-800">Ton lien — copie-le maintenant, il ne sera plus affiché</p>
              <code className="block break-all text-xs text-slate-700">{lienFrais}</code>
              <button onClick={() => navigator.clipboard.writeText(lienFrais)} className="text-sm font-bold text-violet-700 hover:underline">Copier le lien</button>
            </div>
          )}
          {mcp && !lienFrais && <p className="text-sm text-slate-500">Un lien est actif{mcp.last_used_at ? `, dernière utilisation le ${new Date(mcp.last_used_at).toLocaleDateString("fr-FR")}` : ""}.</p>}
          <div className="flex gap-3">
            <button disabled={occupe} onClick={genererLien} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-bold disabled:opacity-50">
              {mcp ? "Régénérer un lien" : "Générer un lien"}
            </button>
            {mcp && <button disabled={occupe} onClick={revoquer} className="text-sm font-bold text-rose-600 hover:underline">Révoquer</button>}
          </div>
        </section>
      </div>
    </main>
  );
}
