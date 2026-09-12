export type PidId =
  | "rpm"
  | "speed"
  | "coolant"
  | "intakeTemp"
  | "throttle"
  | "stft1"
  | "ltft1"
  | "stft2"
  | "ltft2"
  | "map"
  | "maf"
  | "o2b1s1"
  | "o2b1s2"
  | "fuelLevel"
  | "voltage"
  | "timing"
  | "engineLoad"
  | "runtime"
  | "ambient"
  | "fuelPressure"
  | "baro";

export interface PidDef {
  id: PidId;
  /** OBD-II Mode 01 PID, hex string without mode */
  pid: string;
  label: string;
  short: string;
  unit: string;
  min: number;
  max: number;
  /** number of data bytes expected */
  bytes: number;
  decode: (b: number[]) => number;
  /** green band for the gauge, optional */
  nominal?: [number, number];
  decimals?: number;
}

const c = (v: number, d = 0) => Number(v.toFixed(d));

export const PIDS: PidDef[] = [
  {
    id: "rpm",
    pid: "0C",
    label: "Engine Speed",
    short: "RPM",
    unit: "rpm",
    min: 0,
    max: 8000,
    bytes: 2,
    nominal: [600, 4000],
    decode: (b) => c(((b[0] ?? 0) * 256 + (b[1] ?? 0)) / 4),
  },
  {
    id: "speed",
    pid: "0D",
    label: "Vehicle Speed",
    short: "Speed",
    unit: "km/h",
    min: 0,
    max: 255,
    bytes: 1,
    decode: (b) => b[0] ?? 0,
  },
  {
    id: "coolant",
    pid: "05",
    label: "Coolant Temp",
    short: "Coolant",
    unit: "°C",
    min: -40,
    max: 150,
    bytes: 1,
    nominal: [70, 105],
    decode: (b) => (b[0] ?? 0) - 40,
  },
  {
    id: "intakeTemp",
    pid: "0F",
    label: "Intake Air Temp",
    short: "IAT",
    unit: "°C",
    min: -40,
    max: 120,
    bytes: 1,
    decode: (b) => (b[0] ?? 0) - 40,
  },
  {
    id: "throttle",
    pid: "11",
    label: "Throttle Position",
    short: "Throttle",
    unit: "%",
    min: 0,
    max: 100,
    bytes: 1,
    decimals: 1,
    decode: (b) => c(((b[0] ?? 0) * 100) / 255, 1),
  },
  {
    id: "engineLoad",
    pid: "04",
    label: "Calculated Load",
    short: "Load",
    unit: "%",
    min: 0,
    max: 100,
    bytes: 1,
    decimals: 1,
    decode: (b) => c(((b[0] ?? 0) * 100) / 255, 1),
  },
  {
    id: "stft1",
    pid: "06",
    label: "Short Fuel Trim B1",
    short: "STFT B1",
    unit: "%",
    min: -100,
    max: 99,
    bytes: 1,
    nominal: [-10, 10],
    decimals: 1,
    decode: (b) => c(((b[0] ?? 0) - 128) * (100 / 128), 1),
  },
  {
    id: "ltft1",
    pid: "07",
    label: "Long Fuel Trim B1",
    short: "LTFT B1",
    unit: "%",
    min: -100,
    max: 99,
    bytes: 1,
    nominal: [-10, 10],
    decimals: 1,
    decode: (b) => c(((b[0] ?? 0) - 128) * (100 / 128), 1),
  },
  {
    id: "stft2",
    pid: "08",
    label: "Short Fuel Trim B2",
    short: "STFT B2",
    unit: "%",
    min: -100,
    max: 99,
    bytes: 1,
    nominal: [-10, 10],
    decimals: 1,
    decode: (b) => c(((b[0] ?? 0) - 128) * (100 / 128), 1),
  },
  {
    id: "ltft2",
    pid: "09",
    label: "Long Fuel Trim B2",
    short: "LTFT B2",
    unit: "%",
    min: -100,
    max: 99,
    bytes: 1,
    nominal: [-10, 10],
    decimals: 1,
    decode: (b) => c(((b[0] ?? 0) - 128) * (100 / 128), 1),
  },
  {
    id: "map",
    pid: "0B",
    label: "Manifold Pressure",
    short: "MAP",
    unit: "kPa",
    min: 0,
    max: 255,
    bytes: 1,
    decode: (b) => b[0] ?? 0,
  },
  {
    id: "maf",
    pid: "10",
    label: "Mass Air Flow",
    short: "MAF",
    unit: "g/s",
    min: 0,
    max: 400,
    bytes: 2,
    decimals: 2,
    decode: (b) => c(((b[0] ?? 0) * 256 + (b[1] ?? 0)) / 100, 2),
  },
  {
    id: "o2b1s1",
    pid: "14",
    label: "O2 Sensor B1S1",
    short: "O2 B1S1",
    unit: "V",
    min: 0,
    max: 1.275,
    bytes: 2,
    decimals: 3,
    nominal: [0.1, 0.9],
    decode: (b) => c((b[0] ?? 0) / 200, 3),
  },
  {
    id: "o2b1s2",
    pid: "15",
    label: "O2 Sensor B1S2",
    short: "O2 B1S2",
    unit: "V",
    min: 0,
    max: 1.275,
    bytes: 2,
    decimals: 3,
    nominal: [0.1, 0.9],
    decode: (b) => c((b[0] ?? 0) / 200, 3),
  },
  {
    id: "fuelLevel",
    pid: "2F",
    label: "Fuel Level",
    short: "Fuel",
    unit: "%",
    min: 0,
    max: 100,
    bytes: 1,
    decimals: 1,
    decode: (b) => c(((b[0] ?? 0) * 100) / 255, 1),
  },
  {
    id: "voltage",
    pid: "42",
    label: "Module Voltage",
    short: "Battery",
    unit: "V",
    min: 0,
    max: 18,
    bytes: 2,
    decimals: 2,
    nominal: [13.2, 14.8],
    decode: (b) => c(((b[0] ?? 0) * 256 + (b[1] ?? 0)) / 1000, 2),
  },
  {
    id: "timing",
    pid: "0E",
    label: "Timing Advance",
    short: "Timing",
    unit: "°",
    min: -64,
    max: 64,
    bytes: 1,
    decimals: 1,
    decode: (b) => c((b[0] ?? 0) / 2 - 64, 1),
  },
  {
    id: "ambient",
    pid: "46",
    label: "Ambient Air Temp",
    short: "Ambient",
    unit: "°C",
    min: -40,
    max: 80,
    bytes: 1,
    decode: (b) => (b[0] ?? 0) - 40,
  },
  {
    id: "fuelPressure",
    pid: "0A",
    label: "Fuel Pressure",
    short: "Fuel Press",
    unit: "kPa",
    min: 0,
    max: 765,
    bytes: 1,
    decode: (b) => (b[0] ?? 0) * 3,
  },
  {
    id: "baro",
    pid: "33",
    label: "Barometric Pressure",
    short: "Baro",
    unit: "kPa",
    min: 0,
    max: 255,
    bytes: 1,
    decode: (b) => b[0] ?? 0,
  },
  {
    id: "runtime",
    pid: "1F",
    label: "Run Time Since Start",
    short: "Runtime",
    unit: "s",
    min: 0,
    max: 65535,
    bytes: 2,
    decode: (b) => (b[0] ?? 0) * 256 + (b[1] ?? 0),
  },
];

export const PID_BY_ID: Record<string, PidDef> = Object.fromEntries(
  PIDS.map((p) => [p.id, p]),
);

/** PIDs shown on the main gauge cluster, in order. */
export const DASH_PIDS: PidId[] = [
  "rpm",
  "speed",
  "coolant",
  "voltage",
  "throttle",
  "engineLoad",
  "intakeTemp",
  "maf",
];

export const GRAPH_PIDS: PidId[] = ["rpm", "speed", "coolant", "throttle", "maf", "voltage"];
