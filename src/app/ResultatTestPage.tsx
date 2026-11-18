"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { CaretDown, CaretUp } from "@phosphor-icons/react";
import { ProgrammerTest } from "./Tests";
import {
  aUnePage, ecartAvecPrecedent, jourCourt, minutesALarret, niveauxCourse, niveauxVelo, paliersRampe, prochainTest, type Palier,
} from "./resultatTest";

// La page de résultat d'un test (rampe vélo, calibrage course) à la place de
// l'analyse technique ; l'analyse reste dessous, dépliée par « Pour les curieux ».
// Pendant de App-Coach, components/ResultatTestPage.tsx.

const VIOLET = "#7c3aed", VIOLET_CLAIR = "#ddd6fe", BLEU = "#2563eb";
const virgule = (x: number) => x.toFixed(1).replace(".", ",");
export type Resultat = { session_id: string; user_id: string; jour: string; protocole: string; valide: boolean; detail: { ftp?: number; pma?: number; fc_max?: number | null; vma_kmh?: number } | null };
const VERRE = "rounded-3xl border border-white/90 bg-white/70 shadow-sm backdrop-blur";

/** Le résultat à montrer pour cette séance, ou null (ancienne page). */
export function useResultatPage(sessionId: string | undefined, protocole: unknown, faite: boolean) {
  const [r, setR] = useState<Resultat | null>(null);
  useEffect(() => {
    if (!sessionId || !faite || !aUnePage(protocole)) return;
    let vivant = true;
    supabase.from("test_resultats").select("*").eq("session_id", sessionId).maybeSingle().then(({ data }) => {
      const d = data?.detail ?? {};
      if (vivant && data?.valide && (data.protocole === "rampe" ? d.ftp : d.vma_kmh)) setR(data as Resultat);
    });
    return () => { vivant = false; };
  }, [sessionId, protocole, faite]);
  return r;
}

function Dessin({ paliers, ftp }: { paliers: Palier[]; ftp: number }) {
  const L = 600, H = 190, bas = 18, haut = 16, zone = H - bas - haut, n = paliers.length;
  const wMax = Math.max(...paliers.map((p) => p.w), ftp) * 1.05;
  const fcs = paliers.map((p) => p.fc).filter((x): x is number => x != null);
  const fcLo = fcs.length ? Math.min(...fcs) - 8 : 0, fcHi = fcs.length ? Math.max(...fcs) + 2 : 1;
  const pas = L / n, bw = pas - 4;
  const y = (w: number) => haut + zone * (1 - w / wMax);
  const yFc = (f: number) => haut + zone * (1 - (f - fcLo) / (fcHi - fcLo));
  const pts = paliers.map((p, i) => (p.fc != null ? `${i * pas + bw / 2},${yFc(p.fc)}` : null)).filter(Boolean).join(" ");
  const dernier = n - 1;
  return (
    <svg viewBox={`0 0 ${L} ${H}`} className="w-full" role="img" aria-label="Puissance minute par minute et cœur">
      {paliers.map((p, i) => <rect key={i} x={i * pas} y={y(p.w)} width={bw} height={haut + zone - y(p.w)} rx={4} fill={i === dernier ? VIOLET : VIOLET_CLAIR} />)}
      <line x1={0} x2={L} y1={y(ftp)} y2={y(ftp)} stroke="#64748b" strokeWidth={1} strokeDasharray="4 4" />
      <text x={2} y={y(ftp) - 5} fontSize={12} fontWeight="bold" fill="#334155">{ftp} W</text>
      {pts && <polyline points={pts} fill="none" stroke={BLEU} strokeWidth={2.5} />}
      <circle cx={dernier * pas + bw / 2} cy={y(paliers[dernier].w) - 9} r={4.5} fill={VIOLET} />
      {paliers.map((_, i) => (i % 2 === 0 || i === dernier) && <text key={i} x={i * pas + bw / 2} y={H - 3} fontSize={11} fill="#64748b" textAnchor="middle">{i + 1}</text>)}
    </svg>
  );
}

