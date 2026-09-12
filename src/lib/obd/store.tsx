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
import {
  Elm327,
  bluetoothSupported,
  extractPayload,
  isNegative,
  openBluetooth,
  openSerial,
  parseDtcResponse,
  parseVin,
  serialSupported,
  type ObdLogEntry,
} from "./elm327";
import { PIDS, PID_BY_ID, type PidDef, type PidId } from "./pids";

export type ConnState = "disconnected" | "connecting" | "connected" | "error";

export interface Sample {
  t: number;
  v: number;
}

export interface Vehicle {
  id: string;
  nickname: string;
  make: string;
  model: string;
  year: string;
  vin: string;
  plate: string;
  odometer: string;
  notes: string;
}

export interface SessionRecord {
  id: string;
  vehicleId: string | null;
  vehicleLabel: string;
  startedAt: number;
  endedAt: number;
  protocol: string;
  adapter: string;
  vin: string | null;
  dtcs: string[];
  pending: string[];
  maxima: Partial<Record<PidId, number>>;
  samples: number;
  notes: string;
}

interface FreezeFrame {
  dtc: string | null;
  values: { label: string; value: string }[];
}

interface ObdContextValue {
  state: ConnState;
  statusText: string;
  elm: Elm327;
  adapterName: string;
  transport: "serial" | "bluetooth" | null;
  protocolName: string;
  protocolCode: string;
  supportedSerial: boolean;
  supportedBluetooth: boolean;
  live: Partial<Record<PidId, number>>;
  history: Partial<Record<PidId, Sample[]>>;
  activePids: PidId[];
  setActivePids: (p: PidId[]) => void;
  polling: boolean;
  setPolling: (b: boolean) => void;
  supportedPids: PidId[];
  dtcs: string[];
  pendingDtcs: string[];
  permanentDtcs: string[];
  milOn: boolean;
  dtcCount: number;
  vin: string | null;
  calId: string | null;
  ecuName: string | null;
  freeze: FreezeFrame | null;
  logEntries: ObdLogEntry[];
  connect: (kind: "serial" | "bluetooth") => Promise<void>;
  disconnect: () => Promise<void>;
  reconnect: () => Promise<void>;
  scanDtcs: () => Promise<void>;
  clearDtcs: () => Promise<void>;
  readFreezeFrame: () => Promise<void>;
  readVehicleInfo: () => Promise<void>;
  sendRaw: (cmd: string) => Promise<string>;
  vehicles: Vehicle[];
  activeVehicleId: string | null;
  setActiveVehicleId: (id: string | null) => void;
  saveVehicle: (v: Vehicle) => void;
  deleteVehicle: (id: string) => void;
  sessions: SessionRecord[];
  saveSession: (notes?: string) => void;
  deleteSession: (id: string) => void;
}

const Ctx = createContext<ObdContextValue | null>(null);

const LS_VEHICLES = "obd.vehicles";
const LS_SESSIONS = "obd.sessions";
const LS_ACTIVE = "obd.activeVehicle";
const MAX_POINTS = 240;

function loadLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export function ObdProvider({ children }: { children: ReactNode }) {
  const elmRef = useRef<Elm327 | null>(null);
  if (!elmRef.current) elmRef.current = new Elm327();
  const elm = elmRef.current;

  const [state, setState] = useState<ConnState>("disconnected");
  const [statusText, setStatusText] = useState("No adapter connected");
  const [adapterName, setAdapterName] = useState("");
  const [transport, setTransport] = useState<"serial" | "bluetooth" | null>(null);
  const [protocolName, setProtocolName] = useState("");
  const [protocolCode, setProtocolCode] = useState("");
  const [supportedSerial, setSupportedSerial] = useState(false);
  const [supportedBluetooth, setSupportedBluetooth] = useState(false);

  const [live, setLive] = useState<Partial<Record<PidId, number>>>({});
  const [history, setHistory] = useState<Partial<Record<PidId, Sample[]>>>({});
  const [activePids, setActivePids] = useState<PidId[]>([
    "rpm",
    "speed",
    "coolant",
    "voltage",
    "throttle",
    "engineLoad",
    "intakeTemp",
    "maf",
    "stft1",
    "ltft1",
    "o2b1s1",
    "fuelLevel",
    "timing",
    "map",
  ]);
  const [polling, setPolling] = useState(true);
  const [supportedPids, setSupportedPids] = useState<PidId[]>([]);

  const [dtcs, setDtcs] = useState<string[]>([]);
  const [pendingDtcs, setPendingDtcs] = useState<string[]>([]);
  const [permanentDtcs, setPermanentDtcs] = useState<string[]>([]);
  const [milOn, setMilOn] = useState(false);
  const [dtcCount, setDtcCount] = useState(0);
  const [vin, setVin] = useState<string | null>(null);
  const [calId, setCalId] = useState<string | null>(null);
  const [ecuName, setEcuName] = useState<string | null>(null);
  const [freeze, setFreeze] = useState<FreezeFrame | null>(null);
  const [logEntries, setLogEntries] = useState<ObdLogEntry[]>([]);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeVehicleId, setActiveVehicleIdState] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const sessionStart = useRef<number>(Date.now());
  const sampleCount = useRef(0);
  const maxima = useRef<Partial<Record<PidId, number>>>({});

  useEffect(() => {
    setSupportedSerial(serialSupported());
    setSupportedBluetooth(bluetoothSupported());
    setVehicles(loadLS<Vehicle[]>(LS_VEHICLES, []));
    setSessions(loadLS<SessionRecord[]>(LS_SESSIONS, []));
    setActiveVehicleIdState(loadLS<string | null>(LS_ACTIVE, null));
  }, []);

  useEffect(() => {
    elm.onLog = () => setLogEntries([...elm.log]);
    return () => {
      elm.onLog = null;
    };
  }, [elm]);

  const persistVehicles = (v: Vehicle[]) => {
    setVehicles(v);
    window.localStorage.setItem(LS_VEHICLES, JSON.stringify(v));
  };
  const persistSessions = (s: SessionRecord[]) => {
    setSessions(s);
    window.localStorage.setItem(LS_SESSIONS, JSON.stringify(s));
  };
  const setActiveVehicleId = (id: string | null) => {
    setActiveVehicleIdState(id);
    window.localStorage.setItem(LS_ACTIVE, JSON.stringify(id));
  };

  /* ---------------- connection ---------------- */

  const probeSupportedPids = useCallback(async () => {
    const found = new Set<string>();
    for (const base of ["00", "20", "40"]) {
      const resp = await elm.send(`01${base}`);
      const payload = extractPayload(resp, 1, base);
      if (!payload || payload.length < 4) continue;
      const mask =
        ((payload[0] ?? 0) << 24) |
        ((payload[1] ?? 0) << 16) |
        ((payload[2] ?? 0) << 8) |
        (payload[3] ?? 0);
      const offset = parseInt(base, 16);
      for (let bit = 0; bit < 32; bit++) {
        if (mask & (1 << (31 - bit))) {
          found.add((offset + bit + 1).toString(16).toUpperCase().padStart(2, "0"));
        }
      }
      if (!(mask & 1)) break;
    }
    const ids = PIDS.filter((p) => found.has(p.pid)).map((p) => p.id);
    setSupportedPids(ids);
    if (ids.length) setActivePids((cur) => cur.filter((c) => ids.includes(c)));
    return ids;
  }, [elm]);

  const readStatus = useCallback(async () => {
    const resp = await elm.send("0101");
    const p = extractPayload(resp, 1, "01");
    if (p && p.length >= 1) {
      const a = p[0] ?? 0;
      setMilOn((a & 0x80) !== 0);
      setDtcCount(a & 0x7f);
    }
  }, [elm]);

  const scanDtcs = useCallback(async () => {
    if (!elm.connected) return;
    const stored = await elm.send("03", 8000);
    setDtcs(parseDtcResponse(stored, 3));
    const pend = await elm.send("07", 8000);
    setPendingDtcs(parseDtcResponse(pend, 7));
    const perm = await elm.send("0A", 8000);
    setPermanentDtcs(parseDtcResponse(perm, 0x0a));
    await readStatus();
  }, [elm, readStatus]);

  const readVehicleInfo = useCallback(async () => {
    if (!elm.connected) return;
    const v = await elm.send("0902", 8000);
    const parsed = parseVin(v);
    if (parsed) setVin(parsed);
    const cal = await elm.send("0904", 8000);
    const calText = asciiFrom(cal);
    if (calText) setCalId(calText);
    const name = await elm.send("090A", 8000);
    const nameText = asciiFrom(name);
    if (nameText) setEcuName(nameText);
  }, [elm]);

  const readFreezeFrame = useCallback(async () => {
    if (!elm.connected) return;
    const values: { label: string; value: string }[] = [];
    const dtcResp = await elm.send("0202");
    const dtcBytes = extractPayload(dtcResp, 2, "02");
    let dtc: string | null = null;
    if (dtcBytes && dtcBytes.length >= 3) {
      const codes = parseDtcResponse(`42 02 ${dtcBytes.slice(1, 3).map(hex).join(" ")}`, 3);
      dtc = codes[0] ?? null;
    }
    const frozenPids: PidId[] = [
      "rpm",
      "speed",
      "coolant",
      "intakeTemp",
      "throttle",
      "engineLoad",
      "stft1",
      "ltft1",
      "map",
      "maf",
      "timing",
      "fuelPressure",
    ];
    for (const id of frozenPids) {
      const def = PID_BY_ID[id] as PidDef;
      const resp = await elm.send(`02${def.pid}00`);
      const payload = extractPayload(resp, 2, def.pid);
      if (!payload || payload.length < def.bytes + 1) continue;
      const data = payload.slice(1, 1 + def.bytes);
      values.push({ label: def.label, value: `${def.decode(data)} ${def.unit}` });
    }
    setFreeze({ dtc, values });
    if (!values.length) {
      toast.info("No freeze frame stored", {
        description: "The ECU only stores a freeze frame when it sets an emissions fault.",
      });
    }
  }, [elm]);

  const connect = useCallback(
    async (kind: "serial" | "bluetooth") => {
      if (state === "connecting") return;
      setState("connecting");
      setStatusText("Requesting adapter…");
      try {
        const t = kind === "serial" ? await openSerial() : await openBluetooth();
        await elm.attach(t);
        setTransport(kind);
        setAdapterName(t.name);
        await elm.initialise((s) => setStatusText(s));
        setProtocolName(elm.protocolName);
        setProtocolCode(elm.protocolCode);
        setState("connected");
        setStatusText(`${elm.adapterVersion} · ${elm.protocolName}`);
        sessionStart.current = Date.now();
        sampleCount.current = 0;
        maxima.current = {};
        toast.success("Adapter connected", { description: elm.protocolName });
        await probeSupportedPids();
        await scanDtcs();
        await readVehicleInfo();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setState(/cancel|No port selected|chooser/i.test(msg) ? "disconnected" : "error");
        setStatusText(msg);
        if (!/cancel|No port selected|chooser/i.test(msg)) {
          toast.error("Could not connect", { description: msg });
        }
      }
    },
    [elm, probeSupportedPids, readVehicleInfo, scanDtcs, state],
  );

  const disconnect = useCallback(async () => {
    await elm.close();
    setState("disconnected");
    setStatusText("No adapter connected");
    setTransport(null);
    setLive({});
  }, [elm]);

  const reconnect = useCallback(async () => {
    const kind = transport ?? (supportedSerial ? "serial" : "bluetooth");
    await disconnect();
    await connect(kind);
  }, [connect, disconnect, supportedSerial, transport]);

  const clearDtcs = useCallback(async () => {
    if (!elm.connected) return;
    const resp = await elm.send("04", 8000);
    if (isNegative(resp)) {
      toast.error("Clear rejected by the ECU", {
        description: "Most vehicles only accept a clear with the ignition on and the engine off.",
      });
      return;
    }
    toast.success("Fault memory cleared", {
      description: "Monitors are now 'not ready'. Drive a full cycle before an emissions test.",
    });
    setFreeze(null);
    await scanDtcs();
  }, [elm, scanDtcs]);

  const sendRaw = useCallback((cmd: string) => elm.send(cmd.trim().toUpperCase(), 10000), [elm]);

  /* ---------------- live polling loop ---------------- */

  useEffect(() => {
    if (state !== "connected" || !polling || activePids.length === 0) return;
    let cancelled = false;

    const loop = async () => {
      while (!cancelled) {
        for (const id of activePids) {
          if (cancelled) return;
          const def = PID_BY_ID[id];
          if (!def) continue;
          try {
            const resp = await elm.send(`01${def.pid}`, 2500);
            const payload = extractPayload(resp, 1, def.pid);
            if (!payload || payload.length < def.bytes) continue;
            const value = def.decode(payload.slice(0, def.bytes));
            if (!Number.isFinite(value)) continue;
            const now = Date.now();
            sampleCount.current += 1;
            const prevMax = maxima.current[id];
            if (prevMax == null || value > prevMax) maxima.current[id] = value;
            setLive((cur) => ({ ...cur, [id]: value }));
            setHistory((cur) => {
              const arr = cur[id] ? [...(cur[id] as Sample[]), { t: now, v: value }] : [{ t: now, v: value }];
              if (arr.length > MAX_POINTS) arr.splice(0, arr.length - MAX_POINTS);
              return { ...cur, [id]: arr };
            });
          } catch {
            return;
          }
        }
        await new Promise((r) => setTimeout(r, 60));
      }
    };
    void loop();
    return () => {
      cancelled = true;
    };
  }, [state, polling, activePids, elm]);

  /* ---------------- sessions ---------------- */

  const saveSession = useCallback(
    (notes = "") => {
      const vehicle = vehicles.find((v) => v.id === activeVehicleId);
      const rec: SessionRecord = {
        id: uid(),
        vehicleId: activeVehicleId,
        vehicleLabel: vehicle ? `${vehicle.nickname || vehicle.make} ${vehicle.model}`.trim() : "Unassigned vehicle",
        startedAt: sessionStart.current,
        endedAt: Date.now(),
        protocol: protocolName || "—",
        adapter: adapterName || "—",
        vin,
        dtcs,
        pending: pendingDtcs,
        maxima: { ...maxima.current },
        samples: sampleCount.current,
        notes,
      };
      persistSessions([rec, ...sessions]);
      toast.success("Session saved to history");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeVehicleId, adapterName, dtcs, pendingDtcs, protocolName, sessions, vehicles, vin],
  );

  const deleteSession = (id: string) => persistSessions(sessions.filter((s) => s.id !== id));
  const saveVehicle = (v: Vehicle) => {
    const exists = vehicles.some((x) => x.id === v.id);
    persistVehicles(exists ? vehicles.map((x) => (x.id === v.id ? v : x)) : [...vehicles, v]);
  };
  const deleteVehicle = (id: string) => {
    persistVehicles(vehicles.filter((v) => v.id !== id));
    if (activeVehicleId === id) setActiveVehicleId(null);
  };

  const value: ObdContextValue = useMemo(
    () => ({
      state,
      statusText,
      elm,
      adapterName,
      transport,
      protocolName,
      protocolCode,
      supportedSerial,
      supportedBluetooth,
      live,
      history,
      activePids,
      setActivePids,
      polling,
      setPolling,
      supportedPids,
      dtcs,
      pendingDtcs,
      permanentDtcs,
      milOn,
      dtcCount,
      vin,
      calId,
      ecuName,
      freeze,
      logEntries,
      connect,
      disconnect,
      reconnect,
      scanDtcs,
      clearDtcs,
      readFreezeFrame,
      readVehicleInfo,
      sendRaw,
      vehicles,
      activeVehicleId,
      setActiveVehicleId,
      saveVehicle,
      deleteVehicle,
      sessions,
      saveSession,
      deleteSession,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      state, statusText, adapterName, transport, protocolName, protocolCode,
      supportedSerial, supportedBluetooth, live, history, activePids, polling,
      supportedPids, dtcs, pendingDtcs, permanentDtcs, milOn, dtcCount, vin,
      calId, ecuName, freeze, logEntries, vehicles, activeVehicleId, sessions,
      connect, disconnect, reconnect, scanDtcs, clearDtcs, readFreezeFrame,
      readVehicleInfo, sendRaw, saveSession,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function hex(n: number) {
  return n.toString(16).padStart(2, "0").toUpperCase();
}

function asciiFrom(resp: string): string | null {
  const text = resp
    .split("\n")
    .map((l) => l.trim().replace(/^[0-9A-F]:\s*/i, ""))
    .join(" ");
  const toks = text.match(/[0-9A-F]{2}/gi)?.map((t) => parseInt(t, 16)) ?? [];
  const chars = toks
    .filter((b) => b >= 0x20 && b < 0x7f)
    .map((b) => String.fromCharCode(b))
    .join("")
    .trim();
  return chars.length > 3 ? chars : null;
}

export function useObd() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useObd must be used inside ObdProvider");
  return ctx;
}
