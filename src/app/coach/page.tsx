"use client";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Image from "next/image";
import dayjs from "dayjs";
import "dayjs/locale/fr";
dayjs.locale("fr");
import isBetween from "dayjs/plugin/isBetween";
dayjs.extend(isBetween);

import { User, PlusCircle, BikeIcon, Dumbbell, Footprints, WavesLadder, Mountain, Activity, Trash2 } from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide-react";

  
// Helper: icône selon sport
function getSportIcon(sport: string = "") {
  switch (sport) {
    case "Vélo":
      return <BikeIcon size={15} className="text-blue-500" />;
    case "Run":
      return <Footprints size={15} className="text-emerald-600" />;
    case "Natation":
      return <WavesLadder size={15} className="text-blue-400" />;
    case "Renfo":
      return <Dumbbell size={15} className="text-yellow-700" />;
    case "Muscu":
      return <Dumbbell size={15} className="text-red-600" />;
    case "Trail":
      return <Mountain size={15} className="text-green-700" />;
    default:
      return <Activity size={15} className="text-gray-400" />;
  }
}

// --- ModalSession (ajout/modif) ---
function ModalSession({
  athlete,
  date,
  onClose,
  onCreated,
  sessionToEdit
}: {
  athlete: any,
  date: any,
  onClose: any,
  onCreated: any,
  sessionToEdit?: any
}) {
  const [sport, setSport] = useState(sessionToEdit?.sport || "Vélo");
  const [title, setTitle] = useState(sessionToEdit?.title || "");
  const [plannedHour, setPlannedHour] = useState(sessionToEdit ? Math.floor(sessionToEdit.planned_hour) : 0);
  const [plannedMinute, setPlannedMinute] = useState(sessionToEdit ? Math.round((sessionToEdit.planned_hour % 1) * 60) : 0);
  const [planned_inter, setPlannedInter] = useState(sessionToEdit?.planned_inter || "");
  const [intensity, setIntensity] = useState(sessionToEdit?.intensity || "moyenne");
  const [loading, setLoading] = useState(false);

  const isEdit = !!sessionToEdit;





  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    let data, error;
    if (isEdit) {
      ({ data, error } = await supabase
        .from("sessions")
        .update({
          sport,
          title,
          planned_hour: plannedHour + plannedMinute / 60,
          planned_inter,
          intensity,
        })
        .eq("id", sessionToEdit.id)
        .select()
        .single());
    } else {
      ({ data, error } = await supabase
        .from("sessions")
        .insert({
          user_id: athlete.id_auth,
          date,
          sport,
          title,
          planned_hour: plannedHour + plannedMinute / 60,
          planned_inter,
          intensity,
        })
        .select()
        .single());
    }
    setLoading(false);

    if (!error && data) {
      onCreated(data, isEdit);
    } else {
      alert("Erreur lors de la " + (isEdit ? "modification" : "création") + " ! " + (error?.message || ""));
    }
  };

  return (
    <div className="fixed z-50 inset-0 bg-black/40 flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-2xl p-6 min-w-[320px] flex flex-col gap-2 border border-emerald-100 relative"
      >
        <h2 className="font-bold text-xl mb-2 text-blue-900 flex gap-2 items-center">
          {getSportIcon("")}
          {isEdit ? "Modifier la séance" : `Créer une séance pour ${athlete.name} le ${dayjs(date).format("dddd DD MMMM")}`}
        </h2>
        <label>Sport :</label>
        <select
          value={sport}
          onChange={e => setSport(e.target.value)}
          className="rounded-lg p-2 border"
        >
          <option>Vélo</option>
          <option>Run</option>
          <option>Natation</option>
          <option>Renfo</option>
          <option>Muscu</option>
          <option>Trail</option>
          <option>Autre</option>
        </select>
        <label>Titre :</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="rounded-lg p-2 border"
        />
        <label>Durée prévue :</label>
        <div className="flex gap-2">
          <select value={plannedHour} onChange={e => setPlannedHour(Number(e.target.value))} className="rounded-lg p-2 border">
            {Array.from({ length: 15 }, (_, i) => (
              <option key={i} value={i}>{i} h</option>
            ))}
          </select>
          <select value={plannedMinute} onChange={e => setPlannedMinute(Number(e.target.value))} className="rounded-lg p-2 border">
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i * 5}>{String(i * 5).padStart(2, "0")} min</option>
            ))}
          </select>
        </div>
        <label>Intensité :</label>
        <select
          value={intensity}
          onChange={e => setIntensity(e.target.value)}
          className="rounded-lg p-2 border"
        >
          <option value="basse">Basse</option>
          <option value="moyenne">Moyenne</option>
          <option value="haute">Haute</option>
        </select>
        <label>Instructions :</label>
        <textarea
          value={planned_inter}
          onChange={e => setPlannedInter(e.target.value)}
          className="rounded-lg p-2 border"
        />
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="bg-gray-200 rounded-lg px-4 py-2 hover:bg-gray-300"
          >
            Annuler
          </button>
          <button
            type="submit"
            className="bg-emerald-500 text-white rounded-lg px-4 py-2 hover:bg-emerald-700"
            disabled={loading}
          >
            {loading ? (isEdit ? "Modification..." : "Création...") : (isEdit ? "Modifier" : "Créer")}
          </button>
        </div>
      </form>
    </div>
  );
}



