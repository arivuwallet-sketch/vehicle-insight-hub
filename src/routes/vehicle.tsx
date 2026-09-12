import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Cpu, Printer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OfflineNotice } from "@/components/obd/ConnectionBar";
import { useObd } from "@/lib/obd/store";
import { decodeVin } from "@/lib/obd/vin";

export const Route = createFileRoute("/vehicle")({
  head: () => ({
    meta: [
      { title: "Vehicle Info & VIN Decode — TorqueDeck" },
      {
        name: "description",
        content:
          "Read Mode 09 vehicle information: VIN, calibration ID and ECU name, with a full VIN breakdown including manufacturer, region and model year.",
      },
      { property: "og:title", content: "Vehicle Info & VIN Decode — TorqueDeck" },
      {
        property: "og:description",
        content: "VIN, calibration ID and ECU identification read straight from the controller.",
      },
    ],
  }),
  component: VehiclePage,
});

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="readout text-sm font-medium">{value}</span>
    </div>
  );
}

function VehiclePage() {
  const { vin, calId, ecuName, protocolName, adapterName, readVehicleInfo, state } = useObd();
  const [manual, setManual] = useState("");
  const target = manual.trim() || vin || "";
  const decoded = target ? decodeVin(target) : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Vehicle Information</h1>
          <p className="text-sm text-muted-foreground">Mode 09 identification and VIN breakdown.</p>
        </div>
        <div className="no-print flex gap-2">
          <Button size="sm" disabled={state !== "connected"} onClick={() => void readVehicleInfo()}>
            <RefreshCw className="size-4" /> Re-read
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" /> Export
          </Button>
        </div>
      </header>

      <OfflineNotice />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Cpu className="size-4 text-signal" /> Read from ECU
          </h2>
          <Row label="VIN (Mode 09 PID 02)" value={vin ?? "—"} />
          <Row label="Calibration ID (PID 04)" value={calId ?? "—"} />
          <Row label="ECU name (PID 0A)" value={ecuName ?? "—"} />
          <Row label="Active protocol" value={protocolName || "—"} />
          <Row label="Adapter" value={adapterName || "—"} />
        </section>

        <section className="panel p-5">
          <h2 className="mb-3 text-sm font-semibold">VIN decode</h2>
          <Input
            className="no-print mb-3"
            placeholder={vin ?? "Type a VIN to decode manually"}
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            maxLength={17}
          />
          {decoded ? (
            <>
              <Row label="VIN" value={decoded.vin || "—"} />
              <Row label="Length valid" value={decoded.valid ? "Yes (17)" : `No (${decoded.vin.length})`} />
              <Row
                label="Check digit"
                value={
                  decoded.checkDigitOk == null
                    ? "—"
                    : decoded.checkDigitOk
                      ? "Passes ISO 3779"
                      : "Fails — VIN may be mistyped or non-standard"
                }
              />
              <Row label="Manufacturer (WMI)" value={decoded.manufacturer} />
              <Row label="Region" value={decoded.region} />
              <Row label="Model year" value={decoded.modelYear} />
              <Row label="Plant code" value={decoded.plantCode} />
              <Row label="Serial" value={decoded.serial || "—"} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Connect and read the VIN, or type one above. Decoding covers the WMI manufacturer,
              region, model-year character and check digit.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
