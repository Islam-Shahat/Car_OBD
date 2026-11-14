"""ELM327-emulator wrapper with a DTC and freeze-frame scenario.

The stock 'car' scenario stores no trouble codes, so Mode 03/07/0A always answer
`43 00`/`47 00`/`4A 00`, and its Mode 02 entries answer `NO DATA`/NRC 12. This
wrapper patches the emulator's module globals before delegating to its normal
CLI, which enables the stored/pending/permanent DTC, Mode 04 clear and positive
freeze-frame paths without editing the installed package.

    python scripts/emulator-dtc.py -n 35020 -s car
"""

from elm import obd_message as obd

# SAE J2012 two-byte encodings: P0143, P0196, P0234 stored, P0300 pending,
# P0420 permanent. The 0101 status byte and Mode 03 count derive from these.
obd.DTC_STORED = ['0143', '0196', '0234']
obd.DTC_PENDING = ['0300']
obd.DTC_PERMANENT = ['0420']

# Mode 02 freeze-frame PIDs supported by the emulated ECU: PID 02 (the DTC),
# 05 (coolant), 0C (RPM) and 0D (speed).
car = obd.ObdMessage['car']
car['DTC_SUPPORTED_PIDS_2'] = {
    'Request': '^020000' + obd.ELM_FOOTER,
    'Descr': 'Freeze-frame supported PIDs',
    'Header': obd.ECU_ADDR_E,
    'Response': obd.iso_tp_frames(['42', '00', '48', '18', '00', '00']),
}
car['INJ_MF_2']['Response'] = obd.iso_tp_frames(['42', '02', '00', '01', '43'])
car['DTC_COOLANT_TEMP']['Response'] = obd.iso_tp_frames(['42', '05', '00', '5F'])
car['DTC_RPM']['Response'] = obd.iso_tp_frames(['42', '0C', '00', '1A', 'F8'])
car['DTC_SPEED']['Response'] = obd.iso_tp_frames(['42', '0D', '00', '0A'])

# The stock Mode 02 patterns only allow one trailing frame byte (`^020C` +
# footer), but the app sends the full `02 <pid> <frame>` request (`020C00`).
# Widen those patterns so the answers above are reachable.
for name, pid in (
    ('DTC_COOLANT_TEMP', '05'),
    ('DTC_RPM', '0C'),
    ('DTC_SPEED', '0D'),
):
    car[name]['Request'] = f'^02{pid}[0-9A-F]{{2}}' + obd.ELM_FOOTER

from elm.interpreter import main  # noqa: E402  (patch must happen before the CLI runs)

if __name__ == '__main__':
    main()
