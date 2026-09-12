import { createFileRoute } from "@tanstack/react-router";
import { Download, Pause, Play } from "lucide-react";
import { useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PageHeader } from "@/components/torquedeck/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { PIDS } from "@/lib/torquedeck/data";
import { useTorque } from "@/lib/torquedeck/store";
import type { TelemetrySnapshot } from "@/lib/torquedeck/simulation";

export const Route = createFileRoute("/live-data")({
  head: () => ({
    meta: [
      { title: "Live Data Stream & Graphing | TORQUEDECK" },
      {
        name: "description",
        content: "Graph multiple OBD PIDs in real time — RPM, fuel trims, O2 voltage, MAF, rail pressure and more.",
      },
      { property: "og:title", content: "Live Data Stream & Graphing | TORQUEDECK" },
      { property: "og:description", content: "Multi-sensor live telemetry graphing for OBD PIDs." },
    ],
  }),
  component: LiveDataPage,
});

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function LiveDataPage() {
  const { history, telemetry } = useTorque();
  const [selected, setSelected] = useState<string[]>(["rpm", "coolant", "load"]);
  const [paused, setPaused] = useState(false);
  const [frozen, setFrozen] = useState<TelemetrySnapshot[]>([]);

  const source = paused ? frozen : history;
  const data = source.slice(-90).map((h, i) => ({ i, ...h }));

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id].slice(0, 5)));

  const exportCsv = () => {
    const keys = ["t", ...selected];
    const rows = [keys.join(",")].concat(
      source.map((row) => keys.map((k) => String((row as unknown as Record<string, number>)[k] ?? "")).join(",")),
    );
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `torquedeck-live-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Live Stream & Graphing"
        description="Select up to five parameters and watch them plot in real time at 2 Hz."
        actions={
          <>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                if (!paused) setFrozen(history);
                setPaused((p) => !p);
              }}
            >
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {paused ? "Resume" : "Freeze"}
            </Button>
            <Button variant="outline" className="gap-2" onClick={exportCsv}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card className="panel h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider">Parameters</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[460px] space-y-1.5 overflow-y-auto">
            {PIDS.map((p) => (
              <label
                key={p.id}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background/40 px-2 py-2 text-xs"
              >
                <Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
                <span className="flex-1 truncate">{p.label}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{p.pid}</span>
              </label>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {selected.map((id) => {
              const pid = PIDS.find((p) => p.id === id);
              const value = telemetry ? (telemetry as unknown as Record<string, number>)[id] : undefined;
              return (
                <Card key={id} className="panel">
                  <CardContent className="p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{pid?.label}</div>
                    <div className="font-mono text-2xl tabular-nums text-primary">
                      {value ?? "—"}
                      <span className="ml-1 text-xs text-muted-foreground">{pid?.unit}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider">
                Multi-sensor graph {paused && <span className="text-warning">· frozen</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="i" hide />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} width={48} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {selected.map((id, idx) => (
                    <Line
                      key={id}
                      type="monotone"
                      dataKey={id}
                      name={PIDS.find((p) => p.id === id)?.label ?? id}
                      stroke={COLORS[idx % COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
