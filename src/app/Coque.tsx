"use client";
// ─────────────────────────────────────────────────────────────────────────
// La coque commune de toutes les pages connectées (refonte du 05/11/2026,
// maquette validée par Martin) : un menu fixe à gauche, le contenu sur toute
// la largeur à droite. Plus de page coincée au milieu de l'écran.
// Côté coach, le menu liste aussi les athlètes avec la pastille de leur état ;
// la coque partage ce qu'elle a chargé avec la page (useCoque) pour ne pas
// tout relire deux fois.
// ─────────────────────────────────────────────────────────────────────────
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import dayjs from "dayjs";
import {
  House, CalendarBlank, UsersThree, ChartLineUp, Bicycle, GearSix, SignOut, List, X, CalendarCheck, Heartbeat,
} from "@phosphor-icons/react";
import { supabase } from "@/lib/supabaseClient";
import { Avatar } from "./commun";

export type Moi = { id: string; nom: string; role: "coach" | "athlete"; code: string | null; selfCoached: boolean };
export type AthleteCoque = { id_auth: string; name: string; ordre: number | null; moi?: boolean };
export type EtatJour = { user_id: string; jour: string; domaine: string; niveau: string; confiance: string; raison: string };

type Valeur = {
  moi: Moi | null;
  athletes: AthleteCoque[];
  /** Les états du jour le plus récent de chaque athlète (user_id → états). */
  etats: Map<string, EtatJour[]>;
  recharger: () => void;
  /** Le menu se réduit à ses icônes (le planning, quand son panneau est ouvert). */
  setEtroit: (v: boolean) => void;
  /** Sans menu ni marges : le home-trainer pendant qu'on roule. */
  setSansMenu: (v: boolean) => void;
};
const Contexte = createContext<Valeur>({ moi: null, athletes: [], etats: new Map(), recharger: () => {}, setEtroit: () => {}, setSansMenu: () => {} });
export const useCoque = () => useContext(Contexte);

export const NIVEAU: Record<string, { couleur: string; libelle: string }> = {
  habituel: { couleur: "#22c55e", libelle: "Habituel" },
  a_surveiller: { couleur: "#f59e0b", libelle: "À surveiller" },
  ecart: { couleur: "#ef4444", libelle: "Écart marqué" },
  inconnu: { couleur: "#cbd5e1", libelle: "Pas assez de données" },
};

const EtroitCtx = createContext(false);
function Lien({ href, actif, icone, children }: { href: string; actif: boolean; icone: React.ReactNode; children: React.ReactNode }) {
  const etroit = useContext(EtroitCtx);
  return (
    <Link href={href} title={etroit ? String(children) : undefined} className={`flex items-center gap-2.5 py-2.5 rounded-xl text-sm transition ${etroit ? "justify-center px-0" : "px-3"} ${actif ? "bg-blue-50 text-blue-600 font-extrabold" : "text-slate-700 font-bold hover:bg-slate-50"}`}>
      {icone}{!etroit && children}
    </Link>
  );
}

