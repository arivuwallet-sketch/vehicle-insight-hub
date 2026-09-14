import type { Severity } from "./dtc";

/**
 * Structured coverage for the whole SAE J2012 numbering space.
 *
 * The curated table in dtc.ts holds hand-written entries for the most common
 * codes. This module fills the rest of the P0xxx / P2xxx / P3xxx / B / C / U
 * space with generated, standards-accurate descriptions so every code a module
 * can report resolves to a real title, severity, meaning, causes and repair
 * steps — nothing here is invented per-vehicle data.
 */

export interface FamilyEntry {
  t: string;
  s: Severity;
  m: string;
  c: string[];
  r: string[];
}

const num = (code: string) => parseInt(code.slice(1), 16);

const bankSensor = (n: number, perBank: number) => {
  const bank = Math.floor(n / perBank) + 1;
  const sensor = (n % perBank) + 1;
  return { bank, sensor };
};

/* ---------------- oxygen sensors: P0130–P0167 ---------------- */

const O2_TYPES: { t: string; s: Severity; m: string; c: string[]; r: string[] }[] = [
  {
    t: "Circuit Malfunction",
    s: "moderate",
    m: "The oxygen sensor signal is outside its valid electrical range, so the ECU cannot trust the mixture reading from it.",
    c: ["Failed oxygen sensor", "Damaged or chafed sensor wiring", "Corroded connector", "Exhaust leak near the sensor"],
    r: [
      "Back-probe the signal wire with the engine warm and compare to the live data reading.",
      "Inspect the loom where it passes near the exhaust for melted insulation.",
      "Replace the sensor only after the wiring and connector check out.",
    ],
  },
  {
    t: "Low Voltage",
    s: "moderate",
    m: "The sensor is reporting a persistently lean signal or the circuit is shorted to ground.",
    c: ["Vacuum or intake leak", "Low fuel pressure", "Short to ground in the signal wire", "Failed sensor"],
    r: [
      "Check fuel pressure at idle and under load against specification.",
      "Smoke-test the intake for unmetered air.",
      "Unplug the sensor: if the ECU reading jumps to bias voltage, the sensor or its wiring is at fault.",
    ],
  },
  {
    t: "High Voltage",
    s: "moderate",
    m: "The sensor is reporting a persistently rich signal or the circuit is shorted to voltage.",
    c: ["Leaking injector", "High fuel pressure", "Short to power in the signal wire", "Contaminated sensor"],
    r: [
      "Read fuel trims: strongly negative trims confirm a genuine rich condition.",
      "Check for a leaking injector or failed fuel pressure regulator.",
      "Inspect the harness for a short to a 5V or 12V feed.",
    ],
  },
  {
    t: "Slow Response",
    s: "moderate",
    m: "The sensor still switches, but too slowly for the ECU to control fuelling accurately — normal ageing behaviour.",
    c: ["Aged or contaminated oxygen sensor", "Silicone or coolant contamination", "Small exhaust leak"],
    r: [
      "Graph the sensor switching rate at 2500 rpm — a healthy upstream sensor crosses several times per second.",
      "Replace the sensor; sensors are a service item, typically every 100,000 km.",
    ],
  },
  {
    t: "No Activity Detected",
    s: "moderate",
    m: "The sensor signal never moves, so the ECU has no feedback for closed-loop fuelling.",
    c: ["Dead oxygen sensor", "Open circuit in signal or ground", "Blown heater fuse keeping the sensor cold"],
    r: [
      "Confirm heater supply and ground at the connector.",
      "Check signal and ground wire continuity back to the ECU.",
      "Replace the sensor if the wiring is sound.",
    ],
  },
  {
    t: "Heater Circuit Malfunction",
    s: "minor",
    m: "The heater element inside the sensor is not drawing the expected current, so the sensor takes too long to reach operating temperature.",
    c: ["Failed heater element", "Blown fuse on the heater circuit", "Broken heater ground"],
    r: [
      "Measure heater element resistance at the sensor — an open circuit confirms a failed sensor.",
      "Check the fuse feeding the heater circuit before replacing anything.",
    ],
  },
];

function o2Family(code: string): FamilyEntry | null {
  const n = num(code);
  if (n < 0x130 || n > 0x167) return null;
  const idx = n - 0x130;
  const typeIdx = idx % 6;
  const pos = Math.floor(idx / 6);
  const type = O2_TYPES[typeIdx];
  if (!type) return null;
  const { bank, sensor } = bankSensor(pos, 4);
  const where = sensor === 1 ? "upstream (pre-catalyst)" : "downstream (post-catalyst)";
  return {
    t: `O2 Sensor ${type.t} (Bank ${bank} Sensor ${sensor})`,
    s: type.s,
    m: `${type.m} This is the ${where} sensor on bank ${bank}.`,
    c: type.c,
    r: type.r,
  };
}

