"use client";
// ─────────────────────────────────────────────────────────────────────────
// Home-trainer (30/10/2026) — remplace Zwift/MyWhoosh pour ce qui sert :
// piloter le home-trainer en ERG sur les séances du coach ou faites à la
// main, un bandeau flottant à poser à côté d'un film, et l'activité sur
// Strava à la fin. Pas de monde virtuel.
// Pendant de l'app : App-Coach/app/home-trainer.tsx, même design (celui de
// l'app : Météo du corps, Progression). La logique (séances, Bluetooth,
// moteur, .fit, zones) est partagée : ./ht/*.ts.
// Refonte du 02/11/2026 (maquette validée, comme l'app) : pastille du vélo,
// séance du coach du jour en tête, catalogue en cartes « Tu vas sentir »,
// séance en cours avec temps restant + watts, fin en un geste.
// ─────────────────────────────────────────────────────────────────────────
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import "dayjs/locale/fr";
import { Plus_Jakarta_Sans } from "next/font/google";
import {
  mdiAlertCircle, mdiBike, mdiChevronDown, mdiChevronUp, mdiTarget, mdiBikeFast, mdiCalendarBlankOutline, mdiCalendarMonth, mdiCheckCircle, mdiCloudUploadOutline,
  mdiDownload, mdiFlagCheckered, mdiHeart, mdiHeartPulse, mdiLightningBolt, mdiMapMarkerDistance, mdiMinus, mdiPause, mdiPauseCircle,
  mdiPictureInPictureBottomRight, mdiPlay, mdiPlus, mdiSkipNext, mdiSkipPrevious, mdiStar,
  mdiStarOutline, mdiTimerOutline, mdiTrophyOutline, mdiFullscreen, mdiFullscreenExit, mdiScaleBathroom,
  mdiGamepadVariantOutline, mdiAccountOutline, mdiKeyboardOutline, mdiTuneVertical,
} from "@mdi/js";
import { supabase } from "@/lib/supabaseClient";
import { depuisCourt, depuisIcu, versCourt, versIcu, aplatir, dureeTotale, type Bloc, type Etape } from "./ht/seance";
import { Moteur, type Etat, type Profil as ProfilCycliste } from "./ht/moteur";
import { compliment } from "./ht/compliment";
import { fichierFit } from "./ht/fit";
import { ecart, zoneCoeur, zoneEtape, ZONE_PAUSE } from "./ht/zones";
import { Capteur, Simulateur, bluetoothDispo, messageConnexion, type EtatCapteur, type Source } from "./capteurs";
import { Editeur } from "./Editeur";
import { EcranCol, ListeCols, ProfilCol } from "./Cols";
import type { Col } from "./ht/cols";
import { resultatRampe, type Famille } from "./ht/catalogue";
import Catalogue from "./Catalogue";
import { Bandeau, bandeauDispo, chrono, ouvrirFenetre, type Actions } from "./Bandeau";
import { useCoque } from "../Coque";
import { demander } from "../fenetres";
import { Bouton, Bulle, Carte, Ciel, degrade, Icone, Jauge, Onglets, Profil, profilDe, Sur } from "./ui";

dayjs.locale("fr");
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["500", "600", "700", "800"], display: "swap" });

type Choix = { titre: string; blocs: Bloc[]; sessionId: string | null; texteCourt: string | null; col?: Col | null; test?: "rampe" | "lsct" | null };
type SeanceDb = { id: string; date: string; title: string | null; workout_text: string | null; planned_hour: number | null; status: string | null; test?: string | null };

const RPE = ["", "Récup", "Très facile", "Facile", "Moyen", "Un peu dur", "Dur", "Très dur", "Extrême", "Agonie", "Maximal"];
// Même échelle que la validation d'une séance (RpeModal), avec son repère.
const RPE_REPERE = ["", "Marche, effort nul", "Respiration par le nez", "Conversation facile", "On raconte l'essentiel", "Conversation hachée", "Quelques mots", "Un mot à la fois", "Impossible de parler", "Tenable quelques secondes", "Sprint final, nausée"];
const RPE_COUL = ["", "#10b981", "#10b981", "#34d399", "#a3e635", "#facc15", "#fbbf24", "#fb923c", "#f97316", "#f43f5e", "#be123c"];
const CIEL_PRET = ["#2563eb", "#0ea5e9", "#38bdf8"], CIEL_ATTENTE = ["#475569", "#64748b", "#94a3b8"];

// Où en est-on dans le dessin de la séance (les étapes « lap » peuvent déborder).
const position = (etapes: Etape[], e: Etat) => etapes.slice(0, e.i).reduce((a, x) => a + x.s, 0) + Math.min(e.tEtape, e.etape?.s ?? 0);
const cibleTexte = (e: Etape, ajust = 1) => e.cible.type === "w" ? `${Math.round(((e.cible.min + e.cible.max) / 2) * ajust)} W` : e.cible.type === "bpm" ? `${e.cible.min} bpm` : "libre";
// La part du temps « dans le mille » (±4 %, au moins 5 W, des watts visés).
function dansLeMille(points: { w: number | null; c: number | null }[]): number | null {
  let n = 0, ok = 0;
  for (const p of points) if (p.c && p.w != null) { n++; if (Math.abs(p.w - p.c) <= Math.max(5, p.c * 0.04)) ok++; }
  return n >= 20 ? Math.round((ok / n) * 100) : null;
}
const colFini = (col: Col, points: { m: number }[]) => (points[points.length - 1]?.m ?? 0) >= col.km * 1000 - 5;

function versBase64(o: Uint8Array) {
  let s = "";
  for (let i = 0; i < o.length; i += 0x8000) s += String.fromCharCode(...o.subarray(i, i + 0x8000));
  return btoa(s);
}

// Hors du composant : recréés à chaque image (4 par seconde), les boutons perdraient des clics.
// Une case de chiffres, centrée (refonte du 02/11/2026, comme l'app).
const Case = ({ titre, valeur, sous, sousCoul, coul }: { titre: string; valeur: React.ReactNode; sous?: string; sousCoul?: string; coul?: string }) => (
  <div className="flex-1 min-w-0 rounded-[18px] bg-white border border-[#eef2f7] px-1.5 py-2 lg:py-3 flex flex-col items-center justify-center text-center">
    <div className="text-[10.5px] lg:text-[11.5px] font-extrabold uppercase tracking-[0.1em] text-slate-400 truncate max-w-full">{titre}</div>
    <div className="text-[26px] lg:text-[34px] font-black tabular-nums leading-tight truncate max-w-full" style={{ color: coul ?? "#1e293b" }}>{valeur}</div>
    {sous ? <div className={`text-[11.5px] lg:text-[12.5px] truncate max-w-full ${sousCoul ? "font-black" : "font-bold text-slate-500"}`} style={sousCoul ? { color: sousCoul } : undefined}>{sous}</div> : null}
  </div>
);
const Rond = ({ onClick, d, titre, grand, couleurs }: { onClick: () => void; d: string; titre: string; grand?: boolean; couleurs?: readonly string[] }) => (
  <button type="button" title={titre} onClick={onClick}
    className={`${grand ? "w-20 h-20 text-white" : "w-14 h-14 bg-white border border-[#eef2f7] text-slate-800 hover:bg-slate-50"} rounded-full flex items-center justify-center transition active:scale-95`}
    style={grand && couleurs ? { backgroundImage: `linear-gradient(135deg, ${couleurs.join(", ")})`, boxShadow: `0 6px 18px ${couleurs[0]}66` } : { boxShadow: "0 3px 10px rgba(100,116,139,0.12)" }}>
    <Icone d={d} taille={grand ? 40 : 26} />
  </button>
);
const Vide = ({ icone, children }: { icone: string; children: React.ReactNode }) => (
  <div className="flex flex-col items-center gap-1.5 py-6 text-center"><Icone d={icone} taille={34} coul="#cbd5e1" /><p className="font-bold text-slate-500">{children}</p></div>
);

// Fin d'une rampe : FTP et FC max tout de suite (le résultat officiel suit dans « Mes tests »).
function CarteRampe({ points }: { points: { w: number | null; bpm: number | null }[] }) {
  const r = resultatRampe(points);
  if (!r) return null;
  return (
    <Carte className="space-y-2.5">
      <div className="font-black text-slate-800 text-base">📏 Ton calibrage</div>
      <div className="grid grid-cols-3 gap-2">
        {[["FTP", `${r.ftp} W`], ["Meilleure minute", `${r.pma} W`], ["Cœur max", r.fcMax ? `${r.fcMax}` : "—"]].map(([t, v]) => (
          <div key={t} className="rounded-2xl bg-slate-50 px-2 py-2.5 text-center">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-400">{t}</div>
            <div className="text-[22px] font-black text-slate-800 tabular-nums leading-tight">{v}</div>
          </div>
        ))}
      </div>
      <p className="text-[13px] font-semibold text-slate-500">Enregistre la séance : le résultat arrive dans « Mes tests », avec un bouton pour mettre à jour ta FTP et tes zones vélo.</p>
    </Carte>
  );
}

