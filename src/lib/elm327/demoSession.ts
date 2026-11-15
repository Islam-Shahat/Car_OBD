import { isDevPreview } from '../db/runtime';
import { Elm327Driver, type AdapterInfo } from './driver';
import { MockTransport } from './mockTransport';
import type { ConnectionInfo, SerialConnection } from './connect';

export const DEMO_ADAPTER_INFO: AdapterInfo = {
  identity: 'ELM327 v1.5 (Demo Mode)',
  description: 'Virtual Mock Adapter for Browser Preview',
  version: '1.5',
  protocol: 'AUTO, ISO 15765-4 (CAN 11/500)',
  ecuPresent: true,
  likelyClone: false,
  limitedCommands: false,
  adapterTimeoutMs: 200,
};

function reply(text: string): string {
  return `${text}\r\r>`;
}

const VIN_RESPONSE = '014\r0: 490201575030\r1: 5A5A5A39395A54\r2: 53333930303030\r\r>';

/**
 * Creates a scripted in-memory demo connection that allows walking through
 * the entire diagnostic journey (connect, car selection, scan, results, clear)
 * without hardware.
 *
 * SAFETY INVARIANT: Strictly forbidden in production builds.
 */
export function createDemoConnection(): SerialConnection {
  if (!isDevPreview()) {
    throw new Error('Demo mode is only available in development preview mode.');
  }

  let codesCleared = false;

  const transport = new MockTransport((command) => {
    // AT commands
    if (command === 'ATZ') return reply('ELM327 v1.5');
    if (
      command === 'ATE0' ||
      command === 'ATL0' ||
      command === 'ATS0' ||
      command === 'ATH0' ||
      command === 'ATH1'
    ) {
      return reply('OK');
    }
    if (command === 'ATSP0') return reply('OK');
    if (command === 'ATDP') return reply('ISO 15765-4 (CAN 11/500)');
    if (command === 'ATDPN') return reply('6');
    if (command === 'ATRV') return reply('12.6V');

    // Mode 01 Supported PIDs
    if (command === '0100') return reply('4100BE3FA813');
    if (command === '0120') return reply('4120901FF015');
    if (command === '0140') return reply('41407A1C8021');
    if (command === '0160') return reply('416000000000');

    // Mode 01 Status / MIL
    if (command === '0101') {
      return codesCleared ? reply('41010007A100') : reply('41018107A100');
    }

    // Engine sensors (RPM = 1AF8 -> 1726 RPM, so engine is running!)
    if (command === '0104') return reply('4104FF');
    if (command === '0105') return reply('41055F');
    if (command === '0106') return reply('410680');
    if (command === '0107') return reply('410780');
    if (command === '010C') return reply('410C1AF8');
    if (command === '010D') return reply('410D0A');
    if (command === '010F') return reply('410F39');
    if (command === '0110') return reply('4110181F');
    if (command === '0111') return reply('41112B');
    if (command === '0115') return reply('4115AA80');
    if (command === '011F') return reply('411F0E10');
    if (command === '0121') return reply('41210064');
    if (command === '012F') return reply('412FAA');
    if (command === '0130') return reply('413005');
    if (command === '0131') return reply('413100C8');
    if (command === '0142') return reply('4142394B');
    if (command === '014D') return reply('414D001E');
    if (command === '014E') return reply('414E0064');

    // Mode 09 VIN
    if (command === '0902') return VIN_RESPONSE;

    // Freeze frame
    if (command === '020000') return reply('42000000100000');
    if (command === '020200') return reply('4202000133');
    if (command === '020C00') return reply('420C001AF8');

    // Mode 03 (stored codes)
    if (command === '03') {
      return codesCleared ? reply('4300') : reply('430133');
    }

    // Mode 07 (pending codes)
    if (command === '07') {
      return codesCleared ? reply('4700') : reply('470300');
    }

    // Mode 0A (permanent codes)
    if (command === '0A') {
      return codesCleared ? reply('4A00') : reply('4A0420');
    }

    // Mode 04 (clear codes)
    if (command === '04') {
      codesCleared = true;
      return reply('44');
    }

    return reply('NO DATA');
  });

  const driver = new Elm327Driver(transport);
  void transport.open();

  const info: ConnectionInfo = {
    ...DEMO_ADAPTER_INFO,
    baudRate: 38400,
  };

  return { driver, transport, info };
}
