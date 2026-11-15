# Phase 4 — local SQLite persistence and reference data

Status: **done**. Base commit: `81cac84` (Phase 3.5). Scope: SQLite schema and repositories,
seeded DTC knowledge base with Arabic review tiers, vehicle catalog and manual selection, legacy
backup migration. No network sync, no remote config, no report or history UI.

## Delivered

### Schema and migrations

`src/lib/db/migrations.ts` applies three versioned, idempotent migrations and records them in
`schema_migrations`:

| Version | Content                                                               |
| ------- | --------------------------------------------------------------------- |
| 1       | `vehicles`, `vehicle_catalog`, `dtc_codes`, `settings`, remote config |
| 2       | `scan_sessions`, `scan_results`, readiness, live data, `scan_backups` |
| 3       | catalog model/search indexes                                          |

Every table uses a UUID `id` plus `created_at`, `updated_at` and `deleted_at` (soft delete).
Required indexes are present: `dtc_codes.code`, `scan_sessions.vehicle_id`,
`live_data_logs(session_id, ts)`, plus catalog, VIN, date and session lookup indexes.

DTC uniqueness is an expression index:

```sql
CREATE UNIQUE INDEX dtc_codes_code_make_uq
  ON dtc_codes(code, COALESCE(make, ''));
```

`make IS NULL` means a generic code. A plain `UNIQUE(code, make)` would allow unlimited NULL makes,
so the expression is what actually enforces one generic row per code while still allowing one
make-specific row per make.

Migration statements are `IF NOT EXISTS` and the ledger insert happens only after all statements
succeed. An interrupted migration can therefore be retried on the next start without dropping or
half-creating anything. Upgrading an existing database keeps its rows; tests cover a version-1
database that is upgraded to the full schema.

### Repositories

`src/lib/db/repositories.ts` defines the storage interfaces:

- `VehicleRepository`, `VehicleCatalogRepository`
- `DtcRepository`, including counts, review export and `applyReview`
- `ScanRepository` for sessions, results, readiness snapshots and live data
- `SettingsRepository` and `RemoteConfigCacheRepository`
- `ScanBackupRepository` (Phase 3 interface extended with `list`, `get` and soft `delete`)

`sqliteRepositories.ts` is the only place that writes SQL. `inMemoryRepositories.ts` implements the
same interfaces for tests and non-Tauri runs. `SqlExecutor` is a two-method port (`execute`,
`select`): production binds it to `@tauri-apps/plugin-sql@2.6.0`, tests bind it to Node 24
`node:sqlite` through `tests/helpers/sqlite.ts`. Both paths execute the same statements and mapping
code; the test adapter translates `$1` placeholders to `?1`.

DTC lookup order is make-specific → generic → unknown. The unknown result keeps the normalised code
and its system category (powertrain/body/chassis/network) and the UI says “no description yet”; it
never invents text. The shipped rows are keyed by code and make, so a free-text car simply falls back
to the generic row.

Settings use an upsert on `key`, so repeated writes keep one row. Remote config has a typed cache
table ready for the later signed-config phase, but no fetch path is implemented.

### Shipped DTC knowledge base

`public/dtc-pack.json` contains **9,533 generic OBDex codes** (moved out of the JavaScript bundle in
Phase 4.5; `src/data/dtc-pack.manifest.json` carries the version and row count):

| Tier | Rows  | Content                                             | Review state |
| ---- | ----- | --------------------------------------------------- | ------------ |
| 1    | 402   | Arabic description, causes and inspection steps     | unreviewed   |
| 2    | 9,131 | Arabic description only, explicitly a machine draft | unreviewed   |
| 3    | 0     | manufacturer-specific codes are not imported        | out of scope |

All **9,533** imported rows have `needs_review = 1`; every row records `source = OBDex` and
`source_version = 9ba1ffa095f3140d9e21b985b322ddea3134bb60`. English text is preserved from the
upstream `title.en`. Arabic uses only `src/data/glossary-ar.json`; missing terms were added there.
There is no network machine translation. Tier 1 has causes/steps; Tier 2 has a description only.
Hex-suffix codes such as `P010A` stay Tier 2 even inside a Tier 1 numeric range.

Exact licence terms, the seven upstream file checksums, import rules and provenance are in
`docs/data-sources.md`. OBDex data is CC0 1.0; upstream tooling is MIT and is not shipped.

### Reproducible import

`npm run import:dtc` runs:

1. `tools/import-dtc/fetch.mjs` — downloads the seven pinned `*_enriched.yaml` files or reuses the
   cache, and refuses any SHA-256 mismatch.
2. `tools/import-dtc/build.mjs` — parses the verified YAML, assigns tiers, translates with the
   glossary, merges `src/data/dtc-reviews.json`, checks uniqueness and non-empty text, and writes
   `public/dtc-pack.json` plus the manifest.

