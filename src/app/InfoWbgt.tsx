"use client";
import { useState } from "react";

// « WBGT ⓘ » cliquable : un terme qui fait décrocher si on ne l'explique pas.
// Même texte que l'app (App-Coach, components/InfoWbgt.tsx).
export default function InfoWbgt() {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} className="font-bold text-blue-600 hover:underline">WBGT ⓘ</button>
      {ouvert && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" onClick={() => setOuvert(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-3 text-slate-700 text-sm leading-relaxed" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold text-slate-800">Le WBGT, c&apos;est quoi ?</h3>
            <p>Un indice qui mesure ce que la chaleur fait vraiment au corps, pas seulement ce qu&apos;affiche le thermomètre. C&apos;est la référence des fédérations sportives.</p>
            <ul className="space-y-1">
              <li><strong>70 % l&apos;humidité et le vent</strong> : ta sueur s&apos;évapore-t-elle pour te refroidir ?</li>
              <li><strong>20 % le soleil</strong> : le rayonnement direct et celui du bitume.</li>
              <li><strong>10 % la température de l&apos;air.</strong></li>
            </ul>
            <p>C&apos;est pour ça que 25 °C à 80 % d&apos;humidité pèsent autant que 30 °C au sec. Le chiffre est toujours plus bas que la température : ce n&apos;est pas un « ressenti ».</p>
            <ul className="border-t border-slate-100 pt-2 space-y-0.5">
              <li><strong>Sous 13-15</strong> : idéal pour l&apos;endurance</li>
              <li><strong>20-23</strong> : chaud, la performance baisse nettement</li>
              <li><strong>Au-delà de 28</strong> : les grandes courses sont souvent annulées</li>
            </ul>
            <p className="text-xs text-slate-400">App-Coach le calcule avec la météo réelle à l&apos;endroit et à l&apos;heure de ta sortie, jamais avec le capteur de la montre, chauffé par ton poignet. Repères indicatifs : c&apos;est ton propre modèle qui dit où toi, tu commences à payer.</p>
            <button onClick={() => setOuvert(false)} className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700">Compris</button>
          </div>
        </div>
      )}
    </>
  );
}
