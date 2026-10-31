// Home-trainer, côté site : le Bluetooth de Chrome (Web Bluetooth). Sous
// Linux, Chrome demande d'activer « Experimental Web Platform features »
// dans chrome://flags. Les octets sont lus par ht/ftms.ts, partagé avec l'app.
// Mode simulateur (?simu=1) : un faux home-trainer qui tient la consigne,
// pour essayer l'écran sans vélo.

import { Commande, lireCardio, lireIndoorBike, lirePuissance, lireRR, type Mesure, UUID } from "./ht/ftms";
import type { Consigne } from "./ht/moteur";
import { GUIDON, lireBoutons, nouveauxAppuis, type ActionGuidon } from "./ht/guidon";

export type Source = "ht" | "pedales" | "cardio" | "guidon";
export type Ecoute = (src: Source, m: Mesure) => void;
export type EtatCapteur = { nom: string; connecte: boolean } | null;

/* eslint-disable @typescript-eslint/no-explicit-any */
const bt = () => (typeof navigator !== "undefined" ? (navigator as any).bluetooth : undefined);
export const bluetoothDispo = () => !!bt();

const FILTRES: Record<Source, any> = {
  ht: { filters: [{ services: [UUID.ftms] }], optionalServices: [UUID.power, UUID.hr] },
  pedales: { filters: [{ services: [UUID.power] }] },
  cardio: { filters: [{ services: [UUID.hr] }] },
  // Guidon Zwift Ride : il ne s'annonce pas toujours par son service, on accepte aussi son nom
  guidon: { filters: [{ services: [GUIDON.service] }, { namePrefix: "Zwift" }], optionalServices: [GUIDON.service, GUIDON.serviceAncien] },
};

// Les appareils déjà choisis sont retenus (dans ce navigateur) : au retour
// sur la page, ils se reconnectent seuls, sans repasser par la liste de Chrome.
const CLE = "ht-appareils";
const retenus = (): Partial<Record<Source, string>> => { try { return JSON.parse(localStorage.getItem(CLE) ?? "{}"); } catch { return {}; } };
const retenir = (src: Source, id: string | null) => {
  try { const r = retenus(); if (id) r[src] = id; else delete r[src]; localStorage.setItem(CLE, JSON.stringify(r)); } catch { /* navigation privée */ }
};
const delai = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, ko) => setTimeout(() => ko(new Error("trop long")), ms))]);

/** Un seul pilote à la fois : si Zwift, MyWhoosh ou l'app Tacx tient le
 *  home-trainer, la connexion échoue. On le dit en clair. */
export const messageConnexion = (e: unknown) => {
  const m = (e as Error)?.message ?? "";
  if (/cancel/i.test(m)) return null;
  return "Connexion impossible. Ferme Zwift, MyWhoosh ou l'app Tacx (le home-trainer n'accepte qu'une app à la fois), puis réessaie.";
};

export class Capteur {
  device: any = null;
  private cp: any = null;
  private file: Promise<unknown> = Promise.resolve();
  private derniere = "";
  private controle = false;
  private actif = true;
  private enCours = false;
  private etatPuissance: { tours?: number; t?: number; cadence?: number } = {};
  private ecouteurs: { c: any; f: (ev: any) => void }[] = [];
  onEtat: (e: EtatCapteur) => void = () => {};
  surAction: (a: ActionGuidon) => void = () => {};
  private boutons = 0;

  constructor(readonly src: Source, private ecoute: Ecoute) {}

  /** La liste de Chrome (il faut un clic). */
  async choisir() {
    this.adopter(await bt().requestDevice(FILTRES[this.src]));
    await this.connecter();
  }

  /** Sans clic : l'appareil retenu la dernière fois, s'il est autorisé et allumé. */
  async retrouver(): Promise<boolean> {
    const id = retenus()[this.src];
    if (!id || !bt()?.getDevices) return false;
    const d = (await bt().getDevices()).find((x: any) => x.id === id);
    if (!d) return false;
    this.adopter(d);
    this.onEtat({ nom: d.name ?? "Capteur", connecte: false });
    try { await this.connecter(); } catch { this.reconnecter(); }
    return true;
  }

