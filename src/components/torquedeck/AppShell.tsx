import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BatteryFull,
  Bluetooth,
  Cable,
  Car,
  FileText,
  Gauge,
  Network,
  Power,
  Radio,
  ScrollText,
  Settings2,
  SlidersHorizontal,
  TriangleAlert,
  Warehouse,
  Wrench,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { openReport } from "@/lib/torquedeck/report";
import { useTorque } from "@/lib/torquedeck/store";
import { BAUD_RATES } from "@/lib/torquedeck/transport";

const NAV = [
  { to: "/", label: "Dashboard", icon: Gauge },
  { to: "/topology", label: "Topology Map", icon: Network },
  { to: "/fault-codes", label: "Fault Codes", icon: TriangleAlert },
  { to: "/live-data", label: "Live Stream", icon: Activity },
  { to: "/bi-directional", label: "Bi-Directional", icon: SlidersHorizontal },
  { to: "/service-resets", label: "Service Resets", icon: Wrench },
  { to: "/coding", label: "ECU Coding", icon: Settings2 },
  { to: "/console", label: "CAN Console", icon: ScrollText },
  { to: "/garage", label: "Garage & History", icon: Warehouse },
] as const;

function BatteryPill() {
  const { telemetry } = useTorque();
  const volts = telemetry?.battery ?? 12.4;
  const tone = volts >= 13.4 ? "text-success" : volts >= 12.2 ? "text-warning" : "text-destructive";
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-1.5">
      <BatteryFull className={cn("h-4 w-4", tone)} />
      <span className={cn("font-mono text-sm tabular-nums", tone)}>{volts.toFixed(2)}V</span>
    </div>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map(({ to, label, icon: Icon }) => {
        const active = pathname === to;
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-primary glow-primary"
                : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
            )}
          >
            <Icon className="h-4.5 w-4.5 shrink-0" />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const {
    vehicle,
    demoMode,
    setDemoMode,
    linkState,
    linkKind,
    adapterLabel,
    connectBle,
    connectUsb,
    disconnect,
    baudRate,
    setBaudRate,
    canUseBluetooth,
    canUseSerial,
    modules,
    dtcs,
    technician,
    notes,
    telemetry,
  } = useTorque();
  const [mobileOpen, setMobileOpen] = useState(false);

  const connected = linkState === "connected";

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3 px-3 py-2.5 lg:px-5">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Network className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0">
              <div className="border-b border-sidebar-border px-4 py-4 text-lg font-bold tracking-[0.2em] text-primary">
                TORQUEDECK
              </div>
              <SidebarNav onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <Link to="/" className="hidden items-center gap-2 lg:flex">
            <Radio className="h-5 w-5 text-primary" />
            <span className="text-lg font-bold tracking-[0.25em] text-primary">TORQUEDECK</span>
          </Link>

          <div className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-background/60 px-3 py-1.5">
            <Car className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-xs font-semibold">
                {vehicle.year} {vehicle.make} {vehicle.model}
              </div>
              <div className="truncate font-mono text-[10px] text-muted-foreground">
                {vehicle.vin} · {vehicle.protocol}
              </div>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <BatteryPill />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant={connected ? "default" : "outline"} size="sm" className="gap-2">
                  {linkKind === "serial" ? <Cable className="h-4 w-4" /> : <Bluetooth className="h-4 w-4" />}
                  <span className="hidden sm:inline">
                    {connected ? adapterLabel : linkState === "connecting" ? "Connecting…" : "Connect adapter"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Adapter</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => void connectBle()} disabled={!canUseBluetooth}>
                  <Bluetooth className="mr-2 h-4 w-4" />
                  Web Bluetooth (ELM327 BLE)
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void connectUsb()} disabled={!canUseSerial}>
                  <Cable className="mr-2 h-4 w-4" />
                  Web Serial (FTDI / CH340)
                </DropdownMenuItem>
                {!canUseBluetooth && !canUseSerial && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    This browser exposes neither Web Bluetooth nor Web Serial. Demo mode stays active.
                  </div>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Baud rate</DropdownMenuLabel>
                {BAUD_RATES.map((rate) => (
                  <DropdownMenuItem key={rate} onSelect={() => setBaudRate(rate)}>
                    <span className={cn("font-mono", rate === baudRate && "text-primary")}>{rate}</span>
                  </DropdownMenuItem>
                ))}
                {connected && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => void disconnect()}>
                      <Power className="mr-2 h-4 w-4" />
                      Disconnect
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-1.5">
              <span className="text-xs text-muted-foreground">Demo</span>
              <Switch checked={demoMode} onCheckedChange={setDemoMode} aria-label="Simulation mode" />
            </div>

            <Button
              variant="outline"
              size="sm"
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
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">PDF report</span>
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-border/60 px-3 py-1 lg:px-5">
          <Badge variant={connected ? "default" : "secondary"} className="gap-1">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                connected ? "bg-success glow-success" : demoMode ? "bg-primary" : "bg-muted-foreground",
              )}
            />
            {connected ? "LIVE HARDWARE" : demoMode ? "SIMULATION ENGINE" : "OFFLINE"}
          </Badge>
          <span className="font-mono text-[11px] text-muted-foreground">
            {dtcs.length} DTC · {modules.filter((m) => m.status === "fault").length} faulted modules
          </span>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
          <div className="sticky top-[92px]">
            <SidebarNav />
          </div>
        </aside>
        <main className="min-w-0 flex-1 p-3 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
