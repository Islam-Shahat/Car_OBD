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

The make list is reconciled with Appendix C (`docs/appendix-c-vehicle-catalog.md`), covering 46
canonical makes joining the vehicle catalog and WMI `makeSlug` values. When a manufacturer
appendix is adopted or modified, it must be added here with its source, licence and retrieval date
before the slugs change.

## VIN check digit

The check-digit algorithm is ISO 3779 (`src/lib/obd/vin.ts`), not bundled data. The app flags a
mismatch only when position 9 is a digit or `X`; an alphabetic position 9 is reported as
"not applicable", because the check digit is not mandatory in every market. This rule is explained
in the UI beside the VIN status.

## DTC knowledge base (`public/dtc-pack.json`)

The 4.5 MB pack is a static asset loaded on first run, not a module in the JavaScript bundle.
`src/data/dtc-pack.manifest.json` carries only the version and row count so a normal start can
decide whether to fetch the pack. Any change to the rows changes the pack version.

| Field          | Value                                                                 |
| -------------- | --------------------------------------------------------------------- |
| Source         | OBDex — `foerbsnavi/OBDex`                                            |
| Pinned commit  | `9ba1ffa095f3140d9e21b985b322ddea3134bb60`                            |
| Retrieved      | 2026-11-14                                                            |
| Data licence   | CC0 1.0 Universal (public domain dedication)                          |
| Code licence   | MIT (tooling only; no upstream code is shipped)                       |
| Upstream files | Seven `*_enriched.yaml` files under `data/generic/`                   |
| Imported rows  | 9,533 generic codes                                                   |
| Tier 1         | 402 codes with description, causes and inspection steps               |
| Tier 2         | 9,131 codes with description only                                     |
| Severity       | heuristic estimate from OBDex flags (`severity_source` = `heuristic`) |
| Needs review   | 9,533 rows (`needs_review = 1`)                                       |
| Build command  | `npm run import:dtc` (`fetch.mjs` then `build.mjs`)                   |

### Licence terms

`LICENSE-DATA` at the pinned commit contains:

> Creative Commons Legal Code
>
> CC0 1.0 Universal
>
> The person who associated a work with this deed has dedicated the work to the public domain by
> waiving all of his or her rights to the work worldwide under copyright law, including all related
> and neighboring rights, to the extent allowed by law.
>
> You can copy, modify, distribute and perform the work, even for commercial purposes, all without
> asking permission.
>
> Full legal text: https://creativecommons.org/publicdomain/zero/1.0/legalcode
>
> This dedication applies to the data files contained in this repository (YAML, JSON, schema files
> describing OBD-II codes and PIDs). The accompanying code is licensed separately under the MIT
> License, see LICENSE-CODE.

`LICENSE-CODE` at the same commit contains:

> MIT License
>
> Copyright (c) 2026 obdex contributors
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
> associated documentation files (the "Software"), to deal in the Software without restriction,
> including without limitation the rights to use, copy, modify, merge, publish, distribute,
> sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or
> substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
> NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
> NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
> DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT
> OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
>
> This license applies only to the code in this repository (validation scripts, build tooling). Data
> files are licensed separately under CC0-1.0, see LICENSE-DATA.

Only the CC0 data files are imported. The tooling in `tools/import-dtc` is this project's own MIT
code and does not copy upstream scripts.

### Reproducible import

`tools/import-dtc/sources.mjs` pins the repository, commit, download date and a SHA-256 for every
upstream YAML file:

| File                  | SHA-256                                                            |
| --------------------- | ------------------------------------------------------------------ |
| `P0xxx_enriched.yaml` | `b3aaf435b442ae0517e80da983d9cc0f0a98dd060d02487b417e6e7aa8ff5751` |
| `P2xxx_enriched.yaml` | `aceeccaf838e23539077fe0eea06b94d399474d844af1b2ac18cc86119a446a6` |
| `P3xxx_enriched.yaml` | `bc5264a0c66f982474816bf3b76527ade1f00a321f21a1ce4c657b9b0c560e0f` |
| `B0xxx_enriched.yaml` | `414c00f8abede7d6b3c8e2eaf2ffc412ed67d7ed1cb6ea3a48a1d211d754b9c3` |
| `C0xxx_enriched.yaml` | `70a08cacade9ebc2229bde582827732f46d44af17ad26a62a588196b87f0e067` |
| `U0xxx_enriched.yaml` | `83a88aed8025c60bbaf7ad0846b4069f152aee110580c71a2506e244aab8c3d9` |
| `U3xxx_enriched.yaml` | `145c5c379f3cccf50c1fb315daa99c8adc1e37283d325d4c09168eae28074a03` |

