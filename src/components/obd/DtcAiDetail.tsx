import { useCallback, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useObd } from "@/lib/obd/store";
import { lookupDtcDetail, type DtcDetail } from "@/lib/obd/dtc-ai.functions";

const CACHE_KEY = "obd.dtcDetail";

function readCache(): Record<string, DtcDetail> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, DtcDetail>;
  } catch {
    return {};
  }
}

function writeCache(key: string, value: DtcDetail) {
  try {
    const all = readCache();
    all[key] = value;
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {
    /* storage full or blocked — the detail still shows for this session */
  }
}

function Section({ title, items, ordered }: { title: string; items: string[]; ordered?: boolean }) {
  if (!items?.length) return null;
  const List = ordered ? "ol" : "ul";
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <List className={`mt-1 space-y-1 pl-5 text-sm ${ordered ? "list-decimal" : "list-disc"}`}>
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </List>
    </div>
  );
}

/** Full service-manual detail for a fault code, pulled on demand and cached per code + car. */
export function DtcAiDetail({ code }: { code: string }) {
  const { vehicles, activeVehicleId } = useObd();
  const car = vehicles.find((v) => v.id === activeVehicleId);
  const cacheKey = `${code}|${car?.make ?? ""}|${car?.model ?? ""}|${car?.year ?? ""}`;

  const fetchDetail = useServerFn(lookupDtcDetail);
  const [detail, setDetail] = useState<DtcDetail | null>(() => readCache()[cacheKey] ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDetail({
        data: {
          code,
          ...(car?.make ? { make: car.make } : {}),
          ...(car?.model ? { model: car.model } : {}),
          ...(car?.year ? { year: car.year } : {}),
        },
      });
      setDetail(res);
      writeCache(cacheKey, res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the full entry for this code.");
    } finally {
      setLoading(false);
    }
  }, [fetchDetail, code, car?.make, car?.model, car?.year, cacheKey]);

  if (detail) {
    return (
      <div className="mt-4 space-y-3 rounded-md border border-border/70 bg-muted/20 p-4">
        <div className="text-sm font-semibold">{detail.title}</div>
        <p className="text-sm text-muted-foreground">{detail.meaning}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Section title="Symptoms" items={detail.symptoms} />
          <Section title="Likely causes" items={detail.causes} />
          <Section title="Diagnosis" items={detail.diagnosis} ordered />
          <Section title="Repair" items={detail.repair} ordered />
        </div>
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Safe to drive?</strong> {detail.driveable}
        </p>
        {detail.vehicleNote && car && (
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">
              {car.make} {car.model}:
            </strong>{" "}
            {detail.vehicleNote}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3">
      <Button size="sm" variant="secondary" disabled={loading} onClick={() => void load()}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : <BookOpen className="size-4" />}
        {loading ? "Looking up…" : "Full manual entry"}
      </Button>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
