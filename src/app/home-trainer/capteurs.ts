// Home-trainer, côté site : le Bluetooth de Chrome (Web Bluetooth). Sous
// Linux, Chrome demande d'activer « Experimental Web Platform features »
// dans chrome://flags. Les octets sont lus par ht/ftms.ts, partagé avec l'app.
// Mode simulateur (?simu=1) : un faux home-trainer qui tient la consigne,
// pour essayer l'écran sans vélo.

import { Commande, lireCardio, lireIndoorBike, lirePuissance, type Mesure, UUID } from "./ht/ftms";
import type { Consigne } from "./ht/moteur";

export type Source = "ht" | "pedales" | "cardio";
export type Ecoute = (src: Source, m: Mesure) => void;
export type EtatCapteur = { nom: string; connecte: boolean } | null;

/* eslint-disable @typescript-eslint/no-explicit-any */
const bt = () => (typeof navigator !== "undefined" ? (navigator as any).bluetooth : undefined);
export const bluetoothDispo = () => !!bt();

const FILTRES: Record<Source, any> = {
  ht: { filters: [{ services: [UUID.ftms] }], optionalServices: [UUID.power, UUID.hr] },
  pedales: { filters: [{ services: [UUID.power] }] },
  cardio: { filters: [{ services: [UUID.hr] }] },
};

export class Capteur {
  device: any = null;
  private cp: any = null;
  private file: Promise<unknown> = Promise.resolve();
  private derniere = "";
  private controle = false;
  private etatPuissance: { tours?: number; t?: number; cadence?: number } = {};
  onEtat: (e: EtatCapteur) => void = () => {};

  constructor(readonly src: Source, private ecoute: Ecoute) {}

  async choisir() {
    this.device = await bt().requestDevice(FILTRES[this.src]);
    this.device.addEventListener("gattserverdisconnected", () => this.reconnecter());
    await this.connecter();
  }

  private async connecter() {
    const gatt = await this.device.gatt.connect();
    if (this.src === "ht") {
      const s = await gatt.getPrimaryService(UUID.ftms);
      const data = await s.getCharacteristic(UUID.indoorBikeData);
      data.addEventListener("characteristicvaluechanged", (ev: any) => this.ecoute("ht", lireIndoorBike(ev.target.value)));
      await data.startNotifications();
      this.cp = await s.getCharacteristic(UUID.controlPoint);
      await this.cp.startNotifications();      // les réponses arrivent en « indications »
      this.controle = false; this.derniere = "";
    } else if (this.src === "pedales") {
      const s = await gatt.getPrimaryService(UUID.power);
      const c = await s.getCharacteristic(UUID.powerMeasurement);
      c.addEventListener("characteristicvaluechanged", (ev: any) => this.ecoute("pedales", lirePuissance(ev.target.value, this.etatPuissance)));
      await c.startNotifications();
    } else {
      const s = await gatt.getPrimaryService(UUID.hr);
      const c = await s.getCharacteristic(UUID.hrMeasurement);
      c.addEventListener("characteristicvaluechanged", (ev: any) => this.ecoute("cardio", { bpm: lireCardio(ev.target.value) }));
      await c.startNotifications();
    }
    this.onEtat({ nom: this.device.name ?? "Capteur", connecte: true });
  }

  private async reconnecter() {
    this.onEtat({ nom: this.device?.name ?? "Capteur", connecte: false });
    for (let k = 0; k < 10 && this.device; k++) {
      await new Promise((r) => setTimeout(r, 1000 + k * 1000));
      try { await this.connecter(); return; } catch { /* on réessaie */ }
    }
  }

  private ecrire(octets: Uint8Array) {
    // Une seule opération Bluetooth à la fois : on les enfile.
    this.file = this.file.then(() => this.cp?.writeValueWithResponse(octets)).catch(() => {});
    return this.file;
  }

  /** N'envoie que ce qui change : le home-trainer n'aime pas être bombardé. */
  async consigne(c: Consigne) {
    if (!this.cp) return;
    const cle = c.type === "erg" ? `e${c.w}` : `p${c.pct}`;
    if (cle === this.derniere) return;
    this.derniere = cle;
    if (!this.controle) { await this.ecrire(Commande.prendreLaMain()); await this.ecrire(Commande.demarrer()); this.controle = true; }
    await this.ecrire(c.type === "erg" ? Commande.puissance(c.w) : Commande.pente(c.pct));
  }

  oublier() {
    const d = this.device; this.device = null; this.cp = null;
    try { d?.gatt?.disconnect(); } catch { /* déjà parti */ }
    this.onEtat(null);
  }
}

/** Faux home-trainer (?simu=1) : tient l'ERG à ±3 %, cadence 90, cardio qui suit. */
export class Simulateur {
  private w = 0; private bpm = 95; private h: ReturnType<typeof setInterval> | null = null; private pente = 0;
  constructor(private ecoute: Ecoute) {}
  demarrer() {
    this.h = setInterval(() => {
      const cible = this.pente ? 150 + this.pente * 20 : this.w;
      const w = Math.max(0, Math.round(cible * (0.97 + Math.random() * 0.06)));
      this.bpm += ((90 + w / 3.2) - this.bpm) * 0.05;
      this.ecoute("ht", { watts: w, cadence: 88 + Math.round(Math.random() * 4), vitesse: 30 });
      this.ecoute("cardio", { bpm: Math.round(this.bpm) });
    }, 500);
  }
  consigne(c: Consigne) { if (c.type === "erg") { this.w = c.w; this.pente = 0; } else this.pente = c.pct; }
  arreter() { if (this.h) clearInterval(this.h); }
}
