"use client";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend, BarChart
} from "recharts";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import isoWeeksInYear from "dayjs/plugin/isoWeeksInYear";
import isLeapYear from "dayjs/plugin/isLeapYear";
import "dayjs/locale/fr";
import { Trophy, ChartBar, Lightning, Users, User } from "@phosphor-icons/react";
import { Plus_Jakarta_Sans } from "next/font/google";

// Config DayJS
dayjs.extend(isoWeek);
dayjs.extend(isoWeeksInYear);
dayjs.extend(isLeapYear);
dayjs.locale("fr");

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["500","600","700"], display: "swap" });

const SPORT_COLORS: Record<string, string> = {
  "Vélo": "#10b981", "Run": "#64748b", "Natation": "#06b6d4",
  "Muscu": "#f59e0b", "Renfo": "#f59e0b", "Trail": "#84cc16", "Autre": "#9ca3af"
};

type Athlete = { id_auth: string; name: string };

// --- HELPER: CONVERTIR 4.8 -> 4h48 ---
function fmtDuration(decimal: number) {
  const totalMinutes = Math.round(decimal * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

export default function StatsSemaine() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const [year, setYear] = useState(dayjs().year());
  const [viewMode, setViewMode] = useState<"details" | "compare">("details");
  const [rawData, setRawData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // State pour le survol synchronisé
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  // 1. Charger la liste des athlètes
  useEffect(() => {
    const fetchAthletes = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;

      const { data } = await supabase
        .from("users")
        .select("id_auth, name, ordre")
        .eq("role", "athlete")
        .eq("coach_id", session.user.id)
        .order("ordre", { ascending: true });

      if (data && data.length > 0) {
        setAthletes(data);
        setSelectedAthleteId(data[0].id_auth);
      }
      setLoading(false);
    };
    fetchAthletes();
  }, []);

  // 2. Charger les données
  useEffect(() => {
    const fetchData = async () => {
      if (!selectedAthleteId && viewMode === "details") return;
      setLoading(true);

      const start = dayjs(`${year}-01-01`).startOf("isoWeek").format("YYYY-MM-DD");
      const end = dayjs(`${year}-12-31`).endOf("isoWeek").format("YYYY-MM-DD");

      let query = supabase.from("sessions").select("user_id, date, planned_hour, sport, rpe").gte("date", start).lte("date", end);

      if (viewMode === "details" && selectedAthleteId) {
        query = query.eq("user_id", selectedAthleteId);
      } else if (viewMode === "compare" && athletes.length > 0) {
        const ids = athletes.map(a => a.id_auth);
        query = query.in("user_id", ids);
      }

      const { data } = await query;
      setRawData(data || []);
      setLoading(false);
    };
    fetchData();
  }, [selectedAthleteId, year, viewMode, athletes]);

  // Transformation Vue Détails
  const detailData = useMemo(() => {
    if (viewMode !== "details") return [];
    const weeks: Record<number, any> = {};
    const weeksInYear = dayjs(`${year}-12-31`).isoWeeksInYear();
    
    for (let i = 1; i <= weeksInYear; i++) {
        weeks[i] = { name: `S${i}`, weekIndex: i, totalHours: 0, load: 0, Vélo: 0, Run: 0, Natation: 0, Muscu: 0, Trail: 0, Autre: 0 };
    }

    rawData.forEach(s => {
        const w = dayjs(s.date).isoWeek();
        if (weeks[w]) {
            const h = Number(s.planned_hour || 0);
            const rpe = s.rpe ? Number(s.rpe) : 5;
            weeks[w].totalHours += h;
            weeks[w].load += (h * rpe);
            const sportKey = (s.sport && SPORT_COLORS[s.sport]) ? s.sport : "Autre";
            const finalSportKey = sportKey === "Renfo" ? "Muscu" : sportKey;
            if (weeks[w][finalSportKey] !== undefined) weeks[w][finalSportKey] += h;
            else weeks[w].Autre += h;
        }
    });
    return Object.values(weeks);
  }, [rawData, year, viewMode]);

  // Transformation Vue Comparaison
  const compareData = useMemo(() => {
    if (viewMode !== "compare") return [];
    const totals: Record<string, { name: string, totalHours: number, totalLoad: number }> = {};
    athletes.forEach(a => {
        totals[a.id_auth] = { name: a.name.split(" ")[0], totalHours: 0, totalLoad: 0 };
    });
    rawData.forEach(s => {
        if (totals[s.user_id]) {
            const h = Number(s.planned_hour || 0);
            const rpe = s.rpe ? Number(s.rpe) : 5;
            totals[s.user_id].totalHours += h;
            totals[s.user_id].totalLoad += (h * rpe);
        }
    });
    return Object.values(totals).sort((a, b) => b.totalHours - a.totalHours);
  }, [rawData, athletes, viewMode]);

  const topHours = [...detailData].sort((a, b) => b.totalHours - a.totalHours).slice(0, 3);
  const topLoad = [...detailData].sort((a, b) => b.load - a.load).slice(0, 3);

  // --- FORMAT TOOLTIP AVEC HEURES:MINUTES ---
  const formatTooltip = (value: number, name: string) => {
     const val = Number(value);
     if (name === "Charge") return [Math.round(val), "Charge"];
     // Utilisation de fmtDuration pour l'affichage
     return [fmtDuration(val), name];
  };

  const handlePodiumHover = (weekIndex: number) => {
      setActiveIndex(weekIndex - 1);
  };

  return (
    <main className={`${jakarta.className} min-h-screen bg-slate-50 text-slate-800 pb-10`}>
      
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
                <button onClick={()=>setYear(year-1)} className="px-3 py-1 text-xs font-bold text-slate-500 hover:text-slate-800">{year-1}</button>
                <div className="px-3 py-1 text-xs font-bold bg-white text-emerald-600 shadow-sm rounded">{year}</div>
                <button onClick={()=>setYear(year+1)} className="px-3 py-1 text-xs font-bold text-slate-500 hover:text-slate-800">{year+1}</button>
            </div>
            <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
                <button onClick={() => setViewMode("details")} className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode==="details" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><User size={16} weight="bold"/> Athlète</button>
                <button onClick={() => setViewMode("compare")} className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode==="compare" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><Users size={16} weight="bold"/> Comparaison</button>
            </div>
            <div className="w-full sm:w-64">
                {viewMode === "details" && (
                    <select value={selectedAthleteId || ""} onChange={(e) => setSelectedAthleteId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold focus:ring-2 focus:ring-emerald-500 outline-none">
                        {athletes.map(a => <option key={a.id_auth} value={a.id_auth}>{a.name}</option>)}
                    </select>
                )}
                {viewMode === "compare" && <div className="w-full text-right text-xs font-bold text-slate-400 uppercase tracking-wide pt-2">Classement Saison</div>}
            </div>
          </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 mt-8 space-y-8">
        {loading ? (
            <div className="text-center py-20 text-slate-400 animate-pulse">Chargement des données...</div>
        ) : (
            <>
                {viewMode === "details" && (
                    <>
                        {/* Graphique Principal */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[450px]">
                            <div className="flex items-center gap-2 mb-6">
                                <ChartBar size={24} className="text-emerald-600"/>
                                <h2 className="font-bold text-slate-800">Volume & Charge Hebdomadaire</h2>
                            </div>
                            <ResponsiveContainer width="100%" height="85%">
                                <ComposedChart 
                                    data={detailData} 
                                    activeIndex={activeIndex}
                                    onMouseMove={(state: any) => {
                                        if (state.isTooltipActive) setActiveIndex(state.activeTooltipIndex);
                                        else setActiveIndex(undefined);
                                    }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                    <XAxis dataKey="name" tick={{fontSize:10, fill:"#94a3b8"}} tickLine={false} interval={3}/>
                                    <YAxis yAxisId="left" tick={{fontSize:11, fill:"#64748b"}} tickLine={false} axisLine={false} unit="h"/>
                                    <YAxis yAxisId="right" orientation="right" tick={{fontSize:11, fill:"#f59e0b"}} tickLine={false} axisLine={false}/>
                                    <Tooltip 
                                        contentStyle={{backgroundColor:"#fff", borderRadius:"12px", border:"none", boxShadow:"0 4px 12px rgba(0,0,0,0.1)"}}
                                        itemStyle={{fontSize:"12px", fontWeight:"600"}}
                                        formatter={formatTooltip}
                                    />
                                    <Legend iconType="circle" wrapperStyle={{fontSize:"12px", paddingTop:"10px"}}/>
                                    <Bar yAxisId="left" dataKey="Vélo" stackId="a" fill={SPORT_COLORS["Vélo"]} radius={[0,0,0,0]} barSize={12} />
                                    <Bar yAxisId="left" dataKey="Run" stackId="a" fill={SPORT_COLORS["Run"]} radius={[0,0,0,0]} barSize={12} />
                                    <Bar yAxisId="left" dataKey="Natation" stackId="a" fill={SPORT_COLORS["Natation"]} radius={[0,0,0,0]} barSize={12} />
                                    <Bar yAxisId="left" dataKey="Muscu" stackId="a" fill={SPORT_COLORS["Muscu"]} radius={[0,0,0,0]} barSize={12} />
                                    <Bar yAxisId="left" dataKey="Trail" stackId="a" fill={SPORT_COLORS["Trail"]} radius={[0,0,0,0]} barSize={12} />
                                    <Line yAxisId="right" type="monotone" dataKey="load" stroke="#f59e0b" strokeWidth={3} dot={false} name="Charge" activeDot={{r:6}} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Podiums */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Top Heures */}
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
                                            {/* Formatage Heure:Minute ici */}
                                            <div className="font-mono font-bold text-emerald-600">{fmtDuration(w.totalHours)}</div>
                                        </div>
                                    ))}
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
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* --- VUE COMPARAISON --- */}
                {viewMode === "compare" && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[500px]">
                            <div className="flex items-center gap-2 mb-6"><Trophy size={24} className="text-blue-600"/><h2 className="font-bold text-slate-800">Classement Volume Annuel</h2></div>
                            <ResponsiveContainer width="100%" height="85%">
                                <BarChart data={compareData} layout="vertical" margin={{top:0, right:30, left:20, bottom:0}}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9"/>
                                    <XAxis type="number" hide/>
                                    <YAxis dataKey="name" type="category" tick={{fontSize:12, fontWeight:700, fill:"#475569"}} width={80} tickLine={false} axisLine={false}/>
                                    <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius:'10px', border:'none'}}/>
                                    {/* Formatage Heure:Minute aussi sur le graphique de comparaison */}
                                    <Bar 
                                        dataKey="totalHours" 
                                        name="Heures" 
                                        fill="#3b82f6" 
                                        radius={[0,4,4,0]} 
                                        barSize={24} 
                                        label={{ position: 'right', fill: '#3b82f6', fontWeight: 700, fontSize: 12, formatter: (v:number) => fmtDuration(v) }}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[500px]">
                            <div className="flex items-center gap-2 mb-6"><Lightning size={24} className="text-amber-500"/><h2 className="font-bold text-slate-800">Classement Charge Annuelle</h2></div>
                            <ResponsiveContainer width="100%" height="85%">
                                <BarChart data={[...compareData].sort((a,b)=>b.totalLoad - a.totalLoad)} layout="vertical" margin={{top:0, right:30, left:20, bottom:0}}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9"/>
                                    <XAxis type="number" hide/>
                                    <YAxis dataKey="name" type="category" tick={{fontSize:12, fontWeight:700, fill:"#475569"}} width={80} tickLine={false} axisLine={false}/>
                                    <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius:'10px', border:'none'}}/>
                                    <Bar dataKey="totalLoad" name="Points de Charge" fill="#f59e0b" radius={[0,4,4,0]} barSize={24} label={{ position: 'right', fill: '#f59e0b', fontWeight: 700, fontSize: 12, formatter: (v:number)=>Math.round(v) }}/>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </>
        )}
      </div>
    </main>
  );
}