"use client";
// ─────────────────────────────────────────────────────────────────────────
// Home-trainer : choisir une séance (refonte du 02/11/2026, maquette validée
// par Martin). La durée d'abord, la famille, puis des cartes qui disent ce
// qu'on va ressentir : nom, durée, « Tu vas sentir », intensité, dessin. La
// carte entière se clique ; si le vélo n'est pas prêt, on le dit au lieu de
// griser. Écran large : deux colonnes.
// Pendant de l'app : App-Coach/components/ht/Catalogue.tsx.
// ─────────────────────────────────────────────────────────────────────────
import { mdiDice5Outline, mdiHeartPulse, mdiRoadVariant, mdiStairsUp } from "@mdi/js";
import { aplatir, depuisCourt, type Bloc } from "./ht/seance";
import { auHasard, DUREES, FAMILLES, INTENSITES, seancesDe, type Famille, type Intensite, type SeanceCatalogue } from "./ht/catalogue";
import { Icone, Profil } from "./ui";

export type ChoixCatalogue = { titre: string; blocs: Bloc[]; sessionId: null; texteCourt: null };

// La couleur d'une carte suit l'intensité : vert, ambre, rose.
export const TEINTES: Record<Intensite, { fond: string; bord: string; texte: string; plein: string; vide: string }> = {
  1: { fond: "#ecfdf5", bord: "#a7f3d0", texte: "#047857", plein: "#10b981", vide: "#a7f3d0" },
  2: { fond: "#fffbeb", bord: "#fde68a", texte: "#b45309", plein: "#f59e0b", vide: "#fde68a" },
  3: { fond: "#fff1f2", bord: "#fecaca", texte: "#be123c", plein: "#f43f5e", vide: "#fecaca" },
};

const minuscule = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

export function PastillesIntensite({ n }: { n: Intensite }) {
  const t = TEINTES[n];
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3].map((i) => <span key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: i <= n ? t.plein : t.vide }} />)}
      <span className="ml-1 text-[13px] font-black" style={{ color: t.texte }}>{INTENSITES[n]}</span>
    </div>
  );
}

/** Une carte de séance : le texte en haut, le dessin en bas, toute la carte se clique. */
export function CarteSeance({ s, ftp, onClick }: { s: SeanceCatalogue; ftp: number; onClick: () => void }) {
  const t = TEINTES[s.intensite];
  const etapes = s.texte ? aplatir(depuisCourt(s.texte, ftp).blocs) : [];
  return (
    <button type="button" onClick={onClick} className="w-full text-left rounded-[22px] border p-4 space-y-2 transition hover:brightness-[0.98] active:scale-[0.99]"
      style={{ background: t.fond, borderColor: t.bord }}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex-1 min-w-0 truncate text-[20px] font-black text-slate-800">{s.nom}</span>
        {s.minutes ? <span className="text-[15px] font-extrabold text-slate-500 shrink-0">{s.minutes} min</span> : null}
      </div>
      {s.classique ? <div className="-mt-1.5 text-[12.5px] font-bold text-slate-400">{s.classique}</div> : null}
      <p className="text-[14.5px] font-semibold leading-5 text-slate-600">Tu vas sentir : {minuscule(s.sentir)}</p>
      <PastillesIntensite n={s.intensite} />
      {etapes.length > 0 && <div className="pt-0.5"><Profil etapes={etapes} ftp={ftp} hauteur={52} /></div>}
    </button>
  );
}

const puce = (actif: boolean) => `shrink-0 rounded-full border px-[15px] py-2.5 text-[14.5px] font-extrabold transition ${actif ? "bg-slate-800 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50"}`;

