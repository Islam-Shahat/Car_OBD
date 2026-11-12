# Testing with the ELM327 emulator

[ELM327-emulator](https://github.com/ircama/ELM327-emulator) is an open-source Python
adapter emulator. It lets us develop and test the driver without a car, and it replays a
realistic OBD-II ECU scenario.

Two ways to reach the emulator:

| Mode             | Needs                        | Use for                                            |
| ---------------- | ---------------------------- | -------------------------------------------------- |
| Virtual COM pair | com0com (installed as admin) | Full app → Rust bridge → COM → emulator end-to-end |
| TCP mode         | nothing                      | Opt-in driver test and manual commands over TCP    |

## 1. Install

```powershell
pip install elm327-emulator
```

Check it works:

```powershell
python -m elm --version
```

## 2. TCP mode (no drivers, no admin)

```powershell
python scripts/run-emulator.py -n 35000 -s car
```

- `-n 35000` listens on `127.0.0.1:35000`.
- `-s car` loads the "car" scenario (one ECU, CAN 11/500, no stored DTCs by default).
- The wrapper keeps the emulator's stdin open. Started directly in a background shell, the
  interactive loop exits as soon as stdin closes.

The desktop app only speaks COM ports, so TCP mode is used by the opt-in integration test:

```powershell
$env:ELM_EMULATOR = '1'
npx vitest run tests/elm327-emulator.test.ts tests/obd-emulator.test.ts
Remove-Item Env:\ELM_EMULATOR
```

The test starts the emulator itself, runs the real init sequence and `03`, then kills the
emulator. Kill the emulator **before** closing the client socket: its TCP mode logs a
`WinError 10053` error storm on abrupt disconnects.

`tests/obd-emulator.test.ts` uses `scripts/emulator-dtc.py`, a thin wrapper that patches the
emulator's module globals before starting its normal CLI. The patched scenario stores
`P0143`, `P0196`, `P0234` (pending `P0300`, permanent `P0420`), so the live test exercises the full
scan and the backup → Mode 04 → verification path with real frames:

```powershell
python scripts/emulator-dtc.py -n 35020 -s car
```

## 3. Virtual COM pair (full end-to-end, needs admin)

1. Install [com0com](https://sourceforge.net/projects/com0com/). The unsigned driver needs
   administrator rights and, on Windows 11, test-signing or a signed build.
2. Create a pair (the default names are `COM5` and `COM6`; use whatever Setup shows):

   ```powershell
   setupc install PortName=COM5 PortName=COM6
   ```

3. Point the emulator at one end and the app at the other:

   ```powershell
   python scripts/run-emulator.py -p COM5 -s car
   ```

4. In the app: **Connect** → port `COM6` → **Connect**. Expected result: adapter version
   `ELM327 v1.5`, protocol `ISO 15765-4 (CAN 11/500)`, ECU found.

Unplug/replug is simulated by closing the emulator (or `setupc remove`) while the app is
connected; the reader thread emits `serial-closed` and the UI returns to the idle state with
a disconnect message.

## 4. Emulator quirks

- `ATZ` takes a moment and the banner arrives after several blank lines. The driver waits for
  the `>` prompt, not a fixed delay, but the reset timeout is 6 s.
- The first `0100` can take several seconds while the emulator "searches" for a protocol. The
  ECU check therefore uses a 20 s timeout.
- `ATDP` returns the protocol the emulator selected, e.g. `AUTO, ISO 15765-4 (CAN 11/500)`.
- The stock `car` scenario stores no DTCs: `03` answers `4300`. To exercise DTC parsing, use
  `scripts/emulator-dtc.py` (patches `DTC_STORED`/`DTC_PENDING`/`DTC_PERMANENT` without editing
  the installed package). Mode 02 freeze frames are mostly negative answers in this scenario, so
  the scan reports `freeze-frame-unavailable` even when stored codes exist.
- The emulator answers `?` to unknown AT commands. The driver treats this as
  `unknown-command` and only tolerates it for optional init commands (`ATI`, `AT@1`, `ATST`,
  `ATAT1`).
- The default identity is `ELM327 v1.5`, so the clone warning is expected in emulator runs.

## 5. What the emulator cannot validate

Real hardware still has to confirm:

- `ATZ` banner timing and whether an adapter needs DTR/RTS toggling to wake up.
- Bluetooth SPP behaviour: baud rate is often ignored by the adapter, and unplugging produces
  different OS error text.
- Clone adapters that accept a command but return malformed frames, and the v2.1 clone
  warning's false-positive rate for genuine v2.1 chips.
- Multi-second `0100` searches on older ISO/KWP buses and `ATST` values below ~20.
- Whether `ATE0`/`ATL0`/`ATS0`/`ATH0` all take effect on the first try, and whether a clone
  needs a longer inter-command gap than the driver's queue provides.
