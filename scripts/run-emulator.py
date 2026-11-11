"""Run the ELM327 emulator in TCP mode with an open stdin.

The emulator's interactive loop exits when stdin is closed, which happens when it is
started as a background process. This wrapper keeps the pipe open so the emulator
keeps serving until the wrapper is stopped.

Usage:
    python scripts/run-emulator.py -n 35000 -s car
"""

from __future__ import annotations

import subprocess
import sys


def main() -> int:
    command = [sys.executable, "-m", "elm", *sys.argv[1:]]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    try:
        return process.wait()
    except KeyboardInterrupt:
        process.terminate()
        return process.wait()


if __name__ == "__main__":
    raise SystemExit(main())
