"use client";
// ─────────────────────────────────────────────────────────────────────────
// Connexion (refonte du 05/11/2026, maquette « bento sportif » validée par
// Martin) : un titre géant dont le mot change, des tuiles en verre sur un fond
// de taches de couleur floues qui bougent lentement. Pendant de l'app
// (App-Coach, app/Login.tsx). Pas de mode invité sur le site (Martin).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const MOTS = ["rouler", "courir", "nager", "transpirer"];
const COL = "M0 66 L40 60 L80 52 L110 50 L150 38 L190 32 L220 24 L260 16 L300 8 L330 4";
const verre = "bg-white/60 border border-white/90 backdrop-blur-xl shadow-[0_10px_30px_rgba(15,23,42,0.06)]";

export default function Login() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mot, setMot] = useState(0);

  useEffect(() => {
    const h = setInterval(() => setMot((m) => (m + 1) % MOTS.length), 2400);
    return () => clearInterval(h);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
    setLoading(false);
    if (error) { setError("E-mail ou mot de passe incorrect."); return; }
    router.push("/");
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f4f6fb] text-slate-900">
      <style>{`
        @keyframes derive1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(60px,40px) scale(1.12)}}
        @keyframes derive2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-50px,30px) scale(.9)}}
        @keyframes derive3{0%,100%{transform:translate(0,0)}50%{transform:translate(30px,-40px)}}
        @keyframes mot{0%{opacity:0;transform:translateY(22px)}12%,88%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-22px)}}
        @keyframes trace{from{stroke-dashoffset:420}to{stroke-dashoffset:0}}
        @keyframes entre{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
        .t1{animation:derive1 16s ease-in-out infinite}.t2{animation:derive2 20s ease-in-out infinite}.t3{animation:derive3 18s ease-in-out infinite}
        .mot{animation:mot 2.4s ease-in-out infinite}
        .trace{stroke-dasharray:420;animation:trace 3.2s ease-out infinite alternate}
        .e{animation:entre .6s ease-out both}
        @media (prefers-reduced-motion: reduce){.t1,.t2,.t3,.mot,.trace,.e{animation:none}}
      `}</style>
      <div aria-hidden className="t1 absolute -left-40 top-24 w-[520px] h-[520px] rounded-full bg-blue-500 blur-[100px] opacity-40" />
      <div aria-hidden className="t2 absolute -right-32 bottom-0 w-[480px] h-[480px] rounded-full bg-orange-400 blur-[100px] opacity-40" />
      <div aria-hidden className="t3 absolute right-1/3 -top-40 w-[380px] h-[380px] rounded-full bg-emerald-400 blur-[100px] opacity-30" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-10 px-5 py-10 lg:flex-row lg:items-center lg:gap-16">
        <div className="e flex flex-col gap-6 lg:flex-1">
          <Link href="/" className="flex items-baseline gap-1.5 self-start">
            <span className="text-[15px] font-bold text-slate-700">c&apos;est</span>
            <span className="text-[28px] font-extrabold tracking-[-0.04em]">Ludique</span>
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
          </Link>
          <h1 className="text-[64px] sm:text-[88px] lg:text-[104px] font-extrabold leading-[0.92] tracking-[-0.05em]">
            Viens
            <span className="block h-[1em] overflow-hidden">
              <span key={mot} className="mot block text-blue-600">{MOTS[mot]}.</span>
            </span>
          </h1>
          <p className="max-w-md text-lg font-semibold text-slate-600">Ton coach, ta montre, ton vélo. Tout au même endroit.</p>
        </div>

        <div className="grid w-full grid-cols-2 gap-3 lg:max-w-[440px]">
          <form onSubmit={handleSubmit} className={`e col-span-2 flex flex-col gap-3 rounded-[28px] p-5 ${verre}`} style={{ animationDelay: "80ms" }}>
            <label className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-700">E-mail
              <input name="email" type="email" required autoComplete="email" placeholder="toi@exemple.fr" value={form.email} onChange={handleChange}
                className="h-12 rounded-2xl border border-slate-300/60 bg-white/80 px-4 text-[15px] font-semibold text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/15" />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-bold text-slate-700">Mot de passe
              <input name="password" type="password" required autoComplete="current-password" placeholder="••••••••" value={form.password} onChange={handleChange}
                className="h-12 rounded-2xl border border-slate-300/60 bg-white/80 px-4 text-[15px] font-semibold text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/15" />
            </label>
            {error && <p className="text-center text-sm font-bold text-red-600">{error}</p>}
            <button type="submit" disabled={loading} className="h-[52px] rounded-2xl bg-blue-600 text-[16px] font-extrabold text-white shadow-[0_10px_24px_rgba(37,99,235,0.35)] transition hover:bg-blue-700 disabled:opacity-60">
              {loading ? "Connexion…" : "Se connecter"}
            </button>
            <Link href="/reset-password" className="self-center text-[13px] font-bold text-slate-500 hover:text-slate-800">Mot de passe oublié ?</Link>
          </form>

          <Link href="/home-trainer" className="e col-span-2 flex flex-col gap-2 overflow-hidden rounded-[28px] bg-gradient-to-br from-emerald-700 to-emerald-500 p-5 pb-3 text-white transition hover:brightness-105" style={{ animationDelay: "160ms" }}>
            <span className="flex items-start justify-between gap-2">
              <span className="flex flex-col">
                <span className="text-[20px] font-extrabold">Le home-trainer, ici aussi</span>
                <span className="text-[13.5px] font-semibold text-emerald-50">Tes séances et les grands cols, depuis ton ordinateur</span>
              </span>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" aria-hidden><path d="M9 6l6 6-6 6" /></svg>
            </span>
            <svg width="100%" height="64" viewBox="0 0 330 70" preserveAspectRatio="none" aria-hidden>
              <path d={COL} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="10" strokeLinecap="round" />
              <path className="trace" d={COL} fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>

          <Link href="/signup" className={`e col-span-2 flex items-center justify-between rounded-[24px] px-5 py-4 transition hover:bg-white/80 ${verre}`} style={{ animationDelay: "240ms" }}>
            <span className="flex flex-col">
              <span className="text-[15px] font-extrabold">Nouveau ici ?</span>
              <span className="text-[13px] font-semibold text-slate-600">Crée ton compte en une minute</span>
            </span>
            <span className="text-[14px] font-extrabold text-blue-600">S&apos;inscrire</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
