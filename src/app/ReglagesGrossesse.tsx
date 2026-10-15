"use client";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";
import { BabyCarriage, CalendarHeart, Heart, UserCircleGear } from "@phosphor-icons/react";
import { grossesseAutorisee, maGrossesse, ROSE, ROSE_FOND, semaines, type Grossesse } from "./grossesse";

// Réglages du mode grossesse (15/10/2026), comme dans l'app (App-Coach,
// components/ReglagesGrossesse.tsx) : n'apparaît QUE si le compte est autorisé
// (liste côté serveur + profil « Femme »). Partages désactivés par défaut.

type Moi = { id_auth: string; coach_id: string | null; partner_id: string | null };

export function ReglagesGrossesse({ className }: { className: string }) {
  const [moi, setMoi] = useState<Moi | null>(null);
  const [ok, setOk] = useState(false);
  const [g, setG] = useState<Grossesse | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const autorise = await grossesseAutorisee(session.user.id);
      setOk(autorise);
      if (!autorise) return;
      const [{ data: u }, gr] = await Promise.all([
        supabase.from("users").select("id_auth, coach_id, partner_id").eq("id_auth", session.user.id).single(),
        maGrossesse(session.user.id),
      ]);
      setMoi(u as Moi);
      setG(gr);
    })();
  }, []);
  if (!ok || !moi) return null;

  const ecrire = async (champs: Partial<Grossesse>) => {
    const suivant = { user_id: moi.id_auth, active: true, dpa: null, titre: "Le plus beau des marathons", partage_duo: false, partage_coach: false, ...(g ?? {}), ...champs };
    setG(suivant as Grossesse);
    const { error } = await supabase.from("grossesse").upsert({ ...suivant, maj: new Date().toISOString() });
    setErreur(error ? error.message : null);
  };
  const actif = !!g?.active;
  const s = semaines(g?.dpa ?? null);
  const coache = !!moi.coach_id && moi.coach_id !== moi.id_auth;
  const auj = new Date().toLocaleDateString("sv-SE");

  const Ligne = ({ icone, titre, sous, droite }: { icone: ReactNode; titre: string; sous?: string; droite: ReactNode }) => (
    <div className="flex items-center gap-3 py-2">
      <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: ROSE_FOND, color: ROSE }}>{icone}</span>
      <span className="flex-1">
        <span className="block font-semibold text-slate-700">{titre}</span>
        {sous && <span className="block text-sm text-slate-500">{sous}</span>}
      </span>
      {droite}
    </div>
  );
  const interrupteur = (v: boolean, set: (v: boolean) => void) => (
    <input type="checkbox" checked={v} onChange={(e) => set(e.target.checked)} className="h-5 w-5" style={{ accentColor: ROSE }} />
  );

  return (
    <section className={className}>
      <h2 className="font-bold text-slate-800">Mode grossesse 🤰</h2>
      {erreur && <p className="text-sm text-rose-600">{erreur}</p>}
      <Ligne icone={<BabyCarriage size={20} />} titre="Mode grossesse"
        sous={actif ? (s ? `${s.sa}e semaine · trimestre ${s.trimestre}` : "Indique la date prévue") : "Rendez-vous, sport adapté, récup ajustée"}
        droite={interrupteur(actif, (v) => ecrire({ active: v }))} />
      {actif && (
        <>
          <Ligne icone={<CalendarHeart size={20} />} titre="Date prévue d'accouchement"
            sous={g?.dpa ? new Date(g.dpa + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "À remplir"}
            droite={<input type="date" min={auj} value={g?.dpa ?? ""} onChange={(e) => e.target.value && ecrire({ dpa: e.target.value })}
              className="rounded-lg border border-slate-200 p-1.5 text-sm text-slate-700" />} />
          {!!moi.partner_id && (
            <Ligne icone={<Heart size={20} />} titre="Partager avec mon duo" sous="Ton duo voit la carte, tes rendez-vous et leur détail"
              droite={interrupteur(!!g?.partage_duo, (v) => ecrire({ partage_duo: v }))} />
          )}
          {coache && (
            <Ligne icone={<UserCircleGear size={20} />} titre="Partager avec mon coach" sous="Ton coach voit seulement « Suivi grossesse » dans ton planning, jamais le détail"
              droite={interrupteur(!!g?.partage_coach, (v) => ecrire({ partage_coach: v }))} />
          )}
        </>
      )}
    </section>
  );
}
