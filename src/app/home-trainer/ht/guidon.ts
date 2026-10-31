// ─────────────────────────────────────────────────────────────────────────
// Home-trainer : le guidon Zwift Ride (31/10/2026), sans la plateforme.
// Protocole Bluetooth non officiel de Zwift, décodé par la communauté
// (MAKINOLO, RideToWoosh, SwiftControl) : non chiffré, poignée de main
// « RideOn », puis un message 0x23 (protobuf) par changement de boutons, champ 1
// = masque des boutons, un bit à 0 = bouton appuyé. Une mise à jour du
// guidon par Zwift peut le casser : l'écran reste alors utilisable seul.
// Copie de App-Coach/lib/ht/guidon.ts — garder les deux identiques.
// ─────────────────────────────────────────────────────────────────────────

export const GUIDON = {
  service: "0000fc82-0000-1000-8000-00805f9b34fb",
  serviceAncien: "00000001-19ca-4651-86e5-fa29dcdd09d1",
  boutons: "00000002-19ca-4651-86e5-fa29dcdd09d1",   // notifications
  ecrire: "00000003-19ca-4651-86e5-fa29dcdd09d1",    // poignée de main
  reponses: "00000004-19ca-4651-86e5-fa29dcdd09d1",  // indications
  rideOn: new Uint8Array([0x52, 0x69, 0x64, 0x65, 0x4f, 0x6e]),   // « RideOn »
};

export type ActionGuidon = "plus" | "moins" | "pause" | "suivante" | "precedente";

const BITS: Record<number, ActionGuidon> = {
  8: "plus", 12: "plus",          // palettes « monter » gauche et droite
  9: "moins", 13: "moins",        // palettes « descendre »
  4: "pause",                     // A
  2: "suivante", 6: "suivante",   // D-pad droite, Y
  0: "precedente", 7: "precedente", // D-pad gauche, Z
};

/** Masque des boutons appuyés (1 = appuyé) d'un message 0x23, ou null. */
export function lireBoutons(v: DataView): number | null {
  if (v.byteLength < 2 || v.getUint8(0) !== 0x23) return null;
  let i = 1;
  while (i < v.byteLength) {
    const tag = v.getUint8(i++), champ = tag >> 3, type = tag & 7;
    if (type === 0) {
      let x = 0, dec = 0;
      while (i < v.byteLength) { const b = v.getUint8(i++); x += (b & 0x7f) * 2 ** dec; if (!(b & 0x80)) break; dec += 7; }
      if (champ === 1) return ~x & 0x7fff;
    } else if (type === 2) {
      let l = 0, dec = 0;
      while (i < v.byteLength) { const b = v.getUint8(i++); l += (b & 0x7f) * 2 ** dec; if (!(b & 0x80)) break; dec += 7; }
      i += l;
    } else return null;
  }
  return null;
}

/** Ne garde que les boutons qui viennent d'être enfoncés (pas ceux qu'on tient). */
export function nouveauxAppuis(avant: number, maintenant: number): ActionGuidon[] {
  const neufs = maintenant & ~avant;
  return Object.entries(BITS).filter(([b]) => neufs & (1 << Number(b))).map(([, a]) => a);
}
