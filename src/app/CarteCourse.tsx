"use client";
import React from "react";

// ─────────────────────────────────────────────────────────────────────────
// Une course dans le planning : une vraie carte, comme dans l'app (26/09).
// Avant : nom, distance, ville et heure, compte à rebours.
// Après : le temps et « Terminée » / « Abandon ».
// ─────────────────────────────────────────────────────────────────────────

const chrono = (h: number) => {
  const t = Math.round(h * 3600), hh = Math.floor(t / 3600), mm = Math.floor((t % 3600) / 60), ss = t % 60;
  return hh ? `${hh}h${String(mm).padStart(2, "0")}` : `${mm}'${String(ss).padStart(2, "0")}`;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function CarteCourse({ a, onClick, action, children }: { a: any; onClick?: () => void; action?: React.ReactNode; children?: React.ReactNode }) {
  const auj = new Date(); auj.setHours(0, 0, 0, 0);
  const jours = Math.round((new Date(a.date + "T00:00:00").getTime() - auj.getTime()) / 86400000);
  const passee = jours < 0 || !!a.strava_activity_id;
  const abandon = a.status === "dnf";
  const infos = [
    a.distance_km ? `${Number(a.distance_km)} km` : null,
    a.elevation_d_plus ? `${a.elevation_d_plus} m D+` : null,
    !passee && a.lieu_nom ? a.lieu_nom : null,
    !passee && a.heure_depart ? String(a.heure_depart).replace(":", "h") : null,
  ].filter(Boolean).join(" · ");
  const badge = passee
    ? (abandon ? "Abandon" : a.duration_hour && (a.status || a.strava_activity_id) ? chrono(a.duration_hour) : a.status ? "Terminée" : "Ton temps ?")
    : jours === 0 ? "Jour J" : `J-${jours}`;
  const [c1, c2] = passee ? (abandon ? ["#64748b", "#475569"] : ["#059669", "#0d9488"]) : ["#f97316", "#e11d48"];

  return (
    <div onClick={onClick} className={`rounded-xl p-3 mb-2 text-white shadow-sm ${onClick ? "cursor-pointer hover:brightness-105" : ""}`} style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
      <div className="flex items-center gap-2">
        <span className="grid place-items-center w-8 h-8 shrink-0 rounded-full bg-white/20 text-base">{passee && !abandon ? "🏅" : "🏁"}</span>
        <div className="min-w-0 flex-1">
          <div className="font-black text-sm truncate">{a.name || "Ma course"}</div>
          {infos && <div className="text-[11px] font-semibold opacity-90 truncate">{infos}</div>}
        </div>
        {action}
      </div>
      <div className="mt-2 flex">
        <span className="rounded-md bg-white px-2 py-0.5 text-xs font-black" style={{ color: c2 }}>{badge}</span>
      </div>
      {children && <div className="mt-2 text-[11px] opacity-90 space-y-0.5">{children}</div>}
    </div>
  );
}
