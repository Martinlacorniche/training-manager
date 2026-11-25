"use client";
// Le jeu des cols à plusieurs (25/11/2026), côté site : le salon, le choix des
// fantômes, le bandeau de position pendant la montée et le classement final.
// La logique est dans ht/course*.ts et ht/useSalon.ts (copies de l'app).
import { useState } from "react";
import { mdiChevronLeft, mdiFlagCheckered, mdiLogin, mdiPlay, mdiPlus, mdiShareVariant } from "@mdi/js";
import { Bouton, Carte, Icone, Titre } from "./ui";
import { chrono } from "./Bandeau";
import { COLS } from "./ht/cols";
import { couleurDe, MAX_RIVAUX, MAX_SALON, rangTexte, texteEcart, type Arrivee, type Situation } from "./ht/course";
import type { FantomeTrace } from "./ht/courseReseau";
import type { useSalon } from "./ht/useSalon";

export type Salon = ReturnType<typeof useSalon>;

/** Pendant la montée : ta position en grand, l'écart avec celui de devant et celui de derrière. */
export function BandeauCourse({ s }: { s: Situation }) {
  const ligne = (sens: "devant" | "derrière", e: Situation["devant"]) => (
    <div className="min-w-0">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/70">{sens}</div>
      {e ? (
        <div className="truncate text-[22px] font-black text-white">{e.prenom} <span className={sens === "devant" ? "text-rose-300" : "text-emerald-300"}>à {texteEcart(e)}</span></div>
      ) : <div className="text-[18px] font-extrabold text-white/60">{sens === "devant" ? "Tu mènes" : "Dernier"}</div>}
    </div>
  );
  return (
    <div className="flex items-center gap-6 rounded-[24px] px-6 py-4" style={{ backgroundImage: "linear-gradient(135deg, #312e81, #4f46e5)" }}>
      <div>
        <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/70">Position</div>
        <div className="text-[64px] font-black leading-none tabular-nums text-white">{rangTexte(s.rang)}<span className="text-3xl text-white/75"> / {s.total}</span></div>
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">{ligne("devant", s.devant)}{ligne("derrière", s.derriere)}</div>
    </div>
  );
}

/** Le classement de la course (fantômes ou direct) : prénom, temps, écart au premier. */
export function ResultatCourse({ lignes, enCours }: { lignes: Arrivee[]; enCours?: boolean }) {
  return (
    <div className="border-t border-slate-100 pt-2.5 space-y-1">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">La course{enCours ? " · en cours" : ""}</div>
      {lignes.map((l, i) => (
        <div key={`${l.id}-${i}`} className={`flex justify-between rounded-xl px-2.5 py-1.5 text-[14px] font-extrabold ${l.moi ? "bg-blue-50 text-blue-700" : l.abandon ? "text-slate-400" : "text-slate-700"}`}>
          <span>{l.abandon ? "—" : l.rang === 1 ? "🥇" : l.rang === 2 ? "🥈" : l.rang === 3 ? "🥉" : `${l.rang}.`} {l.prenom}</span>
          <span className="tabular-nums">{l.abandon ? "abandon" : l.t == null ? "en route…" : `${chrono(l.t)}${l.ecart ? ` · +${l.ecart} s` : ""}`}</span>
        </div>
      ))}
    </div>
  );
}

const Voile = ({ children }: { children: React.ReactNode }) => (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-6">{children}</div>
);

/** « Avec des fantômes » : les montées disponibles sur ce col (jusqu'à 9) + ma meilleure. */
export function FeuilleFantomes({ colNom, liste, chargement, onPartir, onFermer }: { colNom: string; liste: FantomeTrace[]; chargement: boolean; onPartir: (choisis: FantomeTrace[]) => void; onFermer: () => void }) {
  const [pris, setPris] = useState<string[]>([]);
  const bascule = (id: string) => setPris((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_RIVAUX ? p : [...p, id]));
  const moi = liste.find((f) => f.moi);
  const rang = (f: FantomeTrace, nom: string) => (
    <button key={f.id} type="button" onClick={() => bascule(f.id)} className={`flex w-full items-center rounded-2xl border-2 px-3.5 py-3 text-left ${pris.includes(f.id) ? "border-blue-600 bg-blue-50" : "border-slate-100 bg-slate-50"}`}>
      <span className="flex-1 font-black text-slate-800">{nom}</span><span className="font-black tabular-nums text-slate-800">{chrono(f.duree_s)}</span>
    </button>
  );
  return (
    <Voile>
      <div className="w-full max-w-md space-y-2.5 rounded-t-[28px] sm:rounded-[28px] bg-white p-5 max-h-[85vh] overflow-auto">
        <div className="text-xl font-black text-slate-800">Avec des fantômes</div>
        <div className="text-sm font-bold text-slate-500">{colNom} · choisis jusqu&apos;à {MAX_RIVAUX} montées ({pris.length}/{MAX_RIVAUX})</div>
        {chargement ? <div className="py-6 text-center font-bold text-slate-400">Je cherche…</div> : liste.length === 0 ? (
          <p className="text-[15px] font-semibold leading-snug text-slate-500">Aucune montée enregistrée sur ce col pour ton groupe. Chaque montée terminée à partir de maintenant devient un fantôme.</p>
        ) : (
          <div className="space-y-1.5">{moi && rang(moi, "🏆 Ma meilleure")}{liste.filter((f) => !f.moi).map((f) => rang(f, f.prenom))}</div>
        )}
        <Bouton large icone={mdiPlay} onClick={() => onPartir(liste.filter((f) => pris.includes(f.id)))}>{pris.length ? `Partir avec ${pris.length} fantôme${pris.length > 1 ? "s" : ""}` : "Partir seul"}</Bouton>
        <button type="button" onClick={onFermer} className="w-full py-2 font-extrabold text-slate-500">Annuler</button>
      </div>
    </Voile>
  );
}

