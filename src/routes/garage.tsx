import { createFileRoute } from "@tanstack/react-router";
import { FileText, Save, Trash2, Warehouse } from "lucide-react";

import { PageHeader } from "@/components/torquedeck/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { openReport } from "@/lib/torquedeck/report";
import { useTorque } from "@/lib/torquedeck/store";

export const Route = createFileRoute("/garage")({
  head: () => ({
    meta: [
      { title: "Garage & Session History | TORQUEDECK" },
      {
        name: "description",
        content: "Saved diagnostic sessions per vehicle with technician notes and printable workshop PDF reports.",
      },
      { property: "og:title", content: "Garage & Session History | TORQUEDECK" },
      { property: "og:description", content: "Stored vehicle sessions and printable diagnostic reports." },
    ],
  }),
  component: GaragePage,
});

function GaragePage() {
  const {
    sessions,
    saveSession,
    deleteSession,
    technician,
    setTechnician,
    notes,
    setNotes,
    vehicle,
    modules,
    dtcs,
    telemetry,
  } = useTorque();

  return (
    <div>
      <PageHeader
        title="Garage & Session History"
        description="Sessions are stored on this device. Export any session as a printable workshop report."
        actions={
          <>
            <Button variant="outline" className="gap-2" onClick={saveSession}>
              <Save className="h-4 w-4" /> Save current session
            </Button>
            <Button
              className="gap-2"
              onClick={() =>
                openReport({
                  vehicle,
                  modules,
                  dtcs,
                  technician,
                  notes,
                  batteryVolts: telemetry?.battery ?? 14.1,
                })
              }
            >
              <FileText className="h-4 w-4" /> Print report
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card className="panel h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider">Report details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tech" className="text-xs">
                Technician
              </Label>
              <Input
                id="tech"
                value={technician}
                onChange={(e) => setTechnician(e.target.value)}
                placeholder="Name or workshop ID"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs">
                Technician notes
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={8}
                placeholder="Findings, measurements, parts fitted, road test result…"
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {sessions.length ? (
            sessions.map((s) => (
              <Card key={s.id} className="panel">
                <CardContent className="flex flex-wrap items-start justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Warehouse className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">
                        {s.vehicle.year} {s.vehicle.make} {s.vehicle.model}
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {s.vehicle.vin} · {new Date(s.savedAt).toLocaleString()} · {s.technician}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant={s.dtcs.length ? "destructive" : "default"}>{s.dtcs.length} DTC</Badge>
                      <Badge variant="outline">
                        {s.modules.filter((m) => m.status === "fault").length} faulted modules
                      </Badge>
                      <Badge variant="outline">{s.batteryVolts.toFixed(2)}V</Badge>
                    </div>
                    {s.notes && <p className="mt-2 max-w-xl text-xs text-muted-foreground">{s.notes}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() =>
                        openReport({
                          vehicle: s.vehicle,
                          modules: s.modules.map((m) => ({
                            abbr: m.name,
                            name: m.name,
                            status: m.status,
                            dtcs: Array.from({ length: m.dtcCount }, (_, i) => String(i)),
                          })),
                          dtcs: s.dtcs,
                          technician: s.technician,
                          notes: s.notes,
                          batteryVolts: s.batteryVolts,
                        })
                      }
                    >
                      <FileText className="h-3.5 w-3.5" /> Report
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteSession(s.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="panel">
              <CardContent className="p-10 text-center text-sm text-muted-foreground">
                No saved sessions yet. Run a scan, then choose “Save current session”.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
