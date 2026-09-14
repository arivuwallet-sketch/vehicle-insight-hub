import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { History, Printer, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useObd } from "@/lib/obd/store";
import { DTC_DB_SIZE, lookupDtc } from "@/lib/obd/dtc";
import { PID_BY_ID, type PidId } from "@/lib/obd/pids";

export const Route = createFileRoute("/sessions")({
  validateSearch: (search: Record<string, unknown>) => ({
    vehicle: typeof search["vehicle"] === "string" ? (search["vehicle"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Scan Sessions & Reports — TorqueDeck" },
      {
        name: "description",
        content:
          "Trip and scan session history with fault codes, peak live values and a printable PDF report for each visit.",
      },
      { property: "og:title", content: "Scan Sessions & Reports — TorqueDeck" },
      {
        property: "og:description",
        content: "Saved diagnostic sessions with codes, peaks and printable reports.",
      },
    ],
  }),
  component: SessionsPage,
});

function fmt(ts: number) {
  return new Date(ts).toLocaleString();
}

function SessionsPage() {
  const { sessions, saveSession, deleteSession, state } = useObd();
  const [notes, setNotes] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wide">Sessions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Snapshot the current scan, then print any session as a PDF report.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Session notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-56"
          />
          <Button
            disabled={state !== "connected"}
            onClick={() => {
              saveSession(notes);
              setNotes("");
            }}
          >
            <Save className="size-4" /> Save current
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="size-4" /> Export PDF
          </Button>
        </div>
      </header>

      {sessions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          <History className="mx-auto mb-3 size-8 opacity-50" />
          No saved sessions yet. Connect an adapter and press Save current (or G).
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((s) => {
            const open = openId === s.id;
            const mins = Math.max(1, Math.round((s.endedAt - s.startedAt) / 60000));
            return (
              <article key={s.id} className="rounded-lg border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display font-semibold tracking-wide">{s.vehicleLabel}</h2>
                    <div className="readout text-xs text-muted-foreground">
                      {fmt(s.startedAt)} · {mins} min · {s.samples} samples
                    </div>
                  </div>
                  <div className="no-print flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setOpenId(open ? null : s.id)}>
                      {open ? "Hide detail" : "View detail"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      onClick={() => deleteSession(s.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="readout mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <div>Protocol: {s.protocol}</div>
                  <div>Adapter: {s.adapter}</div>
                  <div>VIN: {s.vin ?? "—"}</div>
                  <div>
                    Codes: {s.dtcs.length} stored · {s.pending.length} pending
                  </div>
                </div>
                {s.notes && <p className="mt-2 text-sm">{s.notes}</p>}

                {open && (
                  <div className="mt-4 space-y-4 border-t border-border pt-4">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Fault codes
                      </h3>
                      {s.dtcs.length + s.pending.length === 0 ? (
                        <p className="mt-2 text-sm text-muted-foreground">No codes recorded.</p>
                      ) : (
                        <ul className="mt-2 space-y-2">
                          {[...s.dtcs, ...s.pending].map((code) => {
                            const info = lookupDtc(code);
                            return (
                              <li key={code} className="text-sm">
                                <span className="readout font-bold">{code}</span>{" "}
                                <span className="text-muted-foreground">{info.title}</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Peak live values
                      </h3>
                      <div className="readout mt-2 grid gap-1 text-sm sm:grid-cols-3">
                        {Object.entries(s.maxima).map(([id, v]) => {
                          const def = PID_BY_ID[id as PidId];
                          if (!def || v == null) return null;
                          return (
                            <div key={id}>
                              <span className="text-muted-foreground">{def.label}: </span>
                              {Math.round(v * 10) / 10} {def.unit}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <p className="no-print text-xs text-muted-foreground">
        {DTC_DB_SIZE}+ generic fault definitions are used to describe codes in these reports.
      </p>
    </div>
  );
}
