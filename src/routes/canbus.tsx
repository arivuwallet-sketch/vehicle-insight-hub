import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Network, Play, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OfflineNotice } from "@/components/obd/ConnectionBar";
import { useObd } from "@/lib/obd/store";

export const Route = createFileRoute("/canbus")({
  head: () => ({
    meta: [
      { title: "CAN Bus Monitor — TorqueDeck" },
      {
        name: "description",
        content:
          "Sniff raw CAN frames through an ELM327 in monitor mode: live arbitration IDs, payloads, frame rates and per-ID traffic breakdown.",
      },
      { property: "og:title", content: "CAN Bus Monitor — TorqueDeck" },
      {
        property: "og:description",
        content: "Live raw CAN frame capture with per-ID statistics, straight in the browser.",
      },
    ],
  }),
  component: CanBusPage,
});

interface FrameStat {
  id: string;
  count: number;
  last: string;
  lastTs: number;
}

const MODES = [
  { cmd: "ATMA", label: "Monitor all traffic" },
  { cmd: "ATCAF0\rATMA", label: "Monitor all (CAN formatting off)" },
];

function CanBusPage() {
  const { elm, state, protocolName } = useObd();
  const [running, setRunning] = useState(false);
  const [frames, setFrames] = useState<string[]>([]);
  const [stats, setStats] = useState<Record<string, FrameStat>>({});
  const [filter, setFilter] = useState("");
  const bufRef = useRef<string[]>([]);
  const statRef = useRef<Record<string, FrameStat>>({});

  useEffect(() => {
    const t = setInterval(() => {
      if (bufRef.current.length) {
        setFrames((cur) => [...bufRef.current.slice(-300), ...cur].slice(0, 300));
        bufRef.current = [];
        setStats({ ...statRef.current });
      }
    }, 250);
    return () => clearInterval(t);
  }, []);

  const start = async () => {
    if (state !== "connected") {
      toast.error("Connect an adapter first");
      return;
    }
    if (!/CAN/i.test(protocolName)) {
      toast.warning("This vehicle is not on a CAN protocol", {
        description: `Detected: ${protocolName}. Monitor mode will show raw frames of whatever bus is active.`,
      });
    }
    setRunning(true);
    await elm.send("ATH1");
    await elm.startMonitor("ATMA", (line) => {
      if (!/[0-9A-F]/i.test(line)) return;
      bufRef.current.push(line);
      const id = line.trim().split(/\s+/)[0] ?? "????";
      const prev = statRef.current[id];
      statRef.current[id] = {
        id,
        count: (prev?.count ?? 0) + 1,
        last: line.trim(),
        lastTs: Date.now(),
      };
    });
  };

  const stop = async () => {
    await elm.stopMonitor();
    await elm.send("ATH0");
    setRunning(false);
  };

  useEffect(() => {
    return () => {
      if (elm.streaming) void elm.stopMonitor();
    };
  }, [elm]);

  const visible = frames.filter((f) => !filter || f.toUpperCase().includes(filter.toUpperCase()));
  const table = Object.values(stats).sort((a, b) => b.count - a.count).slice(0, 24);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">CAN Bus Monitor</h1>
          <p className="text-sm text-muted-foreground">
            Raw ISO 15765-4 frame capture through the adapter's monitor mode.
          </p>
        </div>
        <div className="no-print flex gap-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by ID or bytes"
            className="h-9 w-48 rounded-md border border-input bg-surface px-3 text-sm"
          />
          {running ? (
            <Button size="sm" variant="destructive" onClick={() => void stop()}>
              <Square className="size-4" /> Stop
            </Button>
          ) : (
            <Button size="sm" onClick={() => void start()}>
              <Play className="size-4" /> Start capture
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setFrames([]);
              statRef.current = {};
              setStats({});
            }}
          >
            <Trash2 className="size-4" /> Clear
          </Button>
        </div>
      </header>

      <OfflineNotice />

      <div className="panel p-4 text-sm text-muted-foreground">
        <Network className="mr-2 inline size-4 text-signal" />
        Monitor mode is passive listening only — the adapter stops sending acknowledgements while it
        sniffs, so live data polling pauses during capture. Some vehicles flood the bus at thousands
        of frames per second; a cheap ELM327 clone will drop frames, an STN-based adapter keeps up.
        Available monitor commands on this adapter: {MODES.map((m) => m.cmd.split("\r").pop()).join(", ")}.
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <section className="panel scanline p-4">
          <h2 className="mb-2 text-sm font-semibold">
            Frame stream{" "}
            <span className="text-xs font-normal text-muted-foreground">
              ({visible.length} shown)
            </span>
          </h2>
          <div className="readout h-[520px] overflow-auto rounded bg-background/60 p-3 text-xs leading-relaxed">
            {visible.length === 0 ? (
              <span className="text-muted-foreground">Idle — press Start capture.</span>
            ) : (
              visible.map((f, i) => (
                <div key={`${i}-${f}`} className="whitespace-pre">
                  {f}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel p-4">
          <h2 className="mb-2 text-sm font-semibold">Busiest arbitration IDs</h2>
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 text-left">ID</th>
                <th className="py-1 text-right">Frames</th>
                <th className="py-1 text-left pl-3">Last payload</th>
              </tr>
            </thead>
            <tbody className="readout">
              {table.map((s) => (
                <tr key={s.id} className="border-t border-border/50">
                  <td className="py-1 text-signal">{s.id}</td>
                  <td className="py-1 text-right">{s.count}</td>
                  <td className="max-w-[170px] truncate py-1 pl-3 text-muted-foreground">{s.last}</td>
                </tr>
              ))}
              {!table.length && (
                <tr>
                  <td colSpan={3} className="py-3 text-muted-foreground">
                    No frames captured yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
