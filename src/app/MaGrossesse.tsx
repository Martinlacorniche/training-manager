"use client";
import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import {
  Bed, Bicycle, CaretRight, Check, Drop, Flower, HandPalm, Heart, Heartbeat, Hourglass,
  PersonSimpleRun, PersonSimpleWalk, Sun, X,
} from "@phosphor-icons/react";
import { bebeA, fcMaxObservee, ROSE, semaines, SIGNES_ARRET, type Grossesse } from "./grossesse";

// ─────────────────────────────────────────────────────────────────────────
// Le carnet « Ma grossesse » (15/10/2026), comme dans l'app (App-Coach,
// components/MaGrossesse.tsx), ouvert d'un clic sur le bandeau. Peu de texte,
// des tuiles : la semaine, le bébé en objet de sport, son plafond cardio, son
// cœur au repos, les rappels du trimestre, quand s'arrêter, puis au 3e
// trimestre « il bouge » et le chrono des contractions. Après la naissance :
// la reprise. Le duo (s'il voit) a la semaine, le bébé et le journal.
// Règles : HAS 2019 ; tailles : calendrier des HUG. Jamais côté coach.
// ─────────────────────────────────────────────────────────────────────────

type Journal = { id: string; genre: "mouvements" | "contraction"; debut: string; fin: string | null; valeur: number | null };
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const DEGRADE = "linear-gradient(135deg, #fb7185, #ec4899, #a855f7)";