// --- Composant principal ---
export default function CoachDashboard() {
  type UserType = {
  id_auth: string;
  name: string;
  email?: string;
  // ...autres champs si besoin
};

type SessionType = {
  id: string;
  user_id: string;
  sport: string;
  title?: string;
  planned_hour: number;
  planned_inter?: string;
  intensity: string;
  status?: string;
  rpe?: number;
  athlete_comment?: string;
  date: string;
  // ...autres champs selon ta BDD
};

type AbsenceType = {
  id: string;
  user_id: string;
  date: string;
  type: string;
  comment?: string;
};

  const router = useRouter();
  const [coach, setCoach] = useState<UserType | null>(null);
const [athletes, setAthletes] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
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
const [sessions, setSessions] = useState<Session[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ athlete: UserType; date: string } | null>(null);
  const [sessionToEdit, setSessionToEdit] = useState<Session | null>(null);
  const [absences, setAbsences] = useState<AbsenceType[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
const [absencesLoading, setAbsencesLoading] = useState(false);
const coachId = coach?.id_auth;



  // Semaine courante/déplacement
  const weekStart = useMemo(
  () => dayjs().startOf("week").add(weekOffset, "week"),
  [weekOffset]
);
  const weekDays = Array.from({ length: 7 }, (_, i) =>
    weekStart.add(i, "day").format("ddd DD/MM")
  );

  // Suppression d'une séance
async function handleDeleteSession(sessionId: string) {
  const { error } = await supabase.from("sessions").delete().eq("id", sessionId);
  if (!error) {
    setSessions(sessions => sessions.filter(s => s.id !== sessionId));
  } else {
    alert("Erreur lors de la suppression : " + error.message);
  }
}


  useEffect(() => {
  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      router.push("/login");
      return;
    }
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("id_auth", session.user.id)
      .single();
    setCoach(prev => prev?.id_auth === user?.id_auth ? prev : user);
    const { data: athletesList } = await supabase
      .from("users")
      .select("*")
      .eq("role", "athlete");
    setAthletes(athletesList || []);
    setLoading(false);
  };
  fetchData();
}, []);


  useEffect(() => {
  if (!coachId) return;
  setSessionsLoading(true);
  const fetchSessions = async () => {
    const start = weekStart.format("YYYY-MM-DD");
    const end = weekStart.add(6, "day").format("YYYY-MM-DD");
    const { data: sess } = await supabase
      .from("sessions")
      .select("*")
      .gte("date", start)
      .lte("date", end);
    setSessions(sess || []);
    setSessionsLoading(false);
  };
  fetchSessions();
}, [coachId, weekOffset]);

  // ...puis