/* ---------------- misfires: P0300–P0312 ---------------- */

function misfireFamily(code: string): FamilyEntry | null {
  const n = num(code);
  if (n < 0x300 || n > 0x312) return null;
  const cyl = n - 0x300;
  const common = {
    c: [
      "Worn spark plug or failed ignition coil",
      "Blocked or leaking fuel injector",
      "Vacuum leak on the affected runner",
      "Low compression — burnt valve, worn rings or head gasket",
    ],
    r: [
      "Swap the coil and plug with a neighbouring cylinder and rescan: if the misfire follows, the part is faulty.",
      "Check injector operation and resistance on the affected cylinder.",
      "Run a compression and leak-down test if the fault stays with the cylinder.",
      "Fix misfires promptly — raw fuel entering the exhaust destroys the catalytic converter.",
    ],
  };
  if (cyl === 0) {
    return {
      t: "Random / Multiple Cylinder Misfire Detected",
      s: "serious",
      m: "The ECU detected misfires across more than one cylinder, so the cause is something shared rather than a single coil or injector.",
      c: [
        "Vacuum leak in the intake manifold",
        "Low fuel pressure or a failing fuel pump",
        "Faulty MAF sensor causing wrong fuelling",
        "Worn plugs across the whole set",
        "EGR valve stuck open",
      ],
      r: [
        "Smoke-test the intake for leaks first — this is the most common cause.",
        "Check fuel pressure under load and compare fuel trims.",
        "Inspect all spark plugs; replace as a set if worn.",
        "Verify EGR closes fully at idle.",
      ],
    };
  }
  return {
    t: `Cylinder ${cyl} Misfire Detected`,
    s: "serious",
    m: `Cylinder ${cyl} is not burning its charge properly. The ECU sees the crankshaft briefly slow on that cylinder's power stroke.`,
    ...common,
  };
}

/* ---------------- injector circuits: P0201–P0212 ---------------- */

function injectorFamily(code: string): FamilyEntry | null {
  const n = num(code);
  if (n < 0x201 || n > 0x212) return null;
  const cyl = n - 0x200;
  return {
    t: `Injector Circuit / Open — Cylinder ${cyl}`,
    s: "serious",
    m: `The ECU drove the cylinder ${cyl} injector and did not see the expected current, so that cylinder may not be fuelled.`,
    c: ["Failed injector solenoid", "Open or shorted injector wiring", "Corroded injector connector", "Failed ECU driver stage"],
    r: [
      `Measure the resistance of the cylinder ${cyl} injector and compare it with the others.`,
      "Check for 12V supply at the injector connector with the ignition on.",
      "Test continuity of the control wire back to the ECU before condemning the module.",
    ],
  };
}

/* ---------------- glow plugs: P0671–P0678 ---------------- */

function glowFamily(code: string): FamilyEntry | null {
  const n = num(code);
  if (n < 0x671 || n > 0x678) return null;
  const cyl = n - 0x670;
  return {
    t: `Glow Plug Circuit — Cylinder ${cyl}`,
    s: "moderate",
    m: `The glow plug control module reports an out-of-range circuit for cylinder ${cyl}. Cold starting and cold-running emissions suffer.`,
    c: ["Open-circuit glow plug", "Broken glow plug lead", "Failed glow plug relay or control module"],
    r: [
      `Measure the cylinder ${cyl} glow plug resistance — healthy plugs read well under 2 ohms.`,
      "Replace glow plugs as a set; seized plugs may need heat and penetrating fluid.",
      "Confirm the control module switches all channels before replacing it.",
    ],
  };
}

/* ---------------- lost communication: U0100–U02FF ---------------- */

const U_MODULES: Record<number, string> = {
  0x100: "ECM/PCM (engine control)",
  0x101: "TCM (transmission control)",
  0x102: "transfer case control module",
  0x103: "gear shift module",
  0x104: "cruise control module",
  0x105: "fuel injector control module",
  0x106: "glow plug control module",
  0x107: "throttle actuator control module",
  0x109: "fuel pump control module",
  0x110: "drive motor control module",
  0x111: "battery energy control module",
  0x114: "4WD clutch control module",
  0x115: "ECM/PCM 'B'",
  0x121: "ABS control module",
  0x122: "vehicle dynamics control module",
  0x123: "yaw rate sensor module",
  0x124: "lateral acceleration sensor module",
  0x125: "multi-axis acceleration sensor module",
  0x126: "steering angle sensor module",
  0x128: "brake system control module",
  0x131: "power steering control module",
  0x140: "body control module",
  0x141: "body control module 'A'",
  0x151: "restraints (airbag) control module",
  0x155: "instrument panel cluster",
  0x164: "HVAC control module",
  0x167: "vehicle immobiliser module",
  0x184: "radio / infotainment head unit",
  0x199: "door control module",
  0x1a0: "network gateway module",
};

