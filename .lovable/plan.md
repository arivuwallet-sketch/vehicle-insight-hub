# Integrity-first professional scanner upgrade

## Goal
Remove anything that can be mistaken for measured or manufacturer-verified vehicle data. Preserve real Web Serial/BLE diagnostics, but label protocol and hardware limits accurately.

## Changes
1. **Remove fabricated routine definitions**
   - Delete unverified manufacturer actuation IDs, headers, and claims.
   - Keep a manual expert-command workflow only: users may send documented commands they already possess.
   - Keep standard read-only OBD requests where the connected ECU explicitly reports support; do not call UDS requests universal.

2. **Make fault-code information authoritative**
   - Keep exact curated SAE entries only.
   - Stop generating exact-looking titles, severity, causes, or repair steps for unknown and manufacturer-specific codes.
   - Show unknown codes as “definition unavailable” with the raw ECU code and advise checking the correct manufacturer service source.
   - Mark severity and repair guidance as reference guidance, never measured ECU facts.

3. **Correct deep-scan scope and module identity**
   - Report only responding emission-related ECUs found through standard OBD-II.
   - Display actual response headers without guessing that unknown headers are ABS, body, transmission, or hybrid modules.
   - Keep VIN year/engine as separate vehicle context; never use it to invent detected modules.
   - Rename claims such as “every control module” to the standards-accurate scope.

4. **Harden live and CAN data paths**
   - Ensure all displayed live values require a current ECU response and clear stale values after failed reads/disconnects.
   - Validate ELM replies, negative responses, monitor commands, filters, and frame formats before displaying success.
   - Prevent overlapping repeated CAN sends and require an explicit safety confirmation before active transmission.

5. **Remove non-diagnostic randomness and misleading coverage claims**
   - Replace random local record IDs and random skeleton widths with deterministic/cryptographic identifiers and fixed presentation.
   - Correct adapter and manufacturer coverage text so it distinguishes standards-based OBD-II from proprietary factory-tool access.

6. **Verification**
   - Add focused parser/decoder tests for malformed responses, DTC validation, support masks, batching, ISO-TP splitting, and negative ECU replies.
   - Run type checks, tests, current build diagnostics, and browser checks of every route at desktop size.
   - Confirm no demo/mock/simulated vehicle values remain in scanner-facing code.

## Important limitation
A browser plus ELM327 cannot become a Launch X431 equivalent: proprietary module maps, licensed security algorithms, J2534 drivers, coding datasets, and model-specific routines are not publicly available through Web Serial/Bluetooth. This upgrade will make the app accurate and honest rather than pretending unsupported factory functions are real.

## Technical details
- Continue using the existing `PidDef`, `Elm327`, store, and route patterns.
- Keep all scanner values sourced from adapter replies or the official VIN service.
- Unknown data remains unknown; no generated fallback diagnosis or guessed module label is substituted.
