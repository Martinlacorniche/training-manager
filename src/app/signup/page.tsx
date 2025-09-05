"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { UserPlus, Trophy } from "lucide-react";

export default function Signup() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstname: "",
    lastname: "",
    role: "athlete",
    coachCode: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const { data, error: signUpError } = await supabase.auth.signUp({
  email: form.email,
  password: form.password,
});

if (signUpError) {
  setError("Erreur lors de l'inscription : " + signUpError.message);
  return;
}

const user = data.user;
if (!user) {
  setError("Utilisateur non trouvé après inscription.");
  return;
}


    if (!user) {
      setError("Utilisateur non trouvé après inscription.");
      return;
    }
await new Promise((resolve) => setTimeout(resolve, 1000));
    const { error: userError } = await supabase.from("users").insert({
      id_auth: user.id,
      name: form.firstname + " " + form.lastname,
      email: form.email,
      role: form.role,
    });
    if (form.role === "athlete" && form.coachCode) {
  const { data: coach } = await supabase
    .from("users")
    .select("id_auth")
    .eq("coach_code", form.coachCode)
    .eq("role", "coach")
    .single();

  if (coach) {
    await supabase
      .from("users")
      .update({ coach_id: coach.id_auth })
      .eq("id_auth", user.id);
  } else {
    setError("Code coach invalide.");
    return;
  }
}

    if (userError) {
  // On log l’erreur (pour toi), mais on n’affiche pas à l’utilisateur
  console.warn("Erreur lors de la création du profil :", userError.message);
}

// On affiche toujours le message de confirmation
setSuccess("Super, confirme ton inscription via le lien reçu par email !");
setTimeout(() => router.push("/login"), 2000);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-400 via-blue-400 to-blue-600 p-2 sm:p-6 flex flex-col items-center">

      <div className="flex flex-col items-center">
        {/* Logo en haut */}
        <div className="mb-4">
          <Image
            src="/coach-logo.jpg"
            width={120}
            height={120}
            alt="Logo NG Sports"
            className="rounded-full shadow-lg border-4 border-white -mb-4 mt-2"
          />
        </div>
        <div className="bg-white/90 rounded-2xl shadow-2xl p-8 w-full max-w-md flex flex-col items-center relative">
          <Trophy
            size={34}
            className="absolute -right-6 top-3 text-blue-700 drop-shadow-lg animate-bounce"
            strokeWidth={2.2}
          />
          <h2 className="text-2xl font-bold text-emerald-600 mb-2 tracking-tight flex items-center gap-2">
  <UserPlus className="inline mb-1 text-blue-700" size={28} />
  Crée ton compte
</h2>

          <p className="mb-6 text-teal-700 text-center font-semibold tracking-wide">
            Rejoins la team NG Sports Coaching !
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
            <div className="flex gap-2">
  <input
    name="firstname"
    placeholder="Prénom"
    value={form.firstname}
    onChange={handleChange}
    required
    className="w-1/2 p-2 rounded-xl border border-blue-200 focus:ring-2 focus:ring-emerald-300 transition"
  />
  <input
    name="lastname"
    placeholder="Nom"
    value={form.lastname}
    onChange={handleChange}
    required
    className="w-1/2 p-2 rounded-xl border border-blue-200 focus:ring-2 focus:ring-emerald-300 transition"
  />
</div>

            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              className="p-2 rounded-xl border border-blue-200 focus:ring-2 focus:ring-emerald-300 transition"
            >
              <option value="athlete">Athlète</option>
              <option value="coach">Coach</option>
            </select>
            {form.role === "athlete" && (
  <input
    name="coachCode"
    placeholder="Code coach (5 chiffres)"
    value={form.coachCode}
    onChange={handleChange}
    required
    className="p-2 rounded-xl border border-blue-200 focus:ring-2 focus:ring-emerald-300 transition"
  />
)}
            <input
              name="email"
              type="email"
              placeholder="Adresse e-mail"
              value={form.email}
              onChange={handleChange}
              required
              className="p-2 rounded-xl border border-blue-200 focus:ring-2 focus:ring-emerald-300 transition"
            />
            <input
              name="password"
              type="password"
              placeholder="Mot de passe"
              value={form.password}
              onChange={handleChange}
              required
              className="p-2 rounded-xl border border-blue-200 focus:ring-2 focus:ring-emerald-300 transition"
            />
            <button
              type="submit"
              className="p-2 rounded-xl bg-gradient-to-r from-blue-400 to-emerald-500 text-white font-bold mt-2 shadow-lg hover:scale-105 transition"
            >
              S’inscrire 🚀
            </button>
            {error && <div className="text-red-500 text-sm text-center mt-2">{error}</div>}
            {success && <div className="text-green-600 text-sm text-center mt-2">{success}</div>}
          </form>
          <div className="mt-4 text-sm text-gray-500">
            Tu as déjà un compte ?{" "}
            <a href="/login" className="text-blue-700 underline font-bold hover:text-emerald-600 transition">
              Connecte-toi
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
