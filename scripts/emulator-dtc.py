"""ELM327-emulator wrapper with a DTC scenario for the live Phase 3 tests.

The stock 'car' scenario stores no trouble codes, so Mode 03/07/0A always answer
`43 00`/`47 00`/`4A 00`. This wrapper patches the emulator's module globals
before delegating to its normal CLI, which enables the stored/pending/permanent
DTC and Mode 04 clear paths without editing the installed package.

    python scripts/emulator-dtc.py -n 35020 -s car
"""

import sys

import elm.obd_message as obd

# SAE J2012 two-byte encodings: P0143, P0196, P0234 stored, P0300 pending,
# P0420 permanent. The 0101 status byte and Mode 03 count derive from these.
obd.DTC_STORED = ['0143', '0196', '0234']
obd.DTC_PENDING = ['0300']
obd.DTC_PERMANENT = ['0420']

from elm.interpreter import main  # noqa: E402  (patch must happen before the CLI runs)

if __name__ == '__main__':
    main()
