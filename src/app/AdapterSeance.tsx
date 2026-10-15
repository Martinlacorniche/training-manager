"use client";
import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowClockwise, ArrowsLeftRight, Baby, Check, Clock, Gauge, Heartbeat, MagicWand, X } from "@phosphor-icons/react";
import { adapter, ROSE, type Proposition } from "./grossesse";

// « Adapter » (mode grossesse, 15/10/2026), comme dans l'app (App-Coach,
// components/AdapterSeance.tsx) : Claude propose la version adaptée de la
// séance du coach ; elle valide, et seule SA version change (seance_adaptee).
// Le coach garde la sienne.

const INTENSITE: Record<string, string> = { basse: "Facile", moyenne: "Modérée", haute: "Soutenue" };
const DEGRADE = "linear-gradient(135deg, #fb7185, #ec4899, #a855f7)";

export default function AdapterSeance({ open, sessionId, onClose, onFait }: { open: boolean; sessionId: string | null; onClose: () => void; onFait: () => void }) {
  const [p, setP] = useState<Proposition | null>(null);
  const [plafond, setPlafond] = useState<number | null>(null);
  const [charge, setCharge] = useState(false);

  const proposer = async () => {
    if (!sessionId) return;
    setCharge(true); setP(null);
    try {
      const r = await adapter(sessionId, "proposer");
      setP(r.proposition ?? null); setPlafond(r.plafond ?? null);
    } catch (e) { alert("Oups : " + (e as Error).message); onClose(); }
    finally { setCharge(false); }
  };
  useEffect(() => { if (open && sessionId) proposer(); }, [open, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const valider = async () => {
    if (!p || !sessionId) return;
    setCharge(true);
    try { await adapter(sessionId, "enregistrer", p); onFait(); onClose(); }
    catch (e) { alert("Oups : " + (e as Error).message); }
    finally { setCharge(false); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[88vh] overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col">
        <div className="px-5 pt-4 pb-4 text-white" style={{ background: DEGRADE }}>
          <div className="flex items-center gap-2.5">
            <MagicWand size={22} weight="bold" />
            <div className="flex-1 text-lg font-black">Ta version</div>
            <button onClick={onClose} className="opacity-90 hover:opacity-100"><X size={22} weight="bold" /></button>
          </div>
          <div className="mt-1 text-[12.5px] font-bold text-white/90">Ton coach garde la sienne, tu vois la tienne.</div>
        </div>

        {charge && !p ? (
          <div className="flex flex-col items-center p-10">
            <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}>
              <Baby size={44} color={ROSE} weight="duotone" />
            </motion.div>
            <div className="mt-3 font-bold text-slate-500">On adapte ta séance…</div>
          </div>
        ) : p ? (
          <div className="overflow-y-auto p-5 pb-6">
            <div className="text-xl font-black text-slate-900">{p.titre}</div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Puce icone={<Clock size={14} weight="bold" />} texte={`${p.duree_minutes} min`} />
              <Puce icone={<Gauge size={14} weight="bold" />} texte={INTENSITE[p.intensite] ?? p.intensite} />
              {plafond ? <Puce icone={<Heartbeat size={14} weight="bold" />} texte={`Max ${plafond}`} /> : null}
            </div>
            <div className="mt-3.5 space-y-1.5">
              {p.changements.map((c, i) => (
                <div key={i} className="flex items-start gap-2">
                  <ArrowsLeftRight size={16} color={ROSE} className="mt-0.5 shrink-0" />
                  <span className="text-sm font-semibold leading-5 text-slate-700">{c}</span>
                </div>
              ))}
            </div>
            <div className="mt-3.5 whitespace-pre-line rounded-2xl bg-pink-50 p-3.5 text-sm leading-6 text-slate-800">{p.consignes}</div>
            <div className="mt-4 flex gap-2.5">
              <button onClick={proposer} disabled={charge}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-pink-200 py-3 font-black hover:bg-pink-50 disabled:opacity-60" style={{ color: ROSE }}>
                <ArrowClockwise size={18} weight="bold" /> Autre idée
              </button>
              <button onClick={valider} disabled={charge}
                className="flex flex-[1.4] items-center justify-center gap-1.5 rounded-2xl py-3 font-black text-white hover:brightness-110 disabled:opacity-60" style={{ background: ROSE }}>
                <Check size={18} weight="bold" /> {charge ? "…" : "C'est ma séance"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Puce({ icone, texte }: { icone: ReactNode; texte: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-50 px-2.5 py-1 text-[12.5px] font-extrabold text-pink-800">
      <span style={{ color: ROSE }}>{icone}</span>{texte}
    </span>
  );
}
