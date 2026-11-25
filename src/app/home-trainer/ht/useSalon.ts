// Le salon « Course en direct » (25/11/2026) : tout l'état d'une course à plusieurs, partagé app ↔ site
// (copie de App-Coach/lib/ht/useSalon.ts). Aucune dépendance à l'écran : React et Supabase seulement.
import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_SALON, resteAvantDepart, tempsDeCourse, type Rival } from "./course";
import { creerSalon, etatSalon, lancerSalon, mesurerDecalage, Salle, terminerSalon } from "./courseReseau";

export type PhaseSalon = "rien" | "choix" | "attente" | "compte" | "course";
/** Ce que l'écran de pédalage sait de moi, lu chaque seconde. */
export type Lecture = { m: number; v: number; fini: boolean; abandon: boolean };

export function useSalon(sb: SupabaseClient, moi: { id: string; prenom: string } | null, surPartir: (colId: string, departMs: number) => void, lire: () => Lecture | null) {
  const [phase, setPhase] = useState<PhaseSalon>("rien");
  const [code, setCode] = useState("");
  const [hote, setHote] = useState(false);
  const [colId, setColId] = useState<string | null>(null);
  const [departMs, setDepartMs] = useState<number | null>(null);
  const [reste, setReste] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [, setTic] = useState(0);
  const salle = useRef<Salle | null>(null);
  const decalage = useRef(0);
  const parti = useRef(false);
  const tFin = useRef<number | null>(null);
  const partir = useRef(surPartir);
  partir.current = surPartir;
  /** `lire` : la fonction de l'écran de pédalage qui rend ma distance et ma vitesse. */
  const lecture = useRef(lire);
  useEffect(() => { lecture.current = lire; });

  const reveiller = useCallback(() => setTic((n) => n + 1), []);

  const programmer = useCallback((col: string, depart: number) => {
    if (parti.current) return;
    setColId(col); setDepartMs(depart); setPhase("compte");
  }, []);

  const ouvrir = useCallback(async (c: string, estHote: boolean): Promise<boolean> => {
    if (!moi) { setErreur("Connecte-toi pour jouer à plusieurs."); return false; }
    const s = new Salle(sb, c, moi, reveiller);
    s.surDepart = programmer;
    const r = await s.connecter();
    if (r === "plein") { s.fermer(); setErreur(`Ce salon est complet (${MAX_SALON} coureurs).`); return false; }
    if (r === "erreur") { s.fermer(); setErreur("Je n'arrive pas à me connecter au direct."); return false; }
    salle.current = s;
    decalage.current = await mesurerDecalage(sb);
    setCode(c); setHote(estHote); setPhase("attente");
    return true;
  }, [sb, moi, reveiller, programmer]);

  const creer = useCallback(async () => {
    setErreur(null); setOccupe(true);
    try {
      const c = await creerSalon(sb);
      if (!c) { setErreur("Je n'arrive pas à créer le salon."); return; }
      if (!(await ouvrir(c, true))) await terminerSalon(sb, c);
    } finally { setOccupe(false); }
  }, [sb, ouvrir]);

  const rejoindre = useCallback(async (c: string) => {
    setErreur(null);
    if (!/^\d{4}$/.test(c)) { setErreur("Le code a 4 chiffres."); return; }
    setOccupe(true);
    try {
      const e = await etatSalon(sb, c);
      if (!e) { setErreur("Aucun salon avec ce code."); return; }
      if (!(await ouvrir(c, false))) return;
      if (e.statut === "en_cours" && e.col_id && e.depart_ms && e.depart_ms + 1500 > Date.now() + decalage.current) programmer(e.col_id, e.depart_ms);
    } finally { setOccupe(false); }
  }, [sb, ouvrir, programmer]);

  /** L'hôte lance : le serveur fixe l'heure, tout le monde compte à rebours sur la même. */
  const lancer = useCallback(async (col: string) => {
    if (!salle.current) return;
    setErreur(null); setOccupe(true);
    try {
      const d = await lancerSalon(sb, salle.current.code, col);
      if (d == null) { setErreur("Je n'ai pas pu lancer la course."); return; }
      salle.current.annoncerDepart(col, d);
      programmer(col, d);
    } finally { setOccupe(false); }
  }, [sb, programmer]);

  const quitter = useCallback(() => {
    const s = salle.current;
    if (s) { if (hote) terminerSalon(sb, s.code); s.fermer(); }
    salle.current = null; parti.current = false; tFin.current = null;
    setPhase("rien"); setCode(""); setHote(false); setColId(null); setDepartMs(null); setErreur(null);
  }, [sb, hote]);
  useEffect(() => () => { if (salle.current) { salle.current.fermer(); salle.current = null; } }, []);

  // Un coureur qui a manqué le message du départ le retrouve dans le salon (toutes les 2 s en attente).
  useEffect(() => {
    if (phase !== "attente" || hote || !code) return;
    const h = setInterval(async () => {
      const e = await etatSalon(sb, code);
      if (e?.statut === "en_cours" && e.col_id && e.depart_ms) programmer(e.col_id, e.depart_ms);
    }, 2000);
    return () => clearInterval(h);
  }, [phase, hote, code, sb, programmer]);

  // Le compte à rebours, sur l'heure du serveur (jamais sur l'arrivée du message).
  useEffect(() => {
    if (phase !== "compte" || departMs == null) return;
    const h = setInterval(() => {
      const r = resteAvantDepart(departMs, Date.now(), decalage.current);
      setReste(Math.max(0, r));
      if (r <= 0 && !parti.current && colId) {
        parti.current = true; tFin.current = null;
        setPhase("course");
        partir.current(colId, departMs);
      }
    }, 100);
    return () => clearInterval(h);
  }, [phase, departMs, colId]);

  // Chaque seconde : mon état part aux autres ({ id, prenom, m, v, t }), jusqu'à ce que je quitte.
  useEffect(() => {
    if (phase !== "course" || departMs == null) return;
    const h = setInterval(() => {
      const s = salle.current, l = lecture.current();
      reveiller();
      if (!s || !l) return;
      const t = tempsDeCourse(departMs, Date.now(), decalage.current);
      if (l.fini && tFin.current == null) tFin.current = t;
      s.envoyer({ m: Math.round(l.m), v: Math.round(l.v * 10) / 10, t, ...(tFin.current != null ? { f: tFin.current } : {}), ...(l.abandon ? { a: true } : {}) });
    }, 1000);
    return () => clearInterval(h);
  }, [phase, departMs, reveiller]);

  const rivaux: Rival[] = salle.current?.rivaux() ?? [];
  const presents = [...(salle.current?.presents ?? new Map<string, string>()).entries()].map(([id, prenom]) => ({ id, prenom }));
  const connecte = salle.current?.connecte ?? true;
  /** Mon arrivée (temps de course), si je suis arrivé. */
  const monArrivee = tFin.current;

  return { phase, setPhase, code, hote, colId, departMs, reste, erreur, setErreur, occupe, rivaux, presents, connecte, monArrivee, creer, rejoindre, lancer, quitter };
}