  private adopter(d: any) {
    this.device = d;
    this.actif = true;
    d.addEventListener("gattserverdisconnected", () => this.reconnecter());
    retenir(this.src, d.id);
  }

  private ecouter(c: any, f: (ev: any) => void) {
    // Après une reconnexion, Chrome peut rendre la même caractéristique : pas de doublon d'écoute.
    for (const e of this.ecouteurs.filter((x) => x.c === c)) c.removeEventListener("characteristicvaluechanged", e.f);
    this.ecouteurs = this.ecouteurs.filter((x) => x.c !== c);
    c.addEventListener("characteristicvaluechanged", f);
    this.ecouteurs.push({ c, f });
  }

  private async connecter() {
    const gatt = await delai(this.device.gatt.connect(), 10000) as any;
    if (this.src === "ht") {
      const s = await gatt.getPrimaryService(UUID.ftms);
      const data = await s.getCharacteristic(UUID.indoorBikeData);
      this.ecouter(data, (ev: any) => this.ecoute("ht", lireIndoorBike(ev.target.value)));
      await data.startNotifications();
      this.cp = await s.getCharacteristic(UUID.controlPoint);
      await this.cp.startNotifications();      // les réponses arrivent en « indications »
      this.controle = false; this.derniere = "";   // la consigne repart à la prochaine image
    } else if (this.src === "pedales") {
      const s = await gatt.getPrimaryService(UUID.power);
      const c = await s.getCharacteristic(UUID.powerMeasurement);
      this.ecouter(c, (ev: any) => this.ecoute("pedales", lirePuissance(ev.target.value, this.etatPuissance)));
      await c.startNotifications();
    } else if (this.src === "guidon") {
      let s: any;
      try { s = await gatt.getPrimaryService(GUIDON.service); } catch { s = await gatt.getPrimaryService(GUIDON.serviceAncien); }
      const c = await s.getCharacteristic(GUIDON.boutons);
      this.ecouter(c, (ev: any) => {
        const m = lireBoutons(ev.target.value);
        if (m == null) return;
        nouveauxAppuis(this.boutons, m).forEach((a) => this.surAction(a));
        this.boutons = m;
      });
      await c.startNotifications();
      try { await (await s.getCharacteristic(GUIDON.reponses)).startNotifications(); } catch { /* pas indispensable */ }
      await (await s.getCharacteristic(GUIDON.ecrire)).writeValueWithResponse(GUIDON.rideOn);   // « RideOn »
    } else {
      const s = await gatt.getPrimaryService(UUID.hr);
      const c = await s.getCharacteristic(UUID.hrMeasurement);
      this.ecouter(c, (ev: any) => this.ecoute("cardio", { bpm: lireCardio(ev.target.value), rr: lireRR(ev.target.value) }));
      await c.startNotifications();
    }
    this.onEtat({ nom: this.device.name ?? "Capteur", connecte: true });
  }

  /** Coupure : on réessaie sans fin (toutes les 2 à 5 s) tant qu'on ne l'a pas oublié. */
  async reconnecter() {
    if (this.enCours || !this.device) return;
    this.enCours = true;
    this.cp = null;
    this.onEtat({ nom: this.device?.name ?? "Capteur", connecte: false });
    for (let k = 0; this.actif && this.device; k++) {
      await new Promise((r) => setTimeout(r, Math.min(5000, 2000 + k * 500)));
      if (!this.actif || !this.device) break;
      if (this.device.gatt?.connected && this.cp) break;
      try { await this.connecter(); break; } catch { /* on réessaie */ }
    }
    this.enCours = false;
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

  /** Débrancher sans l'oublier (fin de page) ou en l'oubliant (changer d'appareil). */
  oublier(definitivement = true) {
    const d = this.device; this.actif = false; this.device = null; this.cp = null;
    if (definitivement) retenir(this.src, null);
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
