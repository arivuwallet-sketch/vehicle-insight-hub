import { familyLookup } from "./dtc-families";

export type Severity = "critical" | "serious" | "moderate" | "minor";

export interface DtcInfo {
  code: string;
  title: string;
  system: "Powertrain" | "Body" | "Chassis" | "Network";
  severity: Severity;
  meaning: string;
  causes: string[];
  repair: string[];
}

interface RawEntry {
  t: string;
  s: Severity;
  m: string;
  c: string[];
  r?: string[];
}

/**
 * Curated generic (SAE J2012) DTC database with plain-English explanations.
 * Codes not listed fall back to a structured range-based description.
 */
const DB: Record<string, RawEntry> = {
  P0010: {
    t: "Camshaft Position Actuator Circuit (Bank 1)",
    s: "moderate",
    m: "The ECU commanded the variable valve timing actuator and did not see the expected electrical response.",
    c: ["Failed VVT/camshaft oil control solenoid", "Wiring or connector fault", "Low or dirty engine oil"],
  },
  P0011: {
    t: "Camshaft Position - Timing Over-Advanced (Bank 1)",
    s: "serious",
    m: "Camshaft timing is more advanced than the ECU commanded, so valve timing is out of sync.",
    c: ["Sludged or low engine oil", "Stuck VVT solenoid or phaser", "Stretched timing chain"],
  },
  P0016: {
    t: "Crankshaft / Camshaft Position Correlation (Bank 1 Sensor A)",
    s: "serious",
    m: "The crankshaft and camshaft sensors disagree about engine position — the timing relationship is wrong.",
    c: ["Jumped or stretched timing chain/belt", "Failed VVT phaser", "Crank or cam sensor fault"],
  },
  P0030: {
    t: "O2 Sensor Heater Control Circuit (Bank 1 Sensor 1)",
    s: "minor",
    m: "The heater element inside the upstream oxygen sensor is not responding correctly.",
    c: ["Failed O2 sensor heater", "Blown fuse", "Broken wiring to the sensor"],
  },
  P0087: {
    t: "Fuel Rail/System Pressure Too Low",
    s: "serious",
    m: "Measured fuel pressure is below what the ECU demands, so the engine may starve under load.",
    c: ["Clogged fuel filter", "Weak fuel pump", "Leaking pressure regulator", "Failing high-pressure pump"],
  },
  P0101: {
    t: "MAF Sensor Range/Performance",
    s: "moderate",
    m: "Mass air flow readings do not match what the ECU expects from throttle and RPM.",
    c: ["Dirty or failing MAF sensor", "Intake leak after the sensor", "Clogged air filter"],
  },
  P0102: {
    t: "MAF Sensor Circuit Low Input",
    s: "moderate",
    m: "The air flow signal is lower than the sensor's valid range.",
    c: ["Disconnected MAF plug", "Short to ground in wiring", "Failed MAF sensor"],
  },
  P0113: {
    t: "Intake Air Temperature Sensor Circuit High",
    s: "minor",
    m: "The intake air temperature signal is stuck high, which the ECU reads as implausible.",
    c: ["Open circuit in IAT wiring", "Failed IAT sensor", "Corroded connector"],
  },
  P0116: {
    t: "Coolant Temperature Sensor Range/Performance",
    s: "moderate",
    m: "Coolant temperature readings change in a way that does not match normal engine warm-up behaviour.",
    c: ["Failing coolant temp sensor", "Stuck thermostat", "Low coolant level"],
  },
  P0121: {
    t: "Throttle Position Sensor Range/Performance",
    s: "serious",
    m: "The throttle position signal does not agree with air flow and pedal input.",
    c: ["Dirty throttle body", "Failing TPS", "Wiring chafe in the throttle harness"],
  },
  P0128: {
    t: "Coolant Thermostat Below Regulating Temperature",
    s: "minor",
    m: "The engine takes too long to reach operating temperature — usually a thermostat stuck open.",
    c: ["Stuck-open thermostat", "Faulty coolant temp sensor", "Low coolant"],
  },
  P0130: {
    t: "O2 Sensor Circuit (Bank 1 Sensor 1)",
    s: "moderate",
    m: "The upstream oxygen sensor signal is out of range or not switching normally.",
    c: ["Aged O2 sensor", "Exhaust leak before the sensor", "Wiring fault"],
  },
  P0131: {
    t: "O2 Sensor Circuit Low Voltage (Bank 1 Sensor 1)",
    s: "moderate",
    m: "The upstream O2 sensor reports a persistently lean signal.",
    c: ["Vacuum or exhaust leak", "Failed O2 sensor", "Low fuel pressure"],
  },
  P0133: {
    t: "O2 Sensor Slow Response (Bank 1 Sensor 1)",
    s: "moderate",
    m: "The upstream oxygen sensor switches too slowly between rich and lean.",
    c: ["Worn O2 sensor", "Silicone or oil contamination", "Small exhaust leak"],
  },
  P0135: {
    t: "O2 Sensor Heater Circuit (Bank 1 Sensor 1)",
    s: "minor",
    m: "The upstream oxygen sensor's internal heater circuit has failed electrically.",
    c: ["Failed sensor heater", "Blown fuse", "Open wiring"],
  },
  P0137: {
    t: "O2 Sensor Circuit Low Voltage (Bank 1 Sensor 2)",
    s: "minor",
    m: "The post-catalyst oxygen sensor reads persistently low.",
    c: ["Failed rear O2 sensor", "Exhaust leak near the sensor", "Wiring fault"],
  },
  P0171: {
    t: "System Too Lean (Bank 1)",
    s: "moderate",
    m: "The engine is getting more air than fuel and the ECU has run out of trim to correct it.",
    c: ["Vacuum or intake leak", "Dirty MAF sensor", "Weak fuel pump or clogged filter", "Leaking intake gasket"],
  },
  P0172: {
    t: "System Too Rich (Bank 1)",
    s: "moderate",
    m: "The engine is getting more fuel than it can burn cleanly.",
    c: ["Leaking fuel injector", "High fuel pressure", "Dirty air filter", "Failed O2 sensor"],
  },
  P0174: {
    t: "System Too Lean (Bank 2)",
    s: "moderate",
    m: "Bank 2 is running lean beyond the ECU's correction range.",
    c: ["Intake leak on bank 2", "Dirty MAF", "Fuel delivery restriction"],
  },
  P0175: {
    t: "System Too Rich (Bank 2)",
    s: "moderate",
    m: "Bank 2 is running rich beyond the ECU's correction range.",
    c: ["Leaking injector", "Excess fuel pressure", "Contaminated O2 sensor"],
  },
  P0300: {
    t: "Random / Multiple Cylinder Misfire",
    s: "critical",
    m: "More than one cylinder is misfiring. Sustained misfire can destroy the catalytic converter quickly.",
    c: ["Worn spark plugs or coils", "Vacuum leak", "Low fuel pressure", "Low compression / timing fault"],
  },
  P0301: {
    t: "Cylinder 1 Misfire Detected",
    s: "serious",
    m: "Cylinder 1 is not burning its charge consistently.",
    c: ["Bad plug or coil on cylinder 1", "Clogged or dead injector", "Low compression on that cylinder"],
  },
  P0302: {
    t: "Cylinder 2 Misfire Detected",
    s: "serious",
    m: "Cylinder 2 is not burning its charge consistently.",
    c: ["Bad plug or coil on cylinder 2", "Injector fault", "Low compression"],
  },
  P0303: {
    t: "Cylinder 3 Misfire Detected",
    s: "serious",
    m: "Cylinder 3 is not burning its charge consistently.",
    c: ["Bad plug or coil on cylinder 3", "Injector fault", "Low compression"],
  },
  P0304: {
    t: "Cylinder 4 Misfire Detected",
    s: "serious",
    m: "Cylinder 4 is not burning its charge consistently.",
    c: ["Bad plug or coil on cylinder 4", "Injector fault", "Low compression"],
  },
  P0325: {
    t: "Knock Sensor 1 Circuit (Bank 1)",
    s: "moderate",
    m: "The knock sensor circuit is faulty, so the ECU pulls timing as a precaution and loses power.",
    c: ["Failed knock sensor", "Damaged wiring under the intake", "Corroded connector"],
  },
  P0335: {
    t: "Crankshaft Position Sensor A Circuit",
    s: "critical",
    m: "The ECU has lost or cannot trust the crankshaft position signal — the engine may stall or refuse to start.",
    c: ["Failed crank sensor", "Damaged reluctor ring", "Wiring or connector damage"],
  },
  P0340: {
    t: "Camshaft Position Sensor A Circuit (Bank 1)",
    s: "serious",
    m: "The camshaft position signal is missing or erratic, affecting injection and spark timing.",
    c: ["Failed cam sensor", "Wiring fault", "Timing component wear"],
  },
  P0401: {
    t: "EGR Flow Insufficient",
    s: "moderate",
    m: "Not enough exhaust gas is being recirculated, which raises combustion temperatures and NOx.",
    c: ["Carbon-clogged EGR passages", "Stuck EGR valve", "Failed DPFE / EGR position sensor"],
  },
  P0420: {
    t: "Catalyst System Efficiency Below Threshold (Bank 1)",
    s: "moderate",
    m: "The catalytic converter is not cleaning the exhaust as well as it should, judged by the two O2 sensors.",
    c: ["Aged or failed catalytic converter", "Failing rear O2 sensor", "Exhaust leak", "Long-running misfire or rich condition"],
  },
  P0430: {
    t: "Catalyst System Efficiency Below Threshold (Bank 2)",
    s: "moderate",
    m: "Bank 2's catalytic converter is underperforming.",
    c: ["Worn converter", "Rear O2 sensor drift", "Exhaust leak"],
  },
  P0440: {
    t: "Evaporative Emission System Fault",
    s: "minor",
    m: "The fuel vapour containment system is leaking or not holding pressure.",
    c: ["Loose or cracked fuel cap", "Cracked EVAP hose", "Failed purge or vent valve"],
  },
  P0442: {
    t: "EVAP System Small Leak Detected",
    s: "minor",
    m: "A small vapour leak was detected in the fuel system — often just the fuel cap.",
    c: ["Fuel cap not sealing", "Small hose crack", "Leaking vent valve"],
  },
  P0455: {
    t: "EVAP System Large Leak Detected",
    s: "minor",
    m: "A large vapour leak was detected. Fuel smell is common with this code.",
    c: ["Missing or open fuel cap", "Disconnected EVAP hose", "Failed vent valve"],
  },
  P0500: {
    t: "Vehicle Speed Sensor A",
    s: "moderate",
    m: "The speed signal is missing or implausible, which can affect the transmission and cruise control.",
    c: ["Failed VSS", "ABS wheel speed sensor fault", "Wiring break"],
  },
  P0505: {
    t: "Idle Air Control System",
    s: "moderate",
    m: "The ECU cannot hold the commanded idle speed.",
    c: ["Carboned throttle body", "Failed IAC valve", "Vacuum leak"],
  },
  P0606: {
    t: "ECM/PCM Processor Fault",
    s: "critical",
    m: "The engine control module reported an internal processor failure.",
    c: ["Failed ECU", "Poor power/ground to the ECU", "Water ingress into the module"],
  },
  P0700: {
    t: "Transmission Control System Malfunction",
    s: "serious",
    m: "The transmission controller has stored its own fault — read TCM codes for the real detail.",
    c: ["Transmission solenoid fault", "Low or burnt fluid", "TCM wiring issue"],
  },
  P2096: {
    t: "Post Catalyst Fuel Trim System Too Lean (Bank 1)",
    s: "moderate",
    m: "Fuel trim measured after the catalyst is running lean.",
    c: ["Exhaust leak before the rear sensor", "Failing rear O2 sensor", "Lean running condition"],
  },
  P2187: {
    t: "System Too Lean at Idle (Bank 1)",
    s: "moderate",
    m: "The mixture is lean specifically at idle, which usually means unmetered air.",
    c: ["Vacuum leak", "Dirty MAF", "Leaking intake manifold gasket"],
  },
  P2195: {
    t: "O2 Sensor Signal Biased/Stuck Lean (Bank 1 Sensor 1)",
    s: "moderate",
    m: "The upstream sensor is stuck reporting lean regardless of actual mixture.",
    c: ["Contaminated O2 sensor", "Exhaust leak", "Wiring fault"],
  },
  P2279: {
    t: "Intake Air System Leak",
    s: "moderate",
    m: "Air is entering the engine downstream of the metering point.",
    c: ["Split intake boot", "Loose clamp", "Cracked PCV hose"],
  },
  P3400: {
    t: "Cylinder Deactivation System Bank 1",
    s: "moderate",
    m: "The cylinder deactivation (displacement-on-demand) system did not respond as commanded.",
    c: ["Failed deactivation solenoid", "Low oil pressure", "Collapsed lifter"],
  },
  B0001: {
    t: "Driver Frontal Stage 1 Deployment Control",
    s: "critical",
    m: "The airbag module found a fault in the driver airbag deployment circuit.",
    c: ["Failed clockspring", "Damaged airbag connector", "Faulty airbag module"],
  },
  B1000: {
    t: "ECU Internal Fault (Body)",
    s: "serious",
    m: "A body control module reported an internal failure.",
    c: ["Failed module", "Poor ground", "Voltage supply problem"],
  },
  C0035: {
    t: "Left Front Wheel Speed Sensor Circuit",
    s: "serious",
    m: "The ABS controller lost a usable signal from the left front wheel speed sensor.",
    c: ["Failed wheel speed sensor", "Damaged tone ring", "Chafed wiring at the strut"],
  },
  C0040: {
    t: "Right Front Wheel Speed Sensor Circuit",
    s: "serious",
    m: "The ABS controller lost a usable signal from the right front wheel speed sensor.",
    c: ["Failed sensor", "Debris on the tone ring", "Harness damage"],
  },
  C0561: {
    t: "System Configuration Error (ABS/ESC)",
    s: "moderate",
    m: "The stability control module has an invalid or missing configuration.",
    c: ["Module replaced without coding", "Calibration lost", "Network fault"],
  },
  U0100: {
    t: "Lost Communication With ECM/PCM A",
    s: "critical",
    m: "A module stopped hearing the engine controller on the CAN bus.",
    c: ["CAN wiring break or short", "Failed ECU", "Loss of power/ground to a module"],
  },
  U0101: {
    t: "Lost Communication With TCM",
    s: "serious",
    m: "The transmission controller is not responding on the network.",
    c: ["CAN wiring fault", "TCM power supply issue", "Failed TCM"],
  },
  U0121: {
    t: "Lost Communication With ABS Control Module",
    s: "serious",
    m: "The ABS module has dropped off the vehicle network.",
    c: ["Blown ABS fuse", "CAN bus fault", "Failed ABS module"],
  },
  U0155: {
    t: "Lost Communication With Instrument Cluster",
    s: "moderate",
    m: "The instrument cluster is not communicating with the rest of the network.",
    c: ["Cluster power/ground fault", "CAN wiring", "Failed cluster"],
  },
  P2002: {
    t: "Diesel Particulate Filter Efficiency Below Threshold (Bank 1)",
    s: "serious",
    m: "The pressure and temperature sensors say the DPF is no longer trapping and burning soot properly.",
    c: ["Soot-loaded or cracked DPF", "Failed differential pressure sensor or blocked hoses", "Repeated interrupted regenerations from short trips", "Injector or EGR fault feeding extra soot"],
    r: [
      "Read DPF soot mass, ash mass, differential pressure and distance since last regeneration in live data.",
      "Check the pressure sensor hoses for soot blockage or splits before condemning the filter.",
      "Run a forced regeneration if soot loading allows, then drive a motorway cycle and recheck.",
      "Fix any upstream cause (EGR, injectors, turbo) or the new filter will block again.",
    ],
  },
  P2463: {
    t: "Diesel Particulate Filter — Soot Accumulation",
    s: "serious",
    m: "Soot in the particulate filter has passed the allowed limit, usually because regenerations keep failing or being cut short.",
    c: ["Mostly short, low-speed journeys", "Failed or interrupted regeneration", "Faulty differential pressure or exhaust temperature sensor", "Leaking injector or stuck EGR valve"],
    r: [
      "Check soot mass and regeneration history in live data.",
      "Verify exhaust temperature sensors read plausibly and match each other cold.",
      "Attempt a forced regeneration, or drive at steady motorway speed for 20 minutes if the car allows it.",
      "If soot mass is above the safe forced-regen limit, the filter needs off-car cleaning or replacement.",
    ],
  },
  P2096: {
    t: "Post-Catalyst Fuel Trim System Too Lean (Bank 1)",
    s: "moderate",
    m: "The downstream oxygen sensor reports a lean mixture after the catalyst that the ECU cannot trim out.",
    c: ["Small exhaust leak before or near the rear sensor", "Contaminated rear O2 sensor", "Failing catalyst", "Genuine lean running from a vacuum leak"],
    r: [
      "Pressurise or smoke-test the exhaust from the manifold back to find leaks.",
      "Compare front and rear sensor traces at steady cruise.",
      "Check short and long term fuel trims at idle and 2500 rpm before replacing parts.",
    ],
  },
  P2187: {
    t: "System Too Lean at Idle (Bank 1)",
    s: "moderate",
    m: "At idle the engine needs far more fuel than expected, so unmetered air is getting in or fuel delivery is short.",
    c: ["Vacuum hose or intake gasket leak", "Dirty MAF sensor", "Weak fuel pump or blocked filter", "Leaking PCV system"],
    r: [
      "Smoke-test the intake with the engine off.",
      "Watch long term fuel trim: a leak shows a large positive trim at idle that shrinks under load.",
      "Check fuel pressure and MAF grams-per-second against specification.",
    ],
  },
  P0401: {
    t: "Exhaust Gas Recirculation Flow Insufficient",
    s: "moderate",
    m: "The ECU opened the EGR valve but did not see the expected drop in intake pressure or rise in intake temperature.",
    c: ["Carbon-blocked EGR passages or cooler", "Stuck EGR valve", "Faulty DPFE or MAP sensor", "Split vacuum line on older systems"],
    r: [
      "Command the EGR valve open with the engine idling and watch for an rpm drop.",
      "Remove and inspect the valve and ports for carbon build-up.",
      "Verify the EGR position feedback tracks the command in live data.",
    ],
  },
  P0299: {
    t: "Turbocharger / Supercharger Underboost",
    s: "serious",
    m: "Actual boost pressure stayed below the ECU's target, so the engine will feel flat and may go into limp mode.",
    c: ["Split or loose boost hose / intercooler pipe", "Sticking variable-vane mechanism or wastegate", "Faulty boost pressure sensor", "Blocked DPF or air filter", "Worn turbo"],
    r: [
      "Compare requested against actual boost in live data during a road test.",
      "Pressure-test the charge pipework for leaks.",
      "Check vane or wastegate actuator travel with the actuator commanded through its range.",
    ],
  },
  P0171: {
    t: "System Too Lean (Bank 1)",
    s: "moderate",
    m: "Long term fuel trim has hit its positive limit — the engine is running lean and the ECU has run out of correction.",
    c: ["Vacuum or intake manifold leak", "Dirty or failing MAF sensor", "Low fuel pressure or clogged injectors", "Leaking PCV or brake booster hose"],
    r: [
      "Smoke-test the intake system.",
      "Read fuel trims at idle, 2000 rpm and under load — a leak improves as load rises, fuel supply problems get worse.",
      "Check fuel pressure under load and clean or test the injectors.",
    ],
  },
  P0172: {
    t: "System Too Rich (Bank 1)",
    s: "moderate",
    m: "Long term fuel trim is strongly negative — the ECU is pulling fuel out to compensate for a rich mixture.",
    c: ["Leaking injector", "High fuel pressure / failed regulator", "Contaminated MAF sensor reading high", "Restricted air filter", "Faulty coolant temperature sensor"],
    r: [
      "Check fuel pressure and look for a soaked fuel pressure regulator vacuum hose.",
      "Compare MAF grams-per-second against the expected value for engine size at idle.",
      "Inspect spark plugs: uniformly sooty plugs confirm a whole-bank rich condition.",
    ],
  },
};


