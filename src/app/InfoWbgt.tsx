"use client";
import { useState } from "react";

// « Pourquoi ? ⓘ » cliquable : explique en trois phrases pourquoi on parle de
// chaleur et pas de température. Même texte que l'app (App-Coach, components/InfoWbgt.tsx).
export default function InfoWbgt() {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} className="font-bold text-blue-600 hover:underline">Pourquoi ? ⓘ</button>
      {ouvert && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" onClick={() => setOuvert(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-3 text-slate-600 leading-relaxed" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold text-slate-800">La chaleur, pas que la température</h3>
            <p>Quand l&apos;air est humide, ta sueur sèche mal et ne te refroidit plus : par 25 °C humides, on souffre autant que par 30 °C au sec. Le soleil compte aussi.</p>
            <p>On le calcule avec la vraie météo de l&apos;endroit où tu as couru, pas avec ta montre, qui chauffe sur ton poignet.</p>
            <button onClick={() => setOuvert(false)} className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700">Compris</button>
          </div>
        </div>
      )}
    </>
  );
}
