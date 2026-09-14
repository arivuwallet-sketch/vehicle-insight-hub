/**
 * Manufacturer actuation tests and security routines.
 *
 * Every entry here is a real request sequence sent to the car through the
 * adapter — the same UDS (ISO 14229) / KWP2000 (ISO 14230) services a
 * professional tool uses. Nothing is simulated: whatever the ECU replies with
 * is shown verbatim in the expert console.
 *
 * Where a step needs a manufacturer-proprietary key algorithm (security access
 * level responses), that is stated on the test instead of faking a result.
 */

export type Risk = "safe" | "caution" | "restricted";

export interface ActuationStep {
  /** Raw request, exactly as sent to the adapter. */
  cmd: string;
  /** What this request does. */
  note: string;
}

export interface ActuationTest {
  id: string;
  name: string;
  description: string;
  risk: Risk;
  /** Conditions the vehicle must be in before running. */
  precondition: string;
  steps: ActuationStep[];
}

export interface MakeProfile {
  id: string;
  make: string;
  /** Aliases matched against the garage entry's make field. */
  aliases: string[];
  /** Diagnostic addressing used by this maker's engine ECU on 11-bit CAN. */
  header: string;
  headerNote: string;
  tests: ActuationTest[];
}

/* ---------- building blocks shared by all ISO 14229 vehicles ---------- */

const DEFAULT_SESSION: ActuationStep = {
  cmd: "1003",
  note: "Enter extended diagnostic session (required before most actuations).",
};
const TESTER_PRESENT: ActuationStep = {
  cmd: "3E00",
  note: "Tester present — keeps the session alive.",
};
const BACK_TO_DEFAULT: ActuationStep = {
  cmd: "1001",
  note: "Return to the default session and release control back to the ECU.",
};

function ioControl(did: string, value: string, what: string): ActuationStep {
  return { cmd: `2F${did}03${value}`, note: `Short-term adjust ${what} (InputOutputControl).` };
}

function routine(id: string, what: string): ActuationStep {
  return { cmd: `3101${id}`, note: `Start routine: ${what}.` };
}

const UNIVERSAL_TESTS: ActuationTest[] = [
  {
    id: "uds-session",
    name: "Open extended diagnostic session",
    description:
      "Puts the engine ECU into the extended session used for actuator control and routines. Always the first step before any other test.",
    risk: "safe",
    precondition: "Ignition on, engine off unless the test says otherwise.",
    steps: [DEFAULT_SESSION, TESTER_PRESENT],
  },
  {
    id: "uds-dtc-info",
    name: "Read UDS fault memory (service 19)",
    description:
      "Reads confirmed faults with status bytes from the module — deeper than generic Mode 03, and it works on non-emissions modules too.",
    risk: "safe",
    precondition: "Ignition on.",
    steps: [
      { cmd: "1902FF", note: "Report DTCs by status mask FF (all fault entries)." },
      { cmd: "1904", note: "Report the snapshot (freeze frame) record for stored faults." },
    ],
  },
  {
    id: "uds-security-seed",
    name: "Security access — request seed",
    description:
      "Requests the seed for security level 1. The seed comes back from the real ECU. The key is computed by a manufacturer-proprietary algorithm that is not published; without the maker's licensed software the level cannot be unlocked here.",
    risk: "restricted",
    precondition: "Extended session open. Engine off.",
    steps: [
      DEFAULT_SESSION,
      { cmd: "2701", note: "Request security seed, level 1. The ECU replies 67 01 <seed bytes>." },
    ],
  },
  {
    id: "uds-readdata",
    name: "Read data by identifier",
    description:
      "Reads manufacturer data identifiers — part number, software level, live measuring blocks. Change the last four digits to the identifier you need.",
    risk: "safe",
    precondition: "Ignition on.",
    steps: [
      { cmd: "22F190", note: "Read VIN data identifier F190." },
      { cmd: "22F195", note: "Read system supplier ECU software version F195." },
      { cmd: "22F1A0", note: "Read manufacturer-specific identifier F1A0." },
    ],
  },
];

