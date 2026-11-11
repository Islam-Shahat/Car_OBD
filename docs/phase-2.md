# Phase 2 — Serial bridge and ELM327 driver

Goal: reliable communication with an ELM327 adapter (real or emulated) and a connection
screen that reports adapter identity, protocol and ECU presence.

## Delivered

### Rust serial bridge (`src-tauri/src/serial.rs`)

- `list_ports` returns name, kind (`usb | bluetooth | pci | unknown`) and a USB
  manufacturer/product label when the OS exposes it.
- `open_port(port, baud)` opens the port and starts a reader thread that emits
  `serial-data` byte arrays. Read timeout is 50 ms so the thread notices the stop flag.
- IO errors emit `serial-closed` with the OS message; intentional closes emit nothing.
- `close_port` sets the stop flag, drops the writer and joins the reader thread. `open_port`
  discards a stale session whose reader thread already exited (unplug), so replugging does
  not hit "already open".
- `write_port` writes and flushes bytes.
- Registered in `src-tauri/src/lib.rs`; `SerialState` is Tauri-managed. No OBD logic in Rust.

### TypeScript transport and driver (`src/lib/elm327/`)

- `transport.ts` — the seam: `open / close / write / onData / onClosed`.
- `serialTransport.ts` — Tauri `invoke` + event listeners registered before `open_port`, so no
  early bytes are lost. Invalid UTF-8 fails loudly as a disconnect.
- `mockTransport.ts` — scripted responses with optional chunking and `emitClosed()` for
  unplug simulation.
- `parse.ts` — pure response cleaning (echo, prompt, `SEARCHING...`, `BUS INIT ...OK`),
  multi-frame preservation, and token → `ElmErrorCode` classification.
- `adapter.ts` — pure `ATI` version parsing and clone assessment.
- `driver.ts` — one in-flight command queue, `>` framing, `ATZ/ATE0/ATL0/ATS0/ATH0/ATI/AT@1/
ATST32/ATAT1/ATSP0/0100/ATDP` init, typed failures, `ATST` + adaptive host timeout,
  timeout resync with a lone CR, and disconnect propagation.
- `connect.ts` — baud probe `38400 → 115200 → 9600`; closes each failed transport and
  surfaces the last error.
- `errors.ts` — `ElmError` with codes: timeout, no-data, unable-to-connect, bus-init-error,
  can-error, buffer-full, unknown-command, adapter-error, empty-response, transport,
  open-failed, closed.

### Connection UI (`src/features/connection/`)

- Port picker with kind/label, refresh, no-ports hint.
- Connect/disconnect with busy state.
- Status panel: adapter identity, description, protocol, ECU found/not found, baud rate,
  `ATST` value.
- Warnings: likely clone, limited command support, ECU missing.
- Every failure maps to an Arabic/English message plus the technical detail. All strings are
  i18n keys in both `ar.json` and `en.json`.

## Acceptance evidence

| Check                                                            | Result                                                                                                |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Unit tests (parsing fixtures, driver, baud probe)                | 41 passed, 1 skipped (live test off by default)                                                       |
| Live Python ELM327-emulator (TCP, opt-in)                        | Passed: init completed, `ELM327 v1.5`, `ISO 15765-4`, ECU found, `03` → `4300`                        |
| Unplug simulation (in-flight command + reconnect)                | Passed: in-flight command rejects with `closed`, driver stops, a new connection opens a fresh session |
| `npm run typecheck` / `lint` / `format:check`                    | Passed                                                                                                |
| `npm run build`                                                  | Passed (408 kB JS / 128 kB gzip)                                                                      |
| `cargo build` / `cargo clippy -D warnings` / `cargo fmt --check` | Passed                                                                                                |

### Not verified end-to-end

A true COM-port E2E run (app → Rust bridge → virtual COM pair → emulator) and the
unplug/replug demo on real hardware were **not** executed on this machine:

- No administrator rights, so com0com (the virtual COM-pair driver) could not be installed.
- No physical ELM327 adapter is connected.

The Rust bridge compiles clean and is exercised only indirectly; the driver itself is
covered by the mock suite and by a live run against the Python emulator over TCP.
`docs/emulator.md` documents the com0com procedure for a full E2E run on a machine with
admin rights.

## Adapter-behaviour assumptions that need real hardware

1. **`ATZ` banner timing.** The driver waits for `>` with a 6 s timeout and ignores blank
   lines. Some adapters need DTR/RTS toggling or a longer wake-up; untested on real USB and
   Bluetooth SPP.
2. **Bluetooth SPP baud rate.** Many Bluetooth adapters ignore the host baud rate. Probing
   `38400 → 115200 → 9600` should still find one that opens, but the adapter's actual UART
   speed and pairing delay are unverified.
3. **Clone detection false positives.** `ELM327 v2.1` is flagged as a likely clone even though
   a genuine v2.1 exists; real-chip owners will see an informational warning. `v1.5` is never
   genuine. Branded adapters without an ELM version string are not flagged.
4. **Limited-command fallback.** The driver tolerates rejection only for `ATI`, `AT@1`,
   `ATST` and `ATAT1`. Real clones may also reject `ATH0`, `ATS0` or `ATSP0`; that currently
   fails the connection instead of degrading.
5. **First `0100` latency.** The ECU check uses 20 s because protocol search on older
   ISO/KWP buses can take several seconds. The emulator returns within ~2 s.
6. **`ATST` lower bound.** A 200 ms target maps to `ATST32` (32 × 4 ms). Some buses need
   ≥ 50 ms per response; adaptive host timing compensates but the adapter may return
   `BUFFER FULL` or `NO DATA` on very slow ECUs.
7. **Unplug error text.** Windows USB removal produces an IO error from `serialport`, which is
   surfaced verbatim. Bluetooth loss and adapter resets may produce different text or no
   error at all.
8. **Inter-command gap.** The queue sends the next command immediately after `>`. Clones that
   need a longer gap may drop commands; a small fixed gap may be required after real-hardware
   testing.
9. **Echo before `ATE0`.** `ATZ` is parsed with echo stripping; if an adapter answers `ATZ`
   with only a prompt and no banner, the driver still proceeds to `ATE0`, so identity may be
   empty and reported as `Unknown adapter`.