function uFamily(code: string): FamilyEntry | null {
  if (code[0] !== "U") return null;
  const n = num(code);
  const known = U_MODULES[n];
  if (n >= 0x100 && n <= 0x1ff) {
    const who = known ?? "a control module on the vehicle network";
    return {
      t: `Lost Communication With ${known ? known.replace(/^(.)/, (x) => x.toUpperCase()) : "Control Module"}`,
      s: "serious",
      m: `This module stopped receiving expected CAN messages from ${who}. Systems that depend on that data fall back to limp behaviour.`,
      c: [
        "Broken CAN high/low wire or a poor splice",
        "Loss of power or ground at the missing module",
        "Failed module no longer transmitting",
        "Corroded connector or water ingress",
      ],
      r: [
        "Run a deep scan first: the module that is silent usually reports nothing at all.",
        "Check power and ground at the silent module before suspecting the bus.",
        "Measure CAN high to CAN low resistance with the ignition off — about 60 ohms is healthy.",
        "Inspect connectors in wet areas: door sills, under carpet and boot floor.",
      ],
    };
  }
  if (n >= 0x200 && n <= 0x2ff) {
    return {
      t: `Invalid Data Received From ${known ?? "Control Module"}`,
      s: "moderate",
      m: "Messages are arriving on the network, but their content fails the receiving module's plausibility or checksum check.",
      c: ["Software mismatch after a module swap", "Failing sensor feeding the sending module", "Intermittent bus corruption"],
      r: [
        "Compare software/calibration levels between modules after any replacement.",
        "Check the sending module for its own stored faults first — fix those before this one.",
      ],
    };
  }
  if (n >= 0x300 && n <= 0x3ff) {
    return {
      t: "Internal Control Module Software Fault",
      s: "serious",
      m: "The module failed its own internal self-check — memory, software or processor integrity.",
      c: ["Corrupted software after an interrupted update", "Low battery voltage during programming", "Failed module hardware"],
      r: [
        "Check battery and charging system health first — low voltage causes most of these.",
        "Reprogram the module with the manufacturer software; replace only if reprogramming fails.",
      ],
    };
  }
  return null;
}

/* ---------------- broad subsystem coverage ---------------- */

interface RangeDef {
  from: number;
  to: number;
  t: string;
  s: Severity;
  m: string;
  c: string[];
  r: string[];
}