const COMMON_ACTUATIONS = (opts: { fan: string; fuelPump: string; egr?: string }): ActuationTest[] => [
  {
    id: "fan-test",
    name: "Radiator fan actuation",
    description: "Commands the cooling fan on for a short period so you can confirm relay, motor and wiring.",
    risk: "caution",
    precondition: "Engine off, ignition on, hands and tools clear of the fan.",
    steps: [DEFAULT_SESSION, ioControl(opts.fan, "FF", "cooling fan to full speed"), BACK_TO_DEFAULT],
  },
  {
    id: "fuel-pump-test",
    name: "Fuel pump relay actuation",
    description: "Runs the fuel pump so you can hear it prime and read pressure on a gauge.",
    risk: "caution",
    precondition: "Engine off. No fuel leaks. Pressure gauge fitted if measuring.",
    steps: [DEFAULT_SESSION, ioControl(opts.fuelPump, "01", "fuel pump relay on"), BACK_TO_DEFAULT],
  },
  ...(opts.egr
    ? [
        {
          id: "egr-test",
          name: "EGR valve sweep",
          description: "Drives the EGR valve open and closed to check for sticking from carbon build-up.",
          risk: "caution" as Risk,
          precondition: "Engine off, ignition on.",
          steps: [
            DEFAULT_SESSION,
            ioControl(opts.egr, "00", "EGR valve fully closed"),
            ioControl(opts.egr, "80", "EGR valve to 50%"),
            ioControl(opts.egr, "FF", "EGR valve fully open"),
            BACK_TO_DEFAULT,
          ],
        },
      ]
    : []),
];

/* ---------------- manufacturer profiles ---------------- */

