"use client";
// « Les grands cols » (31/10/2026) : la liste des montées et leur profil.
// Le profil se dessine comme un vrai profil de col : l'altitude, colorée par
// tranche de 1 km selon la pente (vert, bleu, rouge, noir, comme les bornes).
import { mdiFlagCheckered, mdiHeart, mdiImageFilterHdr, mdiPause, mdiPlay, mdiRotateRight, mdiSpeedometer, mdiTimerOutline, mdiTrophyOutline } from "@mdi/js";
import type { Etat } from "./ht/moteur";
import { COLS, couleurPente, PAS_COL, type Col } from "./ht/cols";
import { Bouton, Bulle as Pastille, Carte, Icone, Sur, Titre } from "./ui";
import { chrono } from "./Bandeau";

/** Le profil du col ; `d` = où on en est (m), pour la montée en cours. */
export function ProfilCol({ col, d, hauteur = 90, kmParKm = true }: { col: Col; d?: number; hauteur?: number; kmParKm?: boolean }) {
  const n = col.pentes.length, larg = 1000;
  const alts: number[] = [col.depart];
  for (const p of col.pentes) alts.push(alts[alts.length - 1] + p);   // 100 m × p % = p m
  const bas = Math.min(...alts), haut = Math.max(...alts), y = (a: number) => hauteur - 4 - ((a - bas) / Math.max(1, haut - bas)) * (hauteur - 10);
  const x = (i: number) => (i / n) * larg;
  // Une tranche par km, colorée par sa pente moyenne
  const tranches: { de: number; a: number; p: number }[] = [];
  for (let k = 0; k < n; k += 10) {
    const fin = Math.min(n, k + 10);
    tranches.push({ de: k, a: fin, p: col.pentes.slice(k, fin).reduce((s, v) => s + v, 0) / (fin - k) });
  }
  const ici = d != null ? Math.min(n, d / PAS_COL) : null;
  return (
    <svg viewBox={`0 0 ${larg} ${hauteur}`} preserveAspectRatio="none" className="w-full block" style={{ height: hauteur }}>
      {tranches.map((t, k) => (
        <path key={k} fill={couleurPente(t.p)} opacity={ici != null && t.a <= ici ? 0.35 : 0.9}
          d={`M${x(t.de)},${hauteur} ${Array.from({ length: t.a - t.de + 1 }, (_, j) => `L${x(t.de + j)},${y(alts[t.de + j])}`).join(" ")} L${x(t.a)},${hauteur} Z`} />
      ))}
      {kmParKm && tranches.map((t, k) => (t.a - t.de >= 6 && n <= 260 ? (
        <text key={`t${k}`} x={(x(t.de) + x(t.a)) / 2} y={hauteur - 6} textAnchor="middle" fontSize={hauteur > 100 ? 15 : 11} fontWeight={800} fill="#fff">{t.p.toFixed(0)}</text>
      ) : null))}
      {ici != null && (
        <>
          <line x1={x(ici)} x2={x(ici)} y1={0} y2={hauteur} stroke="#1e293b" strokeWidth={3} vectorEffect="non-scaling-stroke" />
          <circle cx={x(ici)} cy={y(alts[Math.floor(ici)] + (alts[Math.min(n, Math.floor(ici) + 1)] - alts[Math.floor(ici)]) * (ici % 1))} r={7} fill="#1e293b" stroke="#fff" strokeWidth={3} />
        </>
      )}
    </svg>
  );
}

/** Le zoom : les 1,5 km qui arrivent, une barre par 100 m avec sa pente
 *  écrite, et toi dessus. C'est là qu'on lit le prochain mur. */
export function ZoomCol({ col, d, hauteur = 150 }: { col: Col; d: number; hauteur?: number }) {
  const i0 = Math.max(0, Math.floor(d / PAS_COL) - 1), n = 16;
  const barres = Array.from({ length: n }, (_, k) => i0 + k).filter((i) => i < col.pentes.length);
  const max = Math.max(10, ...barres.map((i) => Math.abs(col.pentes[i])));
  const larg = 100 / n;
  const ici = ((d / PAS_COL - i0) / n) * 100;
  return (
    <div className="relative" style={{ height: hauteur }}>
      <div className="absolute inset-0 flex items-end gap-[3px]">
        {barres.map((i) => {
          const p = col.pentes[i], passe = (i + 1) * PAS_COL <= d;
          return (
            <div key={i} className="flex flex-col items-center justify-end h-full" style={{ width: `${larg}%` }}>
              <span className="text-[13px] font-black tabular-nums mb-1" style={{ color: passe ? "#cbd5e1" : couleurPente(p) }}>{p.toFixed(0)}</span>
              <div className="w-full rounded-t-md" style={{ height: `${Math.max(4, (Math.max(0, p) / max) * (hauteur - 40))}px`, background: couleurPente(p), opacity: passe ? 0.3 : 1 }} />
            </div>
          );
        })}
      </div>
      <div className="absolute top-0 bottom-0 w-[3px] rounded-full bg-slate-800" style={{ left: `${ici}%` }} />
      <div className="absolute -bottom-5 text-[11px] font-bold text-slate-400 left-0">ici</div>
      <div className="absolute -bottom-5 text-[11px] font-bold text-slate-400 right-0">+{((n - 1) * PAS_COL / 1000).toFixed(1).replace(".", ",")} km</div>
    </div>
  );
}

