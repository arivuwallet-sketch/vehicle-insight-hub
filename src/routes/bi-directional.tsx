import { createFileRoute } from "@tanstack/react-router";
import { CircleCheck, Play, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/torquedeck/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { ACTUATOR_TESTS } from "@/lib/torquedeck/data";
import { useTorque } from "@/lib/torquedeck/store";
import type { ActuatorTest } from "@/lib/torquedeck/types";

export const Route = createFileRoute("/bi-directional")({
  head: () => ({
    meta: [
      { title: "Bi-Directional Actuator Tests | TORQUEDECK" },
      {
        name: "description",
        content: "Command fuel pumps, injectors, ABS valves, EGR and body actuators directly from the scan tool.",
      },
      { property: "og:title", content: "Bi-Directional Actuator Tests | TORQUEDECK" },
      { property: "og:description", content: "Actuator control with live feedback and safety confirmation." },
    ],
  }),
  component: BiDirectionalPage,
});

interface RunState {
  progress: number;
  log: string[];
  done: boolean;
}

function BiDirectionalPage() {
  const { telemetry, sendCommand } = useTorque();
  const [active, setActive] = useState<ActuatorTest | null>(null);
  const [duty, setDuty] = useState(50);
  const [run, setRun] = useState<Record<string, RunState>>({});
  const timers = useRef<Record<string, number>>({});

  const start = async (test: ActuatorTest) => {
    setActive(null);
    setRun((p) => ({ ...p, [test.id]: { progress: 0, log: [`> ${test.module}: activating ${test.name}`], done: false } }));
    const reply = await sendCommand(`2F ${test.id.slice(0, 2).toUpperCase()} 03 ${duty.toString(16).padStart(2, "0")}`);
    const steps = 20;
    let step = 0;
    const interval = window.setInterval(() => {
      step += 1;
      setRun((prev) => {
        const current = prev[test.id] ?? { progress: 0, log: [], done: false };
        const pct = Math.round((step / steps) * 100);
        const line =
          step % 4 === 0
            ? `  feedback ${Math.round(duty + Math.sin(step) * 6)}${test.unit ?? "%"} · rpm ${telemetry?.rpm ?? 0}`
            : null;
        return {
          ...prev,
          [test.id]: {
            progress: pct,
            log: line ? [...current.log, line] : current.log,
            done: pct >= 100,
          },
        };
      });
      if (step >= steps) {
        window.clearInterval(interval);
        setRun((prev) => ({
          ...prev,
          [test.id]: {
            progress: 100,
            log: [...(prev[test.id]?.log ?? []), ...reply.slice(0, 1), "> test completed — actuator returned to rest"],
            done: true,
          },
        }));
        toast.success(`${test.name} completed successfully`);
      }
    }, test.durationMs / steps);
    timers.current[test.id] = interval;
  };

  return (
    <div>
      <PageHeader
        title="Bi-Directional Controls"
        description="Send active commands to vehicle actuators and watch the module's feedback in real time."
      />

      <Card className="panel mb-4">
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <div className="min-w-56 flex-1">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="uppercase tracking-wider text-muted-foreground">Command duty / position</span>
              <span className="font-mono text-primary">{duty}%</span>
            </div>
            <Slider value={[duty]} onValueChange={([v]) => setDuty(v ?? 0)} max={100} step={1} />
          </div>
          <div className="font-mono text-xs text-muted-foreground">
            RPM {telemetry?.rpm ?? 0} · BATT {(telemetry?.battery ?? 14).toFixed(2)}V
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {ACTUATOR_TESTS.map((test) => {
          const state = run[test.id];
          return (
            <Card key={test.id} className="panel flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm">{test.name}</CardTitle>
                  <Badge variant="outline">{test.module}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                <p className="text-xs text-muted-foreground">{test.description}</p>
                {test.warning && (
                  <p className="flex items-start gap-1.5 text-[11px] text-warning">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {test.warning}
                  </p>
                )}

                {state && (
                  <div className="space-y-2">
                    <Progress value={state.progress} />
                    <pre className="max-h-24 overflow-y-auto rounded-md border border-border bg-background/60 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                      {state.log.join("\n")}
                    </pre>
                  </div>
                )}

                <Button
                  className="mt-auto gap-2"
                  variant={state?.done ? "outline" : "default"}
                  onClick={() => setActive(test)}
                >
                  {state?.done ? <CircleCheck className="h-4 w-4 text-success" /> : <Play className="h-4 w-4" />}
                  {state?.done ? "Run again" : "Activate"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-warning">Confirm actuator command</DialogTitle>
            <DialogDescription>
              {active?.name} will be commanded on the {active?.module} at {duty}%. Make sure the vehicle is safely
              secured and nobody is working near moving components.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActive(null)}>
              Cancel
            </Button>
            <Button onClick={() => active && void start(active)}>Send command</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