const SYSTEM_BY_LETTER: Record<string, DtcInfo["system"]> = {
  P: "Powertrain",
  B: "Body",
  C: "Chassis",
  U: "Network",
};

const SUBSYSTEM: Record<string, string> = {
  P0: "fuel and air metering, ignition, emissions or auxiliary emission controls",
  P1: "fuel and air metering",
  P2: "fuel and air metering / injector circuit",
  P3: "ignition system, misfire detection or auxiliary controls",
  P4: "auxiliary emission controls",
  P5: "vehicle speed, idle control and auxiliary inputs",
  P6: "computer output circuits and module communication",
  P7: "transmission",
  B0: "body electronics such as restraints, climate and lighting",
  C0: "chassis systems such as ABS, suspension and steering",
  U0: "module-to-module network communication",
};

const GENERIC_REPAIR: Record<DtcInfo["system"], string[]> = {
  Powertrain: [
    "Record freeze frame data before clearing anything — it shows the conditions when the fault stored.",
    "Inspect the wiring, connector and ground for the named circuit; back-probe rather than unplugging.",
    "Compare the suspect live value against a known-good reading at the same engine conditions.",
    "Repair the root cause, clear the code, then drive the readiness cycle and rescan to confirm.",
  ],
  Body: [
    "Operate the affected function while watching live data to see if the request reaches the module.",
    "Check power, ground and connector condition at the component before replacing it.",
    "Flex door, seat and tailgate looms while monitoring — these chafe at hinge points.",
  ],
  Chassis: [
    "Treat brake, steering and stability faults as safety-critical; verify the repair before road use.",
    "Compare all wheel speed or position sensor readings in live data during a slow drive.",
    "Inspect sensor tips, tone rings and connectors for rust, debris and water ingress.",
  ],
  Network: [
    "Run a full deep scan: the silent module usually reports nothing at all.",
    "Check power and ground at the missing module before suspecting the bus wiring.",
    "Measure CAN high to CAN low with the ignition off — roughly 60 ohms is healthy.",
  ],
};

