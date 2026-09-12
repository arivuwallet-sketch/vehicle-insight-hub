import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { CODING_PARAMETERS, DEMO_VEHICLE, DTC_CATALOG, ECU_MODULES } from "./data";
import { SimulationEngine, randomFrame, simulateElmResponse, type TelemetrySnapshot } from "./simulation";
import {
  connectBluetooth,
  connectSerial,
  bluetoothSupported,
  serialSupported,
  type BaudRate,
  type Transport,
} from "./transport";
import type { CanFrame, CodingParameter, Dtc, EcuModule, LinkKind, LinkState, SessionRecord } from "./types";

const GARAGE_KEY = "torquedeck.garage.v1";
const HISTORY_LIMIT = 240;
const FRAME_LIMIT = 300;

interface TorqueState {
  linkKind: LinkKind;
  linkState: LinkState;
  adapterLabel: string;
  demoMode: boolean;
  baudRate: BaudRate;
  vehicle: typeof DEMO_VEHICLE;
  telemetry: TelemetrySnapshot | null;
  history: TelemetrySnapshot[];
  modules: EcuModule[];
  dtcs: Dtc[];
  frames: CanFrame[];
  sniffing: boolean;
  scanProgress: number;
  scanningModuleId: string | null;
  coding: CodingParameter[];
  sessions: SessionRecord[];
  technician: string;
  notes: string;
  canUseBluetooth: boolean;
  canUseSerial: boolean;
  setDemoMode: (on: boolean) => void;
  setBaudRate: (b: BaudRate) => void;
  setTechnician: (v: string) => void;
  setNotes: (v: string) => void;
  connectBle: () => Promise<void>;
  connectUsb: () => Promise<void>;
  disconnect: () => Promise<void>;
  runSmartScan: () => Promise<void>;
  clearDtcs: () => void;
  setSniffing: (on: boolean) => void;
  sendCommand: (cmd: string) => Promise<string[]>;
  applyCoding: (id: string, value: string) => void;
  saveSession: () => void;
  deleteSession: (id: string) => void;
}

const TorqueContext = createContext<TorqueState | null>(null);

