"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
dayjs.extend(isoWeek);

export default function StatsSemaine() {
  type User = {
  name: string;
  // autres champs si besoin
};
const [user, setUser] = useState<User | null>(null);

  type WeekData = {
  week: number;
  séances: number;
  heures: any;
  charge: any;
};
const [data, setData] = useState<WeekData[]>([]);


  useEffect(() => {
    const fetchUserAndSessions = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      const { data: user } = await supabase.from("users").select("*").eq("id_auth", session.user.id).single();
      setUser(user);

      const year = dayjs().year();
      const start = dayjs(`${year}-01-01`).startOf("isoWeek").format("YYYY-MM-DD");
      const end = dayjs(`${year}-12-31`).endOf("isoWeek").format("YYYY-MM-DD");

      const { data: sessions } = await supabase
        .from("sessions")
        .select("*")
        .eq("user_id", session.user.id)
        .gte("date", start)
        .lte("date", end);

      // Regroupement par semaine
      type WeekSummary = {
  week: number;
  séances: number;
  [key: string]: any; // si tu veux d’autres champs dynamiques
};

const weeks: { [key: number]: WeekSummary } = {};

      (sessions || []).forEach(s => {
        const week = dayjs(s.date).isoWeek();
        if (!weeks[week]) {
          weeks[week] = {
            week,
            séances: 0,
            heures: 0,
            charge: 0,
          };
        }
        weeks[week].séances += 1;
        weeks[week].heures += Number(s.planned_hour || 0);
        weeks[week].charge += (Number(s.rpe || 0) * Number(s.planned_hour || 0));
      });

      // Générer tableau pour graphe (toutes les semaines, même vides)
      const allWeeks = Array.from({ length: 53 }, (_, i) => i + 1).map(week => ({
        week,
        séances: weeks[week]?.séances || 0,
        heures: weeks[week]?.heures || 0,
        charge: weeks[week]?.charge || 0,
      }));

      setData(allWeeks.filter(w => w.séances > 0 || w.heures > 0 || w.charge > 0));
    };
    fetchUserAndSessions();
  }, []);

  // --- Calcul des podiums (top 3) ---
  const medal = (idx: number) => ["🥇", "🥈", "🥉"][idx] || "";
  const colorClass = (idx: number) =>
    idx === 0
      ? "font-bold text-yellow-700"
      : idx === 1
      ? "font-semibold text-gray-600"
      : "font-semibold text-orange-800";

  // Top 3 heures
  const topHeures = [...data]
    .sort((a, b) => b.heures - a.heures)
    .slice(0, 3);
  // Top 3 séances
  const topSeances = [...data]
    .sort((a, b) => b.séances - a.séances)
    .slice(0, 3);
  // Top 3 charge
  const topCharge = [...data]
    .sort((a, b) => b.charge - a.charge)
    .slice(0, 3);

  if (!user) return <div>Chargement...</div>;
  if (data.length === 0) return <div className="text-center text-gray-400 mb-8">Aucune statistique enregistrée pour cette année.</div>;

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-400 via-blue-400 to-blue-600 p-2 sm:p-6 flex flex-col items-center">

      <h1 className="text-3xl font-bold text-blue-900 mb-6">Statistiques - {user.name}</h1>
      <div className="w-full max-w-4xl bg-white/90 rounded-2xl shadow-2xl p-8 flex flex-col items-center">
        <h2 className="text-xl font-semibold text-blue-800 mb-4">Nombre de séances par semaine</h2>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" label={{ value: "Semaine", position: "insideBottomRight", offset: 0 }}/>
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="séances" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
        <h2 className="text-xl font-semibold text-blue-800 mt-10 mb-4">Nombre d'heures et index de charge</h2>
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" label={{ value: "Semaine", position: "insideBottomRight", offset: 0 }}/>
            <YAxis yAxisId="left" label={{ value: "Heures", angle: -90, position: "insideLeft" }}/>
            <YAxis yAxisId="right" orientation="right" label={{ value: "Charge", angle: 90, position: "insideRight" }}/>
            <Tooltip />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="heures" stroke="#2563eb" name="Heures"/>
            <Line yAxisId="right" type="monotone" dataKey="charge" stroke="#f59e42" name="Charge"/>
          </LineChart>
        </ResponsiveContainer>

        {/* PODIUMS */}
        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
  {/* Top heures */}
  <div className="bg-blue-50 rounded-xl shadow p-4">
    <h3 className="font-bold text-blue-800 mb-2">🏆 Top 3 semaines (heures)</h3>
    <ol className="list-decimal ml-4">
      {topHeures.length === 0
        ? <li className="text-gray-400">Aucune donnée</li>
        : topHeures.map((w, i) => (
            <li key={i} className={colorClass(i)}>
              {medal(i)} <span className="font-bold">Semaine {w.week} : {w.heures.toFixed(1)} h</span>
            </li>
          ))}
    </ol>
  </div>
  {/* Top séances */}
  <div className="bg-emerald-50 rounded-xl shadow p-4">
    <h3 className="font-bold text-emerald-800 mb-2">🥈 Top 3 semaines (séances)</h3>
    <ol className="list-decimal ml-4">
      {topSeances.length === 0
        ? <li className="text-gray-400">Aucune donnée</li>
        : topSeances.map((w, i) => (
            <li key={i} className={colorClass(i)}>
              {medal(i)} <span className="font-bold">Semaine {w.week} : {w.séances} séances</span>
            </li>
          ))}
    </ol>
  </div>
  {/* Top charge */}
  <div className="bg-orange-50 rounded-xl shadow p-4">
    <h3 className="font-bold text-orange-800 mb-2">💥 Top 3 semaines (charge)</h3>
    <ol className="list-decimal ml-4">
      {topCharge.length === 0
        ? <li className="text-gray-400">Aucune donnée</li>
        : topCharge.map((w, i) => (
            <li key={i} className={colorClass(i)}>
              {medal(i)} <span className="font-bold">Semaine {w.week} : charge {w.charge.toFixed(0)}</span>
            </li>
          ))}
    </ol>
  </div>
</div>

      </div>
    </main>
  );
}
