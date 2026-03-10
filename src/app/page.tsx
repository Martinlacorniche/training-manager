"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { Plus_Jakarta_Sans } from "next/font/google";
import {
  ClipboardList, Users, BarChart2, Key,
  Smartphone, Bike, Activity, Timer, Heart, Zap, Target, TrendingUp,
  Send,
} from "lucide-react";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400","500","600","700","800"], display: "swap" });

const COACH_FEATURES = [
  { icon: ClipboardList, text: "Planification hebdomadaire complète" },
  { icon: Users,         text: "Tous tes athlètes réunis au même endroit" },
  { icon: BarChart2,     text: "Stats par athlète : charge, sport, RPE, progression" },
  { icon: Zap,           text: "Multi-sports : Vélo, Run, Natation, Trail, Muscu, Renfo" },
  { icon: Target,        text: "Durée, intensité et RPE cible pour chaque séance" },
  { icon: Key,           text: "Un code coach unique à partager à tes athlètes" },
];

const ATHLETE_FEATURES = [
  { icon: Smartphone,  text: "App mobile iOS & Android — ton programme partout" },
  { icon: Bike,        text: "Intégration Strava automatique" },
  { icon: Timer,       text: "Chrono Tabata intégré dans l'app" },
  { icon: TrendingUp,  text: "Suivi de charge hebdomadaire (volume, intensité, RPE)" },
  { icon: Heart,       text: "Mode Duo : Pour mieux t'organiser avec ton/ta +1" },
  { icon: Activity,    text: "Stats perso : distance, dénivelé, FC, watts" },
];