function HomeTrainer() {
  const router = useRouter();
  const params = useSearchParams();
  const simu = params.get("simu") === "1";
  // Ouvert depuis une séance du planning (bouton « Faire sur le home-trainer »)
  const seanceChoisie = params.get("seance");
  // La séance du planning à laquelle rattacher une séance écrite « à la main »
  const [cible, setCible] = useState<{ id: string; titre: string } | null>(null);
  const [moi, setMoi] = useState<string | null>(null);
  const [ftp, setFtp] = useState<number>(200);
  const [zonesFc, setZonesFc] = useState<number[] | null>(null);
  const [ftpConnue, setFtpConnue] = useState(true);
  const [profil, setProfil] = useState<Omit<ProfilCycliste, "ftp">>({});
  const [ecranPlein, setEcranPlein] = useState(false);
  // Étalonnage du home-trainer (spin down FTMS)
  const [etal, setEtal] = useState<null | { etape: "intro" | "attente" | "vitesse" | "stop" | "ok" | "erreur" | "non"; haute?: number }>(null);
  const [vitesseEtal, setVitesseEtal] = useState<number | null>(null);
  const derniereVitesse = useRef<number | null>(null);
  const [seances, setSeances] = useState<SeanceDb[]>([]);
  const [favoris, setFavoris] = useState<{ id: string; nom: string; texte: string }[]>([]);
  const [onglet, setOnglet] = useState<"plan" | "seances" | "main" | "favoris" | "cols">("seances");
  // Ouverte depuis une séance du planning (?seance=) : l'onglet Planning, sauf si c'est celle du jour.
  useEffect(() => {
    const x = seanceChoisie ? seances.find((y) => y.id === seanceChoisie) : null;
    if (x && x.date !== dayjs().format("YYYY-MM-DD")) setOnglet("plan");
  }, [seanceChoisie, seances]);
  const [materielOuvert, setMaterielOuvert] = useState(false);
  const [pasPretOuvert, setPasPretOuvert] = useState(false);   // « Le vélo n'est pas connecté »
  const [dureeCat, setDureeCat] = useState<number>(45);
  const [familleCat, setFamilleCat] = useState<Famille>("decouverte");
  const [testEnCours, setTestEnCours] = useState(false);
  const [erreurTest, setErreurTest] = useState<string | null>(null);
  const [records, setRecords] = useState<Map<string, number>>(new Map());
  const [classement, setClassement] = useState<{ rang: number; prenom: string; duree_s: number; wkg: number | null; moi: boolean }[] | null>(null);
  const [nouveauRecord, setNouveauRecord] = useState(false);
  const [texte, setTexte] = useState("10' 150W, 5x(4' 300W / 3' 150W), 10' 140W");
  const [choix, setChoix] = useState<Choix | null>(null);
  const [capteurs, setCapteurs] = useState<Record<Source, EtatCapteur>>({ ht: null, pedales: null, cardio: null, guidon: null });
  const [erreurBt, setErreurBt] = useState<string | null>(null);
  const [phase, setPhase] = useState<"preparer" | "rouler" | "fin">("preparer");
  const [etat, setEtat] = useState<Etat | null>(null);
  const [fenetre, setFenetre] = useState<Window | null>(null);
  const [rpe, setRpe] = useState<number | null>(null);   // pas de valeur d'avance : elle fausserait la donnée
  const [aideRpe, setAideRpe] = useState(false);
  const [envoi, setEnvoi] = useState<{ etat: "rien" | "en_cours" | "ok" | "erreur"; texte?: string }>({ etat: "rien" });
  const [favoriNom, setFavoriNom] = useState("");
  const [favoriOk, setFavoriOk] = useState(false);

  const moteur = useRef<Moteur | null>(null);
  const cap = useRef<Record<Source, Capteur | null>>({ ht: null, pedales: null, cardio: null, guidon: null });
  const sim = useRef<Simulateur | null>(null);
  const verrou = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

  // ─── Chargement ───
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      const id = session.user.id;
      setMoi(id);
      const [{ data: am }, { data: ss }, { data: fav }, { data: pp }, { data: cp }] = await Promise.all([
        supabase.from("athlete_metrics").select("ftp_w, hr_zones").eq("user_id", id).maybeSingle(),
        supabase.from("sessions").select("id, date, title, workout_text, planned_hour, status, test").eq("user_id", id).eq("sport", "Vélo")
          .gte("date", dayjs().subtract(1, "day").format("YYYY-MM-DD")).lte("date", dayjs().add(6, "day").format("YYYY-MM-DD")).order("date"),
        supabase.from("ht_favoris").select("id, nom, texte").order("cree_le", { ascending: false }),
        // Le profil du cycliste : poids (W/kg) et puissance critique + réserve (jauge)
        supabase.from("profil_physique").select("poids_kg").eq("user_id", id).maybeSingle(),
        supabase.from("vitesse_critique").select("cs, d_prime").eq("user_id", id).eq("sport", "velo").order("jour", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (am?.ftp_w) setFtp(Number(am.ftp_w)); else setFtpConnue(false);
      // Les zones VÉLO (celles des réglages ramenées à la FC max vélo), sinon celles des réglages.
      const { data: zv } = await supabase.rpc("zones_fc_velo", { p_user: id });
      const zf = Array.isArray(zv?.zones) ? zv.zones : am?.hr_zones;
      if (Array.isArray(zf) && zf.length) setZonesFc(zf.map(Number));
      setProfil({ poids: pp?.poids_kg ? Number(pp.poids_kg) : null, cp: cp?.cs ? Number(cp.cs) : null, wPrime: cp?.d_prime ? Number(cp.d_prime) : null });
      let liste = (ss ?? []) as SeanceDb[];
      // Une version adaptée (grossesse) remplace la séance du coach, pour elle seule.
      if (liste.length) {
        const { data: ad } = await supabase.from("seance_adaptee").select("session_id, titre, workout_text, adaptee").in("session_id", liste.map((s) => s.id));
        const m = new Map((ad ?? []).filter((a) => a.adaptee).map((a) => [a.session_id, a]));
        liste = liste.map((s) => { const a = m.get(s.id); return a ? { ...s, title: a.titre || s.title, workout_text: a.workout_text || s.workout_text } : s; });
      }
      setSeances(liste);
      setFavoris(fav ?? []);
      const { data: rec } = await supabase.from("ht_cols_temps").select("col_id, duree_s").eq("user_id", id);
      const r = new Map<string, number>();
      for (const x of rec ?? []) if (!r.has(x.col_id) || x.duree_s < r.get(x.col_id)!) r.set(x.col_id, x.duree_s);
      setRecords(r);
    })();
  }, [router]);

  // ─── Capteurs ───
  const ecoute = useCallback((src: Source, m: { watts?: number; cadence?: number; vitesse?: number; bpm?: number; rr?: number[] }) => {
    if (src === "ht" && m.vitesse != null) derniereVitesse.current = m.vitesse;
    if (src !== "guidon") moteur.current?.mesurer(src, m, Date.now());
  }, []);

  const nouveauCapteur = useCallback((src: Source) => {
    const c = new Capteur(src, ecoute);
    c.onEtat = (e) => setCapteurs((x) => ({ ...x, [src]: e }));
    // Guidon Zwift : palettes = plus/moins dur (vitesses en sortie libre), A = pause, D-pad = étapes
    if (src === "guidon") c.surAction = (a) => {
      const m = moteur.current;
      if (!m) return;
      if (a === "pause") m.basculerPause(); else m[a]();
    };
    if (src === "ht") c.surEtalonnage = (x) => {
      if (typeof x === "object") setEtal(x.ok ? { etape: "vitesse", haute: x.haute } : x.nonSupporte ? { etape: "non" } : { etape: "erreur" });
      else if (x === "arrete-de-pedaler") setEtal((e) => ({ ...e, etape: "stop" }));
      else if (x === "reussi") setEtal({ etape: "ok" });
      else if (x === "erreur") setEtal({ etape: "erreur" });
    };
    cap.current[src] = c;
    return c;
  }, [ecoute]);

  // Pendant l'étalonnage, la vitesse de la roue s'affiche en direct
  useEffect(() => {
    if (!etal || !["vitesse", "stop"].includes(etal.etape)) return;
    const h = setInterval(() => setVitesseEtal(derniereVitesse.current), 500);
    return () => clearInterval(h);
  }, [etal]);
  const lancerEtalonnage = async () => {
    setEtal({ etape: "attente" });
    try { await cap.current.ht?.etalonner(); } catch { setEtal({ etape: "erreur" }); }
    // Sans réponse en 6 s : il ne sait pas le faire depuis une autre app
    setTimeout(() => setEtal((e) => (e?.etape === "attente" ? { etape: "non" } : e)), 6000);
  };

  // Au retour sur la page : le matériel de la dernière fois se rebranche seul.
  useEffect(() => {
    if (simu || !bluetoothDispo()) return;
    const ouverts = cap.current;
    (["ht", "cardio", "pedales", "guidon"] as Source[]).forEach((src) => { nouveauCapteur(src).retrouver().catch(() => {}); });
    return () => { Object.values(ouverts).forEach((c) => c?.oublier(false)); };
  }, [simu, nouveauCapteur]);

  const connecter = async (src: Source) => {
    setErreurBt(null);
    try {
      cap.current[src]?.oublier();
      await nouveauCapteur(src).choisir();
    } catch (e) {
      setErreurBt(messageConnexion(e));
    }
  };

  // ─── Rouler ───
  const demarrer = async (c: Choix) => {
    setChoix(c);
    moteur.current = new Moteur(c.blocs, { ftp, ...profil, col: c.col ?? null, rampe: c.test === "rampe" });
    setClassement(null); setNouveauRecord(false); setRpe(null); setAideRpe(false);
    setPhase("rouler");
    setEnvoi({ etat: "rien" }); setFavoriOk(false); setFavoriNom("");
    if (simu) { sim.current = new Simulateur(ecoute); sim.current.demarrer(); }
    try { verrou.current = await (navigator as any).wakeLock?.request("screen"); } catch { /* pas grave */ } // eslint-disable-line @typescript-eslint/no-explicit-any
  };

  useEffect(() => {
    if (phase !== "rouler") return;
    // Le home-trainer est piloté 4 fois par seconde ; l'écran ne se redessine
    // que 2 fois par seconde (assez pour l'œil, deux fois moins de travail).
    let image = 0;
    const h = setInterval(() => {
      const m = moteur.current;
      if (!m) return;
      const e = m.tic(Date.now());
      if (image++ % 2 === 0 || e.fini) setEtat(e);
      if (simu) sim.current?.consigne(e.consigne);
      else cap.current.ht?.consigne(e.consigne);
      if (e.fini) setPhase("fin");
    }, 250);
    const quitter = (ev: BeforeUnloadEvent) => { ev.preventDefault(); };
    window.addEventListener("beforeunload", quitter);
    return () => { clearInterval(h); window.removeEventListener("beforeunload", quitter); };
  }, [phase, simu]);

  useEffect(() => {
    if (phase !== "fin") return;
    sim.current?.arreter();
    cap.current.ht?.consigne({ type: "pente", pct: 0 });
    fenetre?.close();
    verrou.current?.release?.().catch(() => {});
  }, [phase, fenetre]);

  // Col terminé : on garde le temps (record ?) et on charge le classement
  useEffect(() => {
    const m = moteur.current, col = choix?.col;
    if (phase !== "fin" || !m || !col || !moi || classement) return;
    const fait = (m.points[m.points.length - 1]?.m ?? 0) >= col.km * 1000 - 5;
    (async () => {
      if (fait) {
        const duree = m.points.length, w = Math.round(m.points.reduce((a, p) => a + (p.w ?? 0), 0) / Math.max(1, duree));
        const ancien = records.get(col.id);
        await supabase.from("ht_cols_temps").insert({ col_id: col.id, duree_s: duree, watts: w, wkg: profil.poids ? Math.round((w / profil.poids) * 100) / 100 : null });
        if (!ancien || duree < ancien) { setNouveauRecord(true); setRecords((r) => new Map(r).set(col.id, duree)); }
      }
      const { data } = await supabase.rpc("classement_col", { p_col: col.id });
      setClassement(data ?? []);
    })();
  }, [phase, choix, moi, classement, records, profil.poids]);

  const actions: Actions = useMemo(() => ({
    pause: () => moteur.current?.basculerPause(),
    suivante: () => moteur.current?.suivante(),
    precedente: () => moteur.current?.precedente(),
    plus: () => moteur.current?.plus(),
    moins: () => moteur.current?.moins(),
    terminer: () => moteur.current?.terminer(),
  }), []);

  const pleinEcran = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { /* refusé */ }
  };
  useEffect(() => {
    const f = () => setEcranPlein(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);

  const ouvrirBandeau = async () => {
    const w = await ouvrirFenetre();
    w.addEventListener("pagehide", () => setFenetre(null));
    setFenetre(w);
  };

  // Un test du catalogue (02/11/2026) : il est programmé pour aujourd'hui dans
  // le planning (comme depuis « Mes tests »), puis lancé, pour que le résultat
  // arrive dans « Mes tests ».
  const lancerTest = async (p: "rampe" | "lsct") => {
    setErreurTest(null);
    const auj = dayjs().format("YYYY-MM-DD");
    const deja = seances.find((x) => x.test === p && x.date === auj && x.status !== "valide" && x.workout_text);
    if (deja) { demarrer({ titre: deja.title || "Test", blocs: depuisIcu(deja.workout_text!, ftp), sessionId: deja.id, texteCourt: null, test: p }); return; }
    setTestEnCours(true);
    try {
      const { data, error } = await supabase.functions.invoke("tests", { body: { mode: "programmer", athleteId: moi, protocole: p, date: auj } });
      if (error || !data?.session?.id) throw new Error(data?.error ?? "Je n'arrive pas à préparer le test.");
      const { data: se } = await supabase.from("sessions").select("id, date, title, workout_text, planned_hour, status, test").eq("id", data.session.id).single();
      if (!se?.workout_text) throw new Error("Le test n'a pas d'étapes.");
      setSeances((l) => [se as SeanceDb, ...l]);
      demarrer({ titre: se.title || "Test", blocs: depuisIcu(se.workout_text, ftp), sessionId: se.id, texteCourt: null, test: p });
    } catch (e) {
      setErreurTest((e as Error).message);
    } finally { setTestEnCours(false); }
  };

  // ─── Fin ───
  // Toucher son ressenti enregistre ET envoie sur Strava : un seul geste (02/11/2026).
  const enregistrer = async (note: number | null = rpe) => {
    const m = moteur.current;
    if (!m || !moi || !choix) return;
    if (m.points.length < 30) { setEnvoi({ etat: "erreur", texte: "Moins de 30 secondes enregistrées : rien à envoyer." }); return; }
    setEnvoi({ etat: "en_cours", texte: "J'enregistre la séance…" });
    try {
      let sessionId = choix.sessionId;
      if (sessionId) {
        // Séance du planning écrite ici « à la main » : on y range aussi ses étapes
        await supabase.from("sessions").update({ status: "valide", rpe: note, ...(choix.texteCourt && choix.blocs.length ? { workout_text: versIcu(choix.blocs), workout_target: "POWER" } : {}) }).eq("id", sessionId);
      } else {
        const { data, error } = await supabase.from("sessions").insert({
          user_id: moi, date: dayjs().format("YYYY-MM-DD"), sport: "Vélo", title: choix.titre,
          planned_hour: Math.round(((dureeTotale(choix.blocs) || m.points.length) / 3600) * 100) / 100,
          workout_text: choix.blocs.length ? versIcu(choix.blocs) : null, workout_target: choix.blocs.length ? "POWER" : null,
          status: "valide", rpe: note,
        }).select("id").single();
        if (error) throw new Error(error.message);
        sessionId = data.id;
        setChoix({ ...choix, sessionId });
      }
      setEnvoi({ etat: "en_cours", texte: "J'envoie sur Strava…" });
      const fit = fichierFit(m.points, m.tours, m.rr);
      const colFait = !!choix.col && (m.points[m.points.length - 1]?.m ?? 0) >= choix.col.km * 1000 - 5;
      const bravo = colFait ? `⛰️ ${choix.col!.nom} : montée en ${chrono(m.points.length)}${nouveauRecord ? ", nouveau record !" : ""}` : compliment(m.points, m.tours, m.etapes, ftp, m.bouclee);
      const { data: r, error } = await supabase.functions.invoke("ht-envoi", { body: { fit: versBase64(fit), session_id: sessionId, compliment: bravo } });
      if (error) throw new Error(error.message);
      if (r?.status === "not_connected") { setEnvoi({ etat: "ok", texte: "Séance enregistrée. Strava n'est pas connecté : tu peux télécharger le fichier." }); return; }
      if (r?.error) throw new Error(r.error);
      if (r?.status === "en_cours") { setEnvoi({ etat: "ok", texte: "Séance enregistrée, Strava finit de traiter le fichier : elle arrivera dans quelques minutes." }); return; }
      if (r?.activity_id) {
        await supabase.functions.invoke("strava-force-sync", { body: { action: "attach", user_id: moi, target_type: "session", target_id: sessionId, activity_id: r.activity_id } });
      }
      setEnvoi({ etat: "ok", texte: r?.status === "doublon" ? "Séance enregistrée (elle était déjà sur Strava)." : "Séance enregistrée et envoyée sur Strava 🎉" });
    } catch (e) {
      setEnvoi({ etat: "erreur", texte: `Oups : ${(e as Error).message}` });
    }
  };

  const telecharger = () => {
    const m = moteur.current;
    if (!m?.points.length) return;
    const url = URL.createObjectURL(new Blob([fichierFit(m.points, m.tours, m.rr) as BlobPart], { type: "application/octet-stream" }));
    const a = document.createElement("a");
    a.href = url; a.download = `home-trainer-${dayjs().format("YYYY-MM-DD-HHmm")}.fit`; a.click();
    URL.revokeObjectURL(url);
  };

  const garderFavori = async () => {
    if (!choix?.texteCourt || !favoriNom.trim()) return;
    const { error } = await supabase.from("ht_favoris").insert({ nom: favoriNom.trim().slice(0, 80), texte: choix.texteCourt });
    if (!error) setFavoriOk(true);
  };

  const supprimerFavori = async (id: string) => {
    await supabase.from("ht_favoris").delete().eq("id", id);
    setFavoris((f) => f.filter((x) => x.id !== id));
  };

  const etapes = useMemo(() => (choix ? aplatir(choix.blocs) : []), [choix]);
  const lecture = depuisCourt(texte, ftp);
  const pret = simu || !!capteurs.ht?.connecte;
  const fond = `${jakarta.className} min-h-screen bg-[#F8FAFC] px-4 py-6 md:py-10`;

  // ─────────────────────────── Rouler un col ───────────────────────────
  // Pendant qu'on roule et à la fin : plein écran, le menu de gauche se cache.
  const sansMenu = (phase === "rouler" && !!etat && !!choix) || (phase === "fin" && !!moteur.current && !!choix);
  const { setSansMenu } = useCoque();
  useEffect(() => { setSansMenu(sansMenu); return () => setSansMenu(false); }, [sansMenu, setSansMenu]);

  if (phase === "rouler" && etat && choix?.col && etat.col) {
    const perdusCol = (["ht", "cardio", "pedales"] as Source[]).filter((x) => !simu && capteurs[x] && !capteurs[x]!.connecte);
    return (
      <main className={`${jakarta.className} min-h-screen bg-[#F8FAFC] px-4 lg:px-8 py-4`}>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl lg:text-2xl font-black text-slate-800 truncate">⛰️ {choix.col.nom}</h1>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={pleinEcran} className="hidden md:flex items-center gap-1.5 rounded-full bg-white border border-[#eef2f7] px-3.5 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50 shadow-sm">
                <Icone d={ecranPlein ? mdiFullscreenExit : mdiFullscreen} taille={18} />{ecranPlein ? "Quitter" : "Plein écran"}
              </button>
              {bandeauDispo() && !fenetre && (
                <button type="button" onClick={ouvrirBandeau} className="hidden md:flex items-center gap-1.5 rounded-full bg-white border border-[#eef2f7] px-3.5 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50 shadow-sm">
                  <Icone d={mdiPictureInPictureBottomRight} taille={17} /> Mode bandeau
                </button>
              )}
            </div>
          </div>
          {perdusCol.map((x) => (
            <div key={x} className="flex items-center gap-3 rounded-2xl bg-amber-100 px-4 py-3 text-amber-900 font-extrabold text-sm">
              <span className="w-4 h-4 rounded-full border-2 border-amber-300 border-t-amber-700 animate-spin shrink-0" />
              {x === "ht" ? "Home-trainer perdu : continue de pédaler, je le rebranche tout seul." : "Capteur perdu, je le rebranche…"}
            </div>
          ))}
          {etat.pause !== "non" && <div className="flex items-center gap-2 rounded-2xl px-4 py-3 font-extrabold bg-sky-100 text-sky-800"><Icone d={mdiPauseCircle} taille={20} />{etat.pause === "auto" ? "En pause : repédale pour reprendre" : "Prêt ? Pédale pour attaquer la montée"}</div>}
          <EcranCol etat={etat} col={choix.col} poids={profil.poids ?? null} zoneFc={zoneCoeur(etat.bpm, zonesFc)?.texte ?? null} record={records.get(choix.col.id) ?? null}
            onPause={actions.pause} onMoins={actions.moins} onPlus={actions.plus} onTerminer={async () => { if (await demander("Abandonner la montée ?", "Abandonner", true)) actions.terminer(); }} />
        </div>
        {fenetre && <Bandeau fenetre={fenetre} zoneFc={zoneCoeur(etat.bpm, zonesFc)?.n ?? null} etat={etat} etapes={[]} ftp={ftp} position={0} police={jakarta.style.fontFamily} perdu={!simu && capteurs.ht && !capteurs.ht.connecte ? "Home-trainer perdu, je le rebranche…" : null} actions={actions} onFermer={() => { fenetre.close(); window.focus(); }} />}
      </main>
    );
  }

  // ─────────────────────────── Rouler ───────────────────────────
  // Refonte du 02/11 (maquette validée, comme l'app) : en ERG, le temps
  // restant de l'étape et les watts côte à côte, aussi gros l'un que l'autre ;
  // sous la grande carte, des chiffres utiles (ce tour, dans le mille, la
  // séance, la suite) puis le dessin à hauteur fixe. Tout est centré dans les
  // cartes. Le compte à rebours est visuel : pas de son.
  if (phase === "rouler" && etat && choix) {
    const m = moteur.current;
    const z = etat.pause !== "non" ? ZONE_PAUSE : zoneEtape(etat.etape, ftp);
    const ec = ecart(etat.w3s, etat.cible);
    const wkg = profil.poids && etat.w3s != null ? (etat.w3s / profil.poids).toFixed(1).replace(".", ",") : null;
    const zc = zoneCoeur(etat.bpm, zonesFc);
    const avecEtapes = etapes.length > 0 && !!etat.etape;
    const perdus = (["ht", "cardio", "pedales"] as Source[]).filter((x) => !simu && capteurs[x] && !capteurs[x]!.connecte);
    // « Dans le mille » : la part du temps à ±4 % (au moins 5 W) des watts visés, depuis le début.
    const mille = dansLeMille(m?.points ?? []);
    const resteSeance = etat.dureeTotale ? Math.max(0, etat.dureeTotale - position(etapes, etat)) : null;
    const km = m?.points.length ? (m.points[m.points.length - 1].m / 1000).toFixed(1).replace(".", ",") : "0";
    const suite = etapes.slice(etat.i + 1, etat.i + 4);
    // Le compte à rebours avant le changement d'étape : visuel seulement.
    const rebours = avecEtapes && etat.pause === "non" && etat.suivante && etat.resteEtape != null && etat.resteEtape > 0 && etat.resteEtape <= 3.2 ? Math.ceil(etat.resteEtape) : null;
    const gros = "text-[64px] sm:text-[88px] lg:text-[120px] font-black tabular-nums leading-none tracking-tight";
    const petitBlanc = "text-[12px] lg:text-[13px] font-extrabold uppercase tracking-[0.12em] text-white/90";
    return (
      <main className={`${jakarta.className} min-h-screen bg-[#F8FAFC] px-4 lg:px-8 py-4`}>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl lg:text-2xl font-black text-slate-800 truncate">{choix.titre}</h1>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-black text-slate-500 tabular-nums mr-1">{chrono(etat.tTotal)}{etat.dureeTotale ? <span className="text-slate-400"> / {chrono(etat.dureeTotale)}</span> : null}</span>
              <button type="button" onClick={pleinEcran} title="Plein écran" className="hidden md:flex items-center gap-1.5 rounded-full bg-white border border-[#eef2f7] px-3.5 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50 shadow-sm">
                <Icone d={ecranPlein ? mdiFullscreenExit : mdiFullscreen} taille={18} />{ecranPlein ? "Quitter" : "Plein écran"}
              </button>
              {bandeauDispo() && !fenetre && (
                <button type="button" onClick={ouvrirBandeau} className="hidden md:flex items-center gap-1.5 rounded-full bg-white border border-[#eef2f7] px-3.5 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50 shadow-sm">
                  <Icone d={mdiPictureInPictureBottomRight} taille={17} /> Mode bandeau
                </button>
              )}
            </div>
          </div>

          {perdus.map((x) => (
            <div key={x} className="flex items-center gap-3 rounded-2xl bg-amber-100 px-4 py-3 text-amber-900">
              <span className="w-4 h-4 rounded-full border-2 border-amber-300 border-t-amber-700 animate-spin shrink-0" />
              <span className="flex-1 font-extrabold text-sm">{x === "ht" ? "Home-trainer perdu : continue de pédaler, je le rebranche tout seul." : x === "cardio" ? "Ceinture cardio perdue, je la rebranche…" : "Capteur de puissance perdu, je le rebranche…"}</span>
              <button type="button" onClick={() => connecter(x)} className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-amber-900">Choisir à nouveau</button>
            </div>
          ))}

          {/* Écran large : la grande carte et les boutons à gauche, les chiffres à droite. */}
          <div className="grid lg:grid-cols-2 gap-3 items-start">
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-[26px] px-5 py-4 lg:py-6 text-white space-y-1.5" style={degrade(z.degrade)}>
                <div className={`${petitBlanc} text-center`}>
                  {`${z.mot.toUpperCase()}${avecEtapes ? ` · ÉTAPE ${Math.min(etat.i + 1, etapes.length)}/${etapes.length}` : ` · ${etat.erg ? "ERG" : `PENTE ${etat.pente} %`}`}${etat.ajust !== 1 ? ` · ${etat.ajust > 1 ? "+" : ""}${Math.round((etat.ajust - 1) * 100)} %` : ""}`}
                </div>
                {avecEtapes ? (
                  <div className="flex items-end justify-around gap-2">
                    <div className="flex flex-col items-center min-w-0">
                      <span className={petitBlanc}>{etat.attendLap ? "QUAND TU ES PRÊT" : "ENCORE"}</span>
                      <span className={gros}>{etat.attendLap ? "⏭" : chrono(etat.resteEtape ?? 0)}</span>
                    </div>
                    <div className="flex flex-col items-center min-w-0">
                      <span className={petitBlanc}>WATTS · 3 S</span>
                      <span className={gros}>{etat.w3s ?? "—"}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-[96px] sm:text-[120px] lg:text-[160px] font-black tabular-nums leading-none tracking-tight">{etat.w3s ?? "—"}</div>
                )}
                {etat.pause === "non" && <Jauge w={etat.w3s} cible={etat.cible} />}
                <p className="text-center text-[16px] lg:text-[19px] font-black text-white/95">
                  {etat.cible ? `visé ${etat.cible} W${ec ? ` · ${ec.bon ? "dans le mille" : ec.texte}` : ""}` : "moyenne 3 s"}{wkg ? ` · ${wkg} W/kg` : ""}{etat.etape?.cadence ? ` · vise ${etat.etape.cadence} tr/min` : ""}
                </p>
                {rebours != null && (
                  <div className="pointer-events-none absolute inset-0 !m-0 flex flex-col items-center justify-center bg-slate-900/55">
                    <span className="text-[120px] lg:text-[180px] font-black leading-none">{rebours}</span>
                    {etat.suivante && <span className="text-[18px] lg:text-[24px] font-black">puis {cibleTexte(etat.suivante, etat.ajust)}</span>}
                  </div>
                )}
              </div>

              {(etat.alerte || etat.pause !== "non") && (
                <div className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 font-extrabold ${etat.alerte ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"}`}>
                  <Icone d={etat.alerte ? mdiAlertCircle : mdiPauseCircle} taille={20} />
                  {etat.alerte ?? (etat.pause === "auto" ? "En pause : repédale pour reprendre" : "Prêt ? Pédale pour démarrer")}
                </div>
              )}

              <div className="flex items-center justify-center gap-3 lg:gap-4 pt-1">
                <Rond titre="Moins dur" d={mdiMinus} onClick={actions.moins} />
                <Rond titre="Précédent" d={mdiSkipPrevious} onClick={actions.precedente} />
                <Rond grand couleurs={z.degrade} titre="Pause" d={etat.pause === "non" ? mdiPause : mdiPlay} onClick={actions.pause} />
                <Rond titre="Suivant" d={mdiSkipNext} onClick={actions.suivante} />
                <Rond titre="Plus dur" d={mdiPlus} onClick={actions.plus} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                <Case titre="Cadence" valeur={etat.cadence ?? "—"} sous="tr/min" />
                <Case titre="Cœur" valeur={etat.bpm ?? "—"} sous={zc ? zc.texte : "bpm"} sousCoul={zc?.coul} />
                <Case titre="Réserve" valeur={etat.reserve != null ? `${Math.round(etat.reserve * 100)}%` : "—"} sous={etat.reserve != null ? undefined : "à mesurer"} />
              </div>
              <div className="flex gap-2">
                <Case titre="Ce tour" valeur={<>{etat.tour.w ?? "—"}<span className="text-[13px] text-slate-400"> W</span></>} sous={`avant ${etat.tourPrec?.w ?? "—"} W`} />
                <Case titre="Dans le mille" valeur={mille != null ? `${mille} %` : "—"} coul={mille != null && mille >= 70 ? "#059669" : undefined} sous="du temps" />
                <Case titre="Séance" valeur={resteSeance != null ? chrono(resteSeance) : chrono(etat.tTotal)} sous={`${resteSeance != null ? "restantes · " : ""}${km} km`} />
              </div>
              {suite.length > 0 && (
                <div className="rounded-[18px] bg-white border border-[#eef2f7] px-3.5 py-2.5 space-y-1">
                  <div className="text-center text-[10.5px] lg:text-[11.5px] font-extrabold uppercase tracking-[0.1em] text-slate-400">Et après</div>
                  {suite.map((e, i) => (
                    <div key={i} className="flex items-center justify-center gap-2.5" style={{ opacity: i === 0 ? 1 : i === 1 ? 0.75 : 0.5 }}>
                      <span className="w-[11px] h-[11px] rounded-[3px] shrink-0" style={{ background: zoneEtape(e, ftp).plein }} />
                      <span className={`text-[15px] lg:text-[17px] text-slate-800 tabular-nums ${i === 0 ? "font-black" : "font-bold"}`}>{chrono(e.s)} à {cibleTexte(e, etat.ajust)}</span>
                    </div>
                  ))}
                </div>
              )}
              {etapes.length > 0 && <Carte className="!p-2.5"><Profil etapes={etapes} ftp={ftp} ecoule={position(etapes, etat)} hauteur={90} trace={m?.trace} /></Carte>}
              <div className="flex items-center justify-center gap-2.5 pt-1">
                {etapes.length > 0 && <button type="button" onClick={() => moteur.current?.basculerErg()} className="rounded-full bg-white border border-[#eef2f7] px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50">{etat.erg ? "Passer en résistance" : "Repasser en ERG"}</button>}
                <button type="button" onClick={async () => { if (await demander("Terminer la séance ?", "Terminer")) actions.terminer(); }} className="flex items-center gap-1.5 rounded-full bg-rose-50 px-4 py-2.5 text-sm font-black text-rose-600 hover:bg-rose-100"><Icone d={mdiFlagCheckered} taille={16} /> Terminer</button>
              </div>
              <p className="text-center text-xs text-slate-400 hidden md:block">Clavier : espace = pause · ← → = étapes · ↑ ↓ = plus ou moins dur</p>
            </div>
          </div>
        </div>
        {fenetre && <Bandeau fenetre={fenetre} zoneFc={zc?.n ?? null} etat={etat} etapes={etapes} ftp={ftp} position={position(etapes, etat)} police={jakarta.style.fontFamily} perdu={!simu && capteurs.ht && !capteurs.ht.connecte ? "Home-trainer perdu, je le rebranche…" : null} actions={actions} onFermer={() => { fenetre.close(); window.focus(); }} />}
      </main>
    );
  }

  // ─────────────────────────── Fin ───────────────────────────
  if (phase === "fin" && moteur.current && choix) {
    const pts = moteur.current.points;
    const moy = (k: "w" | "bpm") => { const v = pts.map((p) => p[k]).filter((x): x is number => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : "—"; };
    const km = pts.length ? (pts[pts.length - 1].m / 1000).toFixed(1) : "0";
    const mille = dansLeMille(pts);
    return (
      <main className={fond}>
        <div className="max-w-xl mx-auto space-y-3.5">
          <Ciel couleurs={["#059669", "#10b981", "#34d399"]} icone={mdiTrophyOutline}>
            <Sur>Séance terminée</Sur>
            <div className="text-[30px] font-black mt-1">Bien joué 💪</div>
            <div className="font-bold max-w-[70%] truncate">{choix.titre}</div>
            <div className="flex flex-wrap gap-2 mt-4">
              <Bulle icone={mdiTimerOutline} texte={chrono(pts.length)} />
              <Bulle icone={mdiLightningBolt} texte={`${moy("w")} W`} />
              {profil.poids && typeof moy("w") === "number" ? <Bulle icone={mdiScaleBathroom} texte={`${((moy("w") as number) / profil.poids).toFixed(1).replace(".", ",")} W/kg`} /> : null}
              <Bulle icone={mdiHeart} texte={`${moy("bpm")} bpm`} />
              <Bulle icone={mdiMapMarkerDistance} texte={`${km} km`} />
              {mille != null && <Bulle icone={mdiTarget} texte={`${mille} % dans le mille`} fort />}
            </div>
          </Ciel>
          {choix.test === "rampe" && <CarteRampe points={pts} />}

          {choix.col && (
            <Carte className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-black text-slate-800 text-base">⛰️ {choix.col.nom}</span>
                {nouveauRecord && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700">🏆 Record</span>}
              </div>
              <ProfilCol col={choix.col} hauteur={70} kmParKm={false} />
              {!colFini(choix.col, pts) && <p className="font-extrabold text-slate-500">Pas jusqu&apos;au sommet cette fois : ce sera pour la prochaine 💪</p>}
              {colFini(choix.col, pts) && (choix.col.pros ?? []).slice(0, 1).map((x) => (
                <p key={x.nom} className="font-black text-slate-800">{pts.length > x.s ? `Tu aurais passé la ligne ${chrono(pts.length - x.s)} après ${x.nom}` : `Plus vite que ${x.nom} en ${x.annee} !`}</p>
              ))}
              {(choix.col.pros ?? []).map((x) => (
                <div key={x.nom} className="flex justify-between text-[14px] font-extrabold"><span className="text-slate-500">{x.nom} ({x.annee})</span><span className="tabular-nums text-slate-800">{chrono(x.s)}</span></div>
              ))}
              {classement && classement.length > 0 && (
                <div className="border-t border-slate-100 pt-2.5 space-y-1">
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Classement</div>
                  {classement.map((c) => (
                    <div key={`${c.rang}-${c.prenom}-${c.duree_s}`} className={`flex justify-between rounded-xl px-2.5 py-1.5 text-[14px] font-extrabold ${c.moi ? "bg-blue-50 text-blue-700" : "text-slate-700"}`}>
                      <span>{c.rang === 1 ? "🥇" : c.rang === 2 ? "🥈" : c.rang === 3 ? "🥉" : `${c.rang}.`} {c.prenom}</span>
                      <span className="tabular-nums">{chrono(c.duree_s)}{c.wkg ? <span className="text-slate-400 font-bold"> · {String(c.wkg).replace(".", ",")} W/kg</span> : null}</span>
                    </div>
                  ))}
                </div>
              )}
            </Carte>
          )}

          {envoi.etat !== "ok" && (
            <Carte className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="flex items-baseline gap-2">
                  <span className="font-black text-slate-800 text-base">C&apos;était comment ?</span>
                  {/* L'échelle détaillée, comme quand on valide une séance (Martin, 01/11) */}
                  <button type="button" onClick={() => setAideRpe(!aideRpe)} className="text-xs font-extrabold text-blue-600 hover:underline">{aideRpe ? "Fermer l'aide" : "Aide"}</button>
                </span>
                {rpe != null && <span className="font-black" style={{ color: RPE_COUL[rpe] }}>{RPE[rpe]}</span>}
              </div>
              {aideRpe && (
                <div className="rounded-xl border border-slate-100 overflow-hidden">
                  {RPE.map((mot, n) => n > 0 && (
                    <button key={n} type="button" disabled={envoi.etat === "en_cours"} onClick={() => { setRpe(n); setAideRpe(false); enregistrer(n); }} className="w-full flex items-center gap-3 px-3 py-1.5 text-left text-sm border-b last:border-0 border-slate-50 hover:bg-slate-50">
                      <span className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-white" style={{ background: RPE_COUL[n] }}>{n}</span>
                      <span className="font-extrabold text-slate-800">{mot}</span>
                      <span className="text-slate-500 text-xs">{RPE_REPERE[n]}</span>
                    </button>
                  )).reverse()}
                </div>
              )}
              <div className="flex gap-1.5">
                {Array.from({ length: 10 }, (_, k) => k + 1).map((n) => (
                  <button key={n} type="button" disabled={envoi.etat === "en_cours"} onClick={() => { setRpe(n); enregistrer(n); }} className="flex-1 h-12 rounded-xl font-black text-[16px] transition disabled:cursor-wait"
                    style={{ background: n === rpe ? RPE_COUL[n] : RPE_COUL[n] + "26", color: n === rpe ? "#fff" : "#1e293b" }}>{n}</button>
                ))}
              </div>
              <p className="text-center text-sm font-bold text-slate-500">{rpe != null ? RPE_REPERE[rpe] : "Touche ton ressenti : la séance s'enregistre et part sur Strava."}</p>
            </Carte>
          )}

          {envoi.texte && (
            <div className={`flex items-center gap-2 rounded-2xl px-4 py-3.5 font-extrabold ${envoi.etat === "erreur" ? "bg-rose-50 text-rose-700" : envoi.etat === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
              {envoi.etat === "en_cours" ? <span className="w-5 h-5 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" /> : <Icone d={envoi.etat === "ok" ? mdiCheckCircle : mdiAlertCircle} taille={20} />}
              {envoi.texte}
            </div>
          )}

          {envoi.etat === "erreur" && rpe != null && <Bouton large onClick={() => enregistrer(rpe)} icone={mdiCloudUploadOutline} couleur="#fc4c02">Réessayer l&apos;envoi</Bouton>}
          {envoi.etat === "ok" && <Bouton large onClick={() => router.push("/athlete")} icone={mdiCalendarMonth}>Retour au planning</Bouton>}
          <button type="button" onClick={telecharger} className="w-full flex items-center justify-center gap-1.5 py-2 text-sm font-extrabold text-slate-500 hover:text-slate-800"><Icone d={mdiDownload} taille={17} /> Télécharger le fichier</button>

          {choix.texteCourt && !favoriOk && (
            <div className="rounded-[20px] bg-amber-50 border border-amber-200 p-4 space-y-2.5">
              <div className="flex items-center gap-1.5 font-black text-slate-800"><Icone d={mdiStar} taille={18} coul="#f59e0b" /> La garder pour la refaire ?</div>
              <div className="flex gap-2">
                <input value={favoriNom} onChange={(e) => setFavoriNom(e.target.value)} placeholder="Un nom, ex. 5×4' seuil" className="flex-1 rounded-[14px] bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-300" />
                <Bouton petit onClick={garderFavori} couleur="#f59e0b">Garder</Bouton>
              </div>
            </div>
          )}
          {favoriOk && <p className="text-center font-black text-amber-600">⭐ Gardée dans tes favoris</p>}
        </div>
      </main>
    );
  }

  // ─────────────────────────── Préparer ───────────────────────────
  const connectes = (["ht", "cardio", "pedales"] as Source[]).filter((s) => capteurs[s]?.connecte);
  const puce = (src: Source, nom: string, icone: string) => {
    const c = capteurs[src];
    return (
      <button key={src} type="button" onClick={() => connecter(src)}
        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-black transition ${c?.connecte ? "bg-white text-slate-800" : "bg-white/20 text-white hover:bg-white/30"}`}>
        <Icone d={c?.connecte ? mdiCheckCircle : icone} taille={16} coul={c?.connecte ? "#059669" : "#fff"} />
        {c ? c.nom : nom}
        {c && !c.connecte && <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" />}
      </button>
    );
  };

  // Vélo pas prêt : on le dit au lieu de griser les séances.
  const pasPret = () => { setMaterielOuvert(true); setPasPretOuvert(true); };
  // La séance du coach pour aujourd'hui, en tête (maquette du 02/11/2026).
  const duJour = seances.find((x) => x.date === dayjs().format("YYYY-MM-DD") && x.status !== "valide" && x.workout_text);
  const blocsJour = duJour ? depuisIcu(duJour.workout_text!, ftp) : [];
  const avecPastille = simu || bluetoothDispo();

  // La préparation vit dans la coque commune (menu à gauche, 05/11/2026) ;
  // l'écran pendant qu'on roule, lui, reste en plein écran.
  return (
    <>
      <div className="max-w-[1400px] space-y-3.5">
        <div className="flex items-center gap-1.5">
          <h1 className="flex-1 text-[28px] font-extrabold text-slate-800">Home-trainer</h1>
          {simu && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-extrabold text-violet-700">simulateur</span>}
          {avecPastille && (
            <button type="button" onClick={() => setMaterielOuvert((x) => !x)}
              className={`inline-flex items-center gap-[7px] rounded-full border px-3 py-2 text-[13.5px] font-extrabold ${pret ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
              <span className={`w-[9px] h-[9px] rounded-full ${pret ? "bg-green-600" : "bg-amber-500"}`} />
              {pret ? "Vélo prêt" : "Brancher le vélo"}
              <Icone d={materielOuvert ? mdiChevronUp : mdiChevronDown} taille={16} />
            </button>
          )}
        </div>

        {/* Le matériel : affiché tant que le vélo n'est pas prêt, sinon à la demande (pastille). */}
        {(!avecPastille || !pret || materielOuvert || !ftpConnue) && (
          <>
          <div className="grid md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-3.5 items-stretch">
            {!bluetoothDispo() && !simu ? (
              <Ciel couleurs={CIEL_ATTENTE} icone={mdiBike} className="h-full">
                <Sur>Mon matériel</Sur>
                <div className="text-[26px] font-black mt-1.5 max-w-[72%]">Il faut Chrome</div>
                <p className="font-semibold mt-1.5 max-w-[78%] leading-snug">Le Bluetooth marche dans Chrome (ou Edge) sur ordinateur. Sous Linux : ouvre <code className="rounded bg-white/25 px-1">chrome://flags</code>, active « Experimental Web Platform features », puis relance Chrome.</p>
              </Ciel>
            ) : (
              <Ciel couleurs={pret ? CIEL_PRET : CIEL_ATTENTE} icone={mdiBikeFast} className="h-full">
                <Sur>Mon matériel</Sur>
                <div className="text-[28px] font-black mt-1.5 max-w-[72%]">{pret ? "Prêt à rouler" : "On branche le vélo ?"}</div>
                <p className="font-semibold mt-1 max-w-[75%]">{simu ? "Faux home-trainer : il suit la consigne tout seul." : pret ? `${connectes.length} appareil${connectes.length > 1 ? "s" : ""} connecté${connectes.length > 1 ? "s" : ""}` : "Clique sur « Home-trainer » pour le connecter."}</p>
                {!simu && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {puce("ht", "Home-trainer", mdiBike)}
                    {puce("cardio", "Cardio", mdiHeartPulse)}
                    {puce("pedales", "Capteur de puissance", mdiLightningBolt)}
                    {puce("guidon", "Guidon Zwift", mdiGamepadVariantOutline)}
                  </div>
                )}
                {!simu && capteurs.ht?.connecte && (
                  <button type="button" onClick={() => setEtal({ etape: "intro" })} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3.5 py-2 text-[13px] font-black text-white hover:bg-white/30">
                    <Icone d={mdiTuneVertical} taille={16} /> Étalonner le home-trainer
                  </button>
                )}
                {erreurBt && <p className="mt-2 text-xs font-bold text-white/90">{erreurBt}</p>}
                {!ftpConnue && (
                  <div className="flex items-center gap-2 mt-3 font-bold">
                    Ta FTP <input type="number" value={ftp} onChange={(e) => setFtp(Math.max(80, Number(e.target.value) || 200))} className="w-20 rounded-lg bg-white px-2 py-1 font-black text-slate-800" /> W
                  </div>
                )}
              </Ciel>
            )}

            {/* Mon profil : ce que l'écran utilise, pour que rien ne soit une boîte noire */}
              <Carte className="space-y-3 h-full flex flex-col justify-center">
                <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400"><Icone d={mdiAccountOutline} taille={15} coul="#94a3b8" />Mon profil</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["FTP", `${ftp} W`, profil.poids ? `${(ftp / profil.poids).toFixed(1).replace(".", ",")} W/kg` : ""],
                    ["Poids", profil.poids ? `${profil.poids} kg` : "—", ""],
                    ["Réserve", profil.cp ? `${Math.round(profil.cp)} W` : "—", profil.wPrime ? `+ ${Math.round(profil.wPrime / 1000)} kJ` : "à mesurer"],
                  ].map(([t, v, sous]) => (
                    <div key={t} className="rounded-2xl bg-slate-50 px-3 py-2.5">
                      <div className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-400">{t}</div>
                      <div className="text-[22px] font-black text-slate-800 tabular-nums leading-tight">{v}</div>
                      {sous && <div className="text-[12px] font-bold text-slate-500">{sous}</div>}
                    </div>
                  ))}
                </div>
              </Carte>

          </div>
          {/* Pendant la séance : quatre astuces en un bandeau fin (05/11), plus une colonne à part. */}
          <div className="hidden lg:grid grid-cols-4 gap-2.5">
            {[
              [mdiPictureInPictureBottomRight, "Mode bandeau", "une fenêtre étroite, toujours au-dessus de ton film"],
              [mdiKeyboardOutline, "Clavier", "espace = pause · ← → étapes · ↑ ↓ plus ou moins dur"],
              [mdiGamepadVariantOutline, "Guidon Zwift", "palettes = plus ou moins dur · A = pause"],
              [mdiCloudUploadOutline, "À la fin", "ton ressenti, puis la séance part sur Strava"],
            ].map(([d, t, x]) => (
              <div key={t} className="flex items-start gap-2.5 rounded-2xl bg-white border border-slate-200 px-3 py-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0"><Icone d={d} taille={17} coul="#2563eb" /></div>
                <div className="min-w-0"><div className="font-black text-slate-800 text-[13px]">{t}</div><div className="text-[12px] font-semibold text-slate-500 leading-snug">{x}</div></div>
              </div>
            ))}
          </div>
          </>
        )}

        {duJour && blocsJour.length > 0 && (
          <div className="rounded-[26px] p-5 space-y-2.5 text-white" style={degrade(["#7c3aed", "#a855f7"])}>
            <div className="text-[12px] font-extrabold tracking-[0.12em] text-white/90">AUJOURD&apos;HUI · TON COACH</div>
            <div className="text-[28px] font-black leading-tight line-clamp-2">{duJour.title || "Vélo"}</div>
            <div className="text-[15px] font-bold text-white/95">{Math.round(dureeTotale(blocsJour) / 60)} min</div>
            <div className="rounded-[14px] bg-white/90 p-2">{profilDe(blocsJour, ftp, 52)}</div>
            <button type="button" onClick={() => (pret ? demarrer({ titre: duJour.title || "Vélo", blocs: blocsJour, sessionId: duJour.id, texteCourt: null, test: duJour.test === "rampe" || duJour.test === "lsct" ? duJour.test : null }) : pasPret())}
              className="w-full flex items-center justify-center gap-2 rounded-full bg-white py-3.5 text-[17px] font-black text-violet-700 hover:bg-violet-50 transition active:scale-[0.99]">
              <Icone d={mdiPlay} taille={20} /> C&apos;est parti
            </button>
          </div>
        )}

        <Onglets valeur={onglet} onChange={setOnglet} choix={[["seances", "Séances"], ["plan", "Planning"], ["main", "Main"], ["favoris", "Favoris"], ["cols", "Cols"]] as const} />

        {onglet === "seances" && (
          <>
            {erreurTest && <div className="flex items-center gap-2 rounded-2xl bg-rose-50 px-4 py-3 font-extrabold text-rose-700"><Icone d={mdiAlertCircle} taille={20} />Test impossible : {erreurTest}</div>}
            <Catalogue duree={dureeCat} setDuree={setDureeCat} famille={familleCat} setFamille={setFamilleCat}
              ftp={ftp} pret={pret} occupe={testEnCours} onGo={(c) => demarrer(c)} onTest={lancerTest} onPasPret={pasPret} />
          </>
        )}

        {onglet === "plan" && (seances.length === 0 ? <Vide icone={mdiCalendarBlankOutline}>Pas de séance vélo cette semaine.<br />Fais-en une à la main !</Vide> : (
          <div className="space-y-2.5">
            {[...seances].sort((a, b) => (a.id === seanceChoisie ? -1 : b.id === seanceChoisie ? 1 : 0)).map((s) => {
              const blocs = s.workout_text ? depuisIcu(s.workout_text, ftp) : [];
              const auj = s.date === dayjs().format("YYYY-MM-DD") || s.id === seanceChoisie;
              return (
                <Carte key={s.id} className={`space-y-2.5 ${auj ? "!border-2 !border-blue-200" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className={`text-[11px] font-extrabold uppercase tracking-[0.12em] ${auj ? "text-blue-600" : "text-slate-400"}`}>{auj ? "Aujourd'hui" : dayjs(s.date).format("dddd D MMM")}{s.status === "valide" ? " · faite ✓" : ""}</div>
                      <div className="font-black text-slate-800 text-base truncate mt-0.5">{s.title || "Vélo"}</div>
                      {blocs.length ? <div className="text-[13px] font-semibold text-slate-500">{Math.round(dureeTotale(blocs) / 60)} min</div>
                        : <div className="text-[13px] font-extrabold text-amber-700">Pas d&apos;étapes : l&apos;app ne peut pas piloter l&apos;ERG</div>}
                    </div>
                    <Bouton petit desactive={!pret} icone={mdiPlay} onClick={() => demarrer({ titre: s.title || "Vélo", blocs, sessionId: s.id, texteCourt: null, test: s.test === "rampe" || s.test === "lsct" ? s.test : null })}>Go</Bouton>
                  </div>
                  {blocs.length > 0 && profilDe(blocs, ftp, 40)}
                  {!blocs.length && (
                    <button type="button" onClick={() => { setCible({ id: s.id, titre: s.title || "Vélo" }); setTexte(""); setOnglet("main"); }}
                      className="rounded-full bg-amber-100 px-3 py-1.5 text-[13px] font-black text-amber-800 hover:bg-amber-200">✏️ Écrire ses étapes</button>
                  )}
                </Carte>
              );
            })}
          </div>
        ))}

        {onglet === "main" && (
          <div className="space-y-3">
            {cible && (
              <div className="flex items-center gap-2 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-extrabold text-slate-800">
                <span className="flex-1">🔗 Pour ta séance « {cible.titre} » : elle sera validée dans ton planning.</span>
                <button type="button" onClick={() => setCible(null)} className="text-slate-400 hover:text-slate-700">✕</button>
              </div>
            )}
            <Editeur texte={texte} setTexte={setTexte} ftp={ftp} />
            {lecture.blocs.length > 0 && <Bouton large desactive={!pret} icone={mdiPlay} onClick={() => demarrer({ titre: cible?.titre ?? "Séance maison", blocs: lecture.blocs, sessionId: cible?.id ?? null, texteCourt: versCourt(lecture.blocs) })}>C&apos;est parti</Bouton>}
          </div>
        )}

        {onglet === "favoris" && (favoris.length === 0 ? <Vide icone={mdiStarOutline}>Pas encore de favori.<br />À la fin d&apos;une séance faite à la main, tu pourras la garder.</Vide> : (
          <div className="space-y-2.5">
            {favoris.map((f) => {
              const b = depuisCourt(f.texte, ftp).blocs;
              return (
                <Carte key={f.id} className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-[38px] h-[38px] rounded-xl bg-amber-50 flex items-center justify-center shrink-0"><Icone d={mdiStar} taille={20} coul="#f59e0b" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-slate-800 text-base truncate">{f.nom}</div>
                      <div className="text-[13px] font-semibold text-slate-500">{b.length ? `${Math.round(dureeTotale(b) / 60)} min` : ""}</div>
                    </div>
                    <Bouton petit desactive={!pret || !b.length} icone={mdiPlay} onClick={() => demarrer({ titre: f.nom, blocs: b, sessionId: null, texteCourt: f.texte })}>Go</Bouton>
                  </div>
                  {b.length > 0 && profilDe(b, ftp, 36)}
                  <div className="flex gap-4 text-[13px] font-extrabold">
                    <button type="button" onClick={() => { setTexte(f.texte); setOnglet("main"); }} className="text-blue-600 hover:underline">Modifier</button>
                    <button type="button" onClick={() => supprimerFavori(f.id)} className="text-slate-400 hover:text-rose-500">Retirer</button>
                  </div>
                </Carte>
              );
            })}
          </div>
        ))}

        {onglet === "cols" && <ListeCols ftp={ftp} poids={profil.poids ?? null} records={records} pret={pret} onPasPret={pasPret} onGo={(c) => demarrer({ titre: c.nom, blocs: [], sessionId: null, texteCourt: null, col: c })} />}
      </div>
      {pasPretOuvert && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setPasPretOuvert(false)} />
          <div className="relative w-full max-w-sm rounded-[26px] bg-white p-6 space-y-3 shadow-2xl">
            <div className="text-xl font-black text-slate-800">Le vélo n&apos;est pas connecté</div>
            <p className="text-[15px] font-semibold text-slate-600">Branche d&apos;abord le home-trainer.</p>
            {!simu && bluetoothDispo() && <Bouton large icone={mdiBike} onClick={() => { setPasPretOuvert(false); connecter("ht"); }}>Le chercher</Bouton>}
            <button type="button" onClick={() => setPasPretOuvert(false)} className="w-full py-2 text-sm font-extrabold text-slate-500 hover:text-slate-800">Plus tard</button>
          </div>
        </div>
      )}
      {etal && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setEtal(null)} />
          <div className="relative w-full max-w-md rounded-[26px] bg-white p-6 space-y-4 shadow-2xl">
            <div className="text-xl font-black text-slate-800">Étalonner le home-trainer</div>
            {etal.etape === "intro" && (<>
              <div className="text-[15px] leading-relaxed text-slate-600 space-y-1.5">
                <p>Pour des watts justes. À faire une fois, puis quand tu déplaces le home-trainer.</p>
                <p>1. Pédale <b className="text-slate-800">10 minutes</b> avant : le frein doit être chaud.</p>
                <p>2. Clique « C&apos;est parti », accélère jusqu&apos;à la vitesse demandée.</p>
                <p>3. Arrête de pédaler et laisse la roue s&apos;arrêter toute seule.</p>
              </div>
              <Bouton large icone={mdiPlay} onClick={lancerEtalonnage}>C&apos;est parti</Bouton>
            </>)}
            {etal.etape === "attente" && <p className="text-center text-slate-500 py-4">Je demande au home-trainer…</p>}
            {etal.etape === "vitesse" && (<>
              <p className="text-[15px] text-slate-600">Accélère au-dessus de <b className="text-slate-800">{etal.haute ? `${Math.ceil(etal.haute)} km/h` : "la vitesse demandée"}</b>, puis attends le signal.</p>
              <p className={`text-center text-6xl font-black tabular-nums ${vitesseEtal != null && etal.haute && vitesseEtal >= etal.haute ? "text-emerald-600" : "text-slate-800"}`}>{vitesseEtal != null ? vitesseEtal.toFixed(1).replace(".", ",") : "—"} <span className="text-xl text-slate-400">km/h</span></p>
            </>)}
            {etal.etape === "stop" && <p className="text-center text-2xl font-black text-amber-700 py-3">Arrête de pédaler ✋<br /><span className="text-[15px] font-bold text-slate-500">Laisse la roue s&apos;arrêter toute seule.</span></p>}
            {etal.etape === "ok" && <p className="text-center text-2xl font-black text-emerald-600 py-3">Étalonné ✓<br /><span className="text-[15px] font-bold text-slate-500">Tes watts sont justes.</span></p>}
            {etal.etape === "erreur" && <p className="text-[15px] font-bold text-rose-700">L&apos;étalonnage n&apos;a pas abouti. Réessaie en accélérant un peu plus avant d&apos;arrêter de pédaler.</p>}
            {etal.etape === "non" && <p className="text-[15px] font-semibold text-slate-600 leading-relaxed">Ton home-trainer ne se laisse pas étalonner par une autre app. Fais-le dans l&apos;app <b className="text-slate-800">Tacx Training</b> (après 10 min d&apos;échauffement), puis ferme-la complètement et reviens ici.</p>}
            <button type="button" onClick={() => { if (["vitesse", "stop"].includes(etal.etape)) cap.current.ht?.etalonner(true).catch(() => {}); setEtal(null); }} className="w-full py-2 text-sm font-extrabold text-slate-500 hover:text-slate-800">
              {["ok", "erreur", "non"].includes(etal.etape) ? "Fermer" : "Annuler"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function Page() {
  return <Suspense fallback={null}><HomeTrainer /></Suspense>;
}
