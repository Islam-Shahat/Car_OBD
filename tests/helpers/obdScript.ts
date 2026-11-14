import { Elm327Driver, type AdapterInfo } from '../../src/lib/elm327/driver';
import { MockTransport } from '../../src/lib/elm327/mockTransport';

export type ScriptValue = string | null | ((command: string) => string | null);
export type Script = Record<string, ScriptValue>;

export const TEST_ADAPTER: AdapterInfo = {
  identity: 'ELM327 v1.5',
  description: null,
  version: '1.5',
  protocol: 'AUTO, ISO 15765-4 (CAN 11/500)',
  ecuPresent: true,
  likelyClone: true,
  limitedCommands: false,
  adapterTimeoutMs: 200,
};

/** Wraps one adapter line group in the CR noise and `>` prompt the driver expects. */
export function reply(text: string): string {
  return `${text}\r\r>`;
}

export function createScriptedAdapter(script: Script, log: string[] = []) {
  const transport = new MockTransport((command) => {
    log.push(command);
    const entry = script[command];
    if (typeof entry === 'function') return entry(command);
    if (entry === undefined) return reply('NO DATA');
    return entry;
  });

  return { transport, driver: new Elm327Driver(transport), log };
}

const VIN_RESPONSE = '014\r0: 490201575030\r1: 5A5A5A39395A54\r2: 53333930303030\r\r>';

export function fullScanScript(overrides: Script = {}): Script {
  return {
    '0100': reply('4100BE3FA813'),
    '0120': reply('4120901FF015'),
    '0140': reply('41407A1C8021'),
    '0160': reply('416000000000'),
    '0101': reply('41018107A100'),
    '03': reply('430133'),
    '07': reply('470300'),
    '0A': reply('4A0420'),
    '0902': VIN_RESPONSE,
    '0104': reply('4104FF'),
    '0105': reply('41055F'),
    '0106': reply('410680'),
    '0107': reply('410780'),
    '010C': reply('410C1AF8'),
    '010D': reply('410D0A'),
    '010F': reply('410F39'),
    '0110': reply('4110181F'),
    '0111': reply('41112B'),
    '0115': reply('4115AA80'),
    '011F': reply('411F0E10'),
    '0121': reply('41210064'),
    '012F': reply('412FAA'),
    '0130': reply('413005'),
    '0131': reply('413100C8'),
    '0142': reply('4142394B'),
    '014D': reply('414D001E'),
    '014E': reply('414E0064'),
    '020000': reply('42000000100000'),
    '020200': reply('4202000133'),
    '020C00': reply('420C001AF8'),
    ...overrides,
  };
}