export default function Catalogue({ duree, setDuree, famille, setFamille, ftp, pret, occupe, onGo, onTest, onPasPret }: {
  duree: number; setDuree: (d: number) => void; famille: Famille; setFamille: (f: Famille) => void; ftp: number; pret: boolean; occupe: boolean;
  onGo: (c: ChoixCatalogue) => void; onTest: (p: "rampe" | "lsct") => void; onPasPret: () => void;
}) {
  const liste = seancesDe(famille, duree, { avecLsct: true, graine: new Date().getDate() });
  const fam = FAMILLES.find((x) => x.id === famille)!;
  const lancer = (s: SeanceCatalogue) => {
    if (!pret) return onPasPret();
    if (s.test) return onTest(s.test);
    const blocs = depuisCourt(s.texte!, ftp).blocs;
    onGo({ titre: s.nom, blocs, sessionId: null, texteCourt: null });
  };
  const surprise = () => { const s = auHasard(liste.filter((x) => !x.test)); if (s) lancer(s); };

  return (
    <div className="space-y-3.5">
      {famille !== "test" && (
        <div className="flex gap-1.5">
          {DUREES.map((d) => (
            <button key={d} type="button" onClick={() => setDuree(d)}
              className={`flex-1 h-[50px] rounded-[14px] border text-[16px] font-black transition ${duree === d ? "bg-slate-800 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50"}`}>{d}′</button>
          ))}
        </div>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1 -mb-1">
        {FAMILLES.map((x) => (
          <button key={x.id} type="button" onClick={() => setFamille(x.id)} className={puce(famille === x.id)}>{x.nom}</button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2.5">
        <p className="flex-1 text-[14.5px] font-bold text-slate-600">{fam.phrase}</p>
        {famille !== "test" && liste.length > 1 && (
          <button type="button" onClick={surprise} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-violet-300 bg-violet-50 px-3 py-2 text-[13px] font-black text-violet-700 hover:bg-violet-100">
            <Icone d={mdiDice5Outline} taille={16} /> Surprends-moi
          </button>
        )}
      </div>
      {famille === "tranquille" && (
        <button type="button" onClick={() => (pret ? onGo({ titre: "Sortie libre", blocs: [], sessionId: null, texteCourt: null }) : onPasPret())}
          className="w-full text-left rounded-[22px] bg-white border border-slate-200 p-4 flex items-center gap-3 hover:bg-slate-50 transition">
          <span className="w-[42px] h-[42px] rounded-[14px] bg-teal-100 flex items-center justify-center shrink-0"><Icone d={mdiRoadVariant} taille={22} coul="#0f766e" /></span>
          <span className="flex-1 min-w-0">
            <span className="block text-[18px] font-black text-slate-800">Sortie libre</span>
            <span className="block text-[14px] font-semibold text-slate-500">Pas de séance : tu roules comme tu veux, − et + règlent la résistance</span>
          </span>
        </button>
      )}
      {liste.length === 0 && (
        <p className="text-center font-bold text-slate-400 p-3">Rien de ce genre en {duree} minutes : essaie une autre durée.</p>
      )}
      {famille === "test" ? liste.map((x) => (
        <button key={x.id} type="button" onClick={() => lancer(x)} disabled={occupe}
          className={`w-full text-left rounded-[22px] bg-violet-50 border border-violet-200 p-[18px] space-y-2 transition hover:bg-violet-100 ${occupe ? "opacity-60" : ""}`}>
          <span className="flex items-center gap-2.5">
            <Icone d={x.test === "rampe" ? mdiStairsUp : mdiHeartPulse} taille={24} coul="#6d28d9" />
            <span className="flex-1 text-[20px] font-black text-slate-800">{x.nom}</span>
          </span>
          <span className="block text-[14.5px] font-semibold leading-5 text-slate-600">{x.sentir}</span>
          <span className="block text-[13px] font-semibold text-slate-400">{x.test === "rampe"
            ? "Reposé, avec ta ceinture cardio, en mode ERG. Va vraiment jusqu'au bout : l'app passe toute seule au retour au calme."
            : "Reposé, avec ta ceinture cardio. Le home-trainer règle les watts pour garder ton cœur sur la cible."}</span>
          <span className="block text-[14px] font-black text-violet-700">{occupe ? "Je prépare le test…" : "Touche pour lancer le test"}</span>
        </button>
      )) : (
        <div className="grid min-[700px]:grid-cols-2 gap-3">
          {liste.map((x) => <CarteSeance key={x.id} s={x} ftp={ftp} onClick={() => lancer(x)} />)}
        </div>
      )}
    </div>
  );
}
