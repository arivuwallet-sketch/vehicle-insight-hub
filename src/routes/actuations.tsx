import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, Play, ShieldAlert, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OfflineNotice } from "@/components/obd/ConnectionBar";
import { useObd } from "@/lib/obd/store";
import {
  MAKE_PROFILES,
  RISK_NOTE,
  profileForMake,
  type ActuationTest,
  type MakeProfile,
  type Risk,
} from "@/lib/obd/actuations";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/actuations")({
  head: () => ({
    meta: [
      { title: "Actuation Tests & Security Routines — TorqueDeck" },
      {
        name: "description",
        content:
          "Run manufacturer actuation tests, adaptations and security access routines per vehicle, with every request sent live to the car and the raw ECU reply shown.",
      },
      { property: "og:title", content: "Actuation Tests & Security Routines — TorqueDeck" },
      {
        property: "og:description",
        content: "Per-make bi-directional tests and UDS routines sent as real requests through the expert console.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ActuationsPage,
});

const RISK_STYLE: Record<Risk, string> = {
  safe: "border-info/40 bg-info/10 text-info",
  caution: "border-warn/40 bg-warn/10 text-warn",
  restricted: "border-danger/40 bg-danger/10 text-danger",
};

interface StepResult {
  cmd: string;
  reply: string;
  ok: boolean;
  at: number;
}

function ActuationsPage() {
  const { vehicles, activeVehicleId, sendRaw, state } = useObd();
  const active = vehicles.find((v) => v.id === activeVehicleId);
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, StepResult[]>>({});

  const profile: MakeProfile = useMemo(() => {
    if (overrideId) return MAKE_PROFILES.find((p) => p.id === overrideId) ?? profileForMake("");
    return profileForMake(active?.make ?? "");
  }, [overrideId, active?.make]);

  const runTest = async (test: ActuationTest) => {
    if (state !== "connected") {
      toast.error("Connect an adapter first");
      return;
    }
    setRunning(test.id);
    setResults((r) => ({ ...r, [test.id]: [] }));
    try {
      const header = `ATSH${profile.header}`;
      const pre = await sendRaw(header);
      setResults((r) => ({
        ...r,
        [test.id]: [{ cmd: header, reply: pre, ok: /ok/i.test(pre), at: Date.now() }],
      }));
      for (const step of test.steps) {
        const reply = await sendRaw(step.cmd);
        const ok = !/^7F|NO DATA|ERROR|UNABLE|CAN ERROR/i.test(reply.trim());
        setResults((r) => ({
          ...r,
          [test.id]: [...(r[test.id] ?? []), { cmd: step.cmd, reply, ok, at: Date.now() }],
        }));
      }
      toast.success(`${test.name} finished — read the ECU replies below`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally {
      await sendRaw("ATSH7E0").catch(() => undefined);
      setRunning(null);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Actuation Tests & Routines</h1>
        <p className="text-sm text-muted-foreground">
          Manufacturer tests for the car selected in your garage. Every step is a real request sent
          to the vehicle — the ECU's own reply is shown, nothing is simulated.
        </p>
      </header>

      <OfflineNotice />

      <div className="panel flex flex-wrap items-center gap-3 p-4 text-sm">
        <Wrench className="size-4 shrink-0 text-signal" />
        <span className="text-muted-foreground">
          {active ? (
            <>
              Selected car:{" "}
              <strong className="text-foreground">
                {active.nickname || `${active.year ?? ""} ${active.make} ${active.model}`.trim()}
              </strong>{" "}
              — matched to <strong className="text-foreground">{profile.make}</strong>
            </>
          ) : (
            <>
              No car selected. Pick one in the <Link to="/garage" className="text-signal underline">Garage</Link> or
              choose a make below.
            </>
          )}
        </span>
        <select
          className="ml-auto rounded-md border border-border bg-background px-2 py-1 text-sm"
          value={overrideId ?? profile.id}
          onChange={(e) => setOverrideId(e.target.value)}
        >
          {MAKE_PROFILES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.make}
            </option>
          ))}
        </select>
      </div>

      {profile.verified === false && (
        <div className="panel flex items-start gap-3 border-warn/40 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warn" />
          <p className="text-muted-foreground">
            Brand-specific actuation routines for{" "}
            <strong className="text-foreground">{profile.make}</strong> aren&apos;t verified yet —
            standard UDS diagnostics only. Everything listed below is generic ISO 14229 / OBD-II and
            works on any compliant vehicle.
          </p>
        </div>
      )}

      <div className="panel flex items-start gap-3 border-danger/40 p-4 text-sm">

        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-danger" />
        <p className="text-muted-foreground">
          These commands move real actuators and can write to control modules. Keep hands clear of
          fans and belts, work with a battery maintainer connected, and stop if a module answers with
          a negative response (7F). Key programming, immobiliser learning and flash coding need the
          maker's seed/key algorithm and are not possible from a browser.
        </p>
      </div>

      <p className="readout text-xs text-muted-foreground">
        Diagnostic address in use: {profile.header} — {profile.headerNote}
      </p>

      <div className="grid gap-4">
        {profile.tests.map((test) => {
          const res = results[test.id] ?? [];
          return (
            <article key={test.id} className="panel space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">{test.name}</h2>
                    <Badge variant="outline" className={cn("text-[10px] uppercase", RISK_STYLE[test.risk])}>
                      {test.risk}
                    </Badge>
                  </div>
                  <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{test.description}</p>
                </div>
                <Button
                  size="sm"
                  disabled={state !== "connected" || running !== null}
                  onClick={() => void runTest(test)}
                >
                  <Play className="size-4" />
                  {running === test.id ? "Running…" : "Run test"}
                </Button>
              </div>

              <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn" />
                <span>
                  <strong className="text-foreground">Before you run:</strong> {test.precondition}{" "}
                  {RISK_NOTE[test.risk]}
                </span>
              </div>

              <ol className="readout space-y-1 text-xs">
                {test.steps.map((s, i) => (
                  <li key={`${test.id}-${i}`} className="flex flex-wrap gap-2">
                    <span className="font-semibold text-signal">{s.cmd}</span>
                    <span className="text-muted-foreground">{s.note}</span>
                  </li>
                ))}
              </ol>

              {res.length > 0 && (
                <div className="readout space-y-1 rounded-md border border-border bg-background p-3 text-xs">
                  {res.map((r, i) => (
                    <div key={`${test.id}-r-${i}`} className="flex flex-wrap gap-2">
                      <span className="text-muted-foreground">&gt; {r.cmd}</span>
                      <span className={r.ok ? "text-success" : "text-danger"}>{r.reply || "(no reply)"}</span>
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
