import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  Gauge,
  Network,
  ScanLine,
  ShieldCheck,
  SlidersHorizontal,
  Thermometer,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PageHeader } from "@/components/torquedeck/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useTorque } from "@/lib/torquedeck/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Diagnostic Dashboard | TORQUEDECK" },
      {
        name: "description",
        content:
          "Live vehicle telemetry, module health and readiness monitors in one professional diagnostic dashboard.",
      },
      { property: "og:title", content: "Diagnostic Dashboard | TORQUEDECK" },
      { property: "og:description", content: "Live vehicle telemetry and module health at a glance." },
    ],
  }),
  component: Dashboard,
});

const MONITORS = [
  "Misfire",
  "Fuel System",
  "Components",
  "Catalyst",
  "Evap System",
  "O2 Sensor",
  "O2 Heater",
  "EGR System",
];

function Stat({
  label,
  value,
  unit,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  unit: string;
  icon: typeof Gauge;
  tone?: "primary" | "success" | "warning" | "destructive";
}) {
  const toneClass = {
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  }[tone];
  return (
    <Card className="panel">
      <CardContent className="flex items-center gap-3 p-4">
        <Icon className={`h-5 w-5 ${toneClass}`} />
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="font-mono text-xl tabular-nums">
            {value}
            <span className="ml-1 text-xs text-muted-foreground">{unit}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { telemetry, history, modules, dtcs, runSmartScan, scanProgress, vehicle } = useTorque();

  const chartData = history.slice(-60).map((h, i) => ({ i, rpm: h.rpm, coolant: h.coolant, load: h.load }));
  const faulted = modules.filter((m) => m.status === "fault");
  const critical = dtcs.filter((d) => d.severity === "critical").length;

  return (
    <div>
      <PageHeader
        title="Diagnostic Dashboard"
        description={`${vehicle.year} ${vehicle.make} ${vehicle.model} — live telemetry and system health.`}
        actions={
          <Button onClick={() => void runSmartScan()} className="gap-2">
            <ScanLine className="h-4 w-4" /> Smart Scan All Modules
          </Button>
        }
      />

      {scanProgress > 0 && scanProgress < 100 && (
        <div className="mb-5">
          <Progress value={scanProgress} />
          <p className="mt-1 font-mono text-xs text-muted-foreground">Scanning modules… {scanProgress}%</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Engine speed" value={telemetry?.rpm ?? 0} unit="rpm" icon={Gauge} />
        <Stat label="Coolant" value={telemetry?.coolant ?? 0} unit="°C" icon={Thermometer} tone="warning" />
        <Stat label="Engine load" value={telemetry?.load ?? 0} unit="%" icon={Activity} tone="success" />
        <Stat
          label="Stored codes"
          value={dtcs.length}
          unit={`${critical} critical`}
          icon={TriangleAlert}
          tone={dtcs.length ? "destructive" : "success"}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="panel xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider">Live telemetry</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="rpmFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="i" hide />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  domain={[0, 4500]}
                  width={44}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="rpm"
                  stroke="var(--color-chart-1)"
                  fill="url(#rpmFill)"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider">Readiness monitors</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {MONITORS.map((m, i) => {
              const ready = i % 4 !== 3;
              return (
                <div
                  key={m}
                  className="flex items-center justify-between rounded-md border border-border bg-background/40 px-2.5 py-2"
                >
                  <span className="truncate text-xs">{m}</span>
                  <Badge variant={ready ? "default" : "secondary"} className="text-[10px]">
                    {ready ? "READY" : "INC"}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="panel">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider">
              <Network className="h-4 w-4 text-primary" /> Module health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {modules.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-md border border-border bg-background/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">{m.abbr}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {m.name} · {m.bus} · {m.address}
                  </div>
                </div>
                <Badge
                  variant={m.status === "fault" ? "destructive" : m.status === "pass" ? "default" : "secondary"}
                  className="shrink-0"
                >
                  {m.status === "fault" ? `${m.dtcs.length} DTC` : m.status.toUpperCase()}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {[
            { to: "/topology", title: "Topology map", body: "See the full ECU network", icon: Network },
            { to: "/fault-codes", title: "Fault codes", body: `${dtcs.length} stored codes`, icon: TriangleAlert },
            { to: "/bi-directional", title: "Actuator tests", body: "Command components", icon: SlidersHorizontal },
            { to: "/service-resets", title: "Service resets", body: "Oil, EPB, DPF, SAS", icon: Wrench },
          ].map(({ to, title, body, icon: Icon }) => (
            <Link key={to} to={to}>
              <Card className="panel h-full transition-colors hover:border-primary">
                <CardContent className="p-4">
                  <Icon className="h-5 w-5 text-primary" />
                  <div className="mt-3 text-sm font-semibold">{title}</div>
                  <div className="text-xs text-muted-foreground">{body}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
          <Card className="panel sm:col-span-2 lg:col-span-1 xl:col-span-2">
            <CardContent className="flex items-center gap-3 p-4">
              <ShieldCheck className="h-5 w-5 text-success" />
              <div className="text-xs text-muted-foreground">
                {faulted.length
                  ? `${faulted.length} module(s) reporting faults. Review the topology map for details.`
                  : "No module faults recorded in this session. Run a smart scan to refresh."}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
