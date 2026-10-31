"use client";
// ─────────────────────────────────────────────────────────────────────────
// Home-trainer (30/10/2026) — remplace Zwift/MyWhoosh pour ce qui sert :
// piloter le home-trainer en ERG sur les séances du coach ou faites à la
// main, un bandeau flottant à poser à côté d'un film, et l'activité sur
// Strava à la fin. Pas de monde virtuel.
// Pendant de l'app : App-Coach/app/home-trainer.tsx, même design (celui de
// l'app : Météo du corps, Progression). La logique (séances, Bluetooth,
// moteur, .fit, zones) est partagée : ./ht/*.ts.
// ─────────────────────────────────────────────────────────────────────────
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import "dayjs/locale/fr";
import { Plus_Jakarta_Sans } from "next/font/google";
import {
  mdiAlertCircle, mdiBike, mdiBikeFast, mdiCalendarBlankOutline, mdiCalendarMonth, mdiCheckCircle, mdiChevronLeft, mdiCloudUploadOutline,
  mdiDownload, mdiFlagCheckered, mdiHeart, mdiHeartPulse, mdiLightningBolt, mdiMapMarkerDistance, mdiMinus, mdiPause, mdiPauseCircle,
  mdiPictureInPictureBottomRight, mdiPlay, mdiPlus, mdiRoadVariant, mdiRotateRight, mdiSkipNext, mdiSkipPrevious, mdiSlopeUphill, mdiStar,
  mdiStarOutline, mdiTarget, mdiTimerOutline, mdiTrophyOutline, mdiTuneVariant, mdiFullscreen, mdiFullscreenExit, mdiScaleBathroom,
  mdiFlagVariantOutline, mdiHistory, mdiBatteryHigh, mdiSigma, mdiGamepadVariantOutline,
} from "@mdi/js";
import { supabase } from "@/lib/supabaseClient";
import { depuisCourt, depuisIcu, versCourt, versIcu, aplatir, dureeTotale, type Bloc, type Etape } from "./ht/seance";
import { Moteur, type Etat, type Moyennes as MoyennesT, type Profil as ProfilCycliste } from "./ht/moteur";
import { compliment } from "./ht/compliment";
import { fichierFit } from "./ht/fit";
import { ecart, zoneEtape, ZONE_PAUSE } from "./ht/zones";
import { Capteur, Simulateur, bluetoothDispo, messageConnexion, type EtatCapteur, type Source } from "./capteurs";
import { Editeur } from "./Editeur";
import { Bandeau, bandeauDispo, chrono, ouvrirFenetre, type Actions } from "./Bandeau";
import { Anneau, Bouton, Bulle, Carte, Ciel, Icone, Onglets, Profil, profilDe, Sur, Titre } from "./ui";

dayjs.locale("fr");
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["500", "600", "700", "800"], display: "swap" });

type Choix = { titre: string; blocs: Bloc[]; sessionId: string | null; texteCourt: string | null };
type SeanceDb = { id: string; date: string; title: string | null; workout_text: string | null; planned_hour: number | null; status: string | null };

const RPE = ["", "Très facile", "Facile", "Facile", "Moyen", "Moyen", "Dur", "Dur", "Très dur", "Très dur", "À fond"];
const RPE_COUL = ["", "#10b981", "#10b981", "#34d399", "#a3e635", "#facc15", "#fbbf24", "#fb923c", "#f97316", "#f43f5e", "#be123c"];
const CIEL_PRET = ["#2563eb", "#0ea5e9", "#38bdf8"], CIEL_ATTENTE = ["#475569", "#64748b", "#94a3b8"];

// Où en est-on dans le dessin de la séance (les étapes « lap » peuvent déborder).
const position = (etapes: Etape[], e: Etat) => etapes.slice(0, e.i).reduce((a, x) => a + x.s, 0) + Math.min(e.tEtape, e.etape?.s ?? 0);
const cibleTexte = (e: Etape, ajust = 1) => e.cible.type === "w" ? `${Math.round(((e.cible.min + e.cible.max) / 2) * ajust)} W` : e.cible.type === "bpm" ? `${e.cible.min} bpm` : "libre";

