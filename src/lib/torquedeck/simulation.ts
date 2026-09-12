import type { CanFrame } from "./types";

/** Deterministic-ish pseudo noise so telemetry looks alive but plausible. */
function noise(amplitude: number) {
  return (Math.random() - 0.5) * 2 * amplitude;
}

export interface TelemetrySnapshot {
  t: number;
  rpm: number;
  speed: number;
  coolant: number;
  load: number;
  maf: number;
  map: number;
  o2: number;
  stft: number;
  ltft: number;
  throttle: number;
  intake: number;
  timing: number;
  battery: number;
  fuelrail: number;
}

export class SimulationEngine {
  private startedAt = Date.now();
  private coolant = 24;
  private rpm = 780;
  private speed = 0;
  private phase = 0;
  private cruise = false;

  reset() {
    this.startedAt = Date.now();
    this.coolant = 24;
    this.rpm = 780;
    this.speed = 0;
    this.phase = 0;
  }

  tick(): TelemetrySnapshot {
    this.phase += 0.28;
    const elapsed = (Date.now() - this.startedAt) / 1000;

    // Coolant warms toward 92C with a thermostat wobble.
    const target = 92;
    this.coolant += (target - this.coolant) * 0.004 + noise(0.12);
    if (this.coolant > 88) this.coolant += Math.sin(this.phase / 6) * 0.25;

    // Occasional light throttle blips, otherwise idle.
    if (Math.random() < 0.02) this.cruise = !this.cruise;
    const targetRpm = this.cruise ? 1850 : 790;
    this.rpm += (targetRpm - this.rpm) * 0.08 + noise(22);
    this.rpm = Math.max(620, Math.min(4200, this.rpm));

    const targetSpeed = this.cruise ? 62 : 0;
    this.speed += (targetSpeed - this.speed) * 0.05 + noise(0.4);
    this.speed = Math.max(0, this.speed);

    const load = Math.max(8, Math.min(96, (this.rpm - 600) / 36 + noise(3)));
    const throttle = Math.max(4, Math.min(100, load * 0.85 + noise(2)));
    const maf = Math.max(1.6, (this.rpm / 1000) * 6.4 + load * 0.22 + noise(0.8));
    const map = Math.max(28, 30 + load * 1.4 + noise(2.5));
    // O2 sensor swings as a lambda sine wave around stoich.
    const o2 = Math.max(0.05, Math.min(0.95, 0.45 + Math.sin(this.phase) * 0.33 + noise(0.03)));
    const stft = Math.sin(this.phase * 0.7) * 4 + noise(1.1);
    const ltft = 6.4 + Math.sin(elapsed / 40) * 1.6 + noise(0.3);
    const intake = 22 + this.coolant * 0.12 + noise(0.5);
    const timing = 8 + Math.sin(this.phase * 0.5) * 4 + noise(0.6);
    const battery = (this.rpm > 900 ? 14.25 : 13.9) + noise(0.09);
    const fuelrail = 320 + load * 9 + noise(14);

    return {
      t: Date.now(),
      rpm: Math.round(this.rpm),
      speed: Math.round(this.speed),
      coolant: +this.coolant.toFixed(1),
      load: +load.toFixed(1),
      maf: +maf.toFixed(2),
      map: +map.toFixed(1),
      o2: +o2.toFixed(3),
      stft: +stft.toFixed(1),
      ltft: +ltft.toFixed(1),
      throttle: +throttle.toFixed(1),
      intake: +intake.toFixed(1),
      timing: +timing.toFixed(1),
      battery: +battery.toFixed(2),
      fuelrail: Math.round(fuelrail),
    };
  }
}

const CAN_IDS = ["0x7E0", "0x7E8", "0x0C9", "0x1A0", "0x224", "0x316", "0x420", "0x4B0", "0x760", "0x768"];

let frameSeq = 0;

export function randomFrame(now = Date.now()): CanFrame {
  const canId = CAN_IDS[Math.floor(Math.random() * CAN_IDS.length)] ?? "0x7E8";
  const dlc = 8;
  const data = Array.from({ length: dlc }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .toUpperCase()
      .padStart(2, "0"),
  );
  frameSeq += 1;
  return {
    id: `f${now}-${frameSeq}`,
    ts: now,
    canId,
    dlc,
    data,
    dir: canId === "0x7E0" ? "tx" : "rx",
  };
}

/** Very small ELM327 emulator used when no hardware adapter is attached. */
export function simulateElmResponse(raw: string, telemetry: TelemetrySnapshot | null): string[] {
  const cmd = raw.trim().toUpperCase().replace(/\s+/g, " ");
  const rpm = telemetry?.rpm ?? 780;
  const coolant = telemetry?.coolant ?? 88;

  const hex = (n: number, width = 2) =>
    Math.max(0, Math.round(n))
      .toString(16)
      .toUpperCase()
      .padStart(width, "0");

  switch (cmd) {
    case "AT Z":
      return ["ELM327 v1.5", "", ">"];
    case "AT I":
      return ["ELM327 v1.5 (TORQUEDECK SIM)", ">"];
    case "AT E0":
    case "AT L0":
    case "AT S0":
    case "AT H1":
    case "AT H0":
      return ["OK", ">"];
    case "AT DP":
      return ["ISO 15765-4 (CAN 11/500)", ">"];
    case "AT RV":
      return [`${(telemetry?.battery ?? 14.1).toFixed(1)}V`, ">"];
    case "03":
      return ["43 03 03 00 04 01 C0 200", "P0300 P0401 C0200", ">"];
    case "04":
      return ["44", "CODES CLEARED", ">"];
    case "01 0C": {
      const v = rpm * 4;
      return [`41 0C ${hex(v >> 8)} ${hex(v & 0xff)}`, `${rpm} rpm`, ">"];
    }
    case "01 05":
      return [`41 05 ${hex(coolant + 40)}`, `${Math.round(coolant)} °C`, ">"];
    case "01 0D":
      return [`41 0D ${hex(telemetry?.speed ?? 0)}`, `${telemetry?.speed ?? 0} km/h`, ">"];
    case "22 11 01":
      return ["62 11 01 4B 42 33 41 2D 31 32 41 36 35 30", "KB3A-12A650", ">"];
    case "09 02":
      return ["49 02 01 31 48 47 43 4D 38 32 36 33 33 41 30 30 34 33 35 32", "VIN 1HGCM82633A004352", ">"];
    default:
      if (cmd.startsWith("AT SP")) return ["OK", ">"];
      if (cmd.startsWith("AT")) return ["OK", ">"];
      if (/^[0-9A-F ]+$/.test(cmd)) return ["NO DATA", ">"];
      return ["?", ">"];
  }
}
