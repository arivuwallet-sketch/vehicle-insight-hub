# Vehicle Insight Hub

Build a desktop web-based real OBD vehicle diagnostics deep scanner powerful as launch x431 with a user friendly dashboard 

- Primary: Web Serial API for USB-wired ELM327 adapters — most 

  reliable path, no pairing quirks

- Secondary: Web Bluetooth API for BLE-based OBD adapters (only 

  true BLE dongles work — classic Bluetooth/SPP ELM327 clones 

  can't be reached by any browser; flag this clearly in the 

  adapter picker so users don't buy the wrong one)

- Auto-detect protocol on connect (ISO 15765-4 CAN, ISO 9141-2, 

  ISO 14230 KWP2000, SAE J1850) like ELM327's ATSP0 auto mode

- A "Compatible Adapters" page listing known-good USB and BLE 

  adapter models, explicitly noting classic-Bluetooth dongles 

  won't pair

- Clear connection status indicator and reconnect handling

DIAGNOSTICS (High-standard OBD-II, Modes 01-0A)

- Mode 01 live data dashboard: RPM, speed, coolant temp, intake 

  air temp, throttle position, short/long fuel trim, MAP/MAF, 

  O2 sensor voltages, fuel level, battery voltage, timing advance 

  — gauges plus live line graphs

- Mode 02 freeze frame data

- Mode 03/07 read stored + pending DTCs

- Mode 04 clear DTCs (with a confirm dialog noting this hides 

  symptoms, doesn't fix the cause)

- Mode 09 vehicle info / VIN decode

- Full generic DTC database (P0xxx/P2xxx/P3xxx powertrain, 

  B/C/U-codes) with plain-English explanations, likely causes, 

  severity tags

UX

- Desktop-first dashboard layout, dark mode default, large 

  readable gauges

- Keyboard shortcuts for common actions (reconnect, clear codes, 

  export report)

- Trip/session logging with history, PDF export

- Multi-vehicle garage view for tracking several cars

Also add 

- J2534 pass-thru

- Bi-directional actuation tests, ECU coding, key programming, 

  or manufacturer-proprietary security-access routines

- CAN BUS

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1c2efd6c-8965-4452-95ff-89203bbf99bf).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
