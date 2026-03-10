"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus_Jakarta_Sans } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400","500","600","700","800"], display: "swap" });

export default function Login() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });

    setLoading(false);
    if (error) { setError("Email ou mot de passe incorrect."); return; }
    router.push("/");
  };

  return (
    <main className={`${jakarta.className} min-h-screen bg-slate-100 flex flex-col items-center justify-center px-4`}>

      <div className="w-full max-w-sm">

        <div className="flex flex-col items-center mb-8">
          <Image
            src="/coach-logo.jpg"
            width={56} height={56}
            alt="Logo C'est Ludique"
            className="rounded-full border border-slate-200 object-cover mb-4 shadow-sm"
          />
          <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">C&apos;est Ludique</h1>
          <p className="text-slate-500 text-sm mt-1">Bienvenue, connecte-toi pour continuer</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              name="email" type="email" placeholder="Adresse e-mail"
              value={form.email} onChange={handleChange} required
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 transition"
            />
            <input
              name="password" type="password" placeholder="Mot de passe"
              value={form.password} onChange={handleChange} required
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 transition"
            />
            {error && <p className="text-red-500 text-xs text-center">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition mt-1"
            >
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </form>

          <div className="mt-4 text-center">
            <a href="/reset-password" className="text-slate-400 hover:text-slate-600 text-xs transition">
              Mot de passe oublié ?
            </a>
          </div>
        </div>

        <p className="text-center text-slate-500 text-sm mt-5">
          Pas encore de compte ?{" "}
          <a href="/signup" className="text-emerald-600 hover:text-emerald-700 font-semibold transition">
            S&apos;inscrire
          </a>
        </p>

        <p className="text-center mt-4">
          <a href="/" className="text-slate-400 hover:text-slate-600 text-xs transition">
            ← Retour à l&apos;accueil
          </a>
        </p>

      </div>
    </main>
  );
}
