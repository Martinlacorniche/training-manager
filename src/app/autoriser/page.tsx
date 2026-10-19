"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ShieldCheck, Eye, EyeSlash, CircleNotch } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabaseClient";

// La page d'autorisation OAuth du connecteur IA (Martin, 19/10/2026) : Claude
// (web, bureau ou téléphone, qui ouvre le navigateur) demande à agir au nom de
// la personne. Elle se connecte si besoin — même compte que l'app et le site —,
// voit QUI demande et OÙ part l'accès, et autorise. Le code est émis par la
// fonction `oauth`, relayée sous /oauth.

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], display: "swap" });

function Autoriser() {
  const q = useSearchParams();
  const params = {
    client_id: q.get("client_id") || "", redirect_uri: q.get("redirect_uri") || "",
    code_challenge: q.get("code_challenge") || "", code_challenge_method: q.get("code_challenge_method") || "",
    state: q.get("state") || "", scope: q.get("scope") || "",
  };
  const [client, setClient] = useState<string | null>(null);
  const [session, setSession] = useState<{ email: string; token: string } | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [voir, setVoir] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  // ⚠️ L'HÔTE DE RETOUR, EN CLAIR : le nom du client est choisi par celui qui
  // s'enregistre (n'importe qui peut se dire « Claude »). L'adresse où part
  // l'accès est la seule chose qu'il ne peut pas déguiser.
  const hote = (() => { try { return new URL(params.redirect_uri).host; } catch { return params.redirect_uri; } })();
  const estClaude = /(^|\.)claude\.(ai|com)$/i.test(hote) || /(^|\.)anthropic\.com$/i.test(hote);

  useEffect(() => {
    fetch(`/oauth/client?client_id=${encodeURIComponent(params.client_id)}&redirect_uri=${encodeURIComponent(params.redirect_uri)}`)
      .then(async (r) => { const j = await r.json().catch(() => ({})); if (r.ok) setClient(j.nom); else setErreur(j.error || "Demande invalide"); })
      .catch(() => setErreur("Serveur injoignable"));
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSession({ email: data.session.user.email || "", token: data.session.access_token });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connecter = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnCours(true); setErreur(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) setErreur("Email ou mot de passe incorrect.");
    else setSession({ email: data.session.user.email || "", token: data.session.access_token });
    setEnCours(false);
  };
  const autoriser = async () => {
    if (!session) return;
    setEnCours(true); setErreur(null);
    const r = await fetch("/oauth/autoriser", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` }, body: JSON.stringify({ ...params, consentement: true }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErreur(j.error || `Erreur ${r.status}`); setEnCours(false); return; }
    window.location.href = j.retour;
  };
  const champ = "w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 transition";

  return (
    <main className={`${jakarta.className} min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10`}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <Image src="/coach-logo.jpg" width={56} height={56} alt="C'est Ludique" className="rounded-full border border-slate-200 object-cover mb-3 shadow-sm" />
          <h1 className="text-xl font-extrabold text-slate-800 tracking-tight text-center">{client ?? "…"} demande l&apos;accès</h1>
          <p className="text-slate-500 text-sm mt-1 text-center">à ton compte d&apos;entraînement, avec tes droits</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          {params.redirect_uri && (
            <p className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600">
              L&apos;accès part vers <span className="font-bold text-slate-900 break-all">{hote}</span>.
              {!estClaude && <span className="block mt-1 text-amber-700">Ce n&apos;est pas une adresse de Claude : n&apos;autorise que si tu sais ce que c&apos;est.</span>}
            </p>
          )}
          {/* LE MÊME ACCORD QUE POUR UN LIEN (Réglages > Connecter une IA) : transmettre
              ses données d'entraînement ET de santé à un tiers, dit en clair. Cliquer
              « Autoriser » vaut accord, et le serveur l'enregistre. */}
          <ul className="text-sm text-slate-600 space-y-1.5">
            <li>📖 Lire ton planning, tes séances, ton ressenti et ton suivi, y compris ton sommeil et ta récupération si ta montre les envoie.</li>
            <li>✍️ Préparer, modifier et envoyer tes séances, en te demandant toujours avant.</li>
            <li>🔒 Rien de plus que ce que tu vois toi-même dans l&apos;app.</li>
          </ul>
          {erreur && <p className="rounded-xl bg-rose-50 text-rose-700 text-sm px-3 py-2">{erreur}</p>}

          {!session ? (
            <form onSubmit={connecter} className="flex flex-col gap-3">
              <input type="email" autoComplete="email" placeholder="Adresse e-mail" value={email} onChange={(e) => setEmail(e.target.value)} required className={champ} />
              <div className="relative">
                <input type={voir ? "text" : "password"} autoComplete="current-password" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required className={`${champ} pr-11`} />
                <button type="button" onClick={() => setVoir(!voir)} className="absolute right-3 top-3.5 text-slate-400" aria-label="Afficher le mot de passe">{voir ? <EyeSlash size={20} /> : <Eye size={20} />}</button>
              </div>
              <button type="submit" disabled={enCours} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 flex items-center justify-center gap-2 disabled:opacity-60">
                {enCours && <CircleNotch size={18} className="animate-spin" />} Se connecter
              </button>
              <p className="text-xs text-slate-400 text-center">Le même compte que l&apos;application.</p>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm"><span className="text-slate-500">Connecté :</span> <span className="font-semibold">{session.email}</span></div>
              <button onClick={autoriser} disabled={enCours || !client} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 flex items-center justify-center gap-2 disabled:opacity-60">
                {enCours ? <CircleNotch size={18} className="animate-spin" /> : <ShieldCheck size={18} weight="bold" />} Autoriser
              </button>
              <button className="w-full text-xs text-slate-500 hover:underline" onClick={async () => { await supabase.auth.signOut(); setSession(null); }}>Changer de compte</button>
            </div>
          )}
        </div>
        <p className="text-xs text-slate-400 text-center mt-4">Tu peux couper cet accès à tout moment dans tes Réglages. <a href="/privacy" className="underline">Confidentialité</a></p>
      </div>
    </main>
  );
}

export default function PageAutoriser() {
  return <Suspense fallback={null}><Autoriser /></Suspense>;
}
