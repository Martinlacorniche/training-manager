"use client";
import { Suspense, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Plus_Jakarta_Sans } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400","500","600","700","800"], display: "swap" });

export default function Signup() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = searchParams.get("role") === "coach" ? "coach" : "athlete";
  const [form, setForm] = useState({
    email: "", password: "", firstname: "", lastname: "",
    role: initialRole, coachCode: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (signUpError) {
      setError("Erreur lors de l'inscription : " + signUpError.message);
      setLoading(false);
      return;
    }

    const user = data.user;
    if (!user) { setError("Utilisateur non trouvé après inscription."); setLoading(false); return; }

    await new Promise((resolve) => setTimeout(resolve, 1000));

    await supabase.from("users").insert({
      id_auth: user.id,
      name: form.firstname + " " + form.lastname,
      email: form.email,
      role: form.role,
    });

    if (form.role === "athlete" && form.coachCode) {
      const { data: coach } = await supabase
        .from("users").select("id_auth")
        .eq("coach_code", form.coachCode).eq("role", "coach").single();

      if (coach) {
        await supabase.from("users").update({ coach_id: coach.id_auth }).eq("id_auth", user.id);
      } else {
        setError("Code coach invalide.");
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    setSuccess("Super ! Confirme ton inscription via le lien reçu par email 📬");
    setTimeout(() => router.push("/login"), 2500);
  };

  const isCoach = form.role === "coach";

  return (
    <main className={`${jakarta.className} min-h-screen bg-slate-100 flex flex-col items-center justify-center px-4 py-10`}>

      <div className="w-full max-w-sm">

        <div className="flex flex-col items-center mb-8">
          <Image
            src="/coach-logo.jpg"
            width={56} height={56}
            alt="Logo C'est Ludique"
            className="rounded-full border border-slate-200 object-cover mb-4 shadow-sm"
          />
          <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Crée ton compte</h1>
          <p className="text-slate-500 text-sm mt-1">Rejoins la team NG Sport Coaching</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">

          {/* Toggle */}
          <div className="flex bg-slate-100 border border-slate-200 rounded-xl p-1 mb-4">
            <button
              type="button"
              onClick={() => setForm({ ...form, role: "athlete" })}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${
                !isCoach
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Athlète
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, role: "coach" })}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${
                isCoach
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Coach
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                name="firstname" placeholder="Prénom"
                value={form.firstname} onChange={handleChange} required
                className="w-1/2 bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 transition"
              />
              <input
                name="lastname" placeholder="Nom"
                value={form.lastname} onChange={handleChange} required
                className="w-1/2 bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 transition"
              />
            </div>
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
            {!isCoach && (
              <input
                name="coachCode" placeholder="Code coach (5 chiffres)"
                value={form.coachCode} onChange={handleChange} required
                className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition"
              />
            )}

            {error   && <p className="text-red-500 text-xs text-center">{error}</p>}
            {success && <p className="text-emerald-600 text-xs text-center">{success}</p>}

            <button
              type="submit" disabled={loading}
              className={`w-full font-bold py-2.5 rounded-xl text-sm transition mt-1 disabled:opacity-50 text-white ${
                isCoach
                  ? "bg-emerald-500 hover:bg-emerald-600"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {loading ? "Inscription…" : "Créer mon compte"}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-500 text-sm mt-5">
          Tu as déjà un compte ?{" "}
          <a href="/login" className="text-emerald-600 hover:text-emerald-700 font-semibold transition">
            Se connecter
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
