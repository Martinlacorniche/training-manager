"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { BikeIcon } from "lucide-react";

export default function ResetPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });

    if (error) {
      setError("Erreur : " + error.message);
    } else {
      setMessage("Si ton email existe, un lien a été envoyé !");
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-400 via-blue-400 to-blue-600 p-2 sm:p-6 flex flex-col items-center">
      <div className="flex flex-col items-center">
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
          <h2 className="text-2xl font-bold text-emerald-600 mb-2 flex items-center gap-2">
            <BikeIcon className="inline mb-1 text-blue-700" size={28} />
            Mot de passe oublié ?
          </h2>
          <p className="mb-6 text-blue-700 text-center font-semibold tracking-wide">
            Renseigne ton adresse mail pour recevoir un lien de réinitialisation !
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
            <input
              type="email"
              placeholder="Adresse e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="p-2 rounded-xl border border-emerald-200 focus:ring-2 focus:ring-blue-300 transition"
            />
            <button
              type="submit"
              className="p-2 rounded-xl bg-gradient-to-r from-blue-400 to-emerald-500 text-white font-bold mt-2 shadow-lg hover:scale-105 transition"
            >
              Envoyer le lien 🚴
            </button>
          </form>
          {message && <div className="text-green-700 mt-3 text-center">{message}</div>}
          {error && <div className="text-red-500 mt-3 text-center">{error}</div>}
          <div className="mt-4 text-sm text-gray-500">
            <a href="/login" className="text-emerald-700 underline font-bold hover:text-blue-600 transition">
              Retour à la connexion
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