type FormState = "idle" | "sending" | "sent" | "error";

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [form, setForm] = useState({ prenom: "", email: "", sport: "", message: "" });
  const [formState, setFormState] = useState<FormState>("idle");

  async function handleContact(e: React.FormEvent) {
    e.preventDefault();
    setFormState("sending");
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setFormState(res.ok ? "sent" : "error");
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.id) { setChecking(false); return; }
      supabase.from("users").select("role").eq("id_auth", session.user.id).single()
        .then(({ data: user }) => {
          if (user?.role === "coach") router.push("/coach");
          else if (user?.role === "athlete") router.push("/athlete");
          else setChecking(false);
        });
    });
  }, [router]);

  if (checking) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-slate-100">
        <span className="text-slate-400 text-sm animate-pulse">Chargement…</span>
      </main>
    );
  }

  return (
    <main className={`${jakarta.className} min-h-screen text-slate-800 bg-cover bg-center bg-fixed`} style={{ backgroundImage: "url('/background.png')" }}>

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-md shadow-sm">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Image
              src="/coach-logo.jpg"
              width={36} height={36}
              alt="Logo"
              className="rounded-full border border-slate-200 object-cover"
            />
            <span className="font-extrabold text-base tracking-tight text-slate-800">
              C&apos;est Ludique
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a href="/login" className="text-slate-500 hover:text-slate-800 text-sm font-medium transition px-3 py-1.5">
              Connexion
            </a>
            <a href="/signup" className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold px-4 py-1.5 rounded-lg transition">
              S&apos;inscrire
            </a>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="max-w-5xl mx-auto px-5 pt-14 pb-10 text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full mb-5 uppercase tracking-widest">
          100% gratuit
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
          C&apos;est Ludique
        </h1>
        <p className="mt-4 text-slate-600 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
          La plateforme de coaching sportif pour les coachs qui planifient<br className="hidden md:block" />
          et les athlètes qui performent.
        </p>
      </section>

      {/* ── SPLIT ── */}
      <section className="max-w-5xl mx-auto px-5 pb-16 grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── COACH ── */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-7 flex flex-col">
          <div className="mb-2">
            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
              Coach
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Tu planifies, ils performent.</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-5">
            Un outil complet pour créer des semaines d&apos;entraînement sur mesure,
            suivre tes athlètes et analyser leur progression — depuis une interface web rapide.
          </p>

          <ul className="space-y-2.5 mb-6 flex-1">
            {COACH_FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-2.5">
                <Icon size={15} className="text-emerald-500 mt-0.5 shrink-0" />
                <span className="text-slate-600 text-sm">{text}</span>
              </li>
            ))}
          </ul>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5">
            <p className="text-slate-700 font-semibold text-sm mb-2">Comment ça marche ?</p>
            <ol className="space-y-1 text-slate-500 text-sm list-decimal ml-4">
              <li>Inscris-toi en tant que <span className="text-slate-700 font-semibold">Coach</span></li>
              <li>Reçois ton <span className="text-slate-700 font-semibold">code unique</span></li>
              <li>Transmets-le à tes athlètes</li>
            </ol>
          </div>

          <a
            href="/signup?role=coach"
            className="block text-center bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl transition text-sm"
          >
            Je m&apos;inscris en tant que Coach →
          </a>
        </div>

        {/* ── ATHLETE ── */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-7 flex flex-col">
          <div className="mb-2">
            <span className="bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
              Athlète
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Ton programme, partout avec toi.</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-5">
            Demande à ton coach son code, inscris-toi et c&apos;est parti.
            Web ou mobile — ton planning est toujours là, Strava connecté, charge suivie.
          </p>

          <ul className="space-y-2.5 mb-6 flex-1">
            {ATHLETE_FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-2.5">
                <Icon size={15} className="text-blue-500 mt-0.5 shrink-0" />
                <span className="text-slate-600 text-sm">{text}</span>
              </li>
            ))}
          </ul>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5">
            <p className="text-slate-700 font-semibold text-sm mb-2">Comment ça marche ?</p>
            <ol className="space-y-1 text-slate-500 text-sm list-decimal ml-4">
              <li>Demande le <span className="text-slate-700 font-semibold">code</span> à ton coach</li>
              <li>Inscris-toi en tant qu&apos;<span className="text-slate-700 font-semibold">Athlète</span></li>
              <li>Saisis le code coach à l&apos;inscription</li>
              <li>Transpire 🔥</li>
            </ol>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <a
              href="https://apps.apple.com/fr/app/cest-ludique/id6751885052"
              target="_blank" rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3 hover:border-slate-300 hover:shadow-sm transition"
            >
              <QRCodeSVG
                value="https://apps.apple.com/fr/app/cest-ludique/id6751885052"
                size={72} bgColor="transparent" fgColor="#1e293b"
              />
              <span className="text-slate-500 text-xs font-semibold">📱 App Store</span>
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=ngsport.planning&hl=fr"
              target="_blank" rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3 hover:border-slate-300 hover:shadow-sm transition"
            >
              <QRCodeSVG
                value="https://play.google.com/store/apps/details?id=ngsport.planning&hl=fr"
                size={72} bgColor="transparent" fgColor="#1e293b"
              />
              <span className="text-slate-500 text-xs font-semibold">🤖 Google Play</span>
            </a>
          </div>

          <a
            href="/signup"
            className="block text-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl transition text-sm mt-3"
          >
            Je m&apos;inscris en tant qu&apos;Athlète →
          </a>
        </div>

      </section>

      {/* ── CONTACT SANS COACH ── */}
      <section className="max-w-2xl mx-auto px-5 pb-16">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-7">
          <div className="mb-3">
            <span className="bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
              Pas encore de coach ?
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-1">On peut t&apos;aider à en trouver un.</h2>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            Laisse-nous tes infos et on revient vers toi rapidement.
          </p>

          {formState === "sent" ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-3">🎉</div>
              <p className="text-slate-700 font-semibold">Message envoyé !</p>
              <p className="text-slate-500 text-sm mt-1">On te répond dès que possible.</p>
            </div>
          ) : (
            <form onSubmit={handleContact} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Prénom *</label>
                  <input
                    type="text"
                    required
                    placeholder="Thomas"
                    value={form.prenom}
                    onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="thomas@email.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Sport(s) pratiqué(s) *</label>
                <input
                  type="text"
                  required
                  placeholder="Triathlon, Trail, Vélo…"
                  value={form.sport}
                  onChange={e => setForm(f => ({ ...f, sport: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Message (optionnel)</label>
                <textarea
                  placeholder="Ton niveau, tes objectifs, tes disponibilités…"
                  rows={3}
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none"
                />
              </div>
              {formState === "error" && (
                <p className="text-red-500 text-xs">Une erreur s&apos;est produite. Réessaie dans un moment.</p>
              )}
              <button
                type="submit"
                disabled={formState === "sending"}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl transition text-sm"
              >
                <Send size={14} />
                {formState === "sending" ? "Envoi…" : "Envoyer ma demande"}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center">
        <p className="text-slate-400 text-xs">
          C&apos;est Ludique × NG Sport Coaching — 100% gratuit
        </p>
        <div className="mt-2 flex items-center justify-center gap-4 text-xs">
          <a href="/login"   className="text-slate-400 hover:text-slate-700 transition">Connexion</a>
          <span className="text-slate-300">·</span>
          <a href="/signup"  className="text-slate-400 hover:text-slate-700 transition">Inscription</a>
          <span className="text-slate-300">·</span>
          <a href="/privacy" className="text-slate-400 hover:text-slate-700 transition">Confidentialité</a>
        </div>
      </footer>

    </main>
  );
}
