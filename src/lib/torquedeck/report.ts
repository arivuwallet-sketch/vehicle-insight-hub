import type { Dtc, EcuModule, VehicleProfile } from "./types";

interface ReportInput {
  vehicle: VehicleProfile;
  modules: Pick<EcuModule, "abbr" | "name" | "status" | "dtcs">[];
  dtcs: Dtc[];
  technician: string;
  notes: string;
  batteryVolts: number;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[c] ?? c;
  });
}

export function buildReportHtml(input: ReportInput) {
  const { vehicle, modules, dtcs, technician, notes, batteryVolts } = input;
  const now = new Date().toLocaleString();

  const moduleRows = modules
    .map(
      (m) => `<tr>
        <td>${escapeHtml(m.abbr)}</td>
        <td>${escapeHtml(m.name)}</td>
        <td class="${m.status === "fault" ? "bad" : m.status === "pass" ? "good" : ""}">${m.status.toUpperCase()}</td>
        <td>${m.dtcs.length}</td>
      </tr>`,
    )
    .join("");

  const dtcRows = dtcs.length
    ? dtcs
        .map(
          (d) => `<tr>
            <td><strong>${escapeHtml(d.code)}</strong></td>
            <td>${escapeHtml(d.module)}</td>
            <td>${escapeHtml(d.description)}</td>
            <td>${d.severity.toUpperCase()}</td>
            <td>${d.state.toUpperCase()}</td>
          </tr>`,
        )
        .join("")
    : `<tr><td colspan="5">No diagnostic trouble codes stored.</td></tr>`;

  const freeze = dtcs.find((d) => d.freezeFrame)?.freezeFrame;
  const freezeBlock = freeze
    ? `<h2>Freeze Frame</h2>
       <table>
         <tr><td>Engine speed</td><td>${freeze.rpm} rpm</td><td>Vehicle speed</td><td>${freeze.speedKph} km/h</td></tr>
         <tr><td>Coolant</td><td>${freeze.coolantC} °C</td><td>Engine load</td><td>${freeze.loadPct} %</td></tr>
         <tr><td>Short fuel trim</td><td>${freeze.fuelTrimShort} %</td><td>Long fuel trim</td><td>${freeze.fuelTrimLong} %</td></tr>
         <tr><td>Intake air</td><td>${freeze.intakeAirC} °C</td><td>MAP</td><td>${freeze.mapKpa} kPa</td></tr>
       </table>`
    : "";

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>TORQUEDECK Diagnostic Report — ${escapeHtml(vehicle.vin)}</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; color: #0f172a; margin: 32px; }
  header { border-bottom: 3px solid #0ea5e9; padding-bottom: 12px; margin-bottom: 20px; }
  h1 { margin: 0; font-size: 22px; letter-spacing: 2px; }
  .sub { color: #475569; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
  th { background: #f1f5f9; }
  .good { color: #15803d; font-weight: 600; }
  .bad { color: #b91c1c; font-weight: 600; }
  .notes { border: 1px solid #cbd5e1; padding: 12px; min-height: 70px; font-size: 12px; white-space: pre-wrap; }
  @media print { body { margin: 12mm; } }
</style></head>
<body>
  <header>
    <h1>TORQUEDECK — VEHICLE DIAGNOSTIC REPORT</h1>
    <div class="sub">Generated ${escapeHtml(now)} · Technician: ${escapeHtml(technician || "Unassigned")}</div>
  </header>
  <h2>Vehicle</h2>
  <table>
    <tr><td>VIN</td><td>${escapeHtml(vehicle.vin)}</td><td>Protocol</td><td>${escapeHtml(vehicle.protocol)}</td></tr>
    <tr><td>Vehicle</td><td>${vehicle.year} ${escapeHtml(vehicle.make)} ${escapeHtml(vehicle.model)}</td><td>Engine</td><td>${escapeHtml(vehicle.engine)}</td></tr>
    <tr><td>Odometer</td><td>${vehicle.odometerKm.toLocaleString()} km</td><td>Battery</td><td>${batteryVolts.toFixed(2)} V</td></tr>
  </table>
  <h2>Module Scan</h2>
  <table><thead><tr><th>Module</th><th>Description</th><th>Status</th><th>Codes</th></tr></thead><tbody>${moduleRows}</tbody></table>
  <h2>Diagnostic Trouble Codes</h2>
  <table><thead><tr><th>Code</th><th>Module</th><th>Description</th><th>Severity</th><th>Status</th></tr></thead><tbody>${dtcRows}</tbody></table>
  ${freezeBlock}
  <h2>Technician Notes</h2>
  <div class="notes">${escapeHtml(notes || "—")}</div>
</body></html>`;
}

export function openReport(input: ReportInput) {
  const html = buildReportHtml(input);
  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
  return true;
}
