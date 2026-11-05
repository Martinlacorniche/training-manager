"use client";
// La page que l'invité de l'hôtel ouvre en scannant le QR code de la borne
// (31/10/2026) : sa sortie sur le Zwift Ride, à envoyer sur SON Strava (il se
// connecte sur son téléphone, on se déconnecte aussitôt après) ou à
// télécharger. Gardée 24 h. Pas de compte, pas de nom. Design de l'app.
import { Suspense, use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { mdiAlertCircle, mdiCheckCircle, mdiDownload, mdiLightningBolt, mdiMapMarkerDistance, mdiTimerOutline, mdiTrophyOutline } from "@mdi/js";
import { Bulle, Ciel, Icone, Sur } from "../../home-trainer/ui";
import { chrono } from "../../home-trainer/Bandeau";

const FN = "https://ihigmlpgliasczlvxttd.supabase.co/functions/v1/ht-invite";

type Info = { nom: string; compliment: string | null; resume: { duree_s?: number; w?: number; km?: number } | null; envoye: boolean };

const MESSAGES: Record<string, { ok: boolean; texte: string }> = {
  ok: { ok: true, texte: "C'est sur ton Strava ! On s'est déjà déconnecté de ton compte : on ne garde rien." },
  refus: { ok: false, texte: "Strava n'a pas donné l'autorisation d'ajouter ta sortie. Tu peux réessayer." },
  erreur: { ok: false, texte: "Strava n'a pas pris la sortie. Réessaie, ou télécharge le fichier." },
  expire: { ok: false, texte: "Cette sortie a expiré (24 h)." },
};

function SortieInvite({ code }: { code: string }) {
  const q = useSearchParams();
  const [info, setInfo] = useState<Info | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const retour = MESSAGES[q.get("strava") ?? ""];

  useEffect(() => {
    fetch(`${FN}?code=${encodeURIComponent(code)}&info=1`).then((r) => r.json())
      .then((d) => (d.error ? setErreur(d.error) : setInfo(d))).catch(() => setErreur("Impossible de joindre le serveur."));
  }, [code]);

  return (
    <main className={`min-h-screen bg-[#F8FAFC] px-4 py-8`}>
      <div className="max-w-md mx-auto space-y-4">
        {erreur && <div className="rounded-2xl bg-rose-50 text-rose-700 font-extrabold px-4 py-4 flex items-center gap-2"><Icone d={mdiAlertCircle} taille={20} />{erreur}</div>}
        {info && (
          <>
            <Ciel couleurs={["#059669", "#10b981", "#34d399"]} icone={mdiTrophyOutline}>
              <Sur>Ta sortie au home-trainer</Sur>
              <div className="text-[28px] font-black mt-1">Bien joué 💪</div>
              {info.compliment && <div className="font-bold mt-1 max-w-[78%]">{info.compliment}</div>}
              <div className="flex flex-wrap gap-2 mt-4">
                {info.resume?.duree_s ? <Bulle icone={mdiTimerOutline} texte={chrono(info.resume.duree_s)} /> : null}
                {info.resume?.w ? <Bulle icone={mdiLightningBolt} texte={`${info.resume.w} W`} /> : null}
                {info.resume?.km ? <Bulle icone={mdiMapMarkerDistance} texte={`${info.resume.km} km`} /> : null}
              </div>
            </Ciel>

            {retour && (
              <div className={`rounded-2xl px-4 py-3.5 font-extrabold flex items-center gap-2 ${retour.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                <Icone d={retour.ok ? mdiCheckCircle : mdiAlertCircle} taille={20} />{retour.texte}
              </div>
            )}

            {!info.envoye && q.get("strava") !== "ok" && (
              <a href={`${FN}?code=${encodeURIComponent(code)}&strava=1`} className="w-full flex items-center justify-center gap-2 rounded-full py-4 text-white font-black text-[16px]" style={{ background: "#fc4c02", boxShadow: "0 4px 14px #fc4c0255" }}>
                Envoyer sur mon Strava
              </a>
            )}
            <a href={`${FN}?code=${encodeURIComponent(code)}&fichier=1`} className="w-full flex items-center justify-center gap-1.5 py-2 text-sm font-extrabold text-slate-500">
              <Icone d={mdiDownload} taille={17} /> Télécharger le fichier
            </a>
            <p className="text-xs text-slate-400 text-center">Tu te connectes à Strava ici, sur ton téléphone. On y dépose ta sortie puis on se déconnecte aussitôt. Ta sortie est effacée de chez nous au bout de 24 h.</p>

            <div className="rounded-[20px] bg-white border border-[#eef2f7] p-5 text-center space-y-1.5">
              <div className="font-black text-slate-800">🎯 Envie de séances comme celle-ci toute l&apos;année ?</div>
              <p className="text-sm text-slate-500 font-semibold">Un coach qui prépare ton plan, sur ton vélo comme dehors, et une app qui pilote ton home-trainer.</p>
              <a href="https://ngsportcoaching.com" className="inline-block mt-1 font-black text-blue-600">Découvrir ngsportcoaching.com →</a>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  return <Suspense fallback={null}><SortieInvite code={code} /></Suspense>;
}