useEffect(() => {
  if (!coachId) return;
  
  setAbsencesLoading(true);
  const fetchAbsences = async () => {
    const start = weekStart.format("YYYY-MM-DD");
    const end = weekStart.add(6, "day").format("YYYY-MM-DD");
    const { data: abs } = await supabase
      .from("absences_competitions")
      .select("*")
      .gte("date", start)
      .lte("date", end);
    setAbsences(abs || []);
    setAbsencesLoading(false);
  };
  fetchAbsences();
}, [coachId, weekOffset]);

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-gradient-to-br from-teal-100 via-blue-200 to-emerald-200">
        <span className="text-blue-700 text-lg font-semibold animate-pulse">
          Chargement...
        </span>
      </main>
    );
  }

  return (
  <main className="min-h-screen bg-gradient-to-br from-emerald-400 via-blue-400 to-blue-600 p-2 sm:p-6 flex flex-col items-center">
  {/* Header ligne 1 */}
  <div className="w-full max-w-6xl flex items-start justify-between mb-6 relative">
    {/* Bloc de gauche : bonjour + date */}
    <div className="flex flex-col items-start gap-1">
      <div className="bg-gradient-to-r from-emerald-400 to-blue-500 rounded-xl shadow-lg px-6 py-3 text-white font-bold text-lg flex items-center gap-2">
        <User className="text-white" size={24} />
        Bonjour {coach?.name?.split(" ")[0] || "Coach"} !
      </div>
      <div className="bg-gradient-to-r from-blue-400 to-emerald-400 rounded-xl shadow px-4 py-2 text-white font-semibold text-md mt-1">
        {dayjs().format("dddd DD MMMM")}
      </div>
    </div>

    {/* Bloc centre : logo */}
    <div className="flex flex-col items-center mx-auto absolute left-1/2 -translate-x-1/2">
      <Image
        src="/coach-logo.jpg"
        width={90}
        height={90}
        alt="Logo NG Sports"
        className="rounded-full shadow-lg border-4 border-white"
        priority
      />
    </div>

    {/* Bloc droite : bouton deconnexion */}
    <div className="flex items-center ml-auto">
      <button
        className="px-4 py-2 bg-gradient-to-r from-emerald-400 to-blue-500 text-white rounded-xl shadow-lg hover:scale-105 transition font-bold"
        onClick={async () => {
          await supabase.auth.signOut();
          router.push("/login");
        }}
      >
        Déconnexion
      </button>
    </div>
  </div>

      {/* Carte principale avec ombre et arrondi */}
      <div className="w-full max-w-6xl bg-white/90 rounded-2xl shadow-2xl p-6 pb-4 flex flex-col items-center transition">
        {/* Navigation semaine */}
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

        <div className="flex justify-end w-full mb-4">
  <a
    href="/coach/stats/"
    target="_blank"
    rel="noopener noreferrer"
   className="flex items-center gap-2 bg-gradient-to-r from-blue-200 to-emerald-200 text-blue-900 font-bold px-4 py-2 rounded-xl shadow hover:scale-105 transition text-sm"
  >
    Sont ils morts ? #stats
  </a>
</div>

        {/* Planning stylé */}
        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[800px] border-separate border-spacing-y-2 table-fixed">
            <thead>
              <tr>
                <th className="p-3 bg-emerald-100 text-emerald-800 font-bold text-left rounded-tl-xl min-w-[110px]">
  Athlète
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
              {athletes.map((ath, i) => (
  <tr key={ath.id_auth} className={`transition ${i % 2 ? 'bg-emerald-50' : 'bg-white'}`}>
                 <td
  className="
    p-3 align-top bg-white rounded-l-xl min-w-[170px]
    transition hover:bg-emerald-100
    border-l-4 border-transparent hover:border-emerald-400
  "
>
  <div className="flex items-center gap-3 mb-2">
    {/* Avatar initiales */}
    <div className="flex items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold w-10 h-10 text-lg shadow">
      {ath.name?.split(" ").map(n => n[0]).join("").toUpperCase()}
    </div>
    {/* Nom athlète */}
    <div className="flex flex-col">
      <span className="font-bold text-blue-800 text-[15px] leading-tight break-words">
        {ath.name}
      </span>
    </div>
  </div>
  {/* Récap stats semaine dans une carte */}
  <div className="mt-1 px-2 py-1 rounded-xl bg-emerald-50 text-sm shadow-inner font-medium text-gray-800 w-fit">
    {(() => {
      const athleteSessions = sessions.filter(
        s => s.user_id === ath.id_auth &&
             dayjs(s.date).isBetween(weekStart, weekStart.add(6, "day"), null, "[]")
      );
      const validCount = athleteSessions.filter(s => s.status === "valide").length;
      const totalSessions = athleteSessions.length;
      const totalTime = athleteSessions.reduce((acc, s) => acc + (Number(s.planned_hour) || 0), 0);
      const loadIndex = athleteSessions.reduce((acc, s) => acc + ((Number(s.rpe) || 0) * (Number(s.planned_hour) || 0)), 0);

      return (
        <>
          <div>
            <span className="font-semibold">Validées</span> : {validCount}/{totalSessions}
          </div>
          <div>
            <span className="font-semibold">Temps</span> : {Math.floor(totalTime)}h{String(Math.round((totalTime % 1) * 60)).padStart(2, "0")}
          </div>
          <div>
            <span className="font-semibold">Charge</span> : {loadIndex}
          </div>
        </>
      );
    })()}
  </div>
</td>



                  {weekDays.map((day, j) => (
                    <td key={day + "-" + j} className="p-2 text-center align-middle min-w-[120px] max-w-[140px]">
                      <div className="flex flex-col items-center gap-1">
                        {/* Mini bouton + */}
                        <button
                          className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-200 to-emerald-200 flex items-center justify-center shadow border-2 border-white mb-1 hover:scale-110 transition"
                          title="Ajouter une séance"
                          style={{ margin: '0 auto' }}
                          onClick={() => {
                            setSelectedCell({ athlete: ath, date: weekStart.add(j, "day").format("YYYY-MM-DD") });
                            setSessionToEdit(null);
                            setModalOpen(true);
                          }}
                        >
                          <PlusCircle size={16} />
                        </button>
                        {/* Séances du jour */}
                        <div className="flex flex-col gap-1 w-full items-center">
                          {/* Absences / Compétitions du jour POUR cet athlète */}
{absences
  .filter(
    a =>
      a.user_id === ath.id_auth &&
      a.date === weekStart.add(j, "day").format("YYYY-MM-DD")
  )
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


                          {sessions
                            .filter(
                              s =>
                                s.user_id === ath.id_auth &&
                                s.date === weekStart.add(j, "day").format("YYYY-MM-DD")
                            )
                            .map((s, idx) => (
                              <div
  key={s.id || idx}
  className={`
    group relative rounded-xl shadow border bg-white/95 w-full max-w-[120px] min-w-0 px-2 py-1 flex flex-col items-start
    cursor-pointer hover:shadow-lg transition overflow-hidden
    ${s.status === "valide" ? "bg-green-100 border-green-300" : s.status === "non_valide" ? "bg-red-100 border-red-300" : ""}
  `}
  style={{ wordBreak: "break-word" }}
  onClick={() => {
    setSelectedCell({ athlete: ath, date: s.date });
    setSessionToEdit(s);
    setModalOpen(true);
  }}
  title="Modifier la séance"
>
  {/* Icône sport + sport (gros, visible) */}
  <div className="flex items-center gap-2 mb-1">
    {getSportIcon(s.sport ?? "")}
    <span className="font-semibold text-blue-700 text-[15px] truncate">{s.sport}</span>
  </div>

  {/* Titre */}
  { s.title && (
  <span className="font-bold text-[13px] text-emerald-700 mb-1 line-clamp-2 max-w-[110px] break-words whitespace-pre-line">
    {s.title}
  </span>
)}


  {/* Durée + Intensité */}
  <span className="text-xs text-gray-600 mb-1">
    {s.planned_hour
      ? `${Math.floor(s.planned_hour)}h${String(Math.round((s.planned_hour % 1) * 60)).padStart(2, "0")}`
      : ""}
    {" · "}
    <span
      className={
        s.intensity === "haute"
          ? "text-red-500 font-bold"
          : s.intensity === "moyenne"
          ? "text-yellow-500 font-bold"
          : "text-emerald-600 font-bold"
      }
    >
      {s.intensity}
    </span>
  </span>

  {/* Instructions (toujours visibles, max 2 lignes) */}
  {s.planned_inter && (
    <span className="text-[11px] text-gray-700 mb-1 line-clamp-2 whitespace-pre-line">
      {s.planned_inter}
    </span>
  )}

  {/* Feedback athlète */}
  {(s.athlete_comment || s.rpe) && (
    <span className="text-[11px] text-gray-400 italic mt-1">
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

  {/* Supprimer (icône affichée au hover) */}
  <button
    onClick={e => {
      e.stopPropagation();
      if (confirm("Supprimer cette séance ?")) {
        handleDeleteSession(s.id);
      }
    }}
    className="absolute top-1 right-1 p-0.5 rounded hover:bg-red-50 text-gray-400 group-hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
    title="Supprimer la séance"
  >
    <Trash2 size={15} />
  </button>
</div>

))}
</div>
</div>
</td>
))}
</tr>
))}
</tbody>
</table>
</div>
</div>

{/* Appel du modal */}
{modalOpen && selectedCell && (
  <ModalSession
    athlete={selectedCell.athlete}
    date={selectedCell.date}
    sessionToEdit={sessionToEdit}
    onClose={() => setModalOpen(false)}
    onCreated={(sessionCreated: SessionType, isEdit: boolean) => {
  setModalOpen(false);
  if (isEdit) {
    setSessions(sessions =>
      sessions.map(s => s.id === sessionCreated.id ? sessionCreated : s)
    );
  } else {
    setSessions(sessions => [...sessions, sessionCreated]);
  }
}}

  />
)}
</main>
);
}