export type Record = { col_id: string; duree_s: number };

export function ListeCols({ ftp, poids, records, pret, onGo }: { ftp: number; poids: number | null; records: Map<string, number>; pret: boolean; onGo: (c: Col) => void }) {
  // Le temps qu'il te faudrait à ta FTP, pour savoir dans quoi tu te lances
  const estime = (c: Col) => {
    const m = (poids ?? 72) + 9, w = ftp * 0.95;
    let t = 0;
    for (const p of c.pentes) {
      const th = Math.atan(p / 100), fixe = m * 9.81 * (0.004 * Math.cos(th) + Math.sin(th));
      let v = 5;
      for (let k = 0; k < 25; k++) v = Math.max(0.3, v - (fixe * v + 0.192 * v ** 3 - w) / (fixe + 0.576 * v ** 2));
      t += PAS_COL / v;
    }
    return t;
  };
  const groupe = (famille: Col["famille"], titre: string) => (
    <div className="space-y-2.5">
      <Titre>{titre}</Titre>
      {COLS.filter((c) => c.famille === famille).map((c) => (
        <Carte key={c.id} className="space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">{c.pays}</div>
              <div className="font-black text-slate-800 text-base truncate">{c.nom}</div>
              <div className="text-[13px] font-semibold text-slate-500 tabular-nums">{c.km.toFixed(1).replace(".", ",")} km · {c.moyenne.toFixed(1).replace(".", ",")} % · {c.denivele} m D+ · max {Math.round(c.max)} %</div>
            </div>
            <div className="text-right shrink-0">
              {records.has(c.id)
                ? <div className="flex items-center gap-1 justify-end text-[13px] font-black text-amber-600"><Icone d={mdiTrophyOutline} taille={15} />{chrono(records.get(c.id)!)}</div>
                : <div className="text-[12px] font-bold text-slate-400">~ {chrono(Math.round(estime(c) / 60) * 60)} à ta FTP</div>}
            </div>
            <Bouton petit desactive={!pret} icone={mdiPlay} onClick={() => onGo(c)}>Go</Bouton>
          </div>
          <ProfilCol col={c} hauteur={56} kmParKm={false} />
        </Carte>
      ))}
    </div>
  );
  return (
    <div className="space-y-5">
      {groupe("local", "Autour de Toulon")}
      {groupe("mythique", "Les mythiques")}
      <p className="text-[11px] text-slate-400">Profils fabriqués par l&apos;app : routes © OpenStreetMap, altitudes IGN et Copernicus. Ton home-trainer suit la vraie pente (le Flux S plafonne à 10 %).</p>
    </div>
  );
}

// ─── L'écran de la montée ───


const kmTexte = (m: number) => (m / 1000).toFixed(1).replace(".", ",");

/** Le fantôme : où serait le pro (ou ton record) au même moment, à allure régulière. */
export function ecartFantome(t: number, d: number, total: number, tempsRef: number) {
  const dRef = Math.min(total, (t / tempsRef) * total);
  return dRef - d;   // > 0 : il est devant de tant de mètres
}

