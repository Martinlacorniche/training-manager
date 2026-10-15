"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { BabyCarriage, FlowerLotus, HandHeart, Stethoscope, X } from "@phosphor-icons/react";
import { GENRES, ROSE, ROSE_FOND, heureCourte, type RdvGrossesse } from "./grossesse";

// Un rendez-vous du mode grossesse (15/10/2026), comme dans l'app (App-Coach,
// components/GrossesseRdv.tsx) : écho, consultation, préparation, à deux…
// Modifiable par elle seule ; son duo (s'il voit) le lit sans pouvoir le changer.

// L'icône de chaque genre (mêmes idées que l'app : stéthoscope, méditation, cœurs).
export function IconeGenre({ genre, size, color }: { genre: string; size: number; color: string }) {
  if (genre === "prepa") return <FlowerLotus size={size} color={color} />;
  if (genre === "deux") return <HandHeart size={size} color={color} />;
  if (genre === "rdv") return <Stethoscope size={size} color={color} />;
  return <BabyCarriage size={size} color={color} />;
}

// « 10h30 », « 1030 », « 10:30 », « 9h » → « 10:30 » / « 09:00 ».
function lireHeure(t: string): string | null | false {
  const s = t.trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\s*[h:.]?\s*(\d{2})?$/i);
  if (!m) return false;
  const h = Number(m[1]), mn = Number(m[2] ?? 0);
  if (h > 23 || mn > 59) return false;
  return `${String(h).padStart(2, "0")}:${String(mn).padStart(2, "0")}`;
}

export default function GrossesseRdv({ open, rdv, jourInitial, userId, lectureSeule, nomAuteur, onClose, onSaved }: {
  open: boolean; rdv: RdvGrossesse | null; jourInitial: string; userId: string; lectureSeule?: boolean; nomAuteur?: string;
  onClose: () => void; onSaved: () => void;
}) {
  const [jour, setJour] = useState(jourInitial);
  const [heure, setHeure] = useState("");
  const [genre, setGenre] = useState<RdvGrossesse["genre"]>("rdv");
  const [titre, setTitre] = useState("");
  const [lieu, setLieu] = useState("");
  const [note, setNote] = useState("");
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (!open) return;
    setJour(rdv?.jour ?? jourInitial);
    setHeure(rdv?.heure ? heureCourte(rdv.heure) : "");
    setGenre(rdv?.genre ?? "rdv");
    setTitre(rdv?.titre ?? "");
    setLieu(rdv?.lieu ?? "");
    setNote(rdv?.note ?? "");
  }, [open, rdv, jourInitial]);

  if (!open) return null;

  const enregistrer = async () => {
    const h = lireHeure(heure);
    if (h === false) return alert("Écris l'heure comme 10h30.");
    if (!titre.trim()) return alert("Donne un nom au rendez-vous (ex. : Écho du 1er trimestre).");
    if (!jour) return alert("Choisis le jour.");
    setEnvoi(true);
    const ligne = { user_id: userId, jour, heure: h, genre, titre: titre.trim(), lieu: lieu.trim() || null, note: note.trim() || null };
    const { error } = rdv ? await supabase.from("grossesse_rdv").update(ligne).eq("id", rdv.id) : await supabase.from("grossesse_rdv").insert(ligne);
    setEnvoi(false);
    if (error) return alert(error.message);
    onSaved(); onClose();
  };
  const supprimer = async () => {
    if (!rdv || !confirm("Supprimer ce rendez-vous ?")) return;
    await supabase.from("grossesse_rdv").delete().eq("id", rdv.id);
    onSaved(); onClose();
  };

  const champ = "w-full rounded-xl border border-pink-200 bg-white px-3 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-pink-200";
  const etiquette = (t: string) => <div className="mt-3.5 mb-1.5 text-xs font-extrabold uppercase tracking-wide text-pink-800">{t}</div>;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl p-6" style={{ background: ROSE_FOND }}>
        <div className="flex items-center gap-2.5">
          <BabyCarriage size={26} color={ROSE} />
          <h3 className="flex-1 text-xl font-black text-slate-900">{lectureSeule ? (rdv?.titre ?? "") : rdv ? "Rendez-vous" : "Nouveau rendez-vous"}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800"><X size={22} /></button>
        </div>

        {lectureSeule && rdv ? (
          <div className="mt-3.5 space-y-2">
            <p className="text-[15px] text-slate-900">
              {GENRES[rdv.genre]?.libelle} · {new Date(rdv.jour + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}{rdv.heure ? ` à ${heureCourte(rdv.heure)}` : ""}
            </p>
            {rdv.lieu && <p className="text-sm text-slate-600">📍 {rdv.lieu}</p>}
            {rdv.note && <p className="text-sm text-slate-600 leading-5 whitespace-pre-line">{rdv.note}</p>}
            {nomAuteur && <p className="pt-1.5 text-xs text-slate-400">Ajouté par {nomAuteur}.</p>}
          </div>
        ) : (
          <>
            {etiquette("Quoi")}
            <div className="flex gap-2">
              {(Object.keys(GENRES) as RdvGrossesse["genre"][]).map((gk) => {
                const on = genre === gk;
                return (
                  <button key={gk} type="button" onClick={() => setGenre(gk)}
                    className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-extrabold"
                    style={{ background: on ? ROSE : "#fff", borderColor: on ? ROSE : "#f1d5e4", color: on ? "#fff" : "#9d174d" }}>
                    <IconeGenre genre={gk} size={20} color={on ? "#fff" : ROSE} />
                    {GENRES[gk].libelle}
                  </button>
                );
              })}
            </div>
            {etiquette("Titre")}
            <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Écho du 1er trimestre" className={champ} />
            <div className="flex gap-2.5">
              <div className="flex-[1.4]">
                {etiquette("Jour")}
                <input type="date" value={jour} onChange={(e) => setJour(e.target.value)} className={champ} />
              </div>
              <div className="flex-1">
                {etiquette("Heure")}
                <input value={heure} onChange={(e) => setHeure(e.target.value)} placeholder="10h30" className={champ} />
              </div>
            </div>
            {etiquette("Lieu")}
            <input value={lieu} onChange={(e) => setLieu(e.target.value)} placeholder="Cabinet, maternité…" className={champ} />
            {etiquette("Note")}
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="À apporter, questions à poser…" className={`${champ} min-h-[70px]`} />

            <button disabled={envoi} onClick={enregistrer} className="mt-5 w-full rounded-2xl py-3.5 font-black text-white disabled:opacity-60" style={{ background: ROSE }}>
              Enregistrer
            </button>
            {rdv && (
              <button onClick={supprimer} className="mt-3 w-full text-center font-bold text-slate-400 hover:text-rose-600">Supprimer</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