export function TorqueProvider({ children }: { children: ReactNode }) {
  const engine = useRef(new SimulationEngine());
  const transportRef = useRef<Transport | null>(null);

  const [linkKind, setLinkKind] = useState<LinkKind>("demo");
  const [linkState, setLinkState] = useState<LinkState>("disconnected");
  const [adapterLabel, setAdapterLabel] = useState("Simulation adapter");
  const [demoMode, setDemoMode] = useState(true);
  const [baudRate, setBaudRate] = useState<BaudRate>(115200);
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot | null>(null);
  const [history, setHistory] = useState<TelemetrySnapshot[]>([]);
  const [modules, setModules] = useState<EcuModule[]>(ECU_MODULES);
  const [dtcs, setDtcs] = useState<Dtc[]>([]);
  const [frames, setFrames] = useState<CanFrame[]>([]);
  const [sniffing, setSniffing] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanningModuleId, setScanningModuleId] = useState<string | null>(null);
  const [coding, setCoding] = useState<CodingParameter[]>(CODING_PARAMETERS);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [technician, setTechnician] = useState("");
  const [notes, setNotes] = useState("");
  const [canUseBluetooth, setCanUseBluetooth] = useState(false);
  const [canUseSerial, setCanUseSerial] = useState(false);

  useEffect(() => {
    setCanUseBluetooth(bluetoothSupported());
    setCanUseSerial(serialSupported());
    try {
      const raw = window.localStorage.getItem(GARAGE_KEY);
      if (raw) setSessions(JSON.parse(raw) as SessionRecord[]);
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  const persist = useCallback((next: SessionRecord[]) => {
    setSessions(next);
    try {
      window.localStorage.setItem(GARAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  }, []);

  // Live telemetry ticker (simulation engine drives demo mode).
  useEffect(() => {
    const active = demoMode || linkState === "connected";
    if (!active) return;
    const id = window.setInterval(() => {
      const sample = engine.current.tick();
      setTelemetry(sample);
      setHistory((prev) => [...prev, sample].slice(-HISTORY_LIMIT));
    }, 500);
    return () => window.clearInterval(id);
  }, [demoMode, linkState]);

  // CAN sniffer stream.
  useEffect(() => {
    if (!sniffing) return;
    const id = window.setInterval(() => {
      const batch = Array.from({ length: 4 }, () => randomFrame());
      setFrames((prev) => [...prev, ...batch].slice(-FRAME_LIMIT));
    }, 320);
    return () => window.clearInterval(id);
  }, [sniffing]);

  const connectBle = useCallback(async () => {
    setLinkState("connecting");
    try {
      const t = await connectBluetooth();
      transportRef.current = t;
      setLinkKind("bluetooth");
      setAdapterLabel(t.label);
      setLinkState("connected");
      setDemoMode(false);
      await t.send("AT Z");
      await t.send("AT E0");
      await t.send("AT SP 6");
      toast.success(`Connected to ${t.label}`);
    } catch (error) {
      setLinkState("disconnected");
      setLinkKind("demo");
      setDemoMode(true);
      toast.error(
        error instanceof Error ? error.message : "Bluetooth adapter connection failed — staying in demo mode.",
      );
    }
  }, []);

  const connectUsb = useCallback(async () => {
    setLinkState("connecting");
    try {
      const t = await connectSerial(baudRate);
      transportRef.current = t;
      setLinkKind("serial");
      setAdapterLabel(t.label);
      setLinkState("connected");
      setDemoMode(false);
      await t.send("AT Z");
      await t.send("AT SP 6");
      toast.success(`Connected on ${baudRate} baud`);
    } catch (error) {
      setLinkState("disconnected");
      setLinkKind("demo");
      setDemoMode(true);
      toast.error(error instanceof Error ? error.message : "USB adapter connection failed — staying in demo mode.");
    }
  }, [baudRate]);

  const disconnect = useCallback(async () => {
    await transportRef.current?.close();
    transportRef.current = null;
    setLinkState("disconnected");
    setLinkKind("demo");
    setAdapterLabel("Simulation adapter");
    setDemoMode(true);
    toast.info("Adapter disconnected. Demo mode re-enabled.");
  }, []);

  const runSmartScan = useCallback(async () => {
    setScanProgress(0);
    setModules((prev) => prev.map((m) => ({ ...m, status: "unknown" as const })));
    const total = ECU_MODULES.length;
    for (let i = 0; i < total; i += 1) {
      const target = ECU_MODULES[i]!;
      setScanningModuleId(target.id);
      setModules((prev) => prev.map((m) => (m.id === target.id ? { ...m, status: "scanning" } : m)));
      await new Promise((r) => setTimeout(r, 420));
      const status = target.bus === "LIN" && target.id === "hvac" ? "pass" : target.dtcs.length ? "fault" : "pass";
      setModules((prev) => prev.map((m) => (m.id === target.id ? { ...m, status } : m)));
      setScanProgress(Math.round(((i + 1) / total) * 100));
    }
    setScanningModuleId(null);
    setDtcs(DTC_CATALOG);
    toast.success(`Smart scan complete — ${DTC_CATALOG.length} codes across ${total} modules`);
  }, []);

  // Populate the demo session with a first pass so the tablet is never empty.
  const autoScanned = useRef(false);
  useEffect(() => {
    if (autoScanned.current) return;
    autoScanned.current = true;
    const id = window.setTimeout(() => void runSmartScan(), 600);
    return () => window.clearTimeout(id);
  }, [runSmartScan]);



  const clearDtcs = useCallback(() => {
    setDtcs([]);
    setModules((prev) => prev.map((m) => (m.status === "fault" ? { ...m, status: "pass" } : m)));
    toast.success("Mode 04 sent — stored codes and freeze frame cleared");
  }, []);

  const sendCommand = useCallback(
    async (cmd: string) => {
      const stamp = Date.now();
      setFrames((prev) =>
        [
          ...prev,
          {
            id: `tx-${stamp}`,
            ts: stamp,
            canId: "0x7E0",
            dlc: Math.min(8, cmd.replace(/\s/g, "").length / 2 || 2),
            data: cmd.replace(/\s/g, "").match(/.{1,2}/g)?.slice(0, 8) ?? [],
            dir: "tx" as const,
            note: cmd,
          },
        ].slice(-FRAME_LIMIT),
      );

      if (transportRef.current && !demoMode) {
        try {
          const reply = await transportRef.current.send(cmd);
          return reply.split(/\r?\n/).filter(Boolean);
        } catch (error) {
          return [error instanceof Error ? error.message : "TRANSPORT ERROR"];
        }
      }
      await new Promise((r) => setTimeout(r, 180));
      return simulateElmResponse(cmd, telemetry);
    },
    [demoMode, telemetry],
  );

  const applyCoding = useCallback((id: string, value: string) => {
    setCoding((prev) => prev.map((p) => (p.id === id ? { ...p, value } : p)));
  }, []);

  const saveSession = useCallback(() => {
    const record: SessionRecord = {
      id: `sess-${Date.now()}`,
      savedAt: new Date().toISOString(),
      vehicle: DEMO_VEHICLE,
      modules: modules.map((m) => ({ name: m.abbr, status: m.status, dtcCount: m.dtcs.length })),
      dtcs,
      notes,
      technician: technician || "Unassigned",
      batteryVolts: telemetry?.battery ?? 14.1,
    };
    persist([record, ...sessions].slice(0, 50));
    toast.success("Session saved to garage history");
  }, [modules, dtcs, notes, technician, telemetry, sessions, persist]);

  const deleteSession = useCallback(
    (id: string) => {
      persist(sessions.filter((s) => s.id !== id));
      toast.info("Session removed");
    },
    [sessions, persist],
  );

  const value = useMemo<TorqueState>(
    () => ({
      linkKind,
      linkState,
      adapterLabel,
      demoMode,
      baudRate,
      vehicle: DEMO_VEHICLE,
      telemetry,
      history,
      modules,
      dtcs,
      frames,
      sniffing,
      scanProgress,
      scanningModuleId,
      coding,
      sessions,
      technician,
      notes,
      canUseBluetooth,
      canUseSerial,
      setDemoMode,
      setBaudRate,
      setTechnician,
      setNotes,
      connectBle,
      connectUsb,
      disconnect,
      runSmartScan,
      clearDtcs,
      setSniffing,
      sendCommand,
      applyCoding,
      saveSession,
      deleteSession,
    }),
    [
      linkKind,
      linkState,
      adapterLabel,
      demoMode,
      baudRate,
      telemetry,
      history,
      modules,
      dtcs,
      frames,
      sniffing,
      scanProgress,
      scanningModuleId,
      coding,
      sessions,
      technician,
      notes,
      canUseBluetooth,
      canUseSerial,
      connectBle,
      connectUsb,
      disconnect,
      runSmartScan,
      clearDtcs,
      sendCommand,
      applyCoding,
      saveSession,
      deleteSession,
    ],
  );

  return <TorqueContext.Provider value={value}>{children}</TorqueContext.Provider>;
}

export function useTorque() {
  const ctx = useContext(TorqueContext);
  if (!ctx) throw new Error("useTorque must be used inside TorqueProvider");
  return ctx;
}
