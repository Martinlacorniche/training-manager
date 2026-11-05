"use client";
// « Mes chiffres » (refonte du 05/11/2026) : l'année en heures faites par
// sport. Plus de podiums « Record » : règle produit, pas de record, on se
// compare à soi-même. Même graphique que la page Équipe du coach.
import Coque, { useCoque } from "../../Coque";
import VolumeAnnee from "../../VolumeAnnee";

function MesChiffres() {
  const { moi } = useCoque();
  if (!moi) return <div className="text-slate-400 font-semibold">Chargement…</div>;
  return (
    <div className="space-y-5 max-w-[1700px]">
      <header>
        <h1 className="text-[28px] font-extrabold">Mes chiffres</h1>
        <p className="text-[15px] font-semibold text-slate-500">Ce que tu as fait, semaine après semaine. Ta forme et tes tests sont dans Progrès.</p>
      </header>
      <VolumeAnnee userId={moi.id} titre="Mon année" />
    </div>
  );
}

export default function Page() {
  return <Coque titre="Mes chiffres"><MesChiffres /></Coque>;
}
