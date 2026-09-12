import { createFileRoute } from "@tanstack/react-router";
import { Eraser, ScanLine, Search, Snowflake } from "lucide-react";
import { useMemo, useState } from "react";

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
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTorque } from "@/lib/torquedeck/store";
import type { Dtc } from "@/lib/torquedeck/types";

export const Route = createFileRoute("/fault-codes")({
  head: () => ({
    meta: [
      { title: "Fault Codes & Freeze Frame | TORQUEDECK" },
      {
        name: "description",
        content:
          "Read generic and manufacturer-specific diagnostic trouble codes with severity, status and freeze frame data.",
      },
      { property: "og:title", content: "Fault Codes & Freeze Frame | TORQUEDECK" },
      { property: "og:description", content: "DTC analysis with freeze frame capture and guided causes." },
    ],
  }),
  component: FaultCodesPage,
});

const SYSTEMS = ["All", "Powertrain", "Chassis", "Body", "Network"] as const;

function severityVariant(s: Dtc["severity"]) {
  return s === "critical" ? "destructive" : s === "warning" ? "secondary" : "outline";
}

function FaultCodesPage() {
  const { dtcs, runSmartScan, clearDtcs } = useTorque();
  const [query, setQuery] = useState("");
  const [system, setSystem] = useState<(typeof SYSTEMS)[number]>("All");
  const [selected, setSelected] = useState<Dtc | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const filtered = useMemo(
    () =>
      dtcs.filter(
        (d) =>
          (system === "All" || d.system === system) &&
          (d.code.toLowerCase().includes(query.toLowerCase()) ||
            d.description.toLowerCase().includes(query.toLowerCase())),
      ),
    [dtcs, query, system],
  );

  return (
    <div>
      <PageHeader
        title="Diagnostic Trouble Codes"
        description="Generic (P0xxx) and manufacturer-specific (P1xxx, Bxxxx, Cxxxx, Uxxxx) codes with freeze frame capture."
        actions={
          <>
            <Button variant="outline" className="gap-2" onClick={() => void runSmartScan()}>
              <ScanLine className="h-4 w-4" /> Re-read codes
            </Button>
            <Button variant="destructive" className="gap-2" onClick={() => setConfirmClear(true)}>
              <Eraser className="h-4 w-4" /> Clear codes
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search code or description"
            className="pl-9"
          />
        </div>
        <Tabs value={system} onValueChange={(v) => setSystem(v as (typeof SYSTEMS)[number])}>
          <TabsList>
            {SYSTEMS.map((s) => (
              <TabsTrigger key={s} value={s}>
                {s}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <Card className="panel">
        <CardContent className="p-0">
          {filtered.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead className="min-w-64">Description</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => (
                  <TableRow key={d.code} className="cursor-pointer" onClick={() => setSelected(d)}>
                    <TableCell className="font-mono font-bold">{d.code}</TableCell>
                    <TableCell className="text-xs">{d.module}</TableCell>
                    <TableCell className="text-xs">{d.description}</TableCell>
                    <TableCell>
                      <Badge variant={severityVariant(d.severity)}>{d.severity}</Badge>
                    </TableCell>
                    <TableCell className="text-xs uppercase">{d.state}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{d.occurrences}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No stored codes. Run a smart scan to interrogate every module.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono">
                  {selected.code} · {selected.module}
                </DialogTitle>
                <DialogDescription>{selected.description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={severityVariant(selected.severity)}>{selected.severity}</Badge>
                  <Badge variant="outline">{selected.state}</Badge>
                  <Badge variant="outline">{selected.system}</Badge>
                  <Badge variant="outline">{selected.occurrences} occurrences</Badge>
                </div>

                <Card className="panel">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase tracking-wider">Probable causes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                      {selected.causes.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {selected.freezeFrame && (
                  <Card className="panel">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-xs uppercase tracking-wider">
                        <Snowflake className="h-3.5 w-3.5 text-primary" /> Freeze frame
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                      {Object.entries(selected.freezeFrame).map(([k, v]) => (
                        <div key={k} className="rounded-md border border-border bg-background/40 p-2">
                          <div className="text-[10px] uppercase text-muted-foreground">{k}</div>
                          <div className="font-mono">{v}</div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Clear all stored codes?</DialogTitle>
            <DialogDescription>
              This sends Mode 04 to every module. Freeze frame data and readiness monitors will be erased and cannot
              be recovered.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                clearDtcs();
                setConfirmClear(false);
              }}
            >
              Send Mode 04
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
