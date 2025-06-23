"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
dayjs.extend(isoWeek);

export default function StatsCoachSemaine() {
  type Athlete = {
  id_auth: string;
  name: string;
};
  const [athletes, setAthletes] = useState<Athlete[]>([]);

  const [athleteId, setAthleteId] = useState("all");
  type WeekData = {
  week: number;
  séances: number;
  heures: any;
  charge: any;
};
const [data, setData] = useState<WeekData[]>([]);

  const [loading, setLoading] = useState(true);
  const [topWeeks, setTopWeeks] = useState([]);
  const [topAthletes, setTopAthletes] = useState([]);

  useEffect(() => {
    const fetchAthletes = async () => {
      const { data: aths } = await supabase.from("users").select("id_auth,name").eq("role", "athlete").order("name");
      setAthletes(aths || []);
    };
    fetchAthletes();
  }, []);

  useEffect(() => {
    const fetchSessions = async () => {
      setLoading(true);
      const year = dayjs().year();
      const start = dayjs(`${year}-01-01`).startOf("isoWeek").format("YYYY-MM-DD");
      const end = dayjs(`${year}-12-31`).endOf("isoWeek").format("YYYY-MM-DD");

      // On demande le nom de l'athlète en plus
      let { data: sessions } = await supabase
        .from("sessions")
        .select("*, users!sessions_user_id_fkey(name)") // <-- récupère users.name
        .gte("date", start)
        .lte("date", end);

      if (athleteId !== "all") {
        sessions = (sessions || []).filter(s => s.user_id === athleteId);
      }

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

      // Tableau pour graphe
      const allWeeks = Array.from({ length: 53 }, (_, i) => i + 1).map(week => ({
        week,
        séances: weeks[week]?.séances || 0,
        heures: weeks[week]?.heures || 0,
        charge: weeks[week]?.charge || 0,
      }));
      setData(allWeeks.filter(w => w.séances > 0 || w.heures > 0 || w.charge > 0));

      // --- TOP 3 semaines ---
      const bestWeeks = Object.values(weeks)
        .sort((a, b) => b.heures - a.heures)
        .slice(0, 3);
      setTopWeeks(bestWeeks);

      // --- TOP 3 athlètes sur l'année ---
      const athletesMap = {};
      (sessions || []).forEach(s => {
        const uid = s.user_id;
        const name = s.users?.name || "Inconnu";
        if (!athletesMap[uid]) {
          athletesMap[uid] = {
            name,
            séances: 0,
            heures: 0,
            charge: 0,
          };
        }
        athletesMap[uid].séances += 1;
        athletesMap[uid].heures += Number(s.planned_hour || 0);
        athletesMap[uid].charge += (Number(s.rpe || 0) * Number(s.planned_hour || 0));
      });
      const bestAthletes = Object.values(athletesMap)
        .sort((a, b) => b.heures - a.heures)
        .slice(0, 3);
      setTopAthletes(bestAthletes);

      setLoading(false);
    };
    fetchSessions();
  }, [athleteId]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-400 via-blue-400 to-blue-600 p-2 sm:p-6 flex flex-col items-center">

      <h1 className="text-3xl font-bold text-blue-900 mb-6">Statistiques - Coach</h1>
      <div className="w-full max-w-4xl bg-white/90 rounded-2xl shadow-2xl p-8 flex flex-col items-center">
        <div className="mb-8 w-full flex flex-col sm:flex-row items-center gap-3">
          <label htmlFor="athlete-select" className="font-semibold text-blue-800">
            {athletes.length > 1 ? "Sélectionner un athlète :" : "Athlète :"}
          </label>
          <select
            id="athlete-select"
            className="rounded-lg p-2 border min-w-[160px]"
            value={athleteId}
            onChange={e => setAthleteId(e.target.value)}
          >
            <option value="all">Tous les athlètes</option>
            {athletes.map(a => (
              <option key={a.id_auth} value={a.id_auth}>{a.name}</option>
            ))}
          </select>
        </div>
        {loading ? (
          <div className="text-center text-gray-400 mb-8">Chargement…</div>
        ) : data.length === 0 ? (
          <div className="text-center text-gray-400 mb-8">Aucune statistique enregistrée pour cette année.</div>
        ) : (
          <>
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

            {/* TOPS */}
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
              {/* Top semaines */}
              <div className="bg-blue-50 rounded-xl shadow p-4">
                <h3 className="font-bold text-blue-800 mb-2">🏆 Top 3 semaines (heures)</h3>
                <ol className="list-decimal ml-4">
                  {topWeeks.length === 0
                    ? <li className="text-gray-400">Aucune donnée</li>
                    : topWeeks.map((w, i) => (
                      <li key={i}>
                        Semaine {w.week} : {w.heures.toFixed(1)} h, {w.séances} séances, charge {w.charge.toFixed(0)}
                      </li>
                    ))}
                </ol>
              </div>
              {/* Top athlètes */}
              <div className="bg-emerald-50 rounded-xl shadow p-4">
                <h3 className="font-bold text-emerald-800 mb-2">💪 Top 3 athlètes (heures annuelles)</h3>
                <ol className="list-decimal ml-4">
                  {topAthletes.length === 0
                    ? <li className="text-gray-400">Aucune donnée</li>
                    : topAthletes.map((a, i) => (
                      <li key={i}>
                        {a.name} : {a.heures.toFixed(1)} h, {a.séances} séances, charge {a.charge.toFixed(0)}
                      </li>
                    ))}
                </ol>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