function Menu({ moi, athletes, etats, chemin, athleteActif, onDeconnexion, etroit = false }: {
  moi: Moi | null; athletes: AthleteCoque[]; etats: Map<string, EtatJour[]>; chemin: string; athleteActif: string | null; onDeconnexion: () => void; etroit?: boolean;
}) {
  const [copie, setCopie] = useState(false);
  const coach = moi?.role === "coach";
  const est = (p: string) => chemin === p;
  const pastille = (id: string) => NIVEAU[etats.get(id)?.find((e) => e.domaine === "global")?.niveau ?? "inconnu"]?.couleur ?? "#cbd5e1";
  return (
    <EtroitCtx.Provider value={etroit}>
    <nav aria-label="Navigation" className={`h-full flex flex-col gap-1 overflow-y-auto ${etroit ? "p-2.5" : "p-4"}`}>
      <Link href={coach ? "/coach" : "/athlete"} className={`flex items-center gap-2.5 pb-5 ${etroit ? "justify-center" : "px-2"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="w-9 h-9 rounded-full object-cover" />
        <div className={etroit ? "hidden" : ""}>
          <div className="font-extrabold text-[15px] text-slate-800 leading-tight">C&apos;est Ludique</div>
          <div className="text-[10.5px] font-extrabold tracking-wider text-slate-400">{coach ? "ESPACE COACH" : "MON ESPACE"}</div>
        </div>
      </Link>
      {!moi ? null : coach ? (
        <>
          <Lien href="/coach" actif={est("/coach")} icone={<House size={19} weight="bold" />}>Accueil</Lien>
          <Lien href="/coach/planning?vue=equipe" actif={est("/coach/planning")} icone={<CalendarBlank size={19} weight="bold" />}>Planning</Lien>
          <Lien href="/coach/stats" actif={est("/coach/stats")} icone={<UsersThree size={19} weight="bold" />}>Équipe</Lien>
          <Lien href="/progres" actif={est("/progres")} icone={<Heartbeat size={19} weight="bold" />}>Progrès</Lien>
          <Lien href="/home-trainer" actif={est("/home-trainer")} icone={<Bicycle size={19} weight="bold" />}>Home-trainer</Lien>
          {moi?.selfCoached && (
            <>
              <div className={`text-[10.5px] font-extrabold tracking-wider text-slate-400 pt-4 pb-1 ${etroit ? "text-center" : "px-3"}`}>MOI</div>
              <Lien href="/athlete" actif={est("/athlete")} icone={<CalendarCheck size={19} weight="bold" />}>Mon planning</Lien>
              <Lien href="/athlete/reglages" actif={est("/athlete/reglages")} icone={<GearSix size={19} weight="bold" />}>Mes réglages</Lien>
            </>
          )}
          {athletes.filter((a) => !a.moi).length > 0 && (
            <>
              <div className={`text-[10.5px] font-extrabold tracking-wider text-slate-400 pt-4 pb-1 ${etroit ? "border-t border-slate-100 mt-2" : "px-3"}`}>{etroit ? "" : "MES ATHLÈTES"}</div>
              {athletes.filter((a) => !a.moi).map((a) => (
                <Link key={a.id_auth} href={`/coach/planning?athlete=${a.id_auth}`} title={etroit ? a.name : undefined}
                  className={`relative flex items-center gap-2.5 py-1.5 rounded-xl text-sm ${etroit ? "justify-center" : "px-3"} ${athleteActif === a.id_auth ? "bg-slate-100 font-extrabold" : "font-bold hover:bg-slate-50"} text-slate-800`}>
                  <Avatar id={a.id_auth} nom={a.name} taille={28} />
                  {!etroit && <span className="truncate">{a.name.split(" ")[0]}</span>}
                  <span className={`w-2 h-2 rounded-full shrink-0 ${etroit ? "absolute top-1 right-2 ring-2 ring-white" : "ml-auto"}`} style={{ background: pastille(a.id_auth) }} />
                </Link>
              ))}
            </>
          )}
        </>
      ) : (
        <>
          <Lien href="/athlete" actif={est("/athlete")} icone={<CalendarCheck size={19} weight="bold" />}>Mon planning</Lien>
          <Lien href="/progres" actif={est("/progres")} icone={<Heartbeat size={19} weight="bold" />}>Progrès</Lien>
          <Lien href="/athlete/stats" actif={est("/athlete/stats")} icone={<ChartLineUp size={19} weight="bold" />}>Mes chiffres</Lien>
          <Lien href="/home-trainer" actif={est("/home-trainer")} icone={<Bicycle size={19} weight="bold" />}>Home-trainer</Lien>
          <Lien href="/athlete/reglages" actif={est("/athlete/reglages")} icone={<GearSix size={19} weight="bold" />}>Réglages</Lien>
        </>
      )}
      <div className="mt-auto pt-4 space-y-2">
        {coach && moi?.code && !etroit && (
          <div className="rounded-2xl bg-slate-50 p-3">
            <div className="text-[10.5px] font-extrabold tracking-wider text-slate-400">TON CODE COACH</div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-lg font-extrabold tracking-widest text-slate-800">{moi.code}</span>
              <button onClick={() => { navigator.clipboard?.writeText(moi.code!); setCopie(true); setTimeout(() => setCopie(false), 1500); }}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50">{copie ? "Copié" : "Copier"}</button>
            </div>
          </div>
        )}
        <button onClick={onDeconnexion} title={etroit ? "Se déconnecter" : undefined} className={`w-full flex items-center gap-2.5 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-rose-50 hover:text-rose-600 ${etroit ? "justify-center" : "px-3"}`}>
          <SignOut size={18} weight="bold" />{!etroit && "Se déconnecter"}
        </button>
      </div>
    </nav>
    </EtroitCtx.Provider>
  );
}

// Posée une seule fois, dans le layout racine (05/11/2026) : le menu reste en
// place d'une page à l'autre, rien ne se recharge. Hors de l'espace connecté
// (accueil public, connexion…), elle laisse passer la page telle quelle.
const ESPACE = ["/coach", "/athlete", "/progres", "/seance", "/home-trainer"];
// Ces pages gèrent leurs marges (panneau latéral, semaine pleine largeur).
const PLEIN = ["/coach/planning", "/athlete"];
const TITRES: [string, string][] = [
  ["/coach/planning", "Planning"], ["/coach/stats", "Équipe"], ["/coach", "Accueil"], ["/athlete/reglages", "Réglages"],
  ["/athlete/stats", "Mes chiffres"], ["/athlete", "Mon planning"], ["/progres", "Progrès"], ["/seance", "Séance"], ["/home-trainer", "Home-trainer"],
];

export default function Coque({ children }: { children: React.ReactNode }) {
  const chemin = usePathname() ?? "";
  const espace = ESPACE.some((p) => chemin === p || chemin.startsWith(p + "/"));
  if (!espace) return <>{children}</>;
  return <CoqueEspace chemin={chemin}>{children}</CoqueEspace>;
}

function CoqueEspace({ children, chemin }: { children: React.ReactNode; chemin: string }) {
  const router = useRouter();
  const plein = PLEIN.includes(chemin);
  const titre = TITRES.find(([p]) => chemin === p || chemin.startsWith(p + "/"))?.[1];
  const [sansMenu, setSansMenu] = useState(false);
  const [moi, setMoi] = useState<Moi | null>(null);
  const [athletes, setAthletes] = useState<AthleteCoque[]>([]);
  const [etats, setEtats] = useState<Map<string, EtatJour[]>>(new Map());
  const [tiroir, setTiroir] = useState(false);
  const [etroit, setEtroit] = useState(false);
  const [n, setN] = useState(0);
  const recharger = useCallback(() => setN((x) => x + 1), []);

  useEffect(() => {
    let annule = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) { router.push("/login"); return; }
      const { data: u } = await supabase.from("users").select("name, role, coach_code, self_coached").eq("id_auth", uid).maybeSingle();
      if (annule || !u) return;
      const m: Moi = { id: uid, nom: u.name ?? "", role: u.role === "coach" ? "coach" : "athlete", code: u.coach_code ?? null, selfCoached: !!u.self_coached };
      setMoi(m);
      if (m.role !== "coach") return;
      const [{ data: liste }, { data: e }] = await Promise.all([
        supabase.from("users").select("id_auth, name, ordre").eq("role", "athlete").eq("coach_id", uid).order("ordre", { ascending: true }),
        supabase.rpc("etats_de_mes_athletes", { p_depuis: dayjs().subtract(3, "day").format("YYYY-MM-DD") }),
      ]);
      if (annule) return;
      setAthletes([
        // « Je me coache aussi » : le coach est en tête de sa propre liste.
        ...(m.selfCoached ? [{ id_auth: uid, name: m.nom || "Moi", ordre: -1, moi: true }] : []),
        ...((liste ?? []) as AthleteCoque[]).map((a) => ({ ...a, name: a.name ?? "Athlète" })),
      ]);
      const lignes = (e ?? []) as EtatJour[];
      const dernier = new Map<string, string>();
      for (const x of lignes) if (x.jour > (dernier.get(x.user_id) ?? "")) dernier.set(x.user_id, x.jour);
      const out = new Map<string, EtatJour[]>();
      for (const x of lignes) if (x.jour === dernier.get(x.user_id)) out.set(x.user_id, [...(out.get(x.user_id) ?? []), x]);
      setEtats(out);
    })();
    return () => { annule = true; };
  }, [router, n]);
  // Reconnecté sous un autre compte : on relit tout.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_IN" || ev === "SIGNED_OUT") setN((x) => x + 1); });
    return () => data.subscription.unsubscribe();
  }, []);

  // L'athlète ouvert (planning, progrès) : lu dans l'adresse sans useSearchParams,
  // qui imposerait un Suspense à chaque page.
  const [athleteActif, setAthleteActif] = useState<string | null>(null);
  useEffect(() => {
    setTiroir(false);
    const lire = () => setAthleteActif(new URLSearchParams(window.location.search).get("athlete"));
    lire();
    window.addEventListener("popstate", lire);
    window.addEventListener("coque:athlete", lire);
    return () => { window.removeEventListener("popstate", lire); window.removeEventListener("coque:athlete", lire); };
  }, [chemin]);

  // Se déconnecter : une petite fenêtre de la page, pas la boîte grise du navigateur.
  const [quitter, setQuitter] = useState(false);
  function deconnexion() { setQuitter(true); }
  async function confirmerDeconnexion() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const menu = <Menu moi={moi} athletes={athletes} etats={etats} chemin={chemin} athleteActif={athleteActif} onDeconnexion={deconnexion} />;

  return (
    <Contexte.Provider value={{ moi, athletes, etats, recharger, setEtroit, setSansMenu }}>
      <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans">
        {/* Grand écran : menu fixe de 240 px. */}
        {/* Le menu disparaît pendant qu'on roule, sans toucher à l'arbre de la page
            (le home-trainer en cours ne doit jamais repartir de zéro). */}
        <aside className={`${sansMenu ? "hidden" : "hidden lg:block"} fixed inset-y-0 left-0 bg-white border-r border-slate-200 z-30 transition-[width] ${etroit ? "w-[72px]" : "w-60"}`}>
          {etroit ? <Menu moi={moi} athletes={athletes} etats={etats} chemin={chemin} athleteActif={athleteActif} onDeconnexion={deconnexion} etroit /> : menu}
        </aside>
        {/* Petit écran : barre du haut et menu en tiroir. */}
        <header className={`${sansMenu ? "hidden" : "lg:hidden"} sticky top-0 z-30 flex items-center gap-3 bg-white/95 backdrop-blur border-b border-slate-200 px-4 h-14`}>
          <button aria-label="Menu" onClick={() => setTiroir(true)} className="p-1.5 -ml-1.5 rounded-lg hover:bg-slate-100"><List size={22} weight="bold" /></button>
          <span className="font-extrabold truncate">{titre ?? "C'est Ludique"}</span>
        </header>
        {tiroir && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-slate-900/40" onClick={() => setTiroir(false)} />
            <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-white shadow-2xl">
              <button aria-label="Fermer" onClick={() => setTiroir(false)} className="absolute top-3 right-3 p-1.5 rounded-full bg-slate-100"><X size={16} weight="bold" /></button>
              {menu}
            </aside>
          </div>
        )}
        {quitter && (
          <div className="fixed inset-0 z-[70] grid place-items-center p-4" onClick={() => setQuitter(false)}>
            <div className="absolute inset-0 bg-slate-900/40" />
            <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-extrabold text-slate-800">Te déconnecter ?</h3>
              <p className="text-sm font-semibold text-slate-500">Tu pourras revenir avec ton e-mail et ton mot de passe.</p>
              <div className="flex gap-2.5">
                <button onClick={() => setQuitter(false)} className="flex-1 rounded-xl bg-slate-100 py-2.5 font-extrabold text-slate-600 hover:bg-slate-200">Rester</button>
                <button onClick={confirmerDeconnexion} className="flex-1 rounded-xl bg-rose-600 py-2.5 font-extrabold text-white hover:bg-rose-700">Se déconnecter</button>
              </div>
            </div>
          </div>
        )}
        <div className={sansMenu ? "" : `transition-[padding] ${etroit ? "lg:pl-[72px]" : "lg:pl-60"}`}><div className={plein || sansMenu ? "" : "px-4 py-5 lg:px-8 lg:py-7"}>{children}</div></div>
      </div>
    </Contexte.Provider>
  );
}
