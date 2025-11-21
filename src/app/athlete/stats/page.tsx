"use client";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend
} from "recharts";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import isoWeeksInYear from "dayjs/plugin/isoWeeksInYear";
import isLeapYear from "dayjs/plugin/isLeapYear";
import "dayjs/locale/fr";
import { Trophy, ChartBar, Lightning } from "@phosphor-icons/react";
import { Plus_Jakarta_Sans } from "next/font/google";

// Config DayJS
dayjs.extend(isoWeek);
dayjs.extend(isoWeeksInYear);
dayjs.extend(isLeapYear);
dayjs.locale("fr");

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["500","600","700"], display: "swap" });

const SPORT_COLORS: Record<string, string> = {
  "Vélo": "#10b981",      // Emerald
  "Run": "#64748b",       // Slate
  "Natation": "#06b6d4",  // Cyan
  "Muscu": "#f59e0b",     // Amber
  "Renfo": "#f59e0b",
  "Trail": "#84cc16",     // Lime
  "Autre": "#9ca3af"      // Gray
};

// Helper pour affichage propre (4.5 -> 4h30)
function fmtDuration(decimal: number) {
  const totalMinutes = Math.round(decimal * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

export default function StatsAthlete() {
  const [user, setUser] = useState<{ name: string } | null>(null);
  const [year, setYear] = useState(dayjs().year());
  const [rawData, setRawData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // State pour le survol synchronisé (Podium -> Graph)
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  // 1. Chargement des données
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;

      // Récupérer le nom (juste pour l'affichage "Bonjour X")
      const { data: u } = await supabase.from("users").select("name").eq("id_auth", session.user.id).single();
      setUser(u);

      // Bornes de l'année
      const start = dayjs(`${year}-01-01`).startOf("isoWeek").format("YYYY-MM-DD");
      const end = dayjs(`${year}-12-31`).endOf("isoWeek").format("YYYY-MM-DD");

      // Récupérer UNIQUEMENT les sessions de l'athlète connecté
      const { data: sessions } = await supabase
        .from("sessions")
        .select("date, planned_hour, sport, rpe, status")
        .eq("user_id", session.user.id)
        .gte("date", start)
        .lte("date", end);
      
      setRawData(sessions || []);
      setLoading(false);
    };
    fetchData();
  }, [year]);

  // 2. Transformation des données pour le Graphique
  const chartData = useMemo(() => {
    const weeks: Record<number, any> = {};
    const weeksInYear = dayjs(`${year}-12-31`).isoWeeksInYear();
    
    // Initialisation à vide pour éviter les trous
    for (let i = 1; i <= weeksInYear; i++) {
        weeks[i] = { 
            name: `S${i}`, 
            weekIndex: i,
            totalHours: 0, 
            load: 0, 
            count: 0,
            Vélo: 0, Run: 0, Natation: 0, Muscu: 0, Trail: 0, Autre: 0 
        };
    }

    rawData.forEach(s => {
        const w = dayjs(s.date).isoWeek();
        if (weeks[w]) {
            const h = Number(s.planned_hour || 0);
            // Si RPE vide, on met une valeur par défaut faible (ex: 3) ou moyenne (5) pour l'estimation
            const rpe = s.rpe ? Number(s.rpe) : 5; 
            
            weeks[w].count += 1;
            weeks[w].totalHours += h;
            weeks[w].load += (h * rpe);

            // Répartition par sport
            const sportKey = (s.sport && SPORT_COLORS[s.sport]) ? s.sport : "Autre";
            const finalSportKey = sportKey === "Renfo" ? "Muscu" : sportKey;
            
            if (weeks[w][finalSportKey] !== undefined) {
                weeks[w][finalSportKey] += h;
            } else {
                weeks[w].Autre += h;
            }
        }
    });

    return Object.values(weeks);
  }, [rawData, year]);

  // 3. Calcul des Podiums
  const topHours = [...chartData].sort((a, b) => b.totalHours - a.totalHours).slice(0, 3);
  const topLoad = [...chartData].sort((a, b) => b.load - a.load).slice(0, 3);

  // Formatage tooltip
  const formatTooltip = (value: number, name: string) => {
     const val = Number(value);
     if (name === "Charge") return [Math.round(val), "Charge"];
     return [fmtDuration(val), name];
  };

  // Gestion du survol
  const handlePodiumHover = (weekIndex: number) => {
      setActiveIndex(weekIndex - 1);
  };

  return (
    <main className={`${jakarta.className} min-h-screen bg-slate-50 text-slate-800 pb-10`}>
      
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="bg-blue-600 text-white px-2 py-1 rounded font-bold text-xs uppercase tracking-tight">Statistiques</div>
               <div className="font-bold text-slate-800 text-lg hidden sm:block">{user?.name || "Athlète"}</div>
            </div>

            {/* Sélecteur Année */}
            <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
                <button onClick={()=>setYear(year-1)} className="px-3 py-1 text-xs font-bold text-slate-500 hover:text-slate-800">{year-1}</button>
                <div className="px-3 py-1 text-xs font-bold bg-white text-emerald-600 shadow-sm rounded">{year}</div>
                <button onClick={()=>setYear(year+1)} className="px-3 py-1 text-xs font-bold text-slate-500 hover:text-slate-800">{year+1}</button>
            </div>
          </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 mt-8 space-y-8">
        
        {loading ? (
            <div className="text-center py-20 text-slate-400 animate-pulse">Chargement de tes exploits...</div>
        ) : (
            <>
                {/* GRAPHIQUE PRINCIPAL */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[450px]">
                    <div className="flex items-center gap-2 mb-6">
                        <ChartBar size={24} className="text-emerald-600"/>
                        <h2 className="font-bold text-slate-800">Volume & Charge Hebdomadaire</h2>
                    </div>
                    <ResponsiveContainer width="100%" height="85%">
                        <ComposedChart 
                            data={chartData} 
                            activeIndex={activeIndex}
                            onMouseMove={(state: any) => {
                                if (state.isTooltipActive) setActiveIndex(state.activeTooltipIndex);
                                else setActiveIndex(undefined);
                            }}
                            margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                            <XAxis 
                                dataKey="name" 
                                tick={{fontSize: 10, fill:"#94a3b8"}} 
                                tickLine={false} 
                                interval={3} // Affiche une semaine sur 4 pour éviter la surcharge
                            />
                            <YAxis yAxisId="left" tick={{fontSize: 11, fill:"#64748b"}} tickLine={false} axisLine={false} unit="h"/>
                            <YAxis yAxisId="right" orientation="right" tick={{fontSize: 11, fill:"#f59e0b"}} tickLine={false} axisLine={false}/>
                            
                            <Tooltip 
                                contentStyle={{backgroundColor: "#fff", borderRadius: "12px", border:"none", boxShadow:"0 4px 12px rgba(0,0,0,0.1)"}}
                                itemStyle={{fontSize: "12px", fontWeight: "600"}}
                                formatter={formatTooltip}
                                labelStyle={{color: "#1e293b", fontWeight: "bold", marginBottom: "5px"}}
                            />
                            <Legend iconType="circle" wrapperStyle={{fontSize: "12px", paddingTop: "10px"}}/>

                            {/* Barres empilées par sport (Volume) */}
                            <Bar yAxisId="left" dataKey="Vélo" stackId="a" fill={SPORT_COLORS["Vélo"]} radius={[0,0,0,0]} barSize={12} />
                            <Bar yAxisId="left" dataKey="Run" stackId="a" fill={SPORT_COLORS["Run"]} radius={[0,0,0,0]} barSize={12} />
                            <Bar yAxisId="left" dataKey="Natation" stackId="a" fill={SPORT_COLORS["Natation"]} radius={[0,0,0,0]} barSize={12} />
                            <Bar yAxisId="left" dataKey="Muscu" stackId="a" fill={SPORT_COLORS["Muscu"]} radius={[0,0,0,0]} barSize={12} />
                            <Bar yAxisId="left" dataKey="Trail" stackId="a" fill={SPORT_COLORS["Trail"]} radius={[0,0,0,0]} barSize={12} />
                            
                            {/* Ligne de Charge */}
                            <Line yAxisId="right" type="monotone" dataKey="load" stroke="#f59e0b" strokeWidth={3} dot={false} name="Charge" activeDot={{r: 6}} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>

                {/* PODIUMS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Top Volume */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-2 mb-4 text-emerald-700">
                            <Trophy size={24} weight="duotone"/>
                            <h3 className="font-bold">Record Volume (Heures)</h3>
                        </div>
                        <div className="space-y-3">
                            {topHours.map((w, i) => (
                                <div 
                                    key={w.name} 
                                    onMouseEnter={() => handlePodiumHover(w.weekIndex)}
                                    onMouseLeave={() => setActiveIndex(undefined)}
                                    className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-emerald-50 hover:border-emerald-200 border border-transparent transition cursor-pointer"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`font-bold text-lg w-6 ${i===0?"text-yellow-500": i===1?"text-slate-400":"text-orange-400"}`}>#{i+1}</div>
                                        <div className="text-sm font-semibold text-slate-700">Semaine {w.weekIndex}</div>
                                    </div>
                                    <div className="font-mono font-bold text-emerald-600">{fmtDuration(w.totalHours)}</div>
                                </div>
                            ))}
                            {topHours.every(w => w.totalHours === 0) && <div className="text-slate-400 italic text-sm">Pas encore de données... au boulot !</div>}
                        </div>
                    </div>

                    {/* Top Charge */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-2 mb-4 text-amber-600">
                            <Lightning size={24} weight="duotone"/>
                            <h3 className="font-bold">Record Intensité (Charge)</h3>
                        </div>
                        <div className="space-y-3">
                            {topLoad.map((w, i) => (
                                <div 
                                    key={w.name}
                                    onMouseEnter={() => handlePodiumHover(w.weekIndex)}
                                    onMouseLeave={() => setActiveIndex(undefined)}
                                    className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-amber-50 hover:border-amber-200 border border-transparent transition cursor-pointer"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`font-bold text-lg w-6 ${i===0?"text-yellow-500": i===1?"text-slate-400":"text-orange-400"}`}>#{i+1}</div>
                                        <div className="text-sm font-semibold text-slate-700">Semaine {w.weekIndex}</div>
                                    </div>
                                    <div className="font-mono font-bold text-amber-600">{Math.round(w.load)} pts</div>
                                </div>
                            ))}
                            {topLoad.every(w => w.load === 0) && <div className="text-slate-400 italic text-sm">Pas encore de données.</div>}
                        </div>
                    </div>
                </div>
            </>
        )}
      </div>
    </main>
  );
}