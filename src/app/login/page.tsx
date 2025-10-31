"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Bike, BikeIcon } from "lucide-react";

export default function Login() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });

    if (error) {
      setError(error.message || "Erreur de connexion.");
      return;
    }

    router.push("/");
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-400 via-blue-400 to-blue-600 p-2 sm:p-6 flex flex-col items-center">

      <div className="flex flex-col items-center">
        {/* Logo avec icône vélo */}
        <div className="mb-4 relative w-fit mx-auto">
          <Image
            src="/coach-logo.jpg"
            width={120}
            height={120}
            alt="Logo NG Sports"
            className="rounded-full shadow-lg border-4 border-white object-cover -mb-2 mt-2"
            priority
          />
          <BikeIcon
            size={34}
            className="absolute -right-7 top-5 text-blue-700 drop-shadow-lg animate-bounce"
            strokeWidth={2.2}
          />
        </div>
        <div className="bg-white/90 rounded-2xl shadow-2xl p-8 w-full max-w-md flex flex-col items-center relative">
          <h2 className="text-2xl font-bold text-emerald-600 mb-2 tracking-tight flex items-center gap-2">
  <Bike className="inline mb-1 text-blue-700" size={28} />
  Connexion
</h2>

          <p className="mb-6 text-blue-700 text-center font-semibold tracking-wide">
            Viens transpirer avec NG Sport Coaching !
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
            <input
              name="email"
              type="email"
              placeholder="Adresse e-mail"
              value={form.email}
              onChange={handleChange}
              required
              className="p-2 rounded-xl border border-emerald-200 focus:ring-2 focus:ring-blue-300 transition"
            />
            <input
              name="password"
              type="password"
              placeholder="Mot de passe"
              value={form.password}
              onChange={handleChange}
              required
              className="p-2 rounded-xl border border-emerald-200 focus:ring-2 focus:ring-blue-300 transition"
            />
            <button
              type="submit"
              className="p-2 rounded-xl bg-gradient-to-r from-blue-400 to-emerald-500 text-white font-bold mt-2 shadow-lg hover:scale-105 transition"
            >
              Se connecter 🚴‍♂️
            </button>
            {error && <div className="text-red-500 text-sm text-center mt-2">{error}</div>}
          </form>
          <div className="mt-4 text-sm text-gray-500">
            Pas encore de compte ?{" "}
            <a href="/signup" className="text-emerald-700 underline font-bold hover:text-blue-600 transition">
              Inscris-toi
            </a>
          </div>
          <div className="mt-2 text-sm text-gray-500">
  <a
    href="/reset-password"
    className="text-emerald-700 underline font-bold hover:text-blue-600 transition"
  >
    Mot de passe oublié ?
  </a>
</div>

        </div>
      </div>
    </main>
  );
}
