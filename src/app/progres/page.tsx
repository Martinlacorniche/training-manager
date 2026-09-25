"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dayjs from "dayjs";
import "dayjs/locale/fr";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ArrowLeft } from "@phosphor-icons/react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { supabase } from "@/lib/supabaseClient";

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
const NIVEAU: Record<string, { pastille: string; badge: string; libelle: string }> = {
  habituel: { pastille: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700", libelle: "Habituel" },
  a_surveiller: { pastille: "bg-amber-500", badge: "bg-amber-50 text-amber-700", libelle: "À surveiller" },
  ecart: { pastille: "bg-rose-500", badge: "bg-rose-50 text-rose-700", libelle: "Écart marqué" },
  inconnu: { pastille: "bg-slate-300", badge: "bg-slate-100 text-slate-500", libelle: "Pas assez de données" },
};
const n1 = (v: unknown) => (v == null ? "—" : (Math.round(Number(v) * 10) / 10).toString().replace(".", ","));
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

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      const id = params.get("athlete") || session.user.id;
      const moi = id === session.user.id;
      setSoi(moi);
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
      const { data: vc } = await supabase.from("vitesse_critique").select("jour, cs, d_prime, erreur_pct, n_efforts")
        .eq("user_id", id).eq("sport", "course").order("jour", { ascending: false }).limit(60);
      if (vc?.length) {
        const limite = dayjs(vc[0].jour).subtract(42, "day").format("YYYY-MM-DD");
        setCs({ actuel: vc[0], avant: vc.find((x: any) => x.jour <= limite) ?? null });
      }
      const c = Number(m?.c ?? 0);
      setPoints((a ?? []).map((x: any) => ({
        jour: dayjs(x.jour).format("DD/MM"),
        corrigee: Math.round(Number(x.fc_reference) * 10) / 10,
        // Sans la correction de chaleur : ce que montrerait une montre.
        brute: Math.round((Number(x.fc_reference) + c * Math.max(0, Number(x.wbgt_moy ?? 0) - 13)) * 10) / 10,
      })));

      if (moi) {
        const { data: b } = await supabase.from("bien_etre_quotidien").select("jour, vfc_rmssd, fc_repos, sommeil_s")
          .eq("user_id", id).gte("jour", dayjs().subtract(30, "day").format("YYYY-MM-DD")).order("jour");
        setNuits((b ?? []).map((n: any) => ({ ...n, jour: dayjs(n.jour).format("DD/MM"), vfc: n.vfc_rmssd, fc: n.fc_repos })));
      }
    })();
  }, [params]);

  const global = etats.find((e) => e.domaine === "global");
  const autres = etats.filter((e) => e.domaine !== "global");
  const valide = modele?.r_residu_wbgt != null && Math.abs(Number(modele.r_residu_wbgt)) < 0.1;
  const carte = "bg-white rounded-2xl border border-slate-200 p-5 space-y-3";

  return (
    <main className={`${jakarta.className} min-h-screen bg-slate-100 px-4 py-8`}>
      <div className="max-w-3xl mx-auto space-y-5">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800">
          <ArrowLeft size={16} /> Retour
        </button>
        <header>
          <h1 className="text-2xl font-extrabold text-slate-800">Progrès{!soi && nom ? ` · ${nom}` : ""}</h1>
          <p className="text-sm text-slate-500">{soi ? "Tes vrais progrès" : "Ses vrais progrès"}, chaleur et dénivelé corrigés, comparés à {soi ? "ta" : "sa"} propre normale.</p>
        </header>

        <section className={carte}>
          <h2 className="font-bold text-slate-800">{soi ? "Mon état" : "État"}</h2>
          {!etats.length ? (
            <p className="text-sm text-slate-400">{soi ? "Pas encore d'état calculé : il faut des séances avec RPE, un bilan de semaine, ou une montre branchée." : "État non partagé par l'athlète, ou pas encore calculé."}</p>
          ) : (
            <>
              {global && <span className={`inline-block rounded-full px-3 py-1 text-sm font-bold ${NIVEAU[global.niveau].badge}`}>{NIVEAU[global.niveau].libelle}{global.confiance === "provisoire" ? " · provisoire" : ""}</span>}
              <ul className="space-y-2">
                {autres.map((e) => (
                  <li key={e.domaine} className="flex gap-2 text-sm text-slate-700">
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${NIVEAU[e.niveau]?.pastille ?? "bg-slate-300"}`} />
                    <span><strong>{DOMAINE[e.domaine]}{e.confiance === "provisoire" ? " (provisoire)" : ""} · </strong>{e.raison}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-400">Au {dayjs(global?.jour ?? etats[0].jour).format("DD/MM")}. Jamais un diagnostic.</p>
            </>
          )}
        </section>

        {points.length >= 3 && (
          <section className={carte}>
            <h2 className="font-bold text-slate-800">Forme, chaleur corrigée</h2>
            <p className="text-sm text-slate-500">
              La FC {soi ? "que tu aurais eue" : "qu'aurait eue l'athlète"} à {allure(modele?.v_reference)}/km, au frais et sur le plat : plus bas = plus en forme. En orange, la même sans la correction de chaleur — ce que croit voir une montre l&apos;été.
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#f1f5f9" />
                  <XAxis dataKey="jour" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis domain={["dataMin - 3", "dataMax + 3"]} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="corrigee" name="Corrigée de la chaleur" stroke="#2563eb" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="brute" name="Sans correction" stroke="#ea580c" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {modele && (
              <p className="text-sm text-slate-600">
                1 °C de chaleur au-delà de 13 °C (WBGT) {soi ? "te" : "lui"} coûte {n1(modele.c)} bpm · erreur typique {n1(modele.erreur_typique)} bpm · {modele.n_seances} sorties.{" "}
                <strong className={valide ? "text-emerald-700" : "text-orange-600"}>
                  {valide ? "Test réussi : la forme corrigée ne suit plus la météo." : "Test pas encore réussi : la forme corrigée suit encore un peu la météo, lecture provisoire."}
                </strong>
              </p>
            )}
          </section>
        )}

        {cs && (
          <section className={carte}>
            <h2 className="font-bold text-slate-800">Vitesse critique</h2>
            <p className="text-sm text-slate-500">L&apos;allure tenable longtemps sans s&apos;épuiser : la frontière entre effort « lourd » et « sévère ». L&apos;indicateur de forme le plus robuste, indépendant de la FC.</p>
            <p className="text-3xl font-extrabold text-slate-800">{allure(cs.actuel.cs)}<span className="text-base font-bold text-slate-500">/km</span></p>
            <p className="text-sm text-slate-500">± {n1(cs.actuel.erreur_pct)} % · réserve D′ {Math.round(Number(cs.actuel.d_prime))} m · {cs.actuel.n_efforts} durées d&apos;effort sur 90 jours, chaleur corrigée</p>
            {cs.avant && (
              <p className={`text-sm font-bold ${Number(cs.actuel.cs) >= Number(cs.avant.cs) ? "text-emerald-700" : "text-orange-600"}`}>
                Il y a 6 semaines : {allure(cs.avant.cs)}/km ({Number(cs.actuel.cs) >= Number(cs.avant.cs) ? "+" : ""}{n1((Number(cs.actuel.cs) / Number(cs.avant.cs) - 1) * 100)} %)
              </p>
            )}
            <p className="text-xs text-slate-400">Estimée sur les meilleurs efforts d&apos;entraînement de 3 à 20 min : sous-estimée si ces durées n&apos;ont pas été courues à fond.</p>
          </section>
        )}

        {soi && nuits.some((n) => n.vfc != null) && (
          <section className={carte}>
            <h2 className="font-bold text-slate-800">Ma récupération</h2>
            <p className="text-sm text-slate-500">Tes nuits des 30 derniers jours. Pour toi seul : ton coach n&apos;en voit que l&apos;état, jamais les chiffres.</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={nuits} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#f1f5f9" />
                  <XAxis dataKey="jour" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis yAxisId="v" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis yAxisId="f" orientation="right" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="v" type="monotone" dataKey="vfc" name="VFC nocturne (ms)" stroke="#7c3aed" strokeWidth={2} dot={false} connectNulls />
                  <Line yAxisId="f" type="monotone" dataKey="fc" name="FC de repos" stroke="#ef4444" strokeWidth={1.5} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-slate-400">Une nuit seule ne dit rien : c&apos;est la tendance contre ta normale qui compte.</p>
          </section>
        )}
      </div>
    </main>
  );
}

export default function Page() {
  return <Suspense><Progres /></Suspense>;
}
