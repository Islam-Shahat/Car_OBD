# Bundled data sources

Every dataset shipped in `src/data` must record where it came from, its licence, and when it was
retrieved. This file is the register for those datasets.

## Vehicle identity (`src/data/wmi.json`)

| Field      | Value                                                                        |
| ---------- | ---------------------------------------------------------------------------- |
| Source     | NHTSA vPIC — `GetWMIsForManufacturer` API                                    |
| Source URL | <https://vpic.nhtsa.dot.gov/api/vehicles/GetWMIsForManufacturer/{make}>      |
| Licence    | Public domain (U.S. Government work, 17 U.S.C. §105)                         |
| Retrieved  | 2026-11-12                                                                   |
| Entries    | 266 WMIs                                                                     |
| Scope      | Only World Manufacturer Identifiers returned by the API for the listed makes |

The file maps a three-character WMI to:

- `manufacturerName`: the manufacturer string exactly as returned by the API;
- `makeSlug`: a canonical slug from `src/data/makes.json`, or `null` when the make is not part of
  the app's catalog.

Rules applied when generating the file:

- A WMI is **omitted** when the API response is ambiguous for the app's purpose (for example the
  same WMI returned for several unrelated makes). The app never guesses.
- An unknown WMI is not an error: `decodeVehicleIdentity()` returns the WMI with
  `manufacturerName: null` and `makeSlug: null`.
- Only verified API records are bundled. There is no hand-written fallback table.

The WMI table only identifies the manufacturer. Model-year candidates come from the VIN's
position 10 using the ISO 3779 table in `src/lib/obd/vinDecode.ts` (letters `A`–`Y` excluding
`I`, `O`, `Q`; digits `1`–`9`), and every code yields **two** candidates 30 years apart because the
code repeats. The app does not infer the model.

## Canonical make slugs (`src/data/makes.json`)

| Field   | Value                                                                     |
| ------- | ------------------------------------------------------------------------- |
| Source  | Project-internal canonical list                                           |
| Licence | Project source (no third-party data)                                      |
| Entries | 61 slugs                                                                  |
| Purpose | Stable join key for the Phase 4 vehicle catalog and WMI `makeSlug` values |

No Appendix C (or equivalent make/model appendix) exists in this repository or its git history, so
this list is the canonical set for the current phase. When a manufacturer appendix is adopted, it
must be added here with its source, licence and retrieval date before the slugs change.

## VIN check digit

The check-digit algorithm is ISO 3779 (`src/lib/obd/vin.ts`), not bundled data. The app flags a
mismatch only when position 9 is a digit or `X`; an alphabetic position 9 is reported as
"not applicable", because the check digit is not mandatory in every market. This rule is explained
in the UI beside the VIN status.

## Not yet bundled

DTC descriptions, vehicle make/model/year catalogs and repair data are not part of Phase 3.5.
They must not be invented in code; each future dataset needs its own row here with a verified
source, licence and retrieval date.