export function EcranCol({ etat, col, poids, zoneFc, record, onPause, onTerminer }: {
  etat: Etat; col: Col; poids: number | null; zoneFc?: string | null; record: number | null; onPause: () => void; onTerminer: () => void;
}) {
  const c = etat.col!;
  const p = c.pente, couleur = couleurPente(p);
  const fonce = p < 4 ? ["#15803d", "#22c55e"] : p < 7 ? ["#1d4ed8", "#3b82f6"] : p < 10 ? ["#b91c1c", "#ef4444"] : ["#0f172a", "#334155"];
  const wkg = poids && etat.w3s != null ? (etat.w3s / poids).toFixed(1).replace(".", ",") : null;
  const fantomes = [
    ...(record ? [{ nom: "Ton record", s: record }] : []),
    ...(col.pros ?? []).map((x) => ({ nom: `${x.nom} ${x.annee}`, s: x.s })),
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-12 gap-3">
        <div className="col-span-2 lg:col-span-5 relative overflow-hidden rounded-[26px] p-6 text-white" style={{ backgroundImage: `linear-gradient(135deg, ${fonce.join(", ")})` }}>
          <Icone d={mdiImageFilterHdr} taille={150} coul="rgba(255,255,255,0.18)" style={{ position: "absolute", right: -16, top: -10 }} />
          <Sur>Pente</Sur>
          <div className="text-[110px] lg:text-[140px] font-black tabular-nums leading-none tracking-tight">{p.toFixed(1).replace(".", ",")}<span className="text-5xl"> %</span></div>
          <div className="flex gap-2 mt-3 flex-wrap">
            <Pastille icone={mdiImageFilterHdr} texte={`${c.alt} m / ${col.sommet} m`} />
            {p > 10 && <Pastille icone={mdiImageFilterHdr} texte="Le home-trainer plafonne à 10 %" />}
          </div>
        </div>
        <div className="col-span-2 lg:col-span-4 relative overflow-hidden rounded-[26px] p-6 text-white flex flex-col justify-center" style={{ backgroundImage: "linear-gradient(135deg, #1e293b, #334155)" }}>
          <Sur>Puissance · 3 s</Sur>
          <div className="text-[90px] lg:text-[110px] font-black tabular-nums leading-none tracking-tight">{etat.w3s ?? "—"}<span className="text-3xl text-white/70"> W</span></div>
          <div className="flex gap-2 mt-3 flex-wrap">
            {wkg && <Pastille icone={mdiSpeedometer} texte={`${wkg} W/kg`} />}
            <Pastille icone={mdiSpeedometer} texte={`${c.kmh.toFixed(1).replace(".", ",")} km/h`} />
          </div>
        </div>
        <Carte className="col-span-2 lg:col-span-3 flex flex-col justify-center">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Reste</div>
          <div className="text-[48px] font-black text-slate-800 tabular-nums leading-tight">{kmTexte(c.total - c.d)} <span className="text-lg text-slate-400">km</span></div>
          <div className="text-[13px] font-bold text-slate-500">{col.sommet - c.alt} m à monter</div>
          <div className="flex items-center gap-1.5 text-[13px] font-black text-slate-700 mt-2"><Icone d={mdiTimerOutline} taille={15} />{chrono(etat.tTotal)}</div>
        </Carte>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-12 gap-3">
        <Carte className="lg:col-span-2"><div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400"><Icone d={mdiRotateRight} taille={14} coul="#94a3b8" />Cadence</div><div className="text-[38px] font-black text-slate-800 tabular-nums">{etat.cadence ?? "—"}</div></Carte>
        <Carte className="lg:col-span-2"><div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400"><Icone d={mdiHeart} taille={14} coul="#f43f5e" />Cœur</div><div className="text-[38px] font-black text-slate-800 tabular-nums">{etat.bpm ?? "—"}{zoneFc && <span className="text-[13px] font-extrabold text-slate-400"> {zoneFc}</span>}</div></Carte>
        <Carte className="col-span-2 lg:col-span-5">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400 mb-1.5">Les fantômes</div>
          {fantomes.length ? fantomes.map((f) => {
            const e = ecartFantome(etat.tTotal, c.d, c.total, f.s);
            return (
              <div key={f.nom} className="flex items-center justify-between text-[14px] font-extrabold py-0.5">
                <span className="text-slate-700">{f.nom} <span className="text-slate-400 font-bold">({chrono(f.s)})</span></span>
                <span className={e > 0 ? "text-rose-600" : "text-emerald-600"}>{e > 0 ? `${kmTexte(e)} km devant` : `${kmTexte(-e)} km derrière toi`}</span>
              </div>
            );
          }) : <div className="text-[13px] font-bold text-slate-400">Termine la montée pour avoir ton record comme fantôme.</div>}
        </Carte>
        <Carte className="col-span-2 lg:col-span-3">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Ce km</div>
          <div className="text-[34px] font-black text-slate-800 tabular-nums leading-tight">{etat.tour.w ?? "—"} <span className="text-[14px] text-slate-400">W moy.</span></div>
          <div className="text-[13px] font-extrabold text-slate-500 tabular-nums">km précédent : {etat.tourPrec?.w ?? "—"} W · {etat.tourPrec ? chrono(etat.tourPrec.s) : "—"}</div>
        </Carte>
      </div>

      <div className="grid lg:grid-cols-12 gap-3">
        <Carte className="lg:col-span-5 !pb-7">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400 mb-2">Ce qui arrive</div>
          <ZoomCol col={col} d={c.d} hauteur={150} />
        </Carte>
        <Carte className="lg:col-span-7 !p-3">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400 mb-1 px-1">Le col · {kmTexte(c.d)} / {kmTexte(c.total)} km</div>
          <ProfilCol col={col} d={c.d} hauteur={170} />
        </Carte>
      </div>

      <div className="flex items-center justify-center gap-3 pt-1">
        <button type="button" title="Pause" onClick={onPause} className="w-20 h-20 rounded-full text-white flex items-center justify-center active:scale-95" style={{ background: couleur, boxShadow: `0 6px 18px ${couleur}66` }}>
          <Icone d={etat.pause === "non" ? mdiPause : mdiPlay} taille={40} />
        </button>
        <button type="button" onClick={onTerminer} className="flex items-center gap-1.5 rounded-full bg-rose-50 px-4 py-2.5 text-sm font-black text-rose-600 hover:bg-rose-100"><Icone d={mdiFlagCheckered} taille={16} /> Abandonner</button>
      </div>
    </div>
  );
}
