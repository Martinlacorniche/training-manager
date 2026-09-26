"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import "dayjs/locale/fr";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ArrowLeft } from "@phosphor-icons/react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { supabase } from "@/lib/supabaseClient";
import InfoWbgt from "../InfoWbgt";
import { SuiviTests } from "../Tests";
import { Voyage } from "../Voyage";
import { Chaleur } from "../Chaleur";

dayjs.locale("fr");
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["500", "600", "700", "800"], display: "swap" });

// Le suivi d'un athlète : état par domaine, forme corrigée de la chaleur et
// du dénivelé, et — pour l'athlète seul — la récupération. Ouvert à
// l'athlète (sans paramètre) et à son coach (?athlete=<id>) ; la RLS et
// etats_de_mes_athletes() décident de ce que chacun voit. Pendant de l'écran
// Progrès de l'app (App-Coach, components/SuiviProgres.tsx).

const DOMAINE: Record<string, string> = {
  recuperation: "Récupération", sommeil: "Sommeil", ressenti: "Ressenti", performance: "Forme", mecanique: "Foulée", volume: "Volume",
};
const NIVEAU: Record<string, { pastille: string }> = {
  habituel: { pastille: "bg-emerald-500" }, a_surveiller: { pastille: "bg-amber-500" },
  ecart: { pastille: "bg-rose-500" }, inconnu: { pastille: "bg-slate-300" },
};
// LA TENDANCE, PAS LE BRUIT : moyenne par semaine puis glissante sur 3 semaines
// (forme), glissante sur 7 nuits (récup). Même calcul que l'app
// (App-Coach, components/SuiviProgres.tsx).
function tendance(pts: { iso: string; v: number }[], parSemaine: boolean, fenetre: number) {
  const g = new Map<string, number[]>();
  for (const p of pts) { const k = parSemaine ? dayjs(p.iso).subtract((dayjs(p.iso).day() + 6) % 7, "day").format("YYYY-MM-DD") : p.iso; g.set(k, [...(g.get(k) ?? []), p.v]); }
  const base = [...g].sort(([a], [b]) => a.localeCompare(b)).map(([iso, vs]) => ({ iso, v: vs.reduce((x, y) => x + y, 0) / vs.length }));
  const r = Math.floor(fenetre / 2);
  return base.map((p, i) => { const f = base.slice(Math.max(0, i - r), i + r + 1); return { jour: dayjs(p.iso).format("DD/MM"), v: Math.round((f.reduce((x, y) => x + y.v, 0) / f.length) * 10) / 10 }; });
}
// Une échelle d'au moins `amplitude` : ne pas grossir des variations minuscules.
function domaine(vals: number[], amplitude: number): [number, number] {
  const mn = Math.min(...vals), mx = Math.max(...vals), m = Math.max(0, amplitude - (mx - mn)) / 2 + 1;
  return [Math.floor(mn - m), Math.ceil(mx + m)];
}
const allure = (v: unknown) => {
  const x = Number(v);
  if (!Number.isFinite(x) || x <= 0) return "—";
  const s = Math.round(1000 / x);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function Progres() {
  const router = useRouter();
  const params = useSearchParams();
  const [soi, setSoi] = useState(true);
  const [nom, setNom] = useState<string | null>(null);
  const [etats, setEtats] = useState<any[]>([]);
  const [modele, setModele] = useState<any | null>(null);
  const [points, setPoints] = useState<any[]>([]);
  const [nuits, setNuits] = useState<any[]>([]);
  const [cs, setCs] = useState<{ actuel: any; avant: any | null } | null>(null);
  const [niveau, setNiveau] = useState<{ actuel: any; avant: any | null } | null>(null);
  const [cibleId, setCibleId] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<"forme" | "tests" | "voyage">((["tests", "voyage"].includes(params.get("onglet") ?? "") ? params.get("onglet") : "forme") as "forme" | "tests" | "voyage");

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      const id = params.get("athlete") || session.user.id;
      const moi = id === session.user.id;
      setSoi(moi);
      setCibleId(id);
      const { data: nc } = await supabase.from("niveau_course").select("jour, niveau, bas, haut, source")
        .eq("user_id", id).order("jour", { ascending: false }).limit(60);
      if (nc?.length) {
        const limite = dayjs(nc[0].jour).subtract(42, "day").format("YYYY-MM-DD");
        setNiveau({ actuel: nc[0], avant: nc.find((x: any) => x.jour <= limite) ?? null });
      }
      const { data: u } = await supabase.from("users").select("name").eq("id_auth", id).maybeSingle();
      setNom(u?.name ?? null);

      if (moi) {
        const { data: d } = await supabase.from("etats_athlete").select("jour").eq("user_id", id).order("jour", { ascending: false }).limit(1);
        if (d?.[0]) {
          const { data } = await supabase.from("etats_athlete").select("jour, domaine, niveau, confiance, raison_athlete").eq("user_id", id).eq("jour", d[0].jour);
          setEtats((data ?? []).map((x: any) => ({ ...x, raison: x.raison_athlete })));
        }
      } else {
        const { data } = await supabase.rpc("etats_de_mes_athletes", { p_depuis: dayjs().subtract(3, "day").format("YYYY-MM-DD") });
        const miens = (data ?? []).filter((e: any) => e.user_id === id);
        const dernier = miens.reduce((j: string, e: any) => (e.jour > j ? e.jour : j), "");
        setEtats(miens.filter((e: any) => e.jour === dernier));
      }

      const [{ data: m }, { data: a }] = await Promise.all([
        supabase.from("modele_fc").select("*").eq("user_id", id).eq("sport", "course").maybeSingle(),
        supabase.from("activite_analyse").select("jour, fc_reference, wbgt_moy, activites!inner(sport)")
          .eq("user_id", id).gte("jour", dayjs().subtract(180, "day").format("YYYY-MM-DD"))
          .not("fc_reference", "is", null).in("activites.sport", ["Run", "Trail"]).order("jour"),
      ]);
      setModele(m ?? null);
      // Vitesse critique : la plus récente, et celle d'il y a 6 semaines.
      const { data: vc } = await supabase.from("vitesse_critique").select("jour, cs, d_prime, erreur_pct, n_efforts, statut, fourchette_pct, message")
        .eq("user_id", id).eq("sport", "course").order("jour", { ascending: false }).limit(60);
      if (vc?.length) {
        const limite = dayjs(vc[0].jour).subtract(42, "day").format("YYYY-MM-DD");
        setCs({ actuel: vc[0], avant: vc.find((x: any) => x.jour <= limite && x.statut === "estimee") ?? null });
      }
      const c = Number(m?.c ?? 0);
      setPoints((a ?? []).map((x: any) => ({
        jour: dayjs(x.jour).format("DD/MM"), iso: x.jour,
        corrigee: Math.round(Number(x.fc_reference) * 10) / 10,
        // Sans la correction de chaleur : ce que montrerait une montre.
        brute: Math.round((Number(x.fc_reference) + c * Math.max(0, Number(x.wbgt_moy ?? 0) - 13)) * 10) / 10,
      })));

      if (moi) {
        const { data: b } = await supabase.from("bien_etre_quotidien").select("jour, vfc_rmssd, fc_repos, sommeil_s")
          .eq("user_id", id).gte("jour", dayjs().subtract(30, "day").format("YYYY-MM-DD")).order("jour");
        setNuits((b ?? []).map((n: any) => ({ ...n, jour: dayjs(n.jour).format("DD/MM"), iso: n.jour, vfc: n.vfc_rmssd, fc: n.fc_repos })));
      }
    })();
  }, [params]);

  const global = etats.find((e) => e.domaine === "global");
  const connus = etats.filter((e) => e.domaine !== "global" && e.niveau !== "inconnu");
  const enApprentissage = etats.filter((e) => e.domaine !== "global" && e.niveau === "inconnu").map((e) => (DOMAINE[e.domaine] ?? e.domaine).toLowerCase());
  const perf = etats.find((e) => e.domaine === "performance");
  const recup = etats.find((e) => e.domaine === "recuperation");
  const valide = modele?.valide ?? (modele?.r_residu_wbgt != null && Math.abs(Number(modele.r_residu_wbgt)) < 0.1);
  const carte = "bg-white rounded-2xl border border-slate-200 p-5 space-y-3";
  // La première phrase d'une raison : le message ; la suite (chiffres) en petit.
  const decouper = (r: string) => { const i = (r ?? "").search(/(?<=\.)\s/); return i > 0 ? [r.slice(0, i), r.slice(i + 1)] : [r ?? "", ""]; };
  const temps = (v: number, km: number, f: number) => { const x = Math.round(km * 1000 / (v * f)); const h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60), ss = x % 60; return h ? `${h} h ${String(m).padStart(2, "0")}` : `${m}:${String(ss).padStart(2, "0")}`; };
  const nuitsVfc = nuits.filter((n) => n.vfc != null);
  const tForme = tendance(points.map((p) => ({ iso: p.iso, v: p.corrigee })), true, 3);
  const tNuits = tendance(nuitsVfc.map((n) => ({ iso: n.iso, v: Number(n.vfc) })), false, 7);
  const derniere = nuits[nuits.length - 1];

  // UNE PHRASE SIMPLE D'ABORD, les chiffres ensuite et en petit, comme dans
  // l'app : le détail technique est réservé au MCP.
  return (
    <main className={`${jakarta.className} min-h-screen bg-slate-100 px-4 py-8`}>
      <div className="max-w-3xl mx-auto space-y-5">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800">
          <ArrowLeft size={16} /> Retour
        </button>
        <header>
          <h1 className="text-2xl font-extrabold text-slate-800">Progrès{!soi && nom ? ` · ${nom}` : ""}</h1>
          <p className="text-sm text-slate-500">Comparé à {soi ? "toi-même" : "lui-même"}, jamais aux autres.</p>
          <div className="mt-3 flex rounded-xl bg-slate-200/70 p-1">
            {([["forme", soi ? "Ma forme" : "Sa forme"], ["tests", soi ? "Mes tests" : "Ses tests"], ["voyage", soi ? "Mon voyage" : "Son voyage"]] as const).map(([k, lib]) => (
              <button key={k} onClick={() => setOnglet(k)} className={`flex-1 rounded-lg py-2 text-sm font-bold ${onglet === k ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>{lib}</button>
            ))}
          </div>
        </header>

        {onglet === "tests" && cibleId && <SuiviTests userId={cibleId} soi={soi} />}
        {onglet === "voyage" && cibleId && <Voyage userId={cibleId} soi={soi} />}
        {onglet === "forme" && (<>

        <section className={carte}>
          <h2 className="font-bold text-slate-800">{soi ? "Mon état" : "Son état"}</h2>
          {!global ? (
            <p className="text-sm text-slate-400">{soi ? "On apprend encore à te connaître : il faut quelques semaines de séances. Rien à faire de ton côté." : "Pas encore d'état, ou l'athlète ne le partage pas."}</p>
          ) : (
            <>
              <div className="flex gap-3 items-start">
                <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${NIVEAU[global.niveau]?.pastille ?? "bg-slate-300"}`} />
                <p className="text-lg font-extrabold text-slate-800">{global.raison}</p>
              </div>
              <ul className="space-y-2">
                {connus.filter((e) => e.domaine !== "ressenti" || global.niveau === "habituel").map((e) => {
                  const [phrase, detail] = decouper(e.raison);
                  return (
                    <li key={e.domaine} className="text-sm text-slate-700">
                      <strong>{DOMAINE[e.domaine]} : </strong>{phrase}
                      {detail && <span className="block text-xs text-slate-400">{detail}</span>}
                    </li>
                  );
                })}
              </ul>
              {enApprentissage.length > 0 && (
                <p className="text-sm text-slate-400">On apprend encore à {soi ? "te" : "le"} connaître pour : {enApprentissage.join(", ")}. Il faut quelques semaines de données, rien à faire de ton côté.</p>
              )}
              <p className="text-xs text-slate-400">Au {dayjs(global.jour).format("DD/MM")}.</p>
            </>
          )}
        </section>

        {points.length >= 3 && (
          <section className={carte}>
            <h2 className="font-bold text-slate-800">{soi ? "Ma forme" : "Sa forme"}</h2>
            <p className="font-bold text-slate-800">{perf && perf.niveau !== "inconnu" ? decouper(perf.raison)[0] : "On apprend encore ta forme."}</p>
            <p className="text-sm text-slate-500">
              {soi ? "Ton cœur quand tu cours" : "Son cœur quand il court"} tranquille. <strong>Plus la courbe descend, plus {soi ? "tu es" : "il est"} en forme.</strong>
            </p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tForme} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="jour" tick={{ fontSize: 11, fill: "#94a3b8" }} minTickGap={40} />
                  <YAxis hide domain={domaine(tForme.map((x) => x.v), 12)} />
                  <Line type="monotone" dataKey="v" stroke="#2563eb" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {!valide && <p className="text-xs text-slate-400">Encore en rodage : cette mesure s&apos;affine avec les semaines.</p>}
            <p className="text-xs text-slate-400">La météo est déjà retirée, selon ta propre sensibilité au chaud et au froid : un été chaud ne fait pas croire à une baisse. <InfoWbgt /></p>
            {cs?.actuel?.statut !== "estimee" && (
              <p className="text-sm text-slate-500">{soi ? "Ton" : "Son"} allure sur 10 km sera mesurée après {soi ? "ta" : "sa"} prochaine course.</p>
            )}
          </section>
        )}

        {/* L'allure 10 km n'apparaît que VRAIMENT mesurée (une course ou un effort
            long à fond) : estimée sur l'entraînement, elle bougeait au gré des sorties. */}
        {cs?.actuel?.statut === "estimee" && cs.actuel.cs != null && (() => {
          const v = Number(cs.actuel.cs);
          return (
            <section className={carte}>
              <h2 className="font-bold text-slate-800">{soi ? "Mon allure 10 km" : "Son allure 10 km"}</h2>
              <p className="text-3xl font-extrabold text-slate-800">{allure(v)}<span className="text-base font-bold text-slate-500">/km</span></p>
              {cs.avant && (
                <p className={`text-sm font-bold ${v >= Number(cs.avant.cs) ? "text-emerald-700" : "text-orange-600"}`}>
                  {v >= Number(cs.avant.cs) ? "Plus rapide" : "Moins rapide"} qu&apos;il y a 6 semaines ({allure(cs.avant.cs)}/km)
                </p>
              )}
              <p className="text-sm text-slate-700">Par temps frais, {soi ? "tu peux viser" : "objectif possible"} : 5 km en {temps(v, 5, 1.07)}, 10 km en {temps(v, 10, 1)}, semi en {temps(v, 21.0975, 0.95)}.</p>
              <p className="text-sm text-slate-500">Pour un footing, {soi ? "cours" : "courir"} plus lentement que {allure(v * 0.82)}/km.</p>
            </section>
          );
        })()}

        {cibleId && <Chaleur userId={cibleId} soi={soi} />}

        {/* Le niveau de course : un indice de PERFORMANCE (façon VDOT), tiré des
            vraies courses et du test allure 10 km, jamais appelé VO2max. */}
        {niveau?.actuel && (() => {
          const n = Number(niveau.actuel.niveau), av = niveau.avant ? Number(niveau.avant.niveau) : null;
          const ecart = av != null ? n - av : null;
          return (
            <section className={carte}>
              <h2 className="font-bold text-slate-800">{soi ? "Mon niveau de course" : "Son niveau de course"}</h2>
              <p className="text-3xl font-extrabold text-slate-800">{Math.round(n)}<span className="text-base font-bold text-slate-500">  entre {Math.round(niveau.actuel.bas)} et {Math.round(niveau.actuel.haut)}</span></p>
              {ecart != null && Math.abs(ecart) >= 2 && (
                <p className={`text-sm font-bold ${ecart > 0 ? "text-emerald-700" : "text-orange-600"}`}>{ecart > 0 ? "En hausse" : "En baisse"} depuis 6 semaines (il était à {Math.round(av!)})</p>
              )}
              <p className="text-sm text-slate-700">Un score qui résume {soi ? "ce que tu vaux" : "ce qu'il vaut"} en course, calculé sur {niveau.actuel.source} (chaleur retirée). Plus il monte, plus {soi ? "tu es" : "il est"} fort. On garde les courses et tests des 4 derniers mois.</p>
              <p className="text-xs text-slate-400">C&apos;est l&apos;équivalent de la « VO2max » des montres, mais tiré de {soi ? "tes" : "ses"} vraies courses plutôt que du cœur.</p>
            </section>
          );
        })()}

        {!niveau?.actuel && points.length >= 3 && (
          <section className={carte}>
            <h2 className="font-bold text-slate-800">{soi ? "Mon niveau de course" : "Son niveau de course"}</h2>
            <p className="text-sm text-slate-500">Il sera calculé après {soi ? "ta" : "sa"} prochaine course, ou avec le calibrage (onglet {soi ? "Mes" : "Ses"} tests). On garde les 4 derniers mois.</p>
          </section>
        )}

        {soi && nuitsVfc.length > 0 && (
          <section className={carte}>
            <h2 className="font-bold text-slate-800">Mes nuits</h2>
            <p className="font-bold text-slate-800">{recup && recup.niveau !== "inconnu" ? decouper(recup.raison)[0] : "On apprend encore tes nuits."}</p>
            <p className="text-sm text-slate-500">Ta récupération la nuit, mesurée par ta montre. <strong>Plus la courbe monte, mieux tu récupères.</strong> Ton coach ne voit pas ces chiffres.</p>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tNuits} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="jour" tick={{ fontSize: 11, fill: "#94a3b8" }} minTickGap={40} />
                  <YAxis hide domain={domaine(tNuits.map((x) => x.v), 20)} />
                  <Line type="monotone" dataKey="v" stroke="#7c3aed" strokeWidth={2.5} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {derniere?.sommeil_s ? (
              <p className="text-sm text-slate-500">Cette nuit : {Math.floor(derniere.sommeil_s / 3600)} h {String(Math.round((derniere.sommeil_s % 3600) / 60)).padStart(2, "0")} de sommeil.</p>
            ) : null}
          </section>
        )}
        </>)}
      </div>
    </main>
  );
}

export default function Page() {
  return <Suspense><Progres /></Suspense>;
}
