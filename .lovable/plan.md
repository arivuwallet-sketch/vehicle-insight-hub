# Official VIN database integration

## Build
- Keep the current local VIN format, check-digit, region, year-code, plant, and serial validation.
- Add a server-side lookup against the official NHTSA vPIC VIN database, validating VIN input and normalizing missing fields.
- Show loading, database errors, and the authoritative manufacturer, make, model, production/model year, engine, fuel, body, transmission, and plant details on the Vehicle Information page.
- Automatically decode the VIN read from Mode 09, while still supporting manual VIN entry.

## Technical details
- Use a TanStack server function so the official request is made server-side and no browser secret is required.
- Cache successful lookups briefly to avoid repeated external calls.
- Keep ECU reads and the VIN database separate: Mode 09 supplies the real VIN; vPIC supplies the matching specification record.
- Do not invent values. Missing database fields display as unavailable.

## Verification
- Check TypeScript and build diagnostics.
- Test a known valid VIN and an invalid VIN in the live Vehicle Information page.
- Confirm the page renders without browser console errors.
