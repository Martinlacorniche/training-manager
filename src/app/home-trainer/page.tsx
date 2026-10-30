"use client";
// ─────────────────────────────────────────────────────────────────────────
// Home-trainer (30/10/2026) — remplace Zwift/MyWhoosh pour ce qui sert :
// piloter le home-trainer en ERG sur les séances du coach ou faites à la
// main, un bandeau flottant à poser à côté d'un film, et l'activité sur
// Strava à la fin. Pas de monde virtuel.
// Pendant de l'app : App-Coach/app/home-trainer.tsx. La logique (séances,
// Bluetooth, moteur, .fit) est partagée : ./ht/*.ts.
// ─────────────────────────────────────────────────────────────────────────
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import "dayjs/locale/fr";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ArrowLeft, Bicycle, Heartbeat, Lightning, PictureInPicture, Play, Pause, SkipBack, SkipForward, Stop, Minus, Plus, Star, DownloadSimple, CheckCircle, Warning } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabaseClient";
import { depuisCourt, depuisIcu, versCourt, versIcu, aplatir, dureeTotale, type Bloc, type Etape } from "./ht/seance";
import { Moteur, type Etat } from "./ht/moteur";
import { fichierFit } from "./ht/fit";
import { Capteur, Simulateur, bluetoothDispo, type EtatCapteur, type Source } from "./capteurs";
import { Profil } from "./Profil";
import { Editeur } from "./Editeur";
import { Bandeau, bandeauDispo, chrono, ouvrirFenetre, type Actions } from "./Bandeau";

dayjs.locale("fr");
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["500", "600", "700", "800"], display: "swap" });

type Choix = { titre: string; blocs: Bloc[]; sessionId: string | null; texteCourt: string | null };
type SeanceDb = { id: string; date: string; title: string | null; workout_text: string | null; planned_hour: number | null; status: string | null };

const RPE = ["", "Très facile", "Facile", "Facile", "Moyen", "Moyen", "Dur", "Dur", "Très dur", "Très dur", "À fond"];

// Où en est-on dans le dessin de la séance (les étapes « lap » peuvent déborder).
const position = (etapes: Etape[], e: Etat) => etapes.slice(0, e.i).reduce((a, x) => a + x.s, 0) + Math.min(e.tEtape, e.etape?.s ?? 0);

function versBase64(o: Uint8Array) {
  let s = "";
  for (let i = 0; i < o.length; i += 0x8000) s += String.fromCharCode(...o.subarray(i, i + 0x8000));
  return btoa(s);
}

// Hors du composant : recréés à chaque image (4 par seconde), les boutons
// perdraient des clics.
const Gros = ({ titre, children, sous, icone }: { titre: string; children: React.ReactNode; sous?: React.ReactNode; icone?: React.ReactNode }) => (
  <div className="rounded-3xl bg-white/5 p-5 flex flex-col">
    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">{icone}{titre}</span>
    <span className="text-5xl md:text-6xl font-black text-white tabular-nums mt-1">{children}</span>
    {sous && <span className="text-sm text-slate-400 font-semibold mt-1">{sous}</span>}
  </div>
);
const B = ({ onClick, children, titre, grand }: { onClick: () => void; children: React.ReactNode; titre: string; grand?: boolean }) => (
  <button type="button" title={titre} onClick={onClick} className={`${grand ? "w-20 h-20 bg-emerald-500 hover:bg-emerald-400" : "w-14 h-14 bg-white/10 hover:bg-white/20"} rounded-full flex items-center justify-center text-white`}>{children}</button>
);