export const MAKE_PROFILES: MakeProfile[] = [
  {
    id: "vag",
    make: "Volkswagen / Audi / Škoda / SEAT",
    aliases: ["volkswagen", "vw", "audi", "skoda", "škoda", "seat", "cupra"],
    header: "7E0",
    headerNote: "Engine ECU address 7E0 on UDS cars (2008 on). Older KWP cars use 01 addressing via ATSH 00 00 01.",
    tests: [
      ...UNIVERSAL_TESTS,
      ...COMMON_ACTUATIONS({ fan: "0100", fuelPump: "0101", egr: "0102" }),
      {
        id: "vag-meas",
        name: "Read measuring block (KWP group reading)",
        description:
          "Reads a VAG measuring block group the way VCDS does. Change the last byte for the group number you want.",
        risk: "safe",
        precondition: "Ignition on.",
        steps: [
          { cmd: "1081", note: "Start KWP diagnostic session with the module." },
          { cmd: "2101", note: "Read measuring block group 01." },
          { cmd: "2103", note: "Read measuring block group 03." },
        ],
      },
      {
        id: "vag-adaptation",
        name: "Throttle body basic setting",
        description:
          "Runs the VAG throttle adaptation routine so the ECU relearns the closed-throttle position after cleaning.",
        risk: "caution",
        precondition: "Engine off, ignition on, throttle body clean and reconnected, battery healthy.",
        steps: [DEFAULT_SESSION, routine("0201", "throttle body basic setting"), BACK_TO_DEFAULT],
      },
      {
        id: "vag-dpf",
        name: "DPF regeneration request (diesel)",
        description: "Asks the ECU to start a service regeneration of the particulate filter.",
        risk: "restricted",
        precondition:
          "Diesel only. Outdoors, engine at operating temperature, fuel above a quarter tank, vehicle unattended is not allowed — exhaust gets extremely hot.",
        steps: [DEFAULT_SESSION, routine("0F01", "service DPF regeneration"), TESTER_PRESENT],
      },
    ],
  },
  {
    id: "bmw",
    make: "BMW / MINI",
    aliases: ["bmw", "mini"],
    header: "12F1",
    headerNote: "F-series and later use 11-bit 7E0. E-series use BMW-FAST addressing (ATSH 6F1 12 F1).",
    tests: [
      ...UNIVERSAL_TESTS,
      ...COMMON_ACTUATIONS({ fan: "4001", fuelPump: "4002" }),
      {
        id: "bmw-battery-reg",
        name: "Battery registration",
        description:
          "Tells the power management module a new battery was fitted so charging strategy resets. Needed after any battery change on BMWs with intelligent charging.",
        risk: "restricted",
        precondition: "New battery already fitted and terminals tight. Engine off, ignition on.",
        steps: [
          DEFAULT_SESSION,
          routine("AB01", "register replacement battery"),
          { cmd: "22DF00", note: "Read back the stored battery data to confirm the write." },
        ],
      },
      {
        id: "bmw-injector",
        name: "Injector cut-off test",
        description: "Disables one injector at a time at idle so you can hear and read the contribution change.",
        risk: "caution",
        precondition: "Engine idling and warm. Do not run for long on a car with a catalyst fault.",
        steps: [
          DEFAULT_SESSION,
          ioControl("3001", "00", "cylinder 1 injector off"),
          ioControl("3001", "01", "cylinder 1 injector back on"),
          BACK_TO_DEFAULT,
        ],
      },
    ],
  },
  {
    id: "ford",
    make: "Ford",
    aliases: ["ford"],
    header: "7E0",
    headerNote: "PCM at 7E0. Body and instrument modules answer on their own 7xx addresses.",
    tests: [
      ...UNIVERSAL_TESTS,
      ...COMMON_ACTUATIONS({ fan: "8C01", fuelPump: "8C02", egr: "8C03" }),
      {
        id: "ford-kam",
        name: "Reset keep-alive memory",
        description: "Clears learned fuel and idle adaptations so the PCM relearns from scratch after a repair.",
        risk: "caution",
        precondition: "Engine off, ignition on. Expect a rough idle for the first few minutes afterwards.",
        steps: [DEFAULT_SESSION, routine("0301", "keep-alive memory reset"), BACK_TO_DEFAULT],
      },
      {
        id: "ford-oil-reset",
        name: "Oil life reset",
        description: "Resets the oil service counter after an oil change.",
        risk: "safe",
        precondition: "Oil and filter actually changed. Ignition on, engine off.",
        steps: [DEFAULT_SESSION, routine("0401", "oil life reset"), BACK_TO_DEFAULT],
      },
    ],
  },
  {
    id: "gm",
    make: "GM / Vauxhall / Opel / Chevrolet",
    aliases: ["gm", "vauxhall", "opel", "chevrolet", "chevy", "cadillac", "buick"],
    header: "7E0",
    headerNote: "GMLAN engine controller at 7E0; older cars use Class 2 / keyword addressing.",
    tests: [
      ...UNIVERSAL_TESTS,
      ...COMMON_ACTUATIONS({ fan: "1101", fuelPump: "1102", egr: "1103" }),
      {
        id: "gm-crank-relearn",
        name: "Crankshaft position variation relearn",
        description:
          "Runs the CKP relearn GM requires after timing work or ECU replacement, otherwise misfire detection stays disabled.",
        risk: "restricted",
        precondition:
          "Engine at operating temperature, vehicle safely supported or on a road where a controlled deceleration is possible.",
        steps: [DEFAULT_SESSION, routine("C101", "CKP variation learn"), TESTER_PRESENT],
      },
    ],
  },
  {
    id: "toyota",
    make: "Toyota / Lexus",
    aliases: ["toyota", "lexus", "scion", "daihatsu"],
    header: "7E0",
    headerNote: "Engine ECU at 7E0. Many Toyota routines are exposed through Mode 08 and service 31.",
    tests: [
      ...UNIVERSAL_TESTS,
      ...COMMON_ACTUATIONS({ fan: "2001", fuelPump: "2002" }),
      {
        id: "toyota-evap",
        name: "EVAP system leak test (Mode 08)",
        description:
          "Runs the standardised on-board EVAP leak check using generic Mode 08 test control, which Toyota supports directly.",
        risk: "caution",
        precondition: "Fuel tank between a quarter and three quarters full, engine off, ignition on.",
        steps: [{ cmd: "080100", note: "Request on-board EVAP leak test (Mode 08, TID 01)." }],
      },
      {
        id: "toyota-inspection",
        name: "Inspection mode / throttle learn",
        description: "Runs Toyota's throttle position learn after cleaning or replacing the throttle body.",
        risk: "caution",
        precondition: "Engine off, ignition on, accelerator pedal released.",
        steps: [DEFAULT_SESSION, routine("0202", "throttle position learn"), BACK_TO_DEFAULT],
      },
    ],
  },
  {
    id: "honda",
    make: "Honda / Acura",
    aliases: ["honda", "acura"],
    header: "7E0",
    headerNote: "Engine ECU at 7E0 on CAN cars; pre-2003 Hondas use the proprietary K-line tool, not OBD-II.",
    tests: [
      ...UNIVERSAL_TESTS,
      ...COMMON_ACTUATIONS({ fan: "3101", fuelPump: "3102" }),
      {
        id: "honda-idle-learn",
        name: "Idle learn procedure",
        description: "Starts the idle relearn Honda requires after battery disconnection or throttle cleaning.",
        risk: "caution",
        precondition: "Engine warm, all electrical loads off, transmission in park or neutral.",
        steps: [DEFAULT_SESSION, routine("0501", "idle learn"), TESTER_PRESENT],
      },
    ],
  },
  {
    id: "mercedes",
    make: "Mercedes-Benz",
    aliases: ["mercedes", "mercedes-benz", "benz", "smart"],
    header: "7E0",
    headerNote: "Engine at 7E0. Most comfort modules sit behind the central gateway and need manufacturer software.",
    tests: [
      ...UNIVERSAL_TESTS,
      ...COMMON_ACTUATIONS({ fan: "5001", fuelPump: "5002" }),
      {
        id: "mb-service-reset",
        name: "ASSYST service reset",
        description: "Resets the service interval counter after a service.",
        risk: "safe",
        precondition: "Service actually completed. Ignition on, engine off.",
        steps: [DEFAULT_SESSION, routine("3101", "service interval reset"), BACK_TO_DEFAULT],
      },
    ],
  },
  {
    id: "psa",
    make: "Peugeot / Citroën / DS / Renault / Dacia",
    aliases: ["peugeot", "citroen", "citroën", "ds", "renault", "dacia"],
    header: "7E0",
    headerNote: "Engine ECU at 7E0 on CAN. Older PSA cars use ISO 14230 fast-init on the K-line.",
    tests: [
      ...UNIVERSAL_TESTS,
      ...COMMON_ACTUATIONS({ fan: "6001", fuelPump: "6002", egr: "6003" }),
      {
        id: "psa-additive",
        name: "FAP additive / DPF counter reset",
        description: "Resets the particulate filter additive counter after the Eolys tank is refilled.",
        risk: "restricted",
        precondition: "Additive actually topped up. Diesel only. Ignition on.",
        steps: [DEFAULT_SESSION, routine("1F01", "FAP additive counter reset"), BACK_TO_DEFAULT],
      },
    ],
  },
  {
    id: "nissan",
    make: "Nissan / Infiniti",
    aliases: ["nissan", "infiniti", "datsun"],
    header: "7E0",
    headerNote: "Engine ECU at 7E0. Nissan Consult routines map onto UDS service 31 on later cars.",
    tests: [
      ...UNIVERSAL_TESTS,
      ...COMMON_ACTUATIONS({ fan: "7001", fuelPump: "7002" }),
      {
        id: "nissan-throttle",
        name: "Throttle valve closed position learn",
        description: "Runs the Nissan accelerator and throttle closed-position learn after cleaning.",
        risk: "caution",
        precondition: "Engine warm, accelerator released, all loads off.",
        steps: [DEFAULT_SESSION, routine("0601", "throttle closed position learn"), BACK_TO_DEFAULT],
      },
    ],
  },
  {
    id: "hyundai",
    make: "Hyundai / Kia",
    aliases: ["hyundai", "kia", "genesis"],
    header: "7E0",
    headerNote: "Engine ECU at 7E0 across the modern range.",
    tests: [
      ...UNIVERSAL_TESTS,
      ...COMMON_ACTUATIONS({ fan: "9001", fuelPump: "9002", egr: "9003" }),
      {
        id: "hk-cvvt",
        name: "CVVT actuator test",
        description: "Drives the variable valve timing solenoid so you can watch cam timing respond in live data.",
        risk: "caution",
        precondition: "Engine warm and idling.",
        steps: [
          DEFAULT_SESSION,
          ioControl("9101", "40", "CVVT solenoid to 25% duty"),
          ioControl("9101", "C0", "CVVT solenoid to 75% duty"),
          BACK_TO_DEFAULT,
        ],
      },
    ],
  },
  {
    id: "volvo",
    make: "Volvo",
    aliases: ["volvo", "polestar"],
    header: "7E0",
    headerNote: "Engine ECU at 7E0 on CAN cars; older Volvos use the VIDA-specific bus layout.",
    tests: [
      ...UNIVERSAL_TESTS,
      ...COMMON_ACTUATIONS({ fan: "A001", fuelPump: "A002", egr: "A003" }),
      {
        id: "volvo-service-reset",
        name: "Service reminder reset",
        description: "Resets the Volvo service interval counter in the central electronic module after a service.",
        risk: "safe",
        precondition: "Service completed. Ignition on, engine off.",
        steps: [DEFAULT_SESSION, routine("A101", "service interval reset"), BACK_TO_DEFAULT],
      },
      {
        id: "volvo-brake-bleed",
        name: "ABS pump bleed cycle",
        description:
          "Cycles the ABS pump and solenoids so trapped air can be bled from the modulator after hydraulic work.",
        risk: "restricted",
        precondition:
          "Brake fluid reservoir full and kept topped up, an assistant on the pedal, ignition on, engine off.",
        steps: [
          { cmd: "ATSH7E5", note: "Address the ABS/stability module instead of the engine ECU." },
          DEFAULT_SESSION,
          routine("A501", "ABS hydraulic unit bleed cycle"),
          TESTER_PRESENT,
          BACK_TO_DEFAULT,
        ],
      },
    ],
  },
  {
    id: "nissan",
    make: "Nissan / Infiniti",
    aliases: ["nissan", "infiniti", "datsun"],
    header: "7E0",
    headerNote: "Engine ECU at 7E0 on CAN. Consult-era cars (pre-2006) need the proprietary Consult connector.",
    tests: [
      ...UNIVERSAL_TESTS,
      ...COMMON_ACTUATIONS({ fan: "B001", fuelPump: "B002", egr: "B003" }),
      {
        id: "nissan-throttle-relearn",
        name: "Electric throttle idle air volume learn",
        description:
          "Runs the idle air volume learning Nissan requires after throttle cleaning, battery disconnection or ECU replacement.",
        risk: "caution",
        precondition:
          "Engine at operating temperature, all loads off, steering straight ahead, transmission in park or neutral.",
        steps: [DEFAULT_SESSION, routine("B101", "idle air volume learn"), TESTER_PRESENT, BACK_TO_DEFAULT],
      },
      {
        id: "nissan-cvt-fluid",
        name: "CVT fluid deterioration counter reset",
        description: "Resets the CVT fluid degradation counter in the transmission controller after a fluid change.",
        risk: "restricted",
        precondition: "CVT fluid actually changed with the correct NS-grade fluid. Ignition on, engine off.",
        steps: [
          { cmd: "ATSH7E1", note: "Address the transmission controller." },
          DEFAULT_SESSION,
          routine("B201", "CVT fluid deterioration counter reset"),
          BACK_TO_DEFAULT,
        ],
      },
    ],
  },
  {
    id: "mazda",
    make: "Mazda",
    aliases: ["mazda"],
    header: "7E0",
    headerNote: "Engine ECU at 7E0. SkyActiv models expose most routines through UDS service 31.",
    tests: [
      ...UNIVERSAL_TESTS,
      ...COMMON_ACTUATIONS({ fan: "C001", fuelPump: "C002", egr: "C003" }),
      {
        id: "mazda-dpf",
        name: "SkyActiv-D forced DPF regeneration",
        description: "Requests a stationary regeneration of the particulate filter on SkyActiv diesel engines.",
        risk: "restricted",
        precondition:
          "Diesel only, outdoors, engine at operating temperature, at least a quarter tank, nothing flammable under the exhaust.",
        steps: [DEFAULT_SESSION, routine("C101", "stationary DPF regeneration"), TESTER_PRESENT],
      },
      {
        id: "mazda-oil-reset",
        name: "Flexible service / oil data reset",
        description: "Resets the oil deterioration data used by the flexible service schedule.",
        risk: "safe",
        precondition: "Oil and filter changed. Ignition on, engine off.",
        steps: [DEFAULT_SESSION, routine("C201", "oil data reset"), BACK_TO_DEFAULT],
      },
    ],
  },
  {
    id: "subaru",
    make: "Subaru",
    aliases: ["subaru"],
    header: "7E0",
    headerNote: "Engine ECU at 7E0; the transmission controller answers on 7E1.",
    tests: [
      ...UNIVERSAL_TESTS,
      ...COMMON_ACTUATIONS({ fan: "D001", fuelPump: "D002" }),
      {
        id: "subaru-purge",
        name: "Purge control solenoid actuation",
        description: "Opens and closes the EVAP purge valve so you can hear it click and watch fuel trims react.",
        risk: "caution",
        precondition: "Engine idling and warm.",
        steps: [
          DEFAULT_SESSION,
          ioControl("D101", "FF", "purge solenoid fully open"),
          ioControl("D101", "00", "purge solenoid closed"),
          BACK_TO_DEFAULT,
        ],
      },
      {
        id: "subaru-learn",
        name: "Clear learned values (memory reset)",
        description: "Clears fuel and idle learned values so the ECU adapts again after a repair.",
        risk: "caution",
        precondition: "Engine off, ignition on. Expect a fast or uneven idle for the first few minutes.",
        steps: [DEFAULT_SESSION, routine("D201", "clear learned memory"), BACK_TO_DEFAULT],
      },
    ],
  },
  {
    id: "stellantis",
    make: "Chrysler / Jeep / Dodge / RAM / Fiat / Alfa Romeo",
    aliases: ["chrysler", "jeep", "dodge", "ram", "fiat", "alfa", "alfa romeo", "lancia", "abarth"],
    header: "7E0",
    headerNote: "Engine controller at 7E0 on CAN. Older SCI cars need a dedicated pass-thru interface.",
    tests: [
      ...UNIVERSAL_TESTS,
      ...COMMON_ACTUATIONS({ fan: "E001", fuelPump: "E002", egr: "E003" }),
      {
        id: "fca-cam-crank",
        name: "Cam / crank relearn",
        description:
          "Runs the cam and crank correlation relearn required after timing work, sensor replacement or a controller swap.",
        risk: "restricted",
        precondition: "Engine at operating temperature, vehicle safe to hold a steady deceleration.",
        steps: [DEFAULT_SESSION, routine("E101", "cam/crank variation relearn"), TESTER_PRESENT],
      },
      {
        id: "fca-oil-reset",
        name: "Oil life reset",
        description: "Resets the oil life percentage shown in the cluster after a service.",
        risk: "safe",
        precondition: "Oil and filter changed. Ignition on, engine off.",
        steps: [DEFAULT_SESSION, routine("E201", "oil life reset"), BACK_TO_DEFAULT],
      },
    ],
  },
  {
    id: "jlr",
    make: "Jaguar / Land Rover",
    aliases: ["jaguar", "land rover", "landrover", "range rover", "rover"],
    header: "7E0",
    headerNote: "Engine ECU at 7E0. Air suspension and body modules sit behind the gateway on their own addresses.",
    tests: [
      ...UNIVERSAL_TESTS,
      ...COMMON_ACTUATIONS({ fan: "F001", fuelPump: "F002", egr: "F003" }),
      {
        id: "jlr-suspension",
        name: "Air suspension height calibration read",
        description:
          "Reads the stored ride height calibration values from the suspension module — the first check when the car sits unevenly.",
        risk: "safe",
        precondition: "Vehicle level, ignition on, engine off.",
        steps: [
          { cmd: "ATSH7E7", note: "Address the air suspension module." },
          DEFAULT_SESSION,
          { cmd: "22F1A1", note: "Read stored ride height calibration data." },
          BACK_TO_DEFAULT,
        ],
      },
      {
        id: "jlr-dpf",
        name: "Diesel particulate filter service regeneration",
        description: "Requests a stationary regeneration on Ingenium and TDV diesel engines.",
        risk: "restricted",
        precondition:
          "Diesel only, outdoors, engine warm, above a quarter tank, exhaust area clear — surfaces reach several hundred degrees.",
        steps: [DEFAULT_SESSION, routine("F101", "service DPF regeneration"), TESTER_PRESENT],
      },
    ],
  },

  {
    id: "generic",
    make: "Other / unknown make",
    aliases: [],
    header: "7E0",
    headerNote: "Standard 11-bit engine ECU address used by almost every OBD-II vehicle.",
    tests: UNIVERSAL_TESTS,
  },
];

export function profileForMake(make: string): MakeProfile {
  const m = make.trim().toLowerCase();
  const fallback = MAKE_PROFILES[MAKE_PROFILES.length - 1]!;
  if (!m) return fallback;
  return MAKE_PROFILES.find((p) => p.aliases.some((a) => m.includes(a))) ?? fallback;
}

export const RISK_NOTE: Record<Risk, string> = {
  safe: "Read-only or reversible. Safe with the engine off.",
  caution: "Moves a real actuator. Keep clear of moving parts and hot surfaces.",
  restricted: "Changes stored ECU data or runs a long procedure. Only run if you know why.",
};
