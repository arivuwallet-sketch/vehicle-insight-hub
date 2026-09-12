import { createFileRoute } from "@tanstack/react-router";
import { Cpu, ScanLine } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/torquedeck/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DTC_CATALOG } from "@/lib/torquedeck/data";
import { useTorque } from "@/lib/torquedeck/store";
import type { EcuModule } from "@/lib/torquedeck/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/topology")({
  head: () => ({
    meta: [
      { title: "Network Topology Map | TORQUEDECK" },
      {
        name: "description",
        content: "Full system scan of every ECU on the HS-CAN, MS-CAN and LIN networks with live fault status.",
      },
      { property: "og:title", content: "Network Topology Map | TORQUEDECK" },
      { property: "og:description", content: "Visual ECU network map with per-module fault status." },
    ],
  }),
  component: TopologyPage,
});

const BUS_ROWS: { bus: EcuModule["bus"]; y: number; color: string }[] = [
  { bus: "HS-CAN", y: 22, color: "var(--color-primary)" },
  { bus: "MS-CAN", y: 62, color: "var(--color-chart-5)" },
];

function statusClasses(status: EcuModule["status"]) {
  switch (status) {
    case "pass":
      return "border-success/70 bg-success/10 text-success glow-success";
    case "fault":
      return "border-destructive/70 bg-destructive/10 text-destructive glow-danger";
    case "scanning":
      return "border-primary bg-primary/10 text-primary animate-pulse";
    case "absent":
      return "border-border bg-muted/30 text-muted-foreground";
    default:
      return "border-border bg-card text-muted-foreground";
  }
}

function TopologyPage() {
  const { modules, runSmartScan, scanProgress, scanningModuleId } = useTorque();
  const [selected, setSelected] = useState<EcuModule | null>(null);

  const active = modules.find((m) => m.id === selected?.id) ?? selected;
  const moduleDtcs = active ? DTC_CATALOG.filter((d) => active.dtcs.includes(d.code)) : [];

  return (
    <div>
      <PageHeader
        title="Network Topology Map"
        description="Every control unit on the vehicle bus. Tap a node for part numbers, software IDs and stored codes."
        actions={
          <Button onClick={() => void runSmartScan()} className="gap-2">
            <ScanLine className="h-4 w-4" /> Smart Scan All Modules
          </Button>
        }
      />

      {scanningModuleId && (
        <div className="mb-4">
          <Progress value={scanProgress} />
          <p className="mt-1 font-mono text-xs text-primary">
            Interrogating {modules.find((m) => m.id === scanningModuleId)?.abbr}… {scanProgress}%
          </p>
        </div>
      )}

      <Card className="panel scan-line overflow-hidden">
        <CardContent className="relative h-[520px] p-0">
          <svg className="absolute inset-0 h-full w-full" aria-hidden>
            {BUS_ROWS.map((row) => (
              <line
                key={row.bus}
                x1="4%"
                x2="96%"
                y1={`${row.y + 9}%`}
                y2={`${row.y + 9}%`}
                stroke={row.color}
                strokeWidth={2}
                strokeOpacity={0.55}
                strokeDasharray="6 6"
              />
            ))}
            {modules.map((m) => {
              const row = BUS_ROWS.find((r) => r.bus === m.bus) ?? BUS_ROWS[1]!;
              return (
                <line
                  key={m.id}
                  x1={`${m.x}%`}
                  x2={`${m.x}%`}
                  y1={`${m.y + 9}%`}
                  y2={`${row.y + 9}%`}
                  stroke="var(--color-border)"
                  strokeWidth={1.5}
                />
              );
            })}
          </svg>

          {BUS_ROWS.map((row) => (
            <span
              key={row.bus}
              className="absolute left-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
              style={{ top: `calc(${row.y + 9}% - 16px)` }}
            >
              {row.bus}
            </span>
          ))}
          <span className="absolute bottom-3 left-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            LIN sub-bus
          </span>

          {modules.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelected(m)}
              style={{ left: `${m.x}%`, top: `${m.y}%` }}
              className={cn(
                "absolute w-28 -translate-x-1/2 rounded-lg border p-2 text-left transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                statusClasses(m.status),
              )}
            >
              <div className="flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5" />
                <span className="text-xs font-bold">{m.abbr}</span>
              </div>
              <div className="mt-1 font-mono text-[10px] opacity-80">{m.address}</div>
              <div className="mt-1 text-[10px]">
                {m.status === "fault"
                  ? `${m.dtcs.length} DTC`
                  : m.status === "scanning"
                    ? "scanning…"
                    : m.status === "pass"
                      ? "passed"
                      : "not scanned"}
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-success" /> Passed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive" /> Fault detected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground" /> Not equipped / unresponsive
        </span>
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {active.abbr} — {active.name}
                </SheetTitle>
                <SheetDescription>
                  {active.bus} · request address {active.address}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-6">
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    ["Part number", active.partNumber],
                    ["Software ID", active.softwareId],
                    ["Hardware ID", active.hardwareId],
                    ["Status", active.status.toUpperCase()],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-md border border-border bg-background/40 p-2">
                      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</dt>
                      <dd className="font-mono">{v}</dd>
                    </div>
                  ))}
                </dl>

                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Stored codes
                  </h3>
                  {moduleDtcs.length ? (
                    <div className="space-y-2">
                      {moduleDtcs.map((d) => (
                        <div key={d.code} className="rounded-md border border-border bg-background/40 p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-sm font-bold">{d.code}</span>
                            <Badge variant={d.severity === "critical" ? "destructive" : "secondary"}>
                              {d.severity}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{d.description}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No codes reported by this module.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
