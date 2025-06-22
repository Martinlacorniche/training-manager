// /app/athlete/page.tsx (ou /pages/athlete.tsx selon ton Next)
"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import dayjs from "dayjs";
import "dayjs/locale/fr";
import { BikeIcon, Dumbbell, Footprints, WavesLadder, Mountain, Activity, Trash2 } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DropResult } from "@hello-pangea/dnd";




dayjs.locale("fr");

function getSportIcon(sport: string) {
  switch (sport) {
    case "Vélo": return <BikeIcon size={15} className="text-blue-500" />;
    case "Course à pied": return <Footprints size={15} className="text-emerald-600" />;
    case "Natation": return <WavesLadder size={15} className="text-blue-400" />;
    case "Renforcement": return <Dumbbell size={15} className="text-yellow-700" />;
    case "Musculation": return <Dumbbell size={15} className="text-red-600" />;
    case "Trail": return <Mountain size={15} className="text-green-700" />;
    default: return <Activity size={15} className="text-gray-400" />;
  }
}

function ModalAthleteSession({ session, onClose, onUpdated }: { session: any, onClose: any, onUpdated: any }) {
  const [rpe, setRpe] = useState(session.rpe ?? 5);
  const [status, setStatus] = useState(session.status ?? "valide");
  const [athleteComment, setAthleteComment] = useState(session.athlete_comment ?? "");
  const [plannedHour, setPlannedHour] = useState(session.planned_hour ? Math.floor(session.planned_hour) : 0);
  const [plannedMinute, setPlannedMinute] = useState(session.planned_hour ? Math.round((session.planned_hour % 1) * 60) : 0);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    const planned_hour = Number(plannedHour) + Number(plannedMinute) / 60;
    const load_index = Number(rpe) * planned_hour;
    const { data, error } = await supabase
      .from("sessions")
      .update({ rpe, status, athlete_comment: athleteComment, planned_hour, load_index })
      .eq("id", session.id)
      .select()
      .single();
    setLoading(false);
    if (!error && data) {
      onUpdated(data);
      onClose();
    } else {
      alert("Erreur: " + (error?.message || ""));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-blue-100 via-teal-100 to-emerald-200 bg-opacity-80">
      <form
        onSubmit={handleSubmit}
        className="relative bg-white/95 rounded-3xl shadow-2xl p-8 min-w-[340px] w-full max-w-sm flex flex-col gap-4 border border-blue-100"
      >
        <h2 className="font-black text-2xl text-blue-900 mb-2 tracking-tight text-center flex gap-2 items-center justify-center">
          Valider/modifier ma séance
        </h2>
        <div className="mb-2 flex flex-col gap-2">
          <div className="flex flex-col items-start gap-1">
            <span className="font-bold text-blue-900">Sport :</span>
            <span className="flex gap-2 items-center text-blue-700 font-semibold text-md">{session.sport}</span>
          </div>
          <div>
            <span className="font-bold text-blue-900">Titre :</span> <span>{session.title}</span>
          </div>
          <div>
            <span className="font-bold text-blue-900">Durée prévue (modifiable) :</span>
            <div className="flex gap-2 mt-1">
              <select value={plannedHour} onChange={e => setPlannedHour(Number(e.target.value))} className="rounded-xl p-2 border border-blue-100 shadow-sm">
                {Array.from({ length: 15 }, (_, i) => (
                  <option key={i} value={i}>{i} h</option>
                ))}
              </select>
              <select value={plannedMinute} onChange={e => setPlannedMinute(Number(e.target.value))} className="rounded-xl p-2 border border-blue-100 shadow-sm">
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i * 5}>{String(i * 5).padStart(2, "0")} min</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <span className="font-bold text-blue-900">Intensité :</span> <span>{session.intensity}</span>
          </div>
          <div>
            <span className="font-bold text-blue-900">Instructions :</span> <span>{session.planned_inter}</span>
          </div>
        </div>
        <label className="font-semibold text-blue-900">RPE (1–10)
          <input type="number" min={1} max={10} value={rpe} onChange={e => setRpe(Number(e.target.value))} className="ml-2 border border-emerald-300 rounded-xl px-2 w-16 focus:ring-2 focus:ring-blue-200 transition" />
        </label>
        <div className="flex gap-6 items-center justify-center mt-1">
          <label className="flex items-center gap-2">
            <input type="radio" value="valide" checked={status === "valide"} onChange={e => setStatus(e.target.value)} className="accent-emerald-500" />
            <span className="text-emerald-700 font-bold">Validée</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" value="non_valide" checked={status === "non_valide"} onChange={e => setStatus(e.target.value)} className="accent-red-400" />
            <span className="text-red-500 font-bold">Non validée</span>
          </label>
        </div>
        <label>
          <span className="font-semibold text-blue-900">Commentaire :</span>
          <textarea value={athleteComment} onChange={e => setAthleteComment(e.target.value)} className="mt-1 border border-blue-100 rounded-xl w-full min-h-[60px] p-2 focus:ring-2 focus:ring-blue-200 transition" />
        </label>
        <div className="flex gap-2 mt-2 justify-between">
          <button type="button" onClick={onClose} className="bg-gray-200 rounded-xl px-4 py-2 font-semibold hover:bg-gray-300 shadow">
            Annuler
          </button>
          <button type="submit" className="bg-gradient-to-r from-blue-400 to-emerald-500 text-white rounded-xl px-4 py-2 font-bold shadow-lg hover:scale-105 transition" disabled={loading}>
            {loading ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ModalAbsComp({
  user,
  onClose,
  onCreated
}: {
  user: any,
  onClose: any,
  onCreated: any
}) {
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [type, setType] = useState("absence");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase
      .from("absences_competitions")
      .insert({
        user_id: user.id_auth,
        date,
        type,
        comment,
      })
      .select()
      .single();
    setLoading(false);
    if (!error && data) {
      onCreated(data);
      onClose();
    } else {
      alert("Erreur: " + (error?.message || ""));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-blue-100 via-teal-100 to-emerald-200 bg-opacity-80">
      <form
        onSubmit={handleSubmit}
        className="relative bg-white/90 rounded-3xl shadow-2xl p-8 min-w-[320px] w-full max-w-sm flex flex-col gap-4 border border-blue-100"
      >
        <h2 className="font-black text-xl text-blue-900 mb-2 tracking-tight text-center">
          Déclarer une absence / compétition
        </h2>
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-blue-900">Date concernée :</span>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-xl border border-blue-100 p-2"/>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-blue-900">Type :</span>
          <select value={type} onChange={e => setType(e.target.value)} className="rounded-xl border border-blue-100 p-2">
            <option value="absence">Absence</option>
            <option value="competition">Compétition</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-blue-900">Commentaire :</span>
          <textarea value={comment} onChange={e => setComment(e.target.value)} className="rounded-xl border border-blue-100 p-2 min-h-[60px]"/>
        </label>
        <div className="flex gap-2 mt-2 justify-between">
          <button type="button" onClick={onClose} className="bg-gray-200 rounded-xl px-4 py-2 font-semibold hover:bg-gray-300 shadow">
            Annuler
          </button>
          <button type="submit" className="bg-gradient-to-r from-blue-400 to-emerald-500 text-white rounded-xl px-4 py-2 font-bold shadow-lg hover:scale-105 transition" disabled={loading}>
            {loading ? "Ajout..." : "Ajouter"}
          </button>
        </div>
      </form>
    </div>
  );
}


export default function AthleteDashboard() {
  
  
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [sessionSelected, setSessionSelected] = useState<Session | null>(null);
  const [absModalOpen, setAbsModalOpen] = useState(false);
  type Absence = {
  id: string;
  user_id: string;
  date: string;
  type: string;
  comment: string;
  // Ajoute d’autres champs si tu veux, adapte à ta table si besoin
};
type Session = {
  id: string;
  user_id: string;
  date: string;
  planned_hour?: number;
  rpe?: number;
  status?: string;
  sport?: string;
  title?: string;
  intensity?: string;
  planned_inter?: string;
  athlete_comment?: string;
  load_index?: number;};
  type User = {
  id_auth: string;
  name?: string;
  // Ajoute d'autres champs si besoin
};

const [user, setUser] = useState<User | null>(null);

  const [absences, setAbsences] = useState<Absence[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [hoveredDayId, setHoveredDayId] = useState(null);



  const weekStart = dayjs().startOf("week").add(weekOffset, "week");
  const weekDays = Array.from({ length: 7 }, (_, i) => weekStart.add(i, "day").format("ddd DD/MM"));

  // Auth + profil
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        window.location.href = "/login";
        return;
      }
      const { data: u } = await supabase.from("users").select("*").eq("id_auth", session.user.id).single();
      setUser(u);
    };
    fetchUser();
  }, []);

  const handleDragEnd = async (result: DropResult) => {
  if (!result.destination) return;
  const sessionId = result.draggableId;
  const newDate = result.destination.droppableId.replace("jour_", "");
  // Vérifie si ce n'est pas une absence/compétition ce jour là
  if (absences.some(a => a.date === newDate)) {
    return; // Ne déplace rien si la date cible est bloquée
  }
  // Update local state
  setSessions(sessions =>
    sessions.map(s =>
      s.id === sessionId ? { ...s, date: newDate } : s
    )
  );
  // Update in Supabase
  await supabase.from("sessions").update({ date: newDate }).eq("id", sessionId);
};

  // Séances semaine
  useEffect(() => {
  const fetchSessionsAndAbsences = async () => {
    if (!user) return;
    const start = weekStart.format("YYYY-MM-DD");
    const end = weekStart.add(6, "day").format("YYYY-MM-DD");
    // Charger les séances
    const { data: sess } = await supabase
      .from("sessions")
      .select("*")
      .eq("user_id", user.id_auth)
      .gte("date", start)
      .lte("date", end);
    setSessions(sess || []);
    // Charger les absences/compétitions
    const { data: abs } = await supabase
      .from("absences_competitions")
      .select("*")
      .eq("user_id", user.id_auth)
      .gte("date", start)
      .lte("date", end);
    setAbsences(abs || []);
    setLoading(false);
  };
  fetchSessionsAndAbsences();
}, [user, weekStart]);


  // Stats
  const validCount = sessions.filter(s => s.status === "valide").length;
  const totalSessions = sessions.length;
  const totalTime = sessions.reduce((acc, s) => acc + (Number(s.planned_hour) || 0), 0);
  const loadIndex = sessions.reduce((acc, s) => acc + ((Number(s.rpe) || 0) * (Number(s.planned_hour) || 0)), 0);

  if (loading) {
    return <main className="flex items-center justify-center min-h-screen bg-gradient-to-br from-teal-100 via-blue-200 to-emerald-200">
      <span className="text-blue-700 text-lg font-semibold animate-pulse">Chargement...</span>
    </main>
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-400 via-blue-400 to-blue-600 p-2 sm:p-6 flex flex-col items-center">

      <div className="flex flex-col items-center mb-8 gap-2">
  <div className="flex items-center gap-2 bg-gradient-to-r from-blue-200 to-emerald-200 text-blue-900 font-bold text-xl px-8 py-4 rounded-xl shadow transition">
    Salut {user?.name?.split(" ")[0] || "Athlète"} !
  </div>
</div>


      <div className="w-full max-w-6xl bg-white/90 rounded-2xl shadow-2xl p-6 pb-4 flex flex-col items-center transition">
        <div className="flex items-center justify-center gap-4 mb-6">
  <button
    onClick={() => setWeekOffset(w => w - 1)}
    className="p-2 bg-blue-200 rounded-full shadow hover:bg-blue-400 transition flex items-center justify-center"
    aria-label="Semaine précédente"
  >
    <ChevronLeft className="w-6 h-6 text-blue-700" />
  </button>
  <span className="text-xl font-bold text-blue-900">
    Semaine du {weekStart.format("DD/MM/YYYY")}
  </span>
  <button
    onClick={() => setWeekOffset(w => w + 1)}
    className="p-2 bg-blue-200 rounded-full shadow hover:bg-blue-400 transition flex items-center justify-center"
    aria-label="Semaine suivante"
  >
    <ChevronRight className="w-6 h-6 text-blue-700" />
  </button>
</div>

        
       <div className="flex justify-end w-full gap-3 mb-4">
  <button
    type="button"
    onClick={() => setAbsModalOpen(true)}
    className="flex items-center gap-2 bg-gradient-to-r from-blue-200 to-emerald-200 text-blue-900 font-bold px-4 py-2 rounded-xl shadow hover:scale-105 transition text-sm"
  >
    Ajouter Off / Compétition
  </button>
  <a
    href="/athlete/stats/"
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-2 bg-gradient-to-r from-blue-200 to-emerald-200 text-blue-900 font-bold px-4 py-2 rounded-xl shadow hover:scale-105 transition text-sm"
  >
    Analyser ma souffrance
  </a>
</div>

        <div className="mb-3 text-xs text-gray-600">
          <span>Validées: {validCount}/{totalSessions} | </span>
          <span>Temps: {Math.floor(totalTime)}h{String(Math.round((totalTime%1)*60)).padStart(2,"0")} | </span>
          <span>Charge: {loadIndex}</span>
        </div>
        <DragDropContext onDragEnd={handleDragEnd}>
  <div className="overflow-x-auto w-full">
    <table className="w-full min-w-[900px] border-separate border-spacing-y-2 table-fixed">
      <thead>
  <tr>
    <th className="p-3 bg-emerald-100 text-emerald-800 font-bold text-left rounded-tl-xl min-w-[110px]">
      Jour
    </th>
    {weekDays.map((d, idx) => (
      <th
        key={d}
        className={
          "p-3 bg-emerald-100 text-emerald-800 font-bold text-center min-w-[120px] max-w-[140px]" +
          (idx === weekDays.length - 1 ? " rounded-tr-xl" : "")
        }
      >
        {d}
      </th>
    ))}
  </tr>
</thead>


      <tbody>
        <tr>
          <td className="p-3 font-bold text-emerald-700 bg-emerald-50 rounded-l-xl text-center shadow-inner">
  L'athlète 😁
</td>

          {weekDays.map((day, j) => (
            <Droppable droppableId={`jour_${weekStart.add(j, "day").format("YYYY-MM-DD")}`} key={day + "-" + j}>
              {(provided, snapshot) => (
                <td
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={
        "p-2 text-center align-middle min-w-[120px] max-w-[140px] transition-colors duration-200 " +
        (
          snapshot.isDraggingOver
            ? "bg-emerald-100"
            : "bg-white"
        )
      }
      // Pour garder la couleur si tu veux la faire persister par état :
      // style={{
      //   background: hoveredDayId === `jour_${weekStart.add(j, "day").format("YYYY-MM-DD")}` ? "#d1fae5" : "white"
      // }}
                >
                  <div className="flex flex-col gap-1 items-center">
                    {/* Absences/compétitions du jour */}
                    {absences
                      .filter(a => a.date === weekStart.add(j, "day").format("YYYY-MM-DD"))
                      .map(a => (
                        <div
                          key={a.id}
  className={
    "group rounded-xl shadow w-[110px] px-2 py-1 flex flex-col items-center min-w-0 max-w-[120px] relative " +
    (a.type === "competition"
      ? "bg-yellow-100 border border-yellow-300 text-yellow-800"
      : "bg-gray-100 border border-gray-300 text-gray-500")
  }
>
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              await supabase.from("absences_competitions").delete().eq("id", a.id);
                              setAbsences(absences => absences.filter(ab => ab.id !== a.id));
                            }}
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition p-1 rounded-full hover:bg-red-100"
                            title="Supprimer"
                          >
                            <Trash2 size={15} className="text-red-400 hover:text-red-600" />
                          </button>
                          <span className="text-base font-semibold">
                            {a.type === "competition" ? "🏆 Compétition" : "⛔ Off"}
                          </span>
                          {a.comment && (
  <span className="text-[11px] text-gray-600 mt-1 line-clamp-2 max-w-[100px] break-words whitespace-pre-line">
    {a.comment}
  </span>
)}

                        </div>
                      ))}

                    {/* Séances du jour drag & drop */}
                    {sessions
                      .filter(
                        s =>
                          s.date === weekStart.add(j, "day").format("YYYY-MM-DD") &&
                          s.user_id === user?.id_auth
                      )
                      .map((s, idx) => (
                        <Draggable draggableId={s.id} index={idx} key={s.id}>
  {(provided) => (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      className={
        `group relative rounded-xl shadow border w-full max-w-[120px] min-w-0 px-2 py-1 flex flex-col items-start cursor-pointer hover:shadow-lg transition overflow-hidden ` +
        (s.status === "valide"
          ? "bg-emerald-100 border-emerald-300"
          : s.status === "non_valide"
          ? "bg-red-100 border-red-300"
          : "bg-white/95 border-gray-200")
      }
      style={{ wordBreak: "break-word" }}
      onClick={() => {
        setSessionSelected(s);
        setModalOpen(true);
      }}
      title="Voir ou valider la séance"
    >
      {/* Ligne sport */}
      <div className="flex items-center gap-1 mb-0.5 w-full">
        {getSportIcon(s.sport)}
        <span className="font-semibold text-blue-700 text-[15px] truncate max-w-[80px]">{s.sport}</span>
      </div>
      {/* Titre */}
      {s.title && (
        <span className="font-bold text-[13px] text-emerald-700 mb-1 line-clamp-2 max-w-[110px] break-words whitespace-pre-line">
          {s.title}
        </span>
      )}
      {/* Durée + Intensité */}
      <span className="text-xs text-gray-600 mb-1">
        {s.planned_hour ? `${Math.floor(s.planned_hour)}h${String(Math.round((s.planned_hour % 1) * 60)).padStart(2, "0")}` : ""}
        {" · "}
        <span className={
          s.intensity === "haute"
            ? "text-red-500 font-bold"
            : s.intensity === "moyenne"
            ? "text-yellow-500 font-bold"
            : "text-emerald-600 font-bold"
        }>
          {s.intensity}
        </span>
      </span>
      {/* Instructions */}
      {s.planned_inter && (
        <span className="text-[11px] text-gray-700 mb-1 line-clamp-2 max-w-[110px] whitespace-pre-line break-words">
          {s.planned_inter}
        </span>
      )}
      {/* Feedback athlète */}
      {(s.athlete_comment || s.rpe) && (
        <span className="text-[11px] text-gray-400 italic mt-1 line-clamp-2 max-w-[110px] break-words">
          {s.rpe && `RPE: ${s.rpe} `}
          {s.athlete_comment && `- "${s.athlete_comment}"`}
        </span>
      )}
      {/* Statut */}
      <span className={
        "text-xs font-bold mt-1 " +
        (s.status === "valide"
          ? "text-emerald-700"
          : s.status === "non_valide"
          ? "text-red-600"
          : "text-gray-400")
      }>
        {s.status === "valide" ? "Validée" : s.status === "non_valide" ? "Non validée" : ""}
      </span>
    </div>
  )}
</Draggable>

                      ))}

                    {/* Drag & drop helper */}
                    {provided.placeholder}
                  </div>
                </td>
              )}
            </Droppable>
          ))}
        </tr>
      </tbody>
    </table>
  </div>
</DragDropContext>

      </div>
      {modalOpen && sessionSelected && (
        <ModalAthleteSession
          session={sessionSelected}
          onClose={() => setModalOpen(false)}
          onUpdated={(updatedSession) => {
            setSessions(sess =>
              sess.map(s => s.id === updatedSession.id ? updatedSession : s)
            );
          }}
        />
      )}
      {absModalOpen && user && (
  <ModalAbsComp
    user={user}
    onClose={() => setAbsModalOpen(false)}
    onCreated={() => {/* Optionnel : reload absences, toast, etc. */}}
  />
)}

    </main>
  );
}