/** « Course en direct » : créer ou rejoindre un salon, salle d'attente, compte à rebours commun. */
export function EcranSalon({ salon }: { salon: Salon }) {
  const [saisie, setSaisie] = useState("");
  const [col, setCol] = useState(COLS[0].id);
  const colNom = COLS.find((c) => c.id === (salon.colId ?? col))?.nom ?? "";
  if (salon.phase === "compte") return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-slate-900 p-6 text-center">
      <div className="text-lg font-extrabold text-white/75">⛰️ {colNom}</div>
      <div className="text-[220px] font-black leading-none tabular-nums text-white">{salon.reste}</div>
      <div className="text-base font-bold text-white/75">Tout le monde part en même temps. Installe-toi, pédale dès le départ.</div>
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-xl space-y-3.5">
        <button type="button" onClick={salon.quitter} className="flex items-center gap-1 font-extrabold text-slate-500"><Icone d={mdiChevronLeft} taille={22} />Quitter</button>
        <h1 className="text-[28px] font-extrabold text-slate-800">Course en direct</h1>
        {salon.phase === "choix" && (
          <>
            <p className="text-[15px] font-semibold leading-snug text-slate-500">Jusqu&apos;à {MAX_SALON} coureurs sur le même col, chacun sur son vélo. Un salon, un code à 4 chiffres, et on part ensemble.</p>
            <Bouton large icone={mdiPlus} desactive={salon.occupe} onClick={salon.creer}>Créer un salon</Bouton>
            <Carte className="space-y-2.5">
              <div className="font-black text-slate-800">Rejoindre avec un code</div>
              <input value={saisie} onChange={(e) => setSaisie(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" maxLength={4} placeholder="0000"
                className="w-full rounded-2xl border border-slate-200 bg-white py-2 text-center text-[44px] font-black tracking-[0.3em] text-slate-800 outline-none" />
              <Bouton large icone={mdiLogin} desactive={saisie.length !== 4 || salon.occupe} onClick={() => salon.rejoindre(saisie)}>Rejoindre</Bouton>
            </Carte>
          </>
        )}
        {salon.phase === "attente" && (
          <>
            <Carte className="flex flex-col items-center gap-1.5 !p-5">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Code du salon</div>
              <div className="text-[96px] font-black leading-none tracking-[0.12em] tabular-nums text-slate-800">{salon.code}</div>
              <button type="button" onClick={() => { const t = `Rejoins ma course en direct sur C'est Ludique : salon ${salon.code}`; if (navigator.share) navigator.share({ text: t }).catch(() => {}); else navigator.clipboard?.writeText(t).catch(() => {}); }}
                className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-2 font-extrabold text-slate-800"><Icone d={mdiShareVariant} taille={16} />Partager le code</button>
            </Carte>
            <Carte className="space-y-1.5">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Présents · {salon.presents.length} / {MAX_SALON}</div>
              {salon.presents.map((p, i) => (
                <div key={p.id} className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-black text-white" style={{ background: couleurDe(i) }}>{p.prenom.slice(0, 1).toUpperCase()}</span>
                  <span className="text-base font-extrabold text-slate-800">{p.prenom}</span>
                </div>
              ))}
              {!salon.connecte && <div className="font-extrabold text-amber-600">Connexion perdue, je reprends…</div>}
            </Carte>
            {salon.hote ? (
              <>
                <Titre>Choisis le col</Titre>
                <div className="space-y-1.5">
                  {COLS.map((c) => (
                    <button key={c.id} type="button" onClick={() => setCol(c.id)} className={`flex w-full items-center rounded-2xl border-2 px-3.5 py-3 text-left ${col === c.id ? "border-blue-600 bg-blue-50" : "border-slate-100 bg-white"}`}>
                      <span className="flex-1 truncate font-black text-slate-800">{c.nom}</span>
                      <span className="font-bold text-slate-500">{c.km.toFixed(1).replace(".", ",")} km · {c.moyenne.toFixed(1).replace(".", ",")} %</span>
                    </button>
                  ))}
                </div>
                <Bouton large icone={mdiFlagCheckered} desactive={salon.occupe} onClick={() => salon.lancer(col)}>Lancer le départ</Bouton>
              </>
            ) : <div className="flex items-center gap-2.5 p-3.5 font-extrabold text-slate-500"><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />L&apos;hôte choisit le col et lance le départ…</div>}
          </>
        )}
        {salon.erreur && <div className="font-extrabold text-rose-600">{salon.erreur}</div>}
      </div>
    </div>
  );
}