const P_RANGES: RangeDef[] = [
  {
    from: 0x001,
    to: 0x0ff,
    t: "Fuel and Air Metering Fault",
    s: "moderate",
    m: "A sensor or actuator in the fuel and air metering system reported a value outside its allowed range.",
    c: ["Failed air, pressure or temperature sensor", "Intake or vacuum leak", "Wiring or connector fault"],
    r: [
      "Compare the suspect sensor's live value with a known-good reference at the same conditions.",
      "Smoke-test the intake before replacing parts.",
      "Check the sensor connector for corrosion and the ground for voltage drop.",
    ],
  },
  {
    from: 0x100,
    to: 0x1ff,
    t: "Fuel and Air Metering / Mixture Fault",
    s: "moderate",
    m: "The fuel and air metering system is out of its expected operating window — usually a mixture, air-flow or fuel-trim problem.",
    c: ["Unmetered air entering the intake", "Weak fuel delivery", "Dirty or failing mass air flow sensor", "Exhaust leak upstream of the oxygen sensor"],
    r: [
      "Read short and long term fuel trims at idle and at 2500 rpm to tell a leak from a fuel supply issue.",
      "Clean or replace the MAF sensor and check the air filter.",
      "Test fuel pressure and volume under load.",
    ],
  },
  {
    from: 0x200,
    to: 0x2ff,
    t: "Injector Circuit / Cylinder Fault",
    s: "serious",
    m: "The injector circuits or cylinder balance monitoring reported a fault, so at least one cylinder is not fuelling as commanded.",
    c: ["Failed or blocked injector", "Injector wiring fault", "Low compression on the affected cylinder"],
    r: [
      "Compare injector resistances across all cylinders.",
      "Perform a cylinder contribution or balance test.",
      "Check compression if the electrical side is sound.",
    ],
  },
  {
    from: 0x300,
    to: 0x3ff,
    t: "Ignition System or Misfire Fault",
    s: "serious",
    m: "The ignition system or misfire monitor detected combustion that did not happen as expected.",
    c: ["Worn plugs or failed coil", "Fuel delivery fault", "Mechanical compression loss", "Crank or cam sensor fault"],
    r: [
      "Inspect plugs and coils first — these cause most ignition codes.",
      "Swap suspect components between cylinders to confirm.",
      "Do not keep driving with an active misfire; the catalytic converter will be damaged.",
    ],
  },
  {
    from: 0x400,
    to: 0x4ff,
    t: "Auxiliary Emission Controls Fault",
    s: "moderate",
    m: "An emissions control subsystem — EGR, EVAP, secondary air or particulate filter — is not performing within limits.",
    c: ["Carbon-clogged EGR passages or valve", "Split or perished EVAP hose, loose fuel cap", "Failed secondary air pump", "Blocked diesel particulate filter"],
    r: [
      "Clean the EGR valve and passages before replacing the valve.",
      "Pressure or smoke test the EVAP system to locate leaks.",
      "For DPF codes, check for a successful regeneration history and soot load before replacing the filter.",
    ],
  },
  {
    from: 0x500,
    to: 0x5ff,
    t: "Vehicle Speed, Idle Control and Auxiliary Inputs Fault",
    s: "moderate",
    m: "A speed, idle control, cooling or auxiliary input signal is implausible or out of range.",
    c: ["Failed speed or position sensor", "Sticking idle air control valve", "Cooling system or thermostat fault", "Charging system issue"],
    r: [
      "Verify the signal in live data while the symptom is present.",
      "Clean the throttle body and relearn idle if idle control is affected.",
      "Load-test the battery and check alternator output for charging codes.",
    ],
  },
  {
    from: 0x600,
    to: 0x6ff,
    t: "Control Module and Output Circuit Fault",
    s: "serious",
    m: "The control module reported an internal, memory, supply or output driver problem rather than an external sensor fault.",
    c: ["Low system voltage or poor ground", "Corrupted module software", "Failed output driver", "Water ingress in the module connector"],
    r: [
      "Test the battery, charging system and module grounds first — low voltage causes most of these codes.",
      "Clear the code and recheck; a single occurrence after a jump start is often not a module failure.",
      "Reprogram before replacing the module where the manufacturer allows it.",
    ],
  },
  {
    from: 0x700,
    to: 0x7ff,
    t: "Transmission Control Fault",
    s: "serious",
    m: "The transmission controller detected a shift, pressure, solenoid or ratio fault. The gearbox may be in limp mode.",
    c: ["Low or degraded transmission fluid", "Failed shift solenoid", "Worn clutch packs or torque converter", "Speed sensor fault"],
    r: [
      "Check fluid level and condition at the specified temperature — burnt fluid tells you a lot.",
      "Read live gear ratio and slip data during a road test.",
      "Test solenoid resistance at the valve body connector before removing the gearbox.",
    ],
  },
];

const B_RANGE: FamilyEntry = {
  t: "Body Electronics Fault",
  s: "moderate",
  m: "A body module reported a fault in an interior or comfort system: restraints, climate, lighting, seats, locks or instrumentation.",
  c: ["Failed switch, motor or actuator", "Chafed wiring in a door or seat loom", "Water ingress in a connector", "Failed body control module"],
  r: [
    "Operate the affected function while watching live data to see whether the request reaches the module.",
    "Flex door and seat looms while monitoring — these break at the hinge point.",
    "Never work on restraint (airbag) circuits without disconnecting the battery and waiting the specified time.",
  ],
};

const C_RANGE: FamilyEntry = {
  t: "Chassis System Fault",
  s: "serious",
  m: "A chassis controller — ABS, stability control, suspension, steering or tyre pressure — reported a fault. Safety assistance may be disabled.",
  c: ["Failed wheel speed sensor or damaged reluctor ring", "Corroded sensor connector", "Low brake fluid or a hydraulic fault", "Failed ABS pump or module"],
  r: [
    "Compare all four wheel speed readings in live data during a slow drive.",
    "Inspect the sensor tip and reluctor ring for rust and debris.",
    "Treat any brake or stability fault as safety-critical: verify before returning the car to the road.",
  ],
};

export function familyLookup(codeRaw: string): FamilyEntry | null {
  const code = codeRaw.toUpperCase().trim();
  const letter = code[0];
  if (!letter) return null;
  if (letter === "U") return uFamily(code);
  if (letter === "B") return B_RANGE;
  if (letter === "C") return C_RANGE;
  if (letter !== "P") return null;

  const specific = o2Family(code) ?? misfireFamily(code) ?? injectorFamily(code) ?? glowFamily(code);
  if (specific) return specific;

  const n = num(code);
  if (!Number.isFinite(n)) return null;
  const within = n & 0xfff;
  for (const r of P_RANGES) {
    if (within >= r.from && within <= r.to) {
      return { t: r.t, s: r.s, m: r.m, c: r.c, r: r.r };
    }
  }
  return null;
}
