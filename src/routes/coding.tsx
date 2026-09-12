import { createFileRoute } from "@tanstack/react-router";
import { KeyRound, Lock, LockOpen, ShieldAlert } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTorque } from "@/lib/torquedeck/store";
import type { CodingParameter } from "@/lib/torquedeck/types";

export const Route = createFileRoute("/coding")({
  head: () => ({
    meta: [
      { title: "ECU Coding & Adaptations | TORQUEDECK" },
      {
        name: "description",
        content:
          "UDS security access, variant coding and adaptation writes with seed-key exchange and confirmation guards.",
      },
      { property: "og:title", content: "ECU Coding & Adaptations | TORQUEDECK" },
      { property: "og:description", content: "Variant coding with UDS 0x27 security access and 0x2E writes." },
    ],
  }),
  component: CodingPage,
});

function randomHex(bytes: number) {
  return Array.from({ length: bytes }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .toUpperCase()
      .padStart(2, "0"),
  ).join(" ");
}

function CodingPage() {
  const { coding, applyCoding, sendCommand } = useTorque();
  const [unlocked, setUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [seed, setSeed] = useState<string | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [pending, setPending] = useState<{ param: CodingParameter; value: string } | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const requestAccess = async () => {
    setUnlocking(true);
    setProgress(0);
    setSeed(null);
    setKey(null);
    await sendCommand("10 03");
    const s = randomHex(4);
    setSeed(s);
    setProgress(35);
    await new Promise((r) => setTimeout(r, 700));
    const k = randomHex(4);
    setKey(k);
    setProgress(70);
    await sendCommand("27 01");
    await new Promise((r) => setTimeout(r, 700));
    setProgress(100);
    setUnlocked(true);
    setUnlocking(false);
    toast.success("Security access level 0x01 granted");
  };

  const commit = async () => {
    if (!pending || confirmText !== "WRITE CODING") return;
    await sendCommand(`2E F1 90 ${randomHex(2)}`);
    applyCoding(pending.param.id, pending.value);
    toast.success(`${pending.param.name} written to ${pending.param.module}`);
    setPending(null);
    setConfirmText("");
  };

  return (
    <div>
      <PageHeader
        title="ECU Coding & Adaptations"
        description="Change vehicle variant coding over UDS. Security access must be granted before any write is accepted."
        actions={
          <Badge variant={unlocked ? "default" : "secondary"} className="gap-1.5">
            {unlocked ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            {unlocked ? "WRITE ACCESS UNLOCKED" : "READ ONLY"}
          </Badge>
        }
      />

      <Card className="panel mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider">
            <KeyRound className="h-4 w-4 text-primary" /> UDS security access (0x27)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-md border border-border bg-background/50 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Seed (27 01)</div>
              <div className="font-mono text-sm text-primary">{seed ?? "-- -- -- --"}</div>
            </div>
            <div className="rounded-md border border-border bg-background/50 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Key (27 02)</div>
              <div className="font-mono text-sm text-success">{key ?? "-- -- -- --"}</div>
            </div>
          </div>
          {(unlocking || unlocked) && <Progress value={progress} />}
          <Button onClick={() => void requestAccess()} disabled={unlocking} className="gap-2">
            <KeyRound className="h-4 w-4" />
            {unlocked ? "Re-authenticate" : unlocking ? "Exchanging seed/key…" : "Request security access"}
          </Button>
        </CardContent>
      </Card>

      <Card className="panel">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parameter</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Identifier</TableHead>
                <TableHead className="w-52">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coding.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground">{p.note}</div>
                  </TableCell>
                  <TableCell className="text-xs">{p.module}</TableCell>
                  <TableCell className="font-mono text-xs">{p.did}</TableCell>
                  <TableCell>
                    <Select
                      value={p.value}
                      disabled={!unlocked}
                      onValueChange={(v) => v !== p.value && setPending({ param: p, value: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {p.options.map((o) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog
        open={!!pending}
        onOpenChange={(o) => {
          if (!o) {
            setPending(null);
            setConfirmText("");
          }
        }}
      >
        <DialogContent className="border-destructive">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" /> Permanent ECU write
            </DialogTitle>
            <DialogDescription>
              You are about to write <strong>{pending?.param.name}</strong> = <strong>{pending?.value}</strong> to the{" "}
              {pending?.param.module} using WriteDataByIdentifier ({pending?.param.did}). Incorrect coding can disable
              vehicle functions. Type <span className="font-mono text-destructive">WRITE CODING</span> to continue.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="WRITE CODING"
            className="font-mono"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPending(null);
                setConfirmText("");
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" disabled={confirmText !== "WRITE CODING"} onClick={() => void commit()}>
              Execute write
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
