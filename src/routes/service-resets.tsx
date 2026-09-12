import { createFileRoute } from "@tanstack/react-router";
import { CircleCheck, Loader2, Wrench } from "lucide-react";
import { useState } from "react";
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
import { SERVICE_RESETS } from "@/lib/torquedeck/data";
import { useTorque } from "@/lib/torquedeck/store";
import type { ServiceReset } from "@/lib/torquedeck/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/service-resets")({
  head: () => ({
    meta: [
      { title: "Service Resets & Special Functions | TORQUEDECK" },
      {
        name: "description",
        content:
          "Oil reset, EPB retract, DPF regeneration, steering angle calibration, TPMS relearn and battery registration.",
      },
      { property: "og:title", content: "Service Resets & Special Functions | TORQUEDECK" },
      { property: "og:description", content: "Guided maintenance procedures with step-by-step progress." },
    ],
  }),
  component: ServiceResetsPage,
});

function ServiceResetsPage() {
  const { telemetry, sendCommand } = useTorque();
  const [active, setActive] = useState<ServiceReset | null>(null);
  const [running, setRunning] = useState<ServiceReset | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [completed, setCompleted] = useState<string[]>([]);

  const execute = async (proc: ServiceReset) => {
    setActive(null);
    setRunning(proc);
    setStepIndex(0);
    await sendCommand("10 03");
    for (let i = 0; i < proc.steps.length; i += 1) {
      setStepIndex(i);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 900));
    }
    setStepIndex(proc.steps.length);
    setCompleted((prev) => [...new Set([...prev, proc.id])]);
    toast.success(`${proc.name} completed`);
    setTimeout(() => setRunning(null), 900);
  };

  return (
    <div>
      <PageHeader
        title="Service Resets & Special Functions"
        description="Maintenance routines that write to the vehicle. Battery voltage must remain stable throughout."
        actions={
          <Badge variant={(telemetry?.battery ?? 0) >= 12.4 ? "default" : "destructive"} className="gap-1">
            Battery {(telemetry?.battery ?? 0).toFixed(2)}V
          </Badge>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {SERVICE_RESETS.map((proc) => (
          <Card key={proc.id} className="panel flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Wrench className="h-4 w-4 text-primary" />
                  {proc.name}
                </CardTitle>
                <Badge variant="outline">{proc.module}</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              <p className="text-xs text-muted-foreground">{proc.description}</p>
              <ol className="space-y-1 text-[11px] text-muted-foreground">
                {proc.steps.map((s, i) => (
                  <li key={s} className="font-mono">
                    {i + 1}. {s}
                  </li>
                ))}
              </ol>
              <Button
                className="mt-auto gap-2"
                variant={completed.includes(proc.id) ? "outline" : "default"}
                onClick={() => setActive(proc)}
              >
                {completed.includes(proc.id) ? (
                  <CircleCheck className="h-4 w-4 text-success" />
                ) : (
                  <Wrench className="h-4 w-4" />
                )}
                {completed.includes(proc.id) ? "Run again" : "Start procedure"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start {active?.name}?</DialogTitle>
            <DialogDescription>
              {active?.requiresIgnition
                ? "Switch the ignition ON (engine off unless the procedure says otherwise) and keep a charger connected."
                : "Ensure the vehicle is stationary before continuing."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActive(null)}>
              Cancel
            </Button>
            <Button onClick={() => active && void execute(active)}>Begin</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!running} onOpenChange={() => undefined}>
        <DialogContent className="[&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              {running?.name}
            </DialogTitle>
            <DialogDescription>Do not switch off the ignition while the procedure is running.</DialogDescription>
          </DialogHeader>
          {running && (
            <div className="space-y-3">
              <Progress value={Math.round((stepIndex / running.steps.length) * 100)} />
              <ol className="space-y-1.5 text-xs">
                {running.steps.map((s, i) => (
                  <li
                    key={s}
                    className={cn(
                      "flex items-center gap-2 font-mono",
                      i < stepIndex ? "text-success" : i === stepIndex ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {i < stepIndex ? <CircleCheck className="h-3.5 w-3.5" /> : <span className="w-3.5" />}
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