export default function MaGrossesse({ open, g, moi, onClose, onChange }: { open: boolean; g: Grossesse; moi: boolean; onClose: () => void; onChange: () => void }) {
  const [plafond, setPlafond] = useState<{ max: number; pl: number } | null>(null);
  const [repos, setRepos] = useState<{ avant: number; maintenant: number; depuis: string } | null>(null);
  const [journal, setJournal] = useState<Journal[]>([]);
  const [info, setInfo] = useState<{ titre: string; lignes: string[] } | null>(null);
  const [compte, setCompte] = useState<{ debut: number; n: number } | null>(null);
  const [contraction, setContraction] = useState<number | null>(null);
  const [, tic] = useState(0);

  const s = semaines(g.dpa);
  const sa = s?.sa ?? 0;
  const apres = !!g.naissance;
  const bebe = bebeA(sa);
  const jours = g.dpa ? Math.max(0, Math.round((new Date(g.dpa + "T12:00:00").getTime() - Date.now()) / 86_400_000)) : null;

  const chargerJournal = async () => {
    const { data } = await supabase.from("grossesse_journal").select("id, genre, debut, fin, valeur").eq("user_id", g.user_id)
      .gte("debut", new Date(Date.now() - 3 * 86_400_000).toISOString()).order("debut", { ascending: false });
    setJournal((data ?? []) as Journal[]);
  };
  useEffect(() => {
    if (!open) return;
    chargerJournal();
    if (!moi) return;
    fcMaxObservee(g.user_id).then((m) => setPlafond(m ? { max: m, pl: Math.floor(m * 0.85) } : null)).catch(() => {});
    supabase.from("bien_etre_quotidien").select("jour, fc_repos").eq("user_id", g.user_id).not("fc_repos", "is", null).order("jour").then(({ data }) => {
      const l = (data ?? []).map((x) => ({ jour: x.jour as string, v: Number(x.fc_repos) }));
      if (l.length < 10) { setRepos(null); return; }
      const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
      setRepos({ avant: med(l.slice(0, 7).map((x) => x.v)), maintenant: med(l.slice(-7).map((x) => x.v)), depuis: l[0].jour });
    });
  }, [open, g.user_id, moi]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!compte && contraction == null) return;
    const t = setInterval(() => tic((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [compte, contraction]);

  if (!open) return null;

  const ecrire = async (ligne: Partial<Journal>) => {
    const { error } = await supabase.from("grossesse_journal").insert({ user_id: g.user_id, ...ligne });
    if (error) alert("Oups : " + error.message); else chargerJournal();
  };
  const finirCompte = async () => {
    if (!compte) return;
    await ecrire({ genre: "mouvements", debut: new Date(compte.debut).toISOString(), fin: new Date().toISOString(), valeur: compte.n });
    setCompte(null);
  };
  const basculerContraction = async () => {
    if (contraction == null) { setContraction(Date.now()); return; }
    await ecrire({ genre: "contraction", debut: new Date(contraction).toISOString(), fin: new Date().toISOString() });
    setContraction(null);
  };
  const naissance = async () => {
    if (!confirm("Bébé est né ? 💗\nOn passe en mode reprise.")) return;
    await supabase.from("grossesse").update({ naissance: new Date().toLocaleDateString("sv-SE") }).eq("user_id", g.user_id);
    onChange();
  };

  // Les contractions de la dernière heure : durée et écart moyens.
  const ctr = journal.filter((j) => j.genre === "contraction" && j.fin && Date.parse(j.debut) > Date.now() - 3600_000).reverse();
  const duree = ctr.length ? ctr.reduce((a, c) => a + (Date.parse(c.fin!) - Date.parse(c.debut)) / 1000, 0) / ctr.length : null;
  const ecart = ctr.length > 1 ? (Date.parse(ctr[ctr.length - 1].debut) - Date.parse(ctr[0].debut)) / 1000 / (ctr.length - 1) : null;
  const dernierCompte = journal.find((j) => j.genre === "mouvements");

  const rappels: [ReactNode, string][] = apres ? [] : [
    ...(sa >= 24 ? [[<Bed key="d" size={16} />, "Pas sur le dos"] as [ReactNode, string]] : []),
    ...(s && s.trimestre >= 2 ? [[<Bicycle key="v" size={16} />, "Vélo dedans"] as [ReactNode, string]] : []),
    [<Hourglass key="h" size={16} />, "1 h 30 max"], [<Drop key="e" size={16} />, "Bois souvent"], [<Sun key="c" size={16} />, "Fuis la chaleur"],
  ];
  const semApres = g.naissance ? Math.floor((Date.now() - new Date(g.naissance + "T12:00:00").getTime()) / (7 * 86_400_000)) : 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#fff7fb]">
      <div className="mx-auto max-w-lg pb-10">
        <div className="relative px-5 pt-8 pb-7 text-white rounded-b-[30px] shadow-sm" style={{ background: DEGRADE }}>
          <button onClick={onClose} className="absolute top-5 right-4 opacity-90 hover:opacity-100" title="Fermer"><X size={26} weight="bold" /></button>
          <div className="text-xs font-extrabold uppercase tracking-[0.1em] text-white/85">{g.titre}</div>
          {apres ? (
            <>
              <div className="mt-1.5 text-[44px] font-black leading-tight">{semApres} <span className="text-xl">semaine{semApres > 1 ? "s" : ""}</span></div>
              <div className="text-[15px] font-bold">depuis la naissance 💗</div>
            </>
          ) : (
            <div className="mt-1.5 flex items-end gap-3.5">
              <div className="text-[64px] font-black leading-[70px]">{sa}</div>
              <div className="pb-2.5">
                <div className="text-[17px] font-extrabold">semaines</div>
                <div className="text-[13px] font-bold text-white/90">trimestre {s?.trimestre ?? "-"}{jours != null ? ` · J-${jours}` : ""}</div>
              </div>
              {bebe && (
                <motion.span className="ml-auto text-[54px] leading-none" animate={{ y: [0, -8, 0] }} transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}>{bebe.emoji}</motion.span>
              )}
            </div>
          )}
          {!apres && bebe && <div className="mt-2.5 text-[14.5px] font-bold">Bébé ≈ {bebe.objet} · {bebe.taille}, {bebe.poids}</div>}
        </div>

        <div className="space-y-3 p-4">
          {/* Plafond + cœur au repos (elle seule) */}
          {moi && !apres && (plafond || repos) && (
            <div className="flex gap-2.5">
              {plafond && (
                <Tuile icone={<Heartbeat size={22} />} titre="Plafond" valeur={`${plafond.pl}`} unite="bpm"
                  onClick={() => setInfo({ titre: "Ton plafond", lignes: [`Reste sous ${plafond.pl} bpm : 85 % de ta FC max (${plafond.max}).`, "C'est le repère de la HAS pour les sportives enceintes. Tes séances envoyées à la montre ne le dépassent jamais."] })} />
              )}
              {repos && (
                <Tuile icone={<Heart size={22} />} titre="Cœur au repos" valeur={`${repos.maintenant - repos.avant >= 0 ? "+" : ""}${repos.maintenant - repos.avant}`} unite="bpm"
                  onClick={() => setInfo({ titre: "Ton cœur pour deux", lignes: [`Au repos : ${repos.maintenant} bpm, contre ${repos.avant} début ${new Date(repos.depuis + "T12:00:00").toLocaleDateString("fr-FR", { month: "long" })}.`, "Enceinte, le cœur bat 10 à 20 fois de plus par minute au repos : il travaille pour deux. C'est normal."] })} />
              )}
            </div>
          )}

          {/* Rappels du trimestre */}
          {moi && rappels.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {rappels.map(([i, t]) => (
                <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-pink-100 bg-white px-3 py-2 text-[13px] font-extrabold text-pink-900">
                  <span style={{ color: ROSE }}>{i}</span>{t}
                </span>
              ))}
            </div>
          )}

          {/* Quand s'arrêter */}
          {moi && !apres && (
            <button onClick={() => setInfo({ titre: "Stop, et appelle", lignes: [...SIGNES_ARRET.map((x) => `• ${x}`), "Arrête la séance et appelle ta sage-femme ou ton médecin."] })}
              className="flex w-full items-center gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-left hover:brightness-[0.98]">
              <HandPalm size={22} className="text-rose-600" />
              <span className="flex-1 text-[15px] font-black text-rose-800">Quand s&apos;arrêter</span>
              <CaretRight size={20} className="text-rose-300" />
            </button>
          )}

          {/* 3e trimestre : il bouge, contractions */}
          {!apres && sa >= 28 && (
            <div className="flex gap-2.5">
              <div className="flex-1 rounded-[18px] border border-pink-100 bg-white p-3.5">
                <div className="text-[11px] font-black uppercase tracking-wide" style={{ color: ROSE }}>Il bouge</div>
                {compte ? (
                  <>
                    <div className="mt-1 text-[34px] font-black text-slate-900">{compte.n}</div>
                    <div className="text-xs font-bold text-slate-400">{mmss((Date.now() - compte.debut) / 1000)}</div>
                    {moi && (
                      <div className="mt-2 flex gap-1.5">
                        <button onClick={() => setCompte({ ...compte, n: compte.n + 1 })} className="flex-1 rounded-xl py-2.5 text-base font-black text-white" style={{ background: ROSE }}>+1</button>
                        <button onClick={finirCompte} className="rounded-xl bg-pink-50 px-2.5 py-2.5" style={{ color: ROSE }} title="Fini"><Check size={18} weight="bold" /></button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="mt-1.5 text-[13px] font-semibold text-slate-500">{dernierCompte ? `${dernierCompte.valeur} en ${mmss((Date.parse(dernierCompte.fin!) - Date.parse(dernierCompte.debut)) / 1000)}` : "Compte ses mouvements"}</div>
                    {moi && <button onClick={() => setCompte({ debut: Date.now(), n: 0 })} className="mt-2.5 w-full rounded-xl bg-pink-50 py-2.5 font-black" style={{ color: ROSE }}>Compter</button>}
                  </>
                )}
              </div>
              <div className="flex-1 rounded-[18px] border border-pink-100 bg-white p-3.5">
                <div className="text-[11px] font-black uppercase tracking-wide text-violet-600">Contractions</div>
                {contraction != null ? (
                  <div className="mt-1 text-[34px] font-black text-slate-900">{mmss((Date.now() - contraction) / 1000)}</div>
                ) : (
                  <div className="mt-1.5 text-[13px] font-semibold text-slate-500">
                    {ctr.length ? `${ctr.length} en 1 h${ecart ? ` · toutes les ${mmss(ecart)}` : ""}${duree ? ` · ${Math.round(duree)} s` : ""}` : "Chronomètre-les"}
                  </div>
                )}
                {moi && (
                  <button onClick={basculerContraction} className={`mt-2.5 w-full rounded-xl py-2.5 font-black ${contraction != null ? "bg-violet-600 text-white" : "bg-violet-50 text-violet-600"}`}>
                    {contraction != null ? "Fin" : "Début"}
                  </button>
                )}
              </div>
            </div>
          )}
          {!apres && sa >= 28 && (
            <p className="px-1 text-xs leading-[17px] text-slate-400">
              Il bouge moins que d&apos;habitude ? Appelle ta maternité sans attendre. Pour les contractions, suis la règle que t&apos;a donnée ta maternité ; dans le doute, appelle.
            </p>
          )}

          {/* Après : la reprise */}
          {apres && moi && (
            <div className="space-y-2.5">
              {[
                { ok: true, icone: <PersonSimpleWalk size={24} />, t: "Marche, escaliers, nage douce", d: "Possible tôt, à ton rythme." },
                { ok: true, icone: <Flower size={24} />, t: "Visite postnatale, puis périnée", d: "La rééducation (sage-femme ou kiné) passe avant le sport." },
                { ok: semApres >= 4, icone: <Bicycle size={24} />, t: "Sport en douceur", d: "Après avis médical : souvent 4 à 6 semaines (8 à 10 après césarienne)." },
                { ok: false, icone: <PersonSimpleRun size={24} />, t: "Course, sauts", d: "Seulement quand ton périnée est validé." },
              ].map((x) => (
                <div key={x.t} className={`flex gap-3 rounded-2xl border bg-white p-3.5 ${x.ok ? "border-green-200" : "border-pink-100 opacity-70"}`}>
                  <span style={{ color: x.ok ? "#16a34a" : ROSE }}>{x.icone}</span>
                  <div className="flex-1">
                    <div className="text-[15px] font-black text-slate-900">{x.t}</div>
                    <div className="mt-0.5 text-[13px] leading-[18px] text-slate-500">{x.d}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {moi && !apres && sa >= 30 && (
            <div className="pt-2 text-center">
              <button onClick={naissance} className="font-black hover:underline" style={{ color: ROSE }}>Bébé est né 💗</button>
            </div>
          )}
          <p className="pt-1.5 text-center text-[11px] text-slate-300">Repères HAS 2019 · tailles : HUG. Ne remplace pas ta sage-femme.</p>
        </div>
      </div>

      {info && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-6" onClick={() => setInfo(null)}>
          <div className="absolute inset-0 bg-slate-900/45" />
          <div className="relative w-full max-w-[380px] rounded-[22px] bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-black text-slate-900">{info.titre}</div>
            {info.lignes.map((l, i) => <p key={i} className="mt-2 text-[14.5px] leading-[21px] text-slate-700">{l}</p>)}
            <div className="mt-3 text-right"><button onClick={() => setInfo(null)} className="font-black" style={{ color: ROSE }}>OK</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function Tuile({ icone, titre, valeur, unite, onClick }: { icone: ReactNode; titre: string; valeur: string; unite: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex-1 rounded-[18px] border border-pink-100 bg-white p-3.5 text-left hover:shadow-sm">
      <span style={{ color: ROSE }}>{icone}</span>
      <div className="mt-1.5 text-[11px] font-black uppercase tracking-wide text-pink-800">{titre}</div>
      <div className="text-[28px] font-black text-slate-900">{valeur}<span className="text-[13px] text-slate-400"> {unite}</span></div>
    </button>
  );
}
