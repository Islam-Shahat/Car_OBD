import { describe, expect, it } from 'vitest';

import { isOptionalReadError, ObdService } from '../src/lib/obd/obdService';
import { reply, createScriptedAdapter, fullScanScript } from './helpers/obdScript';

async function openService(script = fullScanScript()) {
  const { transport, driver, log } = createScriptedAdapter(script);
  await transport.open();
  return { service: new ObdService(driver), log };
}

describe('ObdService supported PIDs', () => {
  it('walks 0100/0120/0140/0160 and unions every claimed PID', async () => {
    const { service, log } = await openService();
    const groups: number[] = [];

    const result = await service.readSupportedPids((group) => groups.push(group.base));

    expect(log).toEqual(['0100', '0120', '0140', '0160']);
    expect(groups).toEqual([0x00, 0x20, 0x40, 0x60]);
    expect(result.pids).toContain(0x0c);
    expect(result.pids).toContain(0x2f);
    expect(result.pids).toContain(0x42);
    expect(result.pids).toContain(0x60);
    expect(result.warnings).toEqual([]);
  });

  it('stops at the first bitmap without the next-group bit', async () => {
    const { service, log } = await openService({
      '0100': reply('410000100000'),
    });

    const result = await service.readSupportedPids();

    expect(log).toEqual(['0100']);
    expect(result.pids).toEqual([0x0c]);
    expect(result.warnings).toEqual([]);
  });

  it('reports a missing bitmap instead of assuming PIDs', async () => {
    const { service } = await openService({ '0100': reply('NO DATA') });

    const result = await service.readSupportedPids();

    expect(result.pids).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.code).toBe('pids-unavailable');
  });
});

describe('ObdService Mode 01', () => {
  it('reads and decodes a PID', async () => {
    const { service } = await openService();
    const reading = await service.readPid(0x0c);
    expect(reading.measurements[0]?.value).toBe(1726);
  });

  it('reads MIL status and readiness', async () => {
    const { service } = await openService();
    const status = await service.readStatus();
    expect(status.mil).toEqual({ on: true, dtcCount: 1 });
    expect(status.ignition).toBe('spark');
  });
});

describe('ObdService DTC modes', () => {
  it('decodes stored, pending and permanent codes', async () => {
    const { service } = await openService();

    expect((await service.readDtcGroup(3)).map((dtc) => dtc.code)).toEqual(['P0133']);
    expect((await service.readDtcGroup(7)).map((dtc) => dtc.code)).toEqual(['P0300']);
    expect((await service.readDtcGroup(10)).map((dtc) => dtc.code)).toEqual(['P0420']);
  });

  it('reassembles a multi-frame DTC answer and trims ISO-TP padding', async () => {
    const { service } = await openService({
      '03': '009\r0: 43 01 43 03 00 01\r1: 96 02 34 00 00 00 00\r\r>',
    });

    expect((await service.readDtcGroup(3)).map((dtc) => dtc.code)).toEqual([
      'P0143',
      'P0300',
      'P0196',
      'P0234',
    ]);
  });

  it('surfaces a negative response as a typed service rejection', async () => {
    const { service } = await openService({ '07': reply('7F0711') });

    await expect(service.readDtcGroup(7)).rejects.toMatchObject({
      code: 'service-rejected',
      nrc: 0x11,
    });

    try {
      await service.readDtcGroup(7);
    } catch (error) {
      expect(isOptionalReadError(error)).toBe(true);
    }
  });

  it('returns an empty list for a 43 00 answer', async () => {
    const { service } = await openService({ '03': reply('4300') });
    expect(await service.readDtcGroup(3)).toEqual([]);
  });
});

describe('ObdService Mode 09 VIN', () => {
  it('decodes the multi-frame VIN', async () => {
    const { service } = await openService();
    const vin = await service.readVin();

    expect(vin.vin).toBe('WP0ZZZ99ZTS390000');
    expect(vin.applicable).toBe(false);
  });

  it('fails loudly when the answer contains no VIN', async () => {
    const { service } = await openService({ '0902': reply('4901') });
    await expect(service.readVin()).rejects.toMatchObject({ code: 'malformed-response' });
  });
});

describe('ObdService Mode 02 freeze frame', () => {
  it('reads the frame DTC and supported PIDs', async () => {
    const { service } = await openService();
    const frame = await service.readFreezeFrame(0);

    expect(frame.frame).toBe(0);
    expect(frame.dtc?.code).toBe('P0133');
    expect(frame.readings).toHaveLength(1);
    expect(frame.readings[0]?.pid).toBe(0x0c);
    expect(frame.readings[0]?.measurements[0]?.value).toBe(1726);
  });

  it('tolerates an answer without the echoed frame number', async () => {
    const { service } = await openService(fullScanScript({ '020C00': reply('420C1AF8') }));
    const frame = await service.readFreezeFrame(0);
    expect(frame.readings[0]?.measurements[0]?.value).toBe(1726);
  });

  it('marks an unsupported freeze frame as an optional read failure', async () => {
    const { service } = await openService(fullScanScript({ '020000': reply('NO DATA') }));

    try {
      await service.readFreezeFrame(0);
      throw new Error('expected readFreezeFrame to fail');
    } catch (error) {
      expect(isOptionalReadError(error)).toBe(true);
    }
  });
});
