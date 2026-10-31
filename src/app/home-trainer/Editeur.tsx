"use client";
// Créer une séance à la main, de deux façons qui se suivent : le texte court
// (« 10' 150W, 5x(4' 300W / 3' 150W) ») et des blocs à boutons. Le texte est
// la vérité ; les blocs le réécrivent. Même écran que l'app.
import { mdiCloseCircle, mdiPencilOutline, mdiPlusBoxOutline, mdiRepeat, mdiTrashCanOutline } from "@mdi/js";
import { type Bloc, type Etape, depuisCourt, versCourt, dureeTotale } from "./ht/seance";
import { zoneEtape } from "./ht/zones";
import { Carte, Icone, Pas, profilDe } from "./ui";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function Editeur({ texte, setTexte, ftp }: { texte: string; setTexte: (t: string) => void; ftp: number }) {
  const { blocs, erreurs } = depuisCourt(texte, ftp);
  const maj = (b: Bloc[]) => setTexte(versCourt(b.filter((x) => x.etapes.length)));
  const copie = () => blocs.map((b) => ({ fois: b.fois, sansFin: b.sansFin, etapes: b.etapes.map((e) => ({ ...e, cible: { ...e.cible } })) as Etape[] }));
  const changer = (bi: number, ei: number, f: (e: Etape) => Etape) => { const c = copie(); c[bi].etapes[ei] = f(c[bi].etapes[ei]); maj(c); };
  const w = (pct: number) => Math.round(ftp * pct);
  const watts = (e: Etape, d: number): Etape => {
    if (e.cible.type === "libre") return { ...e, cible: { type: "w", min: w(0.6), max: w(0.6) } };
    const v = Math.max(30, Math.round((e.cible.min + e.cible.max) / 2) + d);
    return { ...e, rampe: undefined, cible: { ...e.cible, min: v, max: v } };
  };
  const type = (e: Etape): Etape => {
    const o = ["w", "bpm", "libre"] as const, t = o[(o.indexOf(e.cible.type) + 1) % 3];
    return { ...e, rampe: undefined, cible: t === "w" ? { type: "w", min: w(0.6), max: w(0.6) } : t === "bpm" ? { type: "bpm", min: 140, max: 140 } : { type: "libre" } };
  };

  return (
    <div className="space-y-2.5">
      <Carte className="space-y-2">
        <div className="flex items-center gap-1.5 font-black text-slate-800"><Icone d={mdiPencilOutline} taille={16} coul="#7c3aed" />Écris ta séance</div>
        <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={2} spellCheck={false} placeholder={`10' 150W, 5x(4' 300W / 3' 150W), 10' 140W`}
          className="w-full rounded-[14px] bg-slate-50 px-3 py-3 font-mono text-[14px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-300" />
        <p className="text-[11.5px] text-slate-400">4&apos; · 1&apos;30 · 30&quot; &nbsp;·&nbsp; 250W · 105% · 140bpm · Z2 · 100&gt;200W &nbsp;·&nbsp; @90 cadence · lap = fin à la main · 5x(…)! = sans la dernière récup</p>
        {erreurs.map((e) => <p key={e} className="text-xs font-bold text-rose-600">{e}</p>)}
        {blocs.length > 0 && <div className="pt-1">{profilDe(blocs, ftp, 46)}<p className="text-right text-xs font-extrabold text-slate-500 mt-1">{Math.round(dureeTotale(blocs) / 60)} min</p></div>}
      </Carte>

      {blocs.map((b, bi) => (
        <div key={bi} className={`rounded-[20px] border p-3 space-y-2.5 ${b.fois > 1 ? "bg-violet-50 border-violet-200" : "bg-white border-[#eef2f7]"}`}>
          <div className="flex items-center justify-between">
            {b.fois > 1 ? (
              <div className="flex items-center gap-1.5"><Icone d={mdiRepeat} taille={18} coul="#7c3aed" />
                <Pas moins={() => { const c = copie(); c[bi].fois = Math.max(1, c[bi].fois - 1); maj(c); }} plus={() => { const c = copie(); c[bi].fois++; maj(c); }}>{b.fois} fois</Pas>
                {b.etapes.length > 1 && (
                  <button type="button" onClick={() => { const c = copie(); c[bi].sansFin = !c[bi].sansFin; maj(c); }}
                    className={`ml-1 rounded-full px-2.5 py-1 text-xs font-black ${b.sansFin ? "bg-violet-600 text-white" : "bg-white text-violet-600 border border-violet-200"}`}>
                    {b.sansFin ? "Sans la dernière récup" : "Avec la dernière récup"}
                  </button>
                )}</div>
            ) : <span className="text-[11px] font-extrabold tracking-[0.12em] text-slate-400">BLOC</span>}
            <button type="button" onClick={() => { const c = copie(); c.splice(bi, 1); maj(c); }} className="text-slate-400 hover:text-rose-500"><Icone d={mdiTrashCanOutline} taille={19} /></button>
          </div>
          {b.etapes.map((e, ei) => {
            const z = zoneEtape(e, ftp);
            return (
              <div key={ei} className="flex flex-wrap items-center gap-2 pl-2.5 border-l-4 rounded-sm" style={{ borderLeftColor: z.plein }}>
                <Pas moins={() => changer(bi, ei, (x) => ({ ...x, s: Math.max(10, x.s - (x.s > 60 ? 30 : 10)) }))} plus={() => changer(bi, ei, (x) => ({ ...x, s: x.s + (x.s >= 60 ? 30 : 10) }))}>{mmss(e.s)}</Pas>
                <button type="button" onClick={() => changer(bi, ei, type)} className="rounded-full px-2.5 py-1.5 text-xs font-black" style={{ background: z.plein + "22", color: z.plein }}>
                  {e.cible.type === "w" ? z.mot : e.cible.type === "bpm" ? "Cardio" : "Libre"}
                </button>
                {e.cible.type === "w" && !e.rampe && <Pas moins={() => changer(bi, ei, (x) => watts(x, -5))} plus={() => changer(bi, ei, (x) => watts(x, 5))}>{e.cible.min === e.cible.max ? `${e.cible.min} W` : `${e.cible.min}-${e.cible.max}`}</Pas>}
                {e.rampe && <span className="font-black text-slate-800">{e.rampe.de} → {e.rampe.a} W</span>}
                {e.cible.type === "bpm" && <Pas moins={() => changer(bi, ei, (x) => x.cible.type === "bpm" ? { ...x, cible: { ...x.cible, min: x.cible.min - 2, max: x.cible.max - 2 } } : x)}
                  plus={() => changer(bi, ei, (x) => x.cible.type === "bpm" ? { ...x, cible: { ...x.cible, min: x.cible.min + 2, max: x.cible.max + 2 } } : x)}>{e.cible.min} bpm</Pas>}
                {b.etapes.length > 1 && <button type="button" onClick={() => { const c = copie(); c[bi].etapes.splice(ei, 1); maj(c); }} className="ml-auto text-slate-300 hover:text-rose-500"><Icone d={mdiCloseCircle} taille={18} /></button>}
              </div>
            );
          })}
          {b.fois > 1 && <button type="button" onClick={() => { const c = copie(); c[bi].etapes.push({ s: 60, cible: { type: "w", min: w(0.55), max: w(0.55) } }); maj(c); }}
            className="text-[13px] font-black text-violet-600 hover:underline">+ une étape dans la répétition</button>}
        </div>
      ))}

      <div className="flex gap-2">
        <button type="button" onClick={() => maj([...copie(), { fois: 1, etapes: [{ s: 600, cible: { type: "w", min: w(0.6), max: w(0.6) } }] }])}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl border border-[#eef2f7] bg-white py-3 font-black text-slate-800 hover:bg-slate-50"><Icone d={mdiPlusBoxOutline} taille={18} />Un bloc</button>
        <button type="button" onClick={() => maj([...copie(), { fois: 5, sansFin: true, etapes: [{ s: 240, cible: { type: "w", min: w(1.05), max: w(1.05) } }, { s: 180, cible: { type: "w", min: w(0.55), max: w(0.55) } }] }])}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl border border-violet-200 bg-violet-50 py-3 font-black text-violet-600 hover:bg-violet-100"><Icone d={mdiRepeat} taille={18} />Une répétition</button>
      </div>
    </div>
  );
}