function HomeTrainer() {
  const router = useRouter();
  const params = useSearchParams();
  const simu = params.get("simu") === "1";
  const [moi, setMoi] = useState<string | null>(null);
  const [ftp, setFtp] = useState<number>(200);
  const [ftpConnue, setFtpConnue] = useState(true);
  const [seances, setSeances] = useState<SeanceDb[]>([]);
  const [favoris, setFavoris] = useState<{ id: string; nom: string; texte: string }[]>([]);
  const [onglet, setOnglet] = useState<"plan" | "main" | "favoris" | "libre">("plan");
  const [texte, setTexte] = useState("10' 150W, 5x(4' 300W / 3' 150W), 10' 140W");
  const [choix, setChoix] = useState<Choix | null>(null);
  const [capteurs, setCapteurs] = useState<Record<Source, EtatCapteur>>({ ht: null, pedales: null, cardio: null });
  const [erreurBt, setErreurBt] = useState<string | null>(null);
  const [phase, setPhase] = useState<"preparer" | "rouler" | "fin">("preparer");
  const [etat, setEtat] = useState<Etat | null>(null);
  const [fenetre, setFenetre] = useState<Window | null>(null);
  const [rpe, setRpe] = useState(5);
  const [envoi, setEnvoi] = useState<{ etat: "rien" | "en_cours" | "ok" | "erreur"; texte?: string }>({ etat: "rien" });
  const [favoriNom, setFavoriNom] = useState("");
  const [favoriOk, setFavoriOk] = useState(false);

  const moteur = useRef<Moteur | null>(null);
  const cap = useRef<Record<Source, Capteur | null>>({ ht: null, pedales: null, cardio: null });
  const sim = useRef<Simulateur | null>(null);
  const verrou = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any

  // ─── Chargement ───
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      const id = session.user.id;
      setMoi(id);
      const [{ data: am }, { data: ss }, { data: fav }] = await Promise.all([
        supabase.from("athlete_metrics").select("ftp_w").eq("user_id", id).maybeSingle(),
        supabase.from("sessions").select("id, date, title, workout_text, planned_hour, status").eq("user_id", id).eq("sport", "Vélo")
          .gte("date", dayjs().subtract(1, "day").format("YYYY-MM-DD")).lte("date", dayjs().add(6, "day").format("YYYY-MM-DD")).order("date"),
        supabase.from("ht_favoris").select("id, nom, texte").order("cree_le", { ascending: false }),
      ]);
      if (am?.ftp_w) setFtp(Number(am.ftp_w)); else setFtpConnue(false);
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
  const ecoute = useCallback((src: Source, m: { watts?: number; cadence?: number; vitesse?: number; bpm?: number }) => {
    moteur.current?.mesurer(src, m, Date.now());
  }, []);

  const connecter = async (src: Source) => {
    setErreurBt(null);
    try {
      cap.current[src]?.oublier();
      const c = new Capteur(src, ecoute);
      c.onEtat = (e) => setCapteurs((x) => ({ ...x, [src]: e }));
      cap.current[src] = c;
      await c.choisir();
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (!/cancel/i.test(msg)) setErreurBt(msg || "Connexion impossible");
    }
  };

  // ─── Rouler ───
  const demarrer = async (c: Choix) => {
    setChoix(c);
    moteur.current = new Moteur(c.blocs, ftp);
    setPhase("rouler");
    setEnvoi({ etat: "rien" });
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
      const heures = Math.round((m.points.length / 3600) * 100) / 100;
      let sessionId = choix.sessionId;
      if (sessionId) {
        await supabase.from("sessions").update({ status: "valide", rpe }).eq("id", sessionId);
      } else {
        const { data, error } = await supabase.from("sessions").insert({
          user_id: moi, date: dayjs().format("YYYY-MM-DD"), sport: "Vélo", title: choix.titre,
          planned_hour: Math.round((dureeTotale(choix.blocs) / 3600) * 100) / 100 || heures,
          workout_text: choix.blocs.length ? versIcu(choix.blocs) : null, workout_target: choix.blocs.length ? "POWER" : null,
          status: "valide", rpe,
        }).select("id").single();
        if (error) throw new Error(error.message);
        sessionId = data.id;
        setChoix({ ...choix, sessionId });
      }
      setEnvoi({ etat: "en_cours", texte: "J'envoie sur Strava…" });
      const fit = fichierFit(m.points, m.tours);
      const { data: r, error } = await supabase.functions.invoke("ht-envoi", { body: { fit: versBase64(fit), session_id: sessionId } });
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
    const url = URL.createObjectURL(new Blob([fichierFit(m.points, m.tours) as BlobPart], { type: "application/octet-stream" }));
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

  // ─────────────────────────── Écrans ───────────────────────────

  if (phase === "rouler" && etat && choix) {
    const ecart = etat.cible && etat.watts != null ? etat.watts - etat.cible : 0;
    const coul = !etat.cible || etat.watts == null ? "text-white" : Math.abs(ecart) <= etat.cible * 0.05 ? "text-emerald-400" : ecart > 0 ? "text-orange-400" : "text-sky-400";
    return (
      <main className={`${jakarta.className} min-h-screen bg-[#0b1220] text-white px-4 py-6`}>
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-extrabold">{choix.titre}</h1>
            {bandeauDispo() && !fenetre && (
              <button type="button" onClick={ouvrirBandeau} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 font-bold text-sm">
                <PictureInPicture size={18} /> Mode bandeau
              </button>
            )}
          </div>
          {(etat.alerte || etat.pause !== "non") && (
            <div className={`mb-4 rounded-2xl px-4 py-3 font-bold text-center ${etat.alerte ? "bg-amber-400 text-slate-900" : "bg-sky-500"}`}>
              {etat.alerte ?? (etat.pause === "auto" ? "En pause — repédale pour reprendre" : "Prêt ? Pédale pour démarrer")}
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-3xl bg-white/5 p-5 col-span-2 flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Lightning size={14} weight="fill" />Puissance</span>
              <div className="flex items-baseline gap-3 mt-1">
                <span className={`text-7xl md:text-8xl font-black tabular-nums ${coul}`}>{etat.watts ?? "—"}</span>
                <span className="text-2xl text-slate-400 font-bold">/ {etat.cible ?? "—"} W</span>
              </div>
              <span className="text-sm text-slate-400 font-semibold mt-1">{etat.erg ? `ERG · intensité ${Math.round(etat.ajust * 100)} %` : `Résistance · pente ${etat.pente} %`}</span>
            </div>
            <Gros titre="Cadence" icone={<Bicycle size={14} />} sous="tr/min">{etat.cadence ?? "—"}</Gros>
            <Gros titre="Cœur" icone={<Heartbeat size={14} weight="fill" />} sous="bpm">{etat.bpm ?? "—"}</Gros>
            <Gros titre="Étape" sous={etat.suivante ? `puis ${etat.suivante.cible.type === "w" ? `${Math.round((etat.suivante.cible.min + etat.suivante.cible.max) / 2 * etat.ajust)} W` : etat.suivante.cible.type === "bpm" ? `${etat.suivante.cible.min} bpm` : "libre"} · ${chrono(etat.suivante.s)}` : etapes.length ? "dernière étape" : "sortie libre"}>
              {etat.attendLap ? "⏭" : chrono(etat.resteEtape ?? etat.tEtape)}
            </Gros>
            <Gros titre="Total" sous={etat.dureeTotale ? `sur ${chrono(etat.dureeTotale)}` : undefined}>{chrono(etat.tTotal)}</Gros>
            <Gros titre="Étapes" sous="faites">{etapes.length ? `${Math.min(etat.i + 1, etapes.length)}/${etapes.length}` : "—"}</Gros>
            <Gros titre="Distance" sous="km">{moteur.current?.points.length ? ((moteur.current.points[moteur.current.points.length - 1].m) / 1000).toFixed(1) : "0.0"}</Gros>
          </div>
          {etapes.length > 0 && <div className="mt-4 rounded-2xl overflow-hidden bg-white/5 p-2"><Profil etapes={etapes} ftp={ftp} ecoule={position(etapes, etat)} hauteur={90} sombre /></div>}
          <div className="mt-6 flex items-center justify-center gap-4">
            <B titre="Moins dur" onClick={actions.moins}><Minus size={22} weight="bold" /></B>
            <B titre="Précédent" onClick={actions.precedente}><SkipBack size={24} weight="fill" /></B>
            <B titre="Pause" grand onClick={actions.pause}>{etat.pause === "non" ? <Pause size={34} weight="fill" /> : <Play size={34} weight="fill" />}</B>
            <B titre="Suivant" onClick={actions.suivante}><SkipForward size={24} weight="fill" /></B>
            <B titre="Plus dur" onClick={actions.plus}><Plus size={22} weight="bold" /></B>
          </div>
          <div className="mt-6 flex items-center justify-center gap-3">
            {etapes.length > 0 && <button type="button" onClick={() => moteur.current?.basculerErg()} className="px-4 py-2 rounded-xl bg-white/10 text-sm font-bold">{etat.erg ? "Passer en résistance" : "Repasser en ERG"}</button>}
            <button type="button" onClick={() => { if (confirm("Terminer la séance ?")) actions.terminer(); }} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-bold"><Stop size={16} weight="fill" /> Terminer</button>
          </div>
          {!simu && !capteurs.ht?.connecte && <p className="mt-4 text-center text-amber-300 text-sm font-bold">Home-trainer déconnecté, je réessaie…</p>}
        </div>
        {fenetre && <Bandeau fenetre={fenetre} etat={etat} etapes={etapes} ftp={ftp} position={position(etapes, etat)} actions={actions} onFermer={() => { fenetre.close(); window.focus(); }} />}
      </main>
    );
  }

  if (phase === "fin" && moteur.current && choix) {
    const pts = moteur.current.points;
    const moy = (k: "w" | "bpm" | "cad") => { const v = pts.map((p) => p[k]).filter((x): x is number => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
    return (
      <main className={`${jakarta.className} min-h-screen bg-gradient-to-br from-emerald-400 via-blue-400 to-blue-600 px-4 py-10`}>
        <div className="max-w-xl mx-auto bg-white rounded-3xl shadow-2xl p-6 md:p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800">Bien joué 💪</h1>
            <p className="text-slate-500">{choix.titre}</p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[["Durée", chrono(pts.length)], ["Watts", moy("w") ?? "—"], ["Cœur", moy("bpm") ?? "—"]].map(([t, v]) => (
              <div key={t} className="rounded-2xl bg-slate-50 py-3"><div className="text-xs font-bold text-slate-400 uppercase">{t}</div><div className="text-2xl font-black text-slate-800">{v}</div></div>
            ))}
          </div>
          {envoi.etat !== "ok" && (
            <div>
              <div className="flex justify-between items-baseline"><span className="font-bold text-slate-700">C&apos;était comment ?</span><span className="text-sm font-bold text-emerald-600">{rpe}/10 · {RPE[rpe]}</span></div>
              <input type="range" min={1} max={10} value={rpe} onChange={(e) => setRpe(Number(e.target.value))} className="w-full mt-2 accent-emerald-500" />
            </div>
          )}
          {envoi.texte && (
            <div className={`rounded-2xl px-4 py-3 text-sm font-semibold flex items-start gap-2 ${envoi.etat === "erreur" ? "bg-rose-50 text-rose-700" : envoi.etat === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-600"}`}>
              {envoi.etat === "ok" ? <CheckCircle size={18} weight="fill" /> : envoi.etat === "erreur" ? <Warning size={18} weight="fill" /> : null}{envoi.texte}
            </div>
          )}
          <div className="flex flex-col gap-2">
            {envoi.etat !== "ok" && <button type="button" disabled={envoi.etat === "en_cours"} onClick={enregistrer} className="py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white font-extrabold">Enregistrer et envoyer sur Strava</button>}
            <button type="button" onClick={telecharger} className="py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center gap-2"><DownloadSimple size={18} /> Télécharger le fichier</button>
            {envoi.etat === "ok" && <a href="/athlete" className="py-2.5 rounded-2xl bg-slate-800 text-white font-bold text-center">Retour au planning</a>}
          </div>
          {choix.texteCourt && !favoriOk && (
            <div className="border-t border-slate-100 pt-4">
              <p className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5"><Star size={16} weight="fill" className="text-amber-400" /> Garder cette séance pour la refaire</p>
              <div className="flex gap-2">
                <input value={favoriNom} onChange={(e) => setFavoriNom(e.target.value)} placeholder="Un nom, ex. 5×4' seuil" className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <button type="button" onClick={garderFavori} className="px-4 rounded-xl bg-amber-400 font-bold text-sm text-slate-900">Garder</button>
              </div>
            </div>
          )}
          {favoriOk && <p className="text-sm font-bold text-amber-600">⭐ Gardée dans tes favoris</p>}
        </div>
      </main>
    );
  }

  // ─── Préparer ───
  const Capt = ({ src, titre, icone, facultatif }: { src: Source; titre: string; icone: React.ReactNode; facultatif?: boolean }) => {
    const c = capteurs[src];
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c?.connecte ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>{icone}</div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-slate-800 text-sm">{titre}{facultatif && <span className="text-slate-400 font-medium"> · facultatif</span>}</div>
          <div className="text-xs text-slate-500 truncate">{c ? `${c.nom} · ${c.connecte ? "connecté" : "reconnexion…"}` : "pas connecté"}</div>
        </div>
        <button type="button" onClick={() => connecter(src)} className="px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-bold">{c ? "Changer" : "Connecter"}</button>
      </div>
    );
  };

  return (
    <main className={`${jakarta.className} min-h-screen bg-gradient-to-br from-emerald-400 via-blue-400 to-blue-600 px-4 py-8`}>
      <div className="max-w-3xl mx-auto bg-white/95 rounded-3xl shadow-2xl p-5 md:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <a href="/athlete" className="text-slate-500 hover:text-slate-800"><ArrowLeft size={22} /></a>
          <h1 className="text-2xl font-extrabold text-slate-800">Home-trainer</h1>
          {simu && <span className="text-xs font-bold bg-violet-100 text-violet-700 rounded-full px-2 py-0.5">simulateur</span>}
        </div>

        <section className="space-y-2">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide">1. Mon matériel</h2>
          {!bluetoothDispo() && !simu ? (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 space-y-1">
              <p className="font-bold">Ce navigateur ne parle pas Bluetooth.</p>
              <p>Il faut Chrome (ou Edge) sur ordinateur. Sous Linux : ouvre <code className="bg-white px-1 rounded">chrome://flags</code>, active « Experimental Web Platform features », puis relance Chrome.</p>
            </div>
          ) : (
            <>
              {!simu && Capt({ src: "ht", titre: "Home-trainer", icone: <Bicycle size={22} /> })}
              {!simu && Capt({ src: "cardio", titre: "Ceinture cardio", icone: <Heartbeat size={22} weight="fill" />, facultatif: true })}
              {!simu && Capt({ src: "pedales", titre: "Pédales / capteur de puissance", icone: <Lightning size={22} weight="fill" />, facultatif: true })}
              {simu && <p className="text-sm text-slate-500">Faux home-trainer : il suit la consigne tout seul.</p>}
              {erreurBt && <p className="text-xs text-rose-600">{erreurBt}</p>}
            </>
          )}
          {!ftpConnue && (
            <div className="flex items-center gap-2 text-sm text-slate-600 pt-1">
              Ta FTP n&apos;est pas connue, je prends
              <input type="number" value={ftp} onChange={(e) => setFtp(Math.max(80, Number(e.target.value) || 200))} className="w-20 rounded-lg border border-slate-200 px-2 py-1" /> W
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide">2. Ma séance</h2>
          <div className="flex gap-1 rounded-2xl bg-slate-100 p-1">
            {([["plan", "Mon planning"], ["main", "À la main"], ["favoris", "Favoris"], ["libre", "Libre"]] as const).map(([k, t]) => (
              <button key={k} type="button" onClick={() => setOnglet(k)} className={`flex-1 py-2 rounded-xl text-sm font-bold ${onglet === k ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>{t}</button>
            ))}
          </div>

          {onglet === "plan" && (
            seances.length === 0 ? <p className="text-sm text-slate-500 py-4 text-center">Pas de séance vélo cette semaine. Fais-en une à la main !</p> : (
              <div className="space-y-2">
                {seances.map((s) => {
                  const blocs = s.workout_text ? depuisIcu(s.workout_text, ftp) : [];
                  const aujourdhui = s.date === dayjs().format("YYYY-MM-DD");
                  return (
                    <div key={s.id} className={`rounded-2xl border p-3 ${aujourdhui ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-400 uppercase">{aujourdhui ? "Aujourd'hui" : dayjs(s.date).format("dddd D MMM")}{s.status === "valide" ? " · faite ✓" : ""}</div>
                          <div className="font-bold text-slate-800 truncate">{s.title || "Vélo"}</div>
                          <div className="text-xs text-slate-500">{blocs.length ? `${Math.round(dureeTotale(blocs) / 60)} min` : "Pas d'étapes : sortie en résistance"}</div>
                        </div>
                        <button type="button" disabled={!pret} onClick={() => demarrer({ titre: s.title || "Vélo", blocs, sessionId: s.id, texteCourt: null })}
                          className="px-4 py-2 rounded-xl bg-emerald-500 disabled:bg-slate-300 text-white font-bold text-sm">C&apos;est parti</button>
                      </div>
                      {blocs.length > 0 && <div className="mt-2"><Profil etapes={aplatir(blocs)} ftp={ftp} hauteur={40} /></div>}
                    </div>
                  );
                })}
              </div>
            )
          )}

          {onglet === "main" && (
            <div className="space-y-3">
              <Editeur texte={texte} setTexte={setTexte} ftp={ftp} />
              <button type="button" disabled={!pret || !lecture.blocs.length} onClick={() => demarrer({ titre: "Séance maison", blocs: lecture.blocs, sessionId: null, texteCourt: versCourt(lecture.blocs) })}
                className="w-full py-3 rounded-2xl bg-emerald-500 disabled:bg-slate-300 text-white font-extrabold">C&apos;est parti</button>
            </div>
          )}

          {onglet === "favoris" && (
            favoris.length === 0 ? <p className="text-sm text-slate-500 py-4 text-center">Pas encore de favori : à la fin d&apos;une séance faite à la main, tu peux la garder.</p> : (
              <div className="space-y-2">
                {favoris.map((f) => {
                  const b = depuisCourt(f.texte, ftp).blocs;
                  return (
                    <div key={f.id} className="rounded-2xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800 truncate">⭐ {f.nom}</div>
                          <div className="text-xs text-slate-500 font-mono truncate">{f.texte}</div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button type="button" onClick={() => { setTexte(f.texte); setOnglet("main"); }} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs">Modifier</button>
                          <button type="button" onClick={() => supprimerFavori(f.id)} className="px-3 py-2 rounded-xl bg-slate-100 text-rose-600 font-bold text-xs">Retirer</button>
                          <button type="button" disabled={!pret || !b.length} onClick={() => demarrer({ titre: f.nom, blocs: b, sessionId: null, texteCourt: f.texte })} className="px-4 py-2 rounded-xl bg-emerald-500 disabled:bg-slate-300 text-white font-bold text-sm">Go</button>
                        </div>
                      </div>
                      {b.length > 0 && <div className="mt-2"><Profil etapes={aplatir(b)} ftp={ftp} hauteur={36} /></div>}
                    </div>
                  );
                })}
              </div>
            )
          )}

          {onglet === "libre" && (
            <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
              <p className="text-sm text-slate-600">Pas de séance : tu roules comme tu veux. Les boutons − et + règlent la résistance.</p>
              <button type="button" disabled={!pret} onClick={() => demarrer({ titre: "Sortie libre", blocs: [], sessionId: null, texteCourt: null })}
                className="w-full py-3 rounded-2xl bg-emerald-500 disabled:bg-slate-300 text-white font-extrabold">C&apos;est parti</button>
            </div>
          )}
          {!pret && <p className="text-xs text-center text-slate-500">Connecte d&apos;abord ton home-trainer.</p>}
        </section>
      </div>
    </main>
  );
}

export default function Page() {
  return <Suspense fallback={null}><HomeTrainer /></Suspense>;
}
