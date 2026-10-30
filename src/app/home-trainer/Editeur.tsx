"use client";
// Créer une séance à la main, de deux façons qui se suivent : le texte court
// (« 10' 150W, 5x(4' 300W / 3' 150W) ») et des blocs à boutons. Le texte est
// la vérité ; les blocs le réécrivent.
import { Minus, Plus, Trash, Repeat, ListPlus } from "@phosphor-icons/react";
import { type Bloc, type Etape, depuisCourt, versCourt, dureeTotale } from "./ht/seance";
import { Profil } from "./Profil";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function Pas({ onMoins, onPlus, children }: { onMoins: () => void; onPlus: () => void; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={onMoins} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center"><Minus size={14} weight="bold" /></button>
      <div className="min-w-[64px] text-center font-bold text-slate-800 tabular-nums">{children}</div>
      <button type="button" onClick={onPlus} className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center"><Plus size={14} weight="bold" /></button>
    </div>
  );
}

export function Editeur({ texte, setTexte, ftp }: { texte: string; setTexte: (t: string) => void; ftp: number }) {
  const { blocs, erreurs } = depuisCourt(texte, ftp);
  const maj = (b: Bloc[]) => setTexte(versCourt(b.filter((x) => x.etapes.length)));
  const copie = () => blocs.map((b) => ({ fois: b.fois, etapes: b.etapes.map((e) => ({ ...e, cible: { ...e.cible } })) as Etape[] }));

  const changerEtape = (bi: number, ei: number, f: (e: Etape) => Etape) => { const b = copie(); b[bi].etapes[ei] = f(b[bi].etapes[ei]); maj(b); };
  const watts = (e: Etape, d: number): Etape => {
    if (e.cible.type === "libre") return { ...e, cible: { type: "w", min: Math.round(ftp * 0.6), max: Math.round(ftp * 0.6) } };
    const v = Math.max(30, Math.round((e.cible.min + e.cible.max) / 2) + d);
    return { ...e, rampe: undefined, cible: { ...e.cible, min: v, max: v } };
  };
  const type = (e: Etape): Etape => {
    const ordre = ["w", "bpm", "libre"] as const;
    const t = ordre[(ordre.indexOf(e.cible.type) + 1) % 3];
    return { ...e, rampe: undefined, cible: t === "w" ? { type: "w", min: Math.round(ftp * 0.6), max: Math.round(ftp * 0.6) } : t === "bpm" ? { type: "bpm", min: 140, max: 140 } : { type: "libre" } };
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">En texte</label>
        <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={2} spellCheck={false}
          placeholder={`10' 150W, 5x(4' 300W / 3' 150W), 10' 140W`}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        <p className="text-xs text-slate-400 mt-1">Durées : 4&apos; · 1&apos;30 · 30&quot; — Cibles : 250W · 105% · 140bpm · Z2 · 100&gt;200W (montée) — Options : @90 (cadence) · lap (fin à la main)</p>
        {erreurs.map((e) => <p key={e} className="text-xs text-rose-600 mt-1">{e}</p>)}
      </div>

      {blocs.length > 0 && (
        <div className="rounded-xl bg-slate-50 p-2"><Profil etapes={blocs.flatMap((b) => Array.from({ length: b.fois }, () => b.etapes).flat())} ftp={ftp} hauteur={60} />
          <p className="text-xs text-slate-500 mt-1 text-right">{Math.round(dureeTotale(blocs) / 60)} min</p></div>
      )}

      <div className="space-y-3">
        {blocs.map((b, bi) => (
          <div key={bi} className={`rounded-2xl border ${b.fois > 1 ? "border-violet-200 bg-violet-50/40" : "border-slate-200 bg-white"} p-3`}>
            <div className="flex items-center justify-between mb-2">
              {b.fois > 1 ? (
                <div className="flex items-center gap-2 text-violet-700 font-bold text-sm"><Repeat size={16} />
                  <Pas onMoins={() => { const c = copie(); c[bi].fois = Math.max(1, c[bi].fois - 1); maj(c); }} onPlus={() => { const c = copie(); c[bi].fois++; maj(c); }}>{b.fois} fois</Pas>
                </div>
              ) : <span className="text-xs font-bold text-slate-400 uppercase">Bloc</span>}
              <button type="button" onClick={() => { const c = copie(); c.splice(bi, 1); maj(c); }} className="text-slate-400 hover:text-rose-500"><Trash size={18} /></button>
            </div>
            <div className="space-y-2">
              {b.etapes.map((e, ei) => (
                <div key={ei} className="flex flex-wrap items-center gap-3">
                  <Pas onMoins={() => changerEtape(bi, ei, (x) => ({ ...x, s: Math.max(10, x.s - (x.s > 60 ? 30 : 10)) }))}
                    onPlus={() => changerEtape(bi, ei, (x) => ({ ...x, s: x.s + (x.s >= 60 ? 30 : 10) }))}>{mmss(e.s)}</Pas>
                  <button type="button" onClick={() => changerEtape(bi, ei, type)} className="px-2 py-1 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-600 w-16">
                    {e.cible.type === "w" ? "Watts" : e.cible.type === "bpm" ? "Cardio" : "Libre"}
                  </button>
                  {e.cible.type === "w" && !e.rampe && <Pas onMoins={() => changerEtape(bi, ei, (x) => watts(x, -5))} onPlus={() => changerEtape(bi, ei, (x) => watts(x, 5))}>
                    {e.cible.min === e.cible.max ? `${e.cible.min} W` : `${e.cible.min}-${e.cible.max}`}</Pas>}
                  {e.rampe && <span className="text-sm font-bold text-slate-700">{e.rampe.de} → {e.rampe.a} W</span>}
                  {e.cible.type === "bpm" && <Pas onMoins={() => changerEtape(bi, ei, (x) => x.cible.type === "bpm" ? { ...x, cible: { ...x.cible, min: x.cible.min - 2, max: x.cible.max - 2 } } : x)}
                    onPlus={() => changerEtape(bi, ei, (x) => x.cible.type === "bpm" ? { ...x, cible: { ...x.cible, min: x.cible.min + 2, max: x.cible.max + 2 } } : x)}>{e.cible.min === e.cible.max ? `${e.cible.min} bpm` : `${e.cible.min}-${e.cible.max}`}</Pas>}
                  {e.cible.type === "w" && <span className="text-xs text-slate-400">{Math.round(((e.cible.min + e.cible.max) / 2 / ftp) * 100)} %</span>}
                  {b.etapes.length > 1 && <button type="button" onClick={() => { const c = copie(); c[bi].etapes.splice(ei, 1); maj(c); }} className="ml-auto text-slate-300 hover:text-rose-500"><Trash size={16} /></button>}
                </div>
              ))}
              {b.fois > 1 && <button type="button" onClick={() => { const c = copie(); c[bi].etapes.push({ s: 60, cible: { type: "w", min: Math.round(ftp * 0.55), max: Math.round(ftp * 0.55) } }); maj(c); }}
                className="text-xs font-bold text-violet-600 hover:underline">+ étape dans la répétition</button>}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => maj([...copie(), { fois: 1, etapes: [{ s: 600, cible: { type: "w", min: Math.round(ftp * 0.6), max: Math.round(ftp * 0.6) } }] }])}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 text-white text-sm font-bold"><ListPlus size={16} /> Bloc</button>
        <button type="button" onClick={() => maj([...copie(), { fois: 5, etapes: [{ s: 240, cible: { type: "w", min: Math.round(ftp * 1.05), max: Math.round(ftp * 1.05) } }, { s: 180, cible: { type: "w", min: Math.round(ftp * 0.55), max: Math.round(ftp * 0.55) } }] }])}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold"><Repeat size={16} /> Répétition</button>
      </div>
    </div>
  );
}