export default function ResultatTestPage({ r, soi, ouvert, onToggle }: { r: Resultat; soi: boolean; ouvert: boolean; onToggle: () => void }) {
  const velo = r.protocole === "rampe";
  const d = r.detail ?? {};
  const valeur = velo ? Number(d.ftp) : Number(d.vma_kmh);
  const unite = velo ? "W" : "km/h";
  const [prec, setPrec] = useState<{ valeur: number; jour: string } | null | undefined>(undefined);
  const [paliers, setPaliers] = useState<Palier[]>([]);
  const [actuel, setActuel] = useState<number | null>(null);
  const [maj, setMaj] = useState<"non" | "en_cours" | "ok" | "erreur">("non");
  const [programmer, setProgrammer] = useState(false);

  useEffect(() => {
    let vivant = true;
    (async () => {
      const { data: liste } = await supabase.from("test_resultats").select("jour, valide, detail").eq("user_id", r.user_id).eq("protocole", r.protocole).lt("jour", r.jour).eq("valide", true).order("jour", { ascending: false });
      const p = (liste ?? []).map((x) => ({ valeur: Number(velo ? x.detail?.ftp : x.detail?.vma_kmh), jour: x.jour as string })).find((x) => Number.isFinite(x.valeur) && x.valeur > 0);
      if (vivant) setPrec(p ?? null);
      if (velo) {
        const { data: m } = await supabase.from("athlete_metrics").select("ftp_w").eq("user_id", r.user_id).maybeSingle();
        if (vivant) setActuel(m?.ftp_w != null ? Number(m.ftp_w) : null);
        const { data: a } = await supabase.from("activites").select("id").eq("session_id", r.session_id).maybeSingle();
        if (a) {
          const { data: t } = await supabase.from("activite_series").select("idx, duree_s, debut_s, puissance, fc_fin, fc_max").eq("activite_id", a.id).order("idx");
          if (vivant) setPaliers(paliersRampe(t ?? []));
        }
      }
    })().catch(() => { if (vivant) setPrec((x) => (x === undefined ? null : x)); });
    return () => { vivant = false; };
  }, [r.session_id, r.user_id, r.protocole, r.jour, velo]);

  // Rien ne change sans l'accord de l'athlète : un geste.
  const appliquer = async () => {
    setMaj("en_cours");
    const { error } = await supabase.from("athlete_metrics").upsert({
      user_id: r.user_id, ftp_w: d.ftp, ...(d.fc_max ? { fc_max_velo: d.fc_max, fc_max_velo_le: r.jour } : {}), updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) { setMaj("erreur"); return; }
    supabase.functions.invoke("zones-icu", { body: { athleteId: r.user_id } }).catch(() => {});
    setActuel(valeur);
    setMaj("ok");
  };

  const niveaux = velo ? niveauxVelo(valeur) : niveauxCourse(valeur);
  const valeurTxt = velo ? `${Math.round(valeur)} W` : `${virgule(valeur)} km/h`;
  const aJour = !velo || actuel === valeur;
  const ecart = prec === undefined ? null : ecartAvecPrecedent(valeur, prec, unite, velo ? "tes séances de vélo" : "tes séances de course");
  const minutes = minutesALarret(paliers);
  const fcMax = d.fc_max ? Math.round(Number(d.fc_max)) : null;
  const noir = "w-full rounded-2xl bg-slate-900 py-3.5 font-bold text-white hover:bg-slate-800 disabled:opacity-50";

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <header>
        <p className="text-xs font-extrabold tracking-[0.14em] text-violet-600">TEST {velo ? "VÉLO" : "COURSE"} · {jourCourt(r.jour)}</p>
        <h1 className="mt-1 text-[40px] font-extrabold leading-tight text-slate-900">{velo ? `Ta FTP : ${valeurTxt}` : `Ta VMA : ${valeurTxt}`}</h1>
        <p className="mt-2 text-base leading-relaxed text-slate-600">
          {velo
            ? `La FTP, c'est la puissance que tu peux tenir environ une heure. Ton test l'estime à partir de ta meilleure minute : ${Math.round(Number(d.pma))} W.`
            : "La VMA, c'est la vitesse la plus haute que tu peux tenir quelques minutes. Ton test la lit sur le dernier palier que tu as tenu."}
        </p>
      </header>

      <section className={`${VERRE} p-5`}>
        <h2 className="text-xl font-extrabold text-slate-900">Ce que ça change pour toi</h2>
        <p className="mb-2 mt-1 text-[15px] text-slate-600">
          {velo
            ? aJour ? `Tes séances de vélo sont maintenant réglées sur ${valeurTxt}.` : `Ta FTP enregistrée est encore de ${actuel ?? "—"} W : les niveaux ci-dessous sont ceux du test.`
            : `Tes allures de course sont réglées sur ta VMA de ${valeurTxt}.`}
        </p>
        <ul>
          {niveaux.map((n) => (
            <li key={n.cle} className="flex items-center gap-3 border-t border-slate-100 py-3">
              <span className="w-1.5 self-stretch rounded-full" style={{ background: n.couleur }} />
              <span className="flex-1"><span className="block font-extrabold text-slate-900">{n.nom}</span><span className="block text-sm text-slate-500">{n.aide}</span></span>
              <span className="font-extrabold text-slate-900">{n.texte}</span>
            </li>
          ))}
        </ul>
        {velo && !aJour && soi && (
          <div className="mt-2">
            <button disabled={maj === "en_cours"} onClick={appliquer} className={noir}>Régler mes séances sur {valeurTxt}</button>
            {maj === "erreur" && <p className="mt-1 text-sm text-slate-500">Je n&apos;ai pas pu enregistrer. Réessaie.</p>}
          </div>
        )}
      </section>

      {velo && paliers.length >= 5 && (
        <section className={`${VERRE} p-5`}>
          <h2 className="text-xl font-extrabold text-slate-900">Ton test, minute par minute</h2>
          <p className="mb-3 mt-1 text-sm text-slate-600">Chaque marche, c&apos;est 20 W de plus. Le trait bleu, c&apos;est ton cœur.</p>
          <Dessin paliers={paliers} ftp={Math.round(valeur)} />
          <div className="mt-2 flex items-center gap-4 text-sm text-slate-600">
            <span className="flex items-center gap-1.5"><i className="inline-block h-2 w-3.5 rounded-sm" style={{ background: VIOLET_CLAIR }} />Puissance</span>
            <span className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-3.5" style={{ background: BLEU }} />{fcMax ? `Cœur (max ${fcMax})` : "Cœur"}</span>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            <b className="text-violet-600">● Tu t&apos;arrêtes à {Math.round(Number(d.pma))} W</b>{minutes != null ? ` après ${minutes} min` : ""} : c&apos;est ta meilleure minute.
          </p>
        </section>
      )}

      <section className={`${VERRE} p-5`}>
        <h2 className="mb-3 text-xl font-extrabold text-slate-900">Et ensuite ?</h2>
        {ecart ? (
          <div className="rounded-2xl bg-slate-100/90 p-4">
            <p className="text-[17px] font-extrabold text-slate-900">{ecart.titre}</p>
            <p className="mt-0.5 text-sm text-slate-600">{ecart.detail}</p>
          </div>
        ) : <p className="text-slate-400">…</p>}
        <p className="my-3 text-[15px] text-slate-600">{prochainTest(r.jour)}</p>
        <button onClick={() => setProgrammer(true)} className={noir}>Programmer un test</button>
      </section>

      <button onClick={onToggle} className={`${VERRE} flex w-full items-center gap-2 px-4 py-3.5 text-left font-extrabold text-slate-700`}>
        <span className="flex-1">Pour les curieux : le détail minute par minute</span>
        {ouvert ? <CaretUp size={20} weight="bold" /> : <CaretDown size={20} weight="bold" />}
      </button>
      {programmer && <ProgrammerTest athleteId={r.user_id} coach={!soi} onFait={() => {}} onFermer={() => setProgrammer(false)} />}
    </div>
  );
}
