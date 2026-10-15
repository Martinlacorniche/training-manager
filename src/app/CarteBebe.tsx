"use client";
import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { supabase } from "@/lib/supabaseClient";
import { X } from "@phosphor-icons/react";
import { bebeA, semaines, type Grossesse } from "./grossesse";
import MaGrossesse from "./MaGrossesse";

// ─────────────────────────────────────────────────────────────────────────
// La carte « Le plus beau des marathons » (15/10/2026), comme dans l'app
// (App-Coach, components/CarteBebe.tsx), en haut du planning. Sa grossesse
// (date prévue réelle), sinon celle de son duo s'il la partage (la RLS le
// garantit) ; à défaut, la carte de la surprise d'origine (table `surprises`,
// lisible du seul destinataire : le coach ne la voit pas).
// ─────────────────────────────────────────────────────────────────────────
type C = { id: string | null; carte_titre: string; carte_date: string; exacte: boolean; sa: number | null; g?: Grossesse };

// 15/10/2026 : un clic ouvre le carnet « Ma grossesse » ; l'emoji est l'objet
// de sport de la taille du bébé ; après la naissance, « Bébé est là 💗 ».

export default function CarteBebe({ userId, partnerId }: { userId?: string; partnerId?: string | null }) {
  const [c, setC] = useState<C | null>(null);
  const [carnet, setCarnet] = useState(false);
  const charger = useCallback(async () => {
    if (!userId) return;
    const { data: gs } = await supabase.from("grossesse").select("*")
      .in("user_id", [userId, partnerId].filter(Boolean) as string[]).eq("active", true).not("dpa", "is", null);
    const g = ((gs ?? []) as Grossesse[]).find((x) => x.user_id === userId) ?? ((gs ?? []) as Grossesse[])[0];
    if (g?.dpa) { setC({ id: null, carte_titre: g.titre, carte_date: g.dpa, exacte: true, sa: semaines(g.dpa)?.sa ?? null, g }); return; }
    const { data } = await supabase.from("surprises").select("id, carte_titre, carte_date")
      .eq("destinataire", userId).not("carte_date", "is", null).eq("carte_masquee", false)
      .order("declenche_le", { ascending: false }).limit(1).maybeSingle();
    setC(data ? { ...(data as { id: string; carte_titre: string; carte_date: string }), exacte: false, sa: null } : null);
  }, [userId, partnerId]);
  useEffect(() => { charger(); }, [charger]);
  if (!c) return null;

  const auj = new Date(); auj.setHours(0, 0, 0, 0);
  const jours = Math.max(0, Math.round((new Date(c.carte_date + "T00:00:00").getTime() - auj.getTime()) / 86400000));
  const ne = c.g?.naissance;
  const bebe = c.sa != null ? bebeA(c.sa) : null;
  const quand = ne ? "Bébé est là 💗" : c.exacte
    ? `Arrivée prévue le ${new Date(c.carte_date + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}${c.sa != null ? ` · ${c.sa}e semaine` : ""}`
    : `Arrivée prévue fin ${new Date(c.carte_date + "T12:00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`;
  // Seule la carte de la surprise se masque (dans l'app : appui long).
  const masquer = async (e: MouseEvent) => {
    e.stopPropagation();
    if (!c.id || !confirm("Masquer la carte ? Elle disparaîtra de ton planning.")) return;
    await supabase.from("surprises").update({ carte_masquee: true }).eq("id", c.id);
    setC(null);
  };

  return (
    <>
    <div onClick={() => c.g && setCarnet(true)} title={c.g ? "Ma grossesse" : undefined}
      className={`group relative mb-4 flex items-center gap-3 rounded-2xl px-4 py-3.5 shadow-sm ${c.g ? "cursor-pointer transition hover:brightness-105 hover:shadow-md" : ""}`}
      style={{ background: "linear-gradient(135deg, #fb7185, #ec4899, #a855f7)" }}>
      <span className="text-[34px] leading-none">{ne ? "💗" : bebe?.emoji ?? "🍼"}</span>
      <div className="flex-1 min-w-0">
        <div className="text-base font-black text-white">{c.carte_titre}</div>
        <div className="mt-0.5 text-[13px] font-bold text-white/90">{quand}</div>
      </div>
      <span className="rounded-full bg-white/25 px-2.5 py-1 text-[13px] font-black text-white">{ne ? "💗" : jours === 0 ? "Jour J" : `J-${jours}`}</span>
      {c.id && (
        <button onClick={masquer} title="Masquer la carte" className="absolute top-1.5 right-1.5 text-white/60 hover:text-white opacity-0 group-hover:opacity-100 transition">
          <X size={14} />
        </button>
      )}
    </div>
    {c.g && <MaGrossesse open={carnet} g={c.g} moi={c.g.user_id === userId} onClose={() => setCarnet(false)} onChange={() => { setCarnet(false); charger(); }} />}
    </>
  );
}