export function lookupDtc(codeRaw: string): DtcInfo {
  const code = codeRaw.toUpperCase().trim();
  const letter = code[0] ?? "P";
  const system = SYSTEM_BY_LETTER[letter] ?? "Powertrain";
  const hit = DB[code];
  if (hit) {
    return {
      code,
      title: hit.t,
      system,
      severity: hit.s,
      meaning: hit.m,
      causes: hit.c,
      repair: hit.r ?? GENERIC_REPAIR[system],
    };
  }
  const fam = familyLookup(code);
  if (fam) {
    return {
      code,
      title: fam.t,
      system,
      severity: fam.s,
      meaning: fam.m,
      causes: fam.c,
      repair: fam.r,
    };
  }
  const group = SUBSYSTEM[code.slice(0, 2)] ?? "a manufacturer-defined subsystem";
  const manufacturerSpecific = code[1] === "1" || code[1] === "3";
  return {
    code,
    title: `${system} fault code ${code}`,
    system,
    severity: "moderate",
    meaning: `${code} is ${
      manufacturerSpecific ? "a manufacturer-specific" : "a generic"
    } ${system.toLowerCase()} code covering ${group}. The exact wording depends on the carmaker, but the controller stored it because a monitored value stayed outside its allowed range.`,
    causes: [
      "Faulty sensor or actuator in the affected circuit",
      "Damaged wiring, connector corrosion or a poor ground",
      "A related mechanical fault the sensor is reporting honestly",
    ],
    repair: GENERIC_REPAIR[system],
  };
}

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  serious: 1,
  moderate: 2,
  minor: 3,
};

export const DTC_DB_SIZE = Object.keys(DB).length;
export const ALL_KNOWN_CODES = Object.keys(DB).sort();
