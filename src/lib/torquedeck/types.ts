export type BusKind = "HS-CAN" | "MS-CAN" | "LIN";

export type ModuleStatus = "pass" | "fault" | "absent" | "scanning" | "unknown";

export interface EcuModule {
  id: string;
  name: string;
  abbr: string;
  bus: BusKind;
  address: string;
  partNumber: string;
  softwareId: string;
  hardwareId: string;
  status: ModuleStatus;
  x: number;
  y: number;
  dtcs: string[];
}

export type DtcSeverity = "critical" | "warning" | "info";
export type DtcState = "current" | "pending" | "permanent" | "history";

export interface FreezeFrame {
  rpm: number;
  speedKph: number;
  coolantC: number;
  loadPct: number;
  fuelTrimShort: number;
  fuelTrimLong: number;
  intakeAirC: number;
  mapKpa: number;
  timingAdvance: number;
  runtimeSec: number;
}

export interface Dtc {
  code: string;
  module: string;
  description: string;
  severity: DtcSeverity;
  state: DtcState;
  system: "Powertrain" | "Body" | "Chassis" | "Network";
  occurrences: number;
  causes: string[];
  freezeFrame?: FreezeFrame;
}

export interface PidDefinition {
  id: string;
  pid: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  group: "Engine" | "Fuel" | "Emissions" | "Chassis" | "Electrical";
}

export interface PidSample {
  t: number;
  [key: string]: number;
}

export interface VehicleProfile {
  vin: string;
  year: number;
  make: string;
  model: string;
  engine: string;
  protocol: string;
  odometerKm: number;
}

export interface SessionRecord {
  id: string;
  savedAt: string;
  vehicle: VehicleProfile;
  modules: { name: string; status: ModuleStatus; dtcCount: number }[];
  dtcs: Dtc[];
  notes: string;
  technician: string;
  batteryVolts: number;
}

export type LinkKind = "demo" | "bluetooth" | "serial";
export type LinkState = "disconnected" | "connecting" | "connected";

export interface CanFrame {
  id: string;
  ts: number;
  canId: string;
  dlc: number;
  data: string[];
  dir: "rx" | "tx";
  note?: string;
}

export interface ActuatorTest {
  id: string;
  name: string;
  module: string;
  description: string;
  kind: "toggle" | "sweep" | "pulse";
  durationMs: number;
  unit?: string;
  warning?: string;
}

export interface ServiceReset {
  id: string;
  name: string;
  module: string;
  description: string;
  steps: string[];
  requiresIgnition: boolean;
}

export interface CodingParameter {
  id: string;
  name: string;
  module: string;
  did: string;
  options: string[];
  value: string;
  note: string;
}