The cache (`tools/import-dtc/.cache/`) is gitignored. The generated JSON is committed, so the app
ships offline; rebuilding from a clean checkout needs one network run of the import command.
`build.mjs` also reports imported/Tier 1/Tier 2/review counts and leftover Latin words, which is how
glossary gaps surface.

### Arabic review workflow

- `npm run review:export` writes a UTF-8 CSV of `needs_review = 1` rows, Tier 1 first, including code,
  tier, category, English, current Arabic, causes, steps and reviewer.
- `npm run review:import -- --in file.csv --reviewer "Name"` validates the CSV, rejects unknown
  codes, requires non-empty Arabic, splits causes/steps on `|`, and writes the review overlay
  `src/data/dtc-reviews.json` with `reviewedBy` and `reviewedAt`.
- `build.mjs` merges the overlay on every import, so re-running the upstream import never discards
  reviews. A reviewed row is emitted with `needs_review = 0`.
- The UI shows an “unreviewed translation” badge and the source/version for imported rows.

The overlay is the durable review record; the generated JSON is rebuilt from source plus overlay.
Both scripts accept `--seed` (and `review:import` also `--overlay`) so tests run without touching the
shipped data.

### Vehicle catalog and selection

`src/data/vehicle-catalog.json` is a **259-model, 33-make** bilingual selection list. No Appendix C
or equivalent make/model appendix exists in the repository or its history, so the catalog uses the
documented fallback:

- every row is `sourceTier = "knowledge"` and `verified = 0`;
- year bounds are `null` until a cited source provides real ranges;
- IDs are stable UUIDs derived from `sha256(makeSlug:model)`;
- Arabic and English aliases support search in both languages;
- `tools/build-catalog.mjs` regenerates the file (`npm run catalog:build`).

`VehiclesPage` implements make → model → optional year, Arabic/English search, and a “not in the
list” free-text path. A saved car keeps its own UUID and may reference `catalog_id` or only
`make_text`/`model_text`. The selected car id is persisted in `settings` under
`vehicle.selected.id` and restored on start. Catalog seeding upserts catalog rows by stable id and
never writes to `vehicles`, so catalog updates cannot overwrite or delete a user car.

### Legacy backup migration

`src/lib/db/legacyBackups.ts` imports the interim `obd-diagnose.scan-backups.v1` localStorage key
exactly once:

- saves are keyed by backup id, so retrying a partial migration cannot duplicate entries;
- unreadable entries are preserved under `.unreadable` instead of being dropped;
- corrupt legacy JSON is preserved aside and reported;
- the old key is removed only after every readable entry is durable in SQLite;
- the `migration.local-backups.v1` marker lives in `settings`;
- a failed save throws before the marker/removal, leaving the legacy data for the next start.

`ScanBackupRepository` is now SQLite-backed. `save()` reads the row back before resolving, so Service
04 is never sent after a silently failed or lost backup. Backups are soft-deleted only and are never
pruned.

### Runtime wiring

`openStorage()` runs migrations, seeds reference data and migrates legacy backups in that order; every
step is idempotent. `StorageProvider` opens the database once for the app. A storage failure disables
only durable operations (clear backup, vehicles, DTC explanations) and shows an error; scanning still
works. The database is `sqlite:obd-diagnose.db` in Tauri's app-data directory. Rust changes are
limited to `tauri-plugin-sql` registration and the `sql:default` / `sql:allow-execute` capability.

## Acceptance evidence

- Fresh database: all tables/indexes/ledger rows created; a second start is a no-op.
- Existing database: a version-1 database with data upgrades to the current schema and keeps its
  rows.
- Repository parity: the same tests run against SQLite and in-memory implementations for vehicles,
  catalog search, DTC lookup/counts/review, sessions/results/readiness/live data, settings and
  backups.
- Seed: 9,533 unique generic codes; every row has English and Arabic text; Tier 1 has causes/steps;
  Tier 2 is description-only; all rows start unreviewed.
- Catalog: 259 unique ids across 33 makes; every row `verified = 0`; seeding changes do not touch
  user vehicles.
- Legacy: migration is one-shot, duplicate-safe, preserves unreadable entries, and retries after a
  save failure.
- Review: CSV round trip is idempotent and rejects unknown codes without writing the overlay.
- Test suite: `172 passed, 3 skipped` (the skips are the opt-in live emulator tests).

## Limitations and next phase

- Scan history UI is still a placeholder. Phase 4 stores sessions, results, readiness and live data;
  Phase 5 adds the history views and safe-clear reporting on top.
- The vehicle catalog is a selection aid with no verified year ranges. It must be replaced or
  upgraded only with a licensed, cited appendix; the register in `docs/data-sources.md` is the gate.
- All imported Arabic is unreviewed until a reviewer imports corrected CSV. Tier 2 text is a
  deterministic draft, not a translation review.
- Wal33D was reviewed (MIT) but not imported; OBDex is the single DTC source.
- Real multi-ECU and legacy-bus behavior remains hardware-only; Phase 4 did not change OBD logic.