function versBase64(o: Uint8Array) {
  let s = "";
  for (let i = 0; i < o.length; i += 0x8000) s += String.fromCharCode(...o.subarray(i, i + 0x8000));
  return btoa(s);
}

// Hors du composant : recréés à chaque image (4 par seconde), les boutons perdraient des clics.
const Mesure = ({ titre, icone, coul, children, unite, classe = "" }: { titre: string; icone: string; coul?: string; children: React.ReactNode; unite?: string; classe?: string }) => (
  <Carte className={classe}>
    <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400"><Icone d={icone} taille={15} coul={coul ?? "#94a3b8"} />{titre}</div>
    <div className="flex items-baseline gap-1 mt-0.5"><span className="text-[44px] font-black text-slate-800 tabular-nums leading-tight">{children}</span>{unite && <span className="text-[13px] font-extrabold text-slate-400">{unite}</span>}</div>
  </Carte>
);
const Rond = ({ onClick, d, titre, grand, couleurs }: { onClick: () => void; d: string; titre: string; grand?: boolean; couleurs?: readonly string[] }) => (
  <button type="button" title={titre} onClick={onClick}
    className={`${grand ? "w-20 h-20 text-white" : "w-14 h-14 bg-white border border-[#eef2f7] text-slate-800 hover:bg-slate-50"} rounded-full flex items-center justify-center transition active:scale-95`}
    style={grand && couleurs ? { backgroundImage: `linear-gradient(135deg, ${couleurs.join(", ")})`, boxShadow: `0 6px 18px ${couleurs[0]}66` } : { boxShadow: "0 3px 10px rgba(100,116,139,0.12)" }}>
    <Icone d={d} taille={grand ? 40 : 26} />
  </button>
);
const Moyennes = ({ titre, icone, m, classe = "" }: { titre: string; icone: string; m: MoyennesT | null; classe?: string }) => (
  <Carte className={classe}>
    <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400"><Icone d={icone} taille={15} coul="#94a3b8" />{titre}{m?.s ? <span className="normal-case tracking-normal font-bold"> · {chrono(m.s)}</span> : null}</div>
    <div className="text-[34px] font-black text-slate-800 tabular-nums leading-tight">{m?.w ?? "—"} <span className="text-[14px] text-slate-400">W moy.</span></div>
    <div className="text-[13px] font-extrabold text-slate-500 tabular-nums">{m?.bpm ?? "—"} bpm · {m?.cad ?? "—"} tr/min</div>
  </Carte>
);
const Vide = ({ icone, children }: { icone: string; children: React.ReactNode }) => (
  <div className="flex flex-col items-center gap-1.5 py-6 text-center"><Icone d={icone} taille={34} coul="#cbd5e1" /><p className="font-bold text-slate-500">{children}</p></div>
);

