import { createFileRoute } from "@tanstack/react-router";
import { Play, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PageHeader } from "@/components/torquedeck/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AT_COMMAND_HELP } from "@/lib/torquedeck/data";
import { useTorque } from "@/lib/torquedeck/store";

export const Route = createFileRoute("/console")({
  head: () => ({
    meta: [
      { title: "CAN Bus Sniffer & Expert Console | TORQUEDECK" },
      {
        name: "description",
        content: "Raw CAN frame sniffer with ID filtering plus a direct AT/OBD command terminal for expert users.",
      },
      { property: "og:title", content: "CAN Bus Sniffer & Expert Console | TORQUEDECK" },
      { property: "og:description", content: "Raw hex frame monitoring and direct ELM327 command entry." },
    ],
  }),
  component: ConsolePage,
});

function ConsolePage() {
  const { frames, sniffing, setSniffing, sendCommand, demoMode } = useTorque();
  const [filterId, setFilterId] = useState("");
  const [filterData, setFilterData] = useState("");
  const [command, setCommand] = useState("");
  const [lines, setLines] = useState<string[]>([
    "TORQUEDECK expert console ready.",
    "Type an AT command or OBD request and press Enter.",
  ]);
  const [busy, setBusy] = useState(false);
  const termRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    termRef.current?.scrollTo({ top: termRef.current.scrollHeight });
  }, [lines]);

  useEffect(() => {
    if (sniffing) frameRef.current?.scrollTo({ top: frameRef.current.scrollHeight });
  }, [frames, sniffing]);

  const visible = frames.filter(
    (f) =>
      (!filterId || f.canId.toLowerCase().includes(filterId.toLowerCase())) &&
      (!filterData || f.data.join("").toLowerCase().includes(filterData.toLowerCase())),
  );

  const submit = async () => {
    const cmd = command.trim();
    if (!cmd || busy) return;
    setBusy(true);
    setLines((p) => [...p, `> ${cmd}`]);
    setCommand("");
    const reply = await sendCommand(cmd);
    setLines((p) => [...p, ...reply.filter((l) => l !== ">")]);
    setBusy(false);
  };

  return (
    <div>
      <PageHeader
        title="CAN Bus & Expert Console"
        description="Live raw frame monitoring and direct adapter command entry. Responses come from the adapter, or from the simulation engine in demo mode."
        actions={
          <Badge variant={demoMode ? "secondary" : "default"}>{demoMode ? "SIMULATED BUS" : "HARDWARE BUS"}</Badge>
        }
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="panel">
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-xs uppercase tracking-wider">Frame sniffer</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant={sniffing ? "destructive" : "default"} onClick={() => setSniffing(!sniffing)}>
                {sniffing ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                <span className="ml-1.5">{sniffing ? "Stop" : "Start"}</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={filterId}
                onChange={(e) => setFilterId(e.target.value)}
                placeholder="Filter CAN ID (0x7E8)"
                className="font-mono text-xs"
              />
              <Input
                value={filterData}
                onChange={(e) => setFilterData(e.target.value)}
                placeholder="Filter payload bytes"
                className="font-mono text-xs"
              />
            </div>
            <div
              ref={frameRef}
              className="h-[420px] overflow-y-auto rounded-md border border-border bg-background/70 p-2 font-mono text-[11px] leading-relaxed"
            >
              <div className="mb-1 grid grid-cols-[70px_36px_1fr_78px] gap-2 text-[10px] uppercase text-muted-foreground">
                <span>ID</span>
                <span>DLC</span>
                <span>Data [0..7]</span>
                <span>Time</span>
              </div>
              {visible.length ? (
                visible.map((f) => (
                  <div key={f.id} className="grid grid-cols-[70px_36px_1fr_78px] gap-2">
                    <span className={f.dir === "tx" ? "text-primary" : "text-success"}>{f.canId}</span>
                    <span className="text-muted-foreground">{f.dlc}</span>
                    <span>{f.data.join(" ")}</span>
                    <span className="text-muted-foreground">
                      {new Date(f.ts).toLocaleTimeString([], { hour12: false })}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">No frames captured. Start the sniffer to monitor the bus.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="panel">
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-xs uppercase tracking-wider">Command terminal</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setLines([])}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              ref={termRef}
              className="h-[330px] overflow-y-auto rounded-md border border-border bg-background/70 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap"
            >
              {lines.join("\n")}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
              className="flex gap-2"
            >
              <Input
                value={command}
                onChange={(e) => setCommand(e.target.value.toUpperCase())}
                placeholder="AT Z"
                className="font-mono"
                autoComplete="off"
              />
              <Button type="submit" disabled={busy}>
                Send
              </Button>
            </form>
            <div className="flex flex-wrap gap-1.5">
              {AT_COMMAND_HELP.map((h) => (
                <button
                  key={h.cmd}
                  type="button"
                  title={h.desc}
                  onClick={() => setCommand(h.cmd)}
                  className="rounded border border-border bg-background/50 px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {h.cmd}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