`fetch.mjs` refuses any file whose bytes do not match its pinned checksum, so a moved or rewritten
upstream commit fails the import instead of silently changing shipped data. The cache in
`tools/import-dtc/.cache/` is gitignored; `build.mjs` reads only that verified cache and writes
`public/dtc-pack.json` plus `src/data/dtc-pack.manifest.json` offline. Rebuilding from a clean
checkout therefore needs one network run of `npm run import:dtc`, after which both generated files
are committed and the app ships fully offline.

Import rules:

- Only generic codes are imported (`make` is `NULL` in `dtc_codes`). Manufacturer-specific Tier 3
  data is out of scope and is never merged.
- English text comes from `title.en` and is preserved verbatim. Arabic is generated deterministically
  from `src/data/glossary-ar.json`; Tier 2 descriptions are explicitly machine drafts. No network
  machine translation is used.
- Tier 1 covers numeric-suffix codes in the families `P0100–P0199`, `P0300–P0312`, `P0420–P0431`,
  `P0440–P0457`, `P0500–P0559`, `P0600–P0629`, `P0641–P0659`, `P0700–P0749` and `U0100–U0199`.
  Hex-suffix codes such as `P010A` stay Tier 2.
- Every row records `source = OBDex` and `source_version =` the pinned commit. Every imported Arabic
  row starts with `needs_review = 1`; no unreviewed text is presented as confirmed.
- Reviews live in `src/data/dtc-reviews.json`, a project overlay merged by `build.mjs`. Rerunning the
  upstream import never discards reviewer corrections. `npm run review:export` writes a CSV with
  Tier 1 first; `npm run review:import` validates it and clears `needs_review` only for reviewed rows.

### Wal33D SQLite source

`Wal33D` (Waleed Judah), HEAD `04c43d72e7db7197658b6f72fe582c5076d9eee8`, was reviewed as an
optional cross-check. Its `LICENSE` is MIT (`Copyright (c) 2024 Wal33D (Waleed Judah)`). No rows from
it were imported or merged in v1; OBDex is the single DTC source. If it is used later, it may only
cross-check individual rows and must not be merged where the licence or provenance of a row is
unclear.

## Vehicle catalog (`src/data/vehicle-catalog.json`)

| Field         | Value                                                                 |
| ------------- | --------------------------------------------------------------------- |
| Source        | Reconciled with Appendix C (`docs/appendix-c-vehicle-catalog.md`)     |
| Version       | `2026-11-15.appendix-c`                                               |
| Licence       | Project source (no third-party data)                                  |
| Entries       | 377 models across 46 makes                                            |
| Years         | `null` for both bounds until a cited source provides real year ranges |
| Verification  | `verified = 0` for every row                                          |
| Source tier   | `cited` (51 models) / `knowledge` (326 models)                        |
| Build command | `npm run catalog:build` (`tools/build-catalog.mjs`)                   |

The vehicle catalog (`src/data/vehicle-catalog.json`, version `2026-11-15.appendix-c`) is reconciled
with Appendix C (`docs/appendix-c-vehicle-catalog.md`), containing 377 models across 46 makes. The
catalog is a bilingual selection aid, not a verified real-vehicle database. Each row has a stable
UUID derived from `sha256(makeSlug:model)`, a canonical make slug (joining `src/data/makes.json`),
English and Arabic search aliases, and an explicit `verified = 0` flag. Model years are not guessed.

Seeding upserts catalog rows by their stable `id`; it never writes to `vehicles`. A user car keeps
its own UUID, may reference `catalog_id` or stay free text, and survives every catalog update. When a
cited manufacturer appendix is adopted, it must be added to this register (source, licence,
retrieval date, year ranges) and its rows may then move to a cited tier and be marked verified; the
existing catalog rows must not be silently relabelled.

## Not yet bundled

Repair procedures, torque specifications, wiring diagrams, manufacturer manuals and
manufacturer-specific DTCs are not part of v1. They must not be invented in code or scraped; each
future dataset needs its own row here with a verified source, licence and retrieval date. MechanicDB
and other unclear-licence datasets are not used.