function HomeTrainer() {
  const router = useRouter();
  const params = useSearchParams();
  const simu = params.get("simu") === "1";
  const [moi, setMoi] = useState<string | null>(null);
  const [ftp, setFtp] = useState<number>(200);
  const [ftpConnue, setFtpConnue] = useState(true);
  const [profil, setProfil] = useState<Omit<ProfilCycliste, "ftp">>({});
  const [ecranPlein, setEcranPlein] = useState(false);
  const [seances, setSeances] = useState<SeanceDb[]>([]);
  const [favoris, setFavoris] = useState<{ id: string; nom: string; texte: string }[]>([]);
  const [onglet, setOnglet] = useState<"plan" | "main" | "favoris" | "libre">("plan");
  const [texte, setTexte] = useState("10' 150W, 5x(4' 300W / 3' 150W), 10' 140W");
  const [choix, setChoix] = useState<Choix | null>(null);
  const [capteurs, setCapteurs] = useState<Record<Source, EtatCapteur>>({ ht: null, pedales: null, cardio: null, guidon: null });
  const [erreurBt, setErreurBt] = useState<string | null>(null);
  const [phase, setPhase] = useState<"preparer" | "rouler" | "fin">("preparer");
  const [etat, setEtat] = useState<Etat | null>(null);
  const [fenetre, setFenetre] = useState<Window | null>(null);
  const [rpe, setRpe] = useState(5);
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
        supabase.from("athlete_metrics").select("ftp_w").eq("user_id", id).maybeSingle(),
        supabase.from("sessions").select("id, date, title, workout_text, planned_hour, status").eq("user_id", id).eq("sport", "Vélo")
          .gte("date", dayjs().subtract(1, "day").format("YYYY-MM-DD")).lte("date", dayjs().add(6, "day").format("YYYY-MM-DD")).order("date"),
        supabase.from("ht_favoris").select("id, nom, texte").order("cree_le", { ascending: false }),
        // Le profil du cycliste : poids (W/kg) et puissance critique + réserve (jauge)
        supabase.from("profil_physique").select("poids_kg").eq("user_id", id).maybeSingle(),
        supabase.from("vitesse_critique").select("cs, d_prime").eq("user_id", id).eq("sport", "velo").order("jour", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (am?.ftp_w) setFtp(Number(am.ftp_w)); else setFtpConnue(false);
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
    })();
  }, [router]);

  // ─── Capteurs ───
  const ecoute = useCallback((src: Source, m: { watts?: number; cadence?: number; vitesse?: number; bpm?: number; rr?: number[] }) => {
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
    cap.current[src] = c;
    return c;
  }, [ecoute]);

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
    moteur.current = new Moteur(c.blocs, { ftp, ...profil });
    setPhase("rouler");
    setEnvoi({ etat: "rien" }); setFavoriOk(false); setFavoriNom("");
    if (simu) { sim.current = new Simulateur(ecoute); sim.current.demarrer(); }
    try { verrou.current = await (navigator as any).wakeLock?.request("screen"); } catch { /* pas grave */ } // eslint-disable-line @typescript-eslint/no-explicit-any
  };

  useEffect(() => {
    if (phase !== "rouler") return;
    const h = setInterval(() => {
      const m = moteur.current;
      if (!m) return;
      const e = m.tic(Date.now());
      setEtat(e);
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

  // ─── Fin ───
  const enregistrer = async () => {
    const m = moteur.current;
    if (!m || !moi || !choix) return;
    if (m.points.length < 30) { setEnvoi({ etat: "erreur", texte: "Moins de 30 secondes enregistrées : rien à envoyer." }); return; }
    setEnvoi({ etat: "en_cours", texte: "J'enregistre la séance…" });
    try {
      let sessionId = choix.sessionId;
      if (sessionId) {
        await supabase.from("sessions").update({ status: "valide", rpe }).eq("id", sessionId);
      } else {
        const { data, error } = await supabase.from("sessions").insert({
          user_id: moi, date: dayjs().format("YYYY-MM-DD"), sport: "Vélo", title: choix.titre,
          planned_hour: Math.round(((dureeTotale(choix.blocs) || m.points.length) / 3600) * 100) / 100,
          workout_text: choix.blocs.length ? versIcu(choix.blocs) : null, workout_target: choix.blocs.length ? "POWER" : null,
          status: "valide", rpe,
        }).select("id").single();
        if (error) throw new Error(error.message);
        sessionId = data.id;
        setChoix({ ...choix, sessionId });
      }
      setEnvoi({ etat: "en_cours", texte: "J'envoie sur Strava…" });
      const fit = fichierFit(m.points, m.tours, m.rr);
      const bravo = compliment(m.points, m.tours, m.etapes, ftp, m.bouclee);
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

  // ─────────────────────────── Rouler ───────────────────────────
  // Tout l'écran (31/10, Martin) : la puissance 3 s en très gros, l'étape,
  // le cœur et la cadence, puis les moyennes du tour, du tour d'avant et de
  // la séance, la réserve, et la séance dessinée avec les vrais watts.
  if (phase === "rouler" && etat && choix) {
    const z = etat.pause !== "non" ? ZONE_PAUSE : zoneEtape(etat.etape, ftp);
    const ec = ecart(etat.w3s, etat.cible);
    const partEtape = etat.etape && etat.etape.s ? Math.min(1, etat.tEtape / etat.etape.s) : 0;
    const wkg = profil.poids && etat.w3s != null ? (etat.w3s / profil.poids).toFixed(1).replace(".", ",") : null;
    // Le dessin prend la hauteur qui reste sur un grand écran
    const hauteurProfil = typeof window !== "undefined" ? Math.max(120, Math.min(300, window.innerHeight - 830)) : 130;
    const perdus = (["ht", "cardio", "pedales"] as Source[]).filter((x) => !simu && capteurs[x] && !capteurs[x]!.connecte);
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
              <span className="flex-1 font-extrabold text-sm">{x === "ht" ? "Home-trainer perdu : continue de pédaler, je le rebranche tout seul." : x === "cardio" ? "Ceinture cardio perdue, je la rebranche…" : "Pédales perdues, je les rebranche…"}</span>
              <button type="button" onClick={() => connecter(x)} className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-amber-900">Choisir à nouveau</button>
            </div>
          ))}
          {(etat.alerte || etat.pause !== "non") && (
            <div className={`flex items-center gap-2 rounded-2xl px-4 py-3 font-extrabold ${etat.alerte ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"}`}>
              <Icone d={etat.alerte ? mdiAlertCircle : mdiPauseCircle} taille={20} />
              {etat.alerte ?? (etat.pause === "auto" ? "En pause : repédale pour reprendre" : "Prêt ? Pédale pour démarrer")}
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-12 gap-3">
            <Ciel couleurs={z.degrade} icone={mdiLightningBolt} className="col-span-2 lg:col-span-6 lg:row-span-2 !p-6 flex flex-col justify-center">
              <div className="flex items-center gap-2 flex-wrap">
                <Sur>{z.mot} · 3 s</Sur>
                {etat.erg && etat.ajust !== 1 && <Bulle icone={mdiTuneVariant} texte={`${Math.round(etat.ajust * 100)} %`} />}
                {!etat.erg && <Bulle icone={mdiSlopeUphill} texte={`Pente ${etat.pente} %`} />}
              </div>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="text-[96px] lg:text-[150px] font-black tabular-nums leading-none tracking-tight">{etat.w3s ?? "—"}</span>
                <span className="text-2xl lg:text-4xl font-black text-white/85">/ {etat.cible ?? "—"} W</span>
              </div>
              <div className="flex gap-2 mt-3 flex-wrap min-h-[32px]">
                {ec && <Bulle icone={ec.bon ? mdiCheckCircle : mdiTarget} texte={ec.texte} fort={ec.bon} />}
                {wkg && <Bulle icone={mdiScaleBathroom} texte={`${wkg} W/kg`} />}
                {etat.etape?.cadence ? <Bulle icone={mdiRotateRight} texte={`Vise ${etat.etape.cadence} tr/min`} /> : null}
              </div>
            </Ciel>
            <Mesure titre="Cadence" icone={mdiRotateRight} unite="tr/min" classe="lg:col-span-3">{etat.cadence ?? "—"}</Mesure>
            <Mesure titre="Cœur" icone={mdiHeart} coul="#f43f5e" unite="bpm" classe="lg:col-span-3">{etat.bpm ?? "—"}</Mesure>
            <Carte className="col-span-2 lg:col-span-6 flex items-center gap-4">
              <div className="relative flex items-center justify-center shrink-0">
                <Anneau part={partEtape} coul={z.plein} taille={76} />
                <span className="absolute text-xs font-black text-slate-800">{etapes.length ? `${Math.min(etat.i + 1, etapes.length)}/${etapes.length}` : "∞"}</span>
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">{etat.attendLap ? "Quand tu es prêt" : etapes.length ? "Fin de l'étape dans" : "Sortie libre"}</div>
                <div className="text-[44px] font-black text-slate-800 tabular-nums leading-tight">{etat.attendLap ? "⏭" : chrono(etat.resteEtape ?? etat.tEtape)}</div>
                <div className="text-[14px] font-bold text-slate-500 truncate">{etat.suivante ? `Ensuite : ${chrono(etat.suivante.s)} à ${cibleTexte(etat.suivante, etat.ajust)}` : etapes.length ? "Dernière étape 💪" : `${etat.seance.km.toFixed(1)} km`}</div>
              </div>
            </Carte>

            <Moyennes titre="Ce tour" icone={mdiFlagVariantOutline} m={etat.tour} classe="lg:col-span-3" />
            <Moyennes titre="Tour d'avant" icone={mdiHistory} m={etat.tourPrec} classe="lg:col-span-3" />
            <Carte className="lg:col-span-3">
              <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400"><Icone d={mdiBatteryHigh} taille={15} coul="#94a3b8" />Ma réserve</div>
              {etat.reserve != null ? (
                <>
                  <div className="text-[34px] font-black text-slate-800 tabular-nums leading-tight">{Math.round(etat.reserve * 100)} %</div>
                  <div className="h-3 rounded-full bg-slate-100 overflow-hidden mt-1">
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${etat.reserve * 100}%`, background: etat.reserve > 0.5 ? "#10b981" : etat.reserve > 0.2 ? "#f59e0b" : "#f43f5e" }} />
                  </div>
                  <div className="text-[12px] font-bold text-slate-400 mt-1">Au-dessus de {Math.round(profil.cp ?? 0)} W, elle se vide</div>
                </>
              ) : <div className="text-[13px] font-bold text-slate-400 mt-2">Il faut quelques efforts à fond pour la connaître.</div>}
            </Carte>
            <Carte className="lg:col-span-3">
              <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400"><Icone d={mdiSigma} taille={15} coul="#94a3b8" />La séance</div>
              <div className="text-[34px] font-black text-slate-800 tabular-nums leading-tight">{etat.seance.w ?? "—"} <span className="text-[14px] text-slate-400">W moy.</span></div>
              <div className="text-[13px] font-extrabold text-slate-500 tabular-nums">{etat.seance.kj} kJ · {etat.seance.km.toFixed(1)} km</div>
            </Carte>
          </div>

          {etapes.length > 0 && <Carte className="!p-3"><Profil etapes={etapes} ftp={ftp} ecoule={position(etapes, etat)} hauteur={hauteurProfil} trace={moteur.current?.points} /></Carte>}

          <div className="flex items-center justify-center gap-3 lg:gap-4 pt-1">
            <Rond titre="Moins dur" d={mdiMinus} onClick={actions.moins} />
            <Rond titre="Précédent" d={mdiSkipPrevious} onClick={actions.precedente} />
            <Rond grand couleurs={z.degrade} titre="Pause" d={etat.pause === "non" ? mdiPause : mdiPlay} onClick={actions.pause} />
            <Rond titre="Suivant" d={mdiSkipNext} onClick={actions.suivante} />
            <Rond titre="Plus dur" d={mdiPlus} onClick={actions.plus} />
          </div>
          <div className="flex items-center justify-center gap-2.5">
            {etapes.length > 0 && <button type="button" onClick={() => moteur.current?.basculerErg()} className="rounded-full bg-white border border-[#eef2f7] px-4 py-2.5 text-sm font-extrabold text-slate-700 hover:bg-slate-50">{etat.erg ? "Passer en résistance" : "Repasser en ERG"}</button>}
            <button type="button" onClick={() => { if (confirm("Terminer la séance ?")) actions.terminer(); }} className="flex items-center gap-1.5 rounded-full bg-rose-50 px-4 py-2.5 text-sm font-black text-rose-600 hover:bg-rose-100"><Icone d={mdiFlagCheckered} taille={16} /> Terminer</button>
          </div>
          <p className="text-center text-xs text-slate-400 hidden md:block">Clavier : espace = pause · ← → = étapes · ↑ ↓ = plus ou moins dur</p>
        </div>
        {fenetre && <Bandeau fenetre={fenetre} etat={etat} etapes={etapes} ftp={ftp} position={position(etapes, etat)} police={jakarta.style.fontFamily} perdu={!simu && capteurs.ht && !capteurs.ht.connecte ? "Home-trainer perdu, je le rebranche…" : null} actions={actions} onFermer={() => { fenetre.close(); window.focus(); }} />}
      </main>
    );
  }

  // ─────────────────────────── Fin ───────────────────────────
  if (phase === "fin" && moteur.current && choix) {
    const pts = moteur.current.points;
    const moy = (k: "w" | "bpm") => { const v = pts.map((p) => p[k]).filter((x): x is number => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : "—"; };
    const km = pts.length ? (pts[pts.length - 1].m / 1000).toFixed(1) : "0";
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
            </div>
          </Ciel>

          {envoi.etat !== "ok" && (
            <Carte className="space-y-3">
              <div className="flex justify-between items-baseline"><span className="font-black text-slate-800 text-base">C&apos;était comment ?</span><span className="font-black" style={{ color: RPE_COUL[rpe] }}>{RPE[rpe]}</span></div>
              <div className="flex gap-1.5">
                {Array.from({ length: 10 }, (_, k) => k + 1).map((n) => (
                  <button key={n} type="button" onClick={() => setRpe(n)} className="flex-1 h-11 rounded-xl font-black transition"
                    style={{ background: n === rpe ? RPE_COUL[n] : n < rpe ? RPE_COUL[n] + "33" : "#f1f5f9", color: n === rpe ? "#fff" : "#64748b" }}>{n}</button>
                ))}
              </div>
            </Carte>
          )}

          {envoi.texte && (
            <div className={`flex items-center gap-2 rounded-2xl px-4 py-3.5 font-extrabold ${envoi.etat === "erreur" ? "bg-rose-50 text-rose-700" : envoi.etat === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
              {envoi.etat === "en_cours" ? <span className="w-5 h-5 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" /> : <Icone d={envoi.etat === "ok" ? mdiCheckCircle : mdiAlertCircle} taille={20} />}
              {envoi.texte}
            </div>
          )}

          {envoi.etat !== "ok"
            ? <Bouton large desactive={envoi.etat === "en_cours"} onClick={enregistrer} icone={mdiCloudUploadOutline} couleur="#fc4c02">Enregistrer et envoyer sur Strava</Bouton>
            : <Bouton large onClick={() => router.push("/athlete")} icone={mdiCalendarMonth}>Retour au planning</Bouton>}
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

  return (
    <main className={fond}>
      <div className="max-w-[1600px] mx-auto lg:px-4 grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-x-8 gap-y-3.5 items-start">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-1.5">
            <a href="/athlete" className="-ml-1 p-1 text-slate-800"><Icone d={mdiChevronLeft} taille={28} /></a>
            <h1 className="text-2xl font-extrabold text-slate-800">Home-trainer</h1>
            {simu && <span className="ml-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-extrabold text-violet-700">simulateur</span>}
          </div>
          <p className="text-sm text-slate-500">Tes séances sur ton vélo, sans le superflu</p>
        </div>

        <div className="space-y-3.5 lg:sticky lg:top-6">
        {!bluetoothDispo() && !simu ? (
          <Ciel couleurs={CIEL_ATTENTE} icone={mdiBike}>
            <Sur>Mon matériel</Sur>
            <div className="text-[26px] font-black mt-1.5 max-w-[72%]">Il faut Chrome</div>
            <p className="font-semibold mt-1.5 max-w-[78%] leading-snug">Le Bluetooth marche dans Chrome (ou Edge) sur ordinateur. Sous Linux : ouvre <code className="rounded bg-white/25 px-1">chrome://flags</code>, active « Experimental Web Platform features », puis relance Chrome.</p>
          </Ciel>
        ) : (
          <Ciel couleurs={pret ? CIEL_PRET : CIEL_ATTENTE} icone={mdiBikeFast}>
            <Sur>Mon matériel</Sur>
            <div className="text-[28px] font-black mt-1.5 max-w-[72%]">{pret ? "Prêt à rouler" : "On branche le vélo ?"}</div>
            <p className="font-semibold mt-1 max-w-[75%]">{simu ? "Faux home-trainer : il suit la consigne tout seul." : pret ? `${connectes.length} appareil${connectes.length > 1 ? "s" : ""} connecté${connectes.length > 1 ? "s" : ""}` : "Clique sur « Home-trainer » pour le connecter."}</p>
            {!simu && (
              <div className="flex flex-wrap gap-2 mt-4">
                {puce("ht", "Home-trainer", mdiBike)}
                {puce("cardio", "Cardio", mdiHeartPulse)}
                {puce("pedales", "Pédales", mdiLightningBolt)}
                {puce("guidon", "Guidon Zwift", mdiGamepadVariantOutline)}
              </div>
            )}
            {erreurBt && <p className="mt-2 text-xs font-bold text-white/90">{erreurBt}</p>}
            {!ftpConnue && (
              <div className="flex items-center gap-2 mt-3 font-bold">
                Ta FTP <input type="number" value={ftp} onChange={(e) => setFtp(Math.max(80, Number(e.target.value) || 200))} className="w-20 rounded-lg bg-white px-2 py-1 font-black text-slate-800" /> W
              </div>
            )}
          </Ciel>
        )}

        </div>
        <div className="space-y-3.5">
        <Titre>Ma séance</Titre>
        <Onglets valeur={onglet} onChange={setOnglet} choix={[["plan", "Planning"], ["main", "À la main"], ["favoris", "Favoris"], ["libre", "Libre"]] as const} />

        {onglet === "plan" && (seances.length === 0 ? <Vide icone={mdiCalendarBlankOutline}>Pas de séance vélo cette semaine.<br />Fais-en une à la main !</Vide> : (
          <div className="space-y-2.5">
            {seances.map((s) => {
              const blocs = s.workout_text ? depuisIcu(s.workout_text, ftp) : [];
              const auj = s.date === dayjs().format("YYYY-MM-DD");
              return (
                <Carte key={s.id} className={`space-y-2.5 ${auj ? "!border-2 !border-blue-200" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className={`text-[11px] font-extrabold uppercase tracking-[0.12em] ${auj ? "text-blue-600" : "text-slate-400"}`}>{auj ? "Aujourd'hui" : dayjs(s.date).format("dddd D MMM")}{s.status === "valide" ? " · faite ✓" : ""}</div>
                      <div className="font-black text-slate-800 text-base truncate mt-0.5">{s.title || "Vélo"}</div>
                      <div className="text-[13px] font-semibold text-slate-500">{blocs.length ? `${Math.round(dureeTotale(blocs) / 60)} min` : "Pas d'étapes : sortie en résistance"}</div>
                    </div>
                    <Bouton petit desactive={!pret} icone={mdiPlay} onClick={() => demarrer({ titre: s.title || "Vélo", blocs, sessionId: s.id, texteCourt: null })}>Go</Bouton>
                  </div>
                  {blocs.length > 0 && profilDe(blocs, ftp, 40)}
                </Carte>
              );
            })}
          </div>
        ))}

        {onglet === "main" && (
          <div className="space-y-3">
            <Editeur texte={texte} setTexte={setTexte} ftp={ftp} />
            {lecture.blocs.length > 0 && <Bouton large desactive={!pret} icone={mdiPlay} onClick={() => demarrer({ titre: "Séance maison", blocs: lecture.blocs, sessionId: null, texteCourt: versCourt(lecture.blocs) })}>C&apos;est parti</Bouton>}
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

        {onglet === "libre" && (
          <Carte className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-[38px] h-[38px] rounded-xl bg-teal-100 flex items-center justify-center shrink-0"><Icone d={mdiRoadVariant} taille={20} coul="#0f766e" /></div>
              <p className="font-bold text-slate-800">Pas de séance : tu roules comme tu veux, les boutons − et + règlent la résistance.</p>
            </div>
            <Bouton large desactive={!pret} icone={mdiPlay} couleur="#0f766e" onClick={() => demarrer({ titre: "Sortie libre", blocs: [], sessionId: null, texteCourt: null })}>C&apos;est parti</Bouton>
          </Carte>
        )}
        </div>
      </div>
    </main>
  );
}

export default function Page() {
  return <Suspense fallback={null}><HomeTrainer /></Suspense>;
}
