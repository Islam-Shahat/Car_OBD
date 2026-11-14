import type { Elm327Driver } from '../elm327/driver';
import { errorMessage, isElmError } from '../elm327/errors';
import type { FreezeFrame, ScanWarning } from './scanTypes';
import {
  DTC_MODE_REQUEST,
  DTC_MODE_RESPONSE,
  decodeDtcPair,
  decodeDtcPayload,
  isZeroDtc,
  uniqueDtcs,
  type Dtc,
  type DtcMode,
} from './dtc';
import { ObdError, isUnsupportedServiceError } from './errors';
import {
  commandWithPid,
  decodeMessages,
  firstPayload,
  hexByte,
  messagesFor,
  negativeResponse,
  pidLabel,
  type ObdMessage,
} from './frames';
import {
  CORE_PID_IDS,
  decodePid,
  decodeSupportedPidGroup,
  type PidReading,
  type SupportedPidGroup,
} from './pids';
import { decodeReadinessStatus, type ReadinessStatus } from './readiness';
import { decodeVin, type VinResult } from './vin';
import { decodeVehicleIdentity, type VehicleIdentity } from './vinDecode';

/** The ELM327 driver's send() is the only transport capability OBD needs. */
export type CommandPort = Pick<Elm327Driver, 'send'>;

const UNSUPPORTED_ELM_CODES: ReadonlySet<string> = new Set([
  'no-data',
  'unable-to-connect',
  'unknown-command',
  'adapter-error',
]);

/**
 * Optional modes/PIDs legitimately return NO DATA or a "service not supported"
 * negative response. Real transport failures are not in this set and propagate.
 */
export function isOptionalReadError(error: unknown): boolean {
  if (isElmError(error)) return UNSUPPORTED_ELM_CODES.has(error.code);
  return isUnsupportedServiceError(error);
}

export interface SupportedPidsResult {
  pids: number[];
  warnings: ScanWarning[];
}

/**
 * Typed OBD-II reads on top of the ELM327 driver. Every method checks the
 * supported-PID bitmaps or handles the ECU's negative/no-data answers before
 * decoding; decoding itself lives in pure modules.
 */
export class ObdService {
  private readonly port: CommandPort;

  constructor(port: CommandPort) {
    this.port = port;
  }

  /** Walks 0100, 0120, 0140 ... until the "next group" bit is clear. */
  async readSupportedPids(
    onGroup?: (group: SupportedPidGroup) => void,
  ): Promise<SupportedPidsResult> {
    const pids = new Set<number>();
    const warnings: ScanWarning[] = [];
    let base = 0x00;

    // 0x00, 0x20 ... 0xE0: a hard ceiling against a broken bitmap chain.
    for (let guard = 0; guard < 8; guard += 1) {
      const command = commandWithPid(0x01, base);
      let messages: ObdMessage[];

      try {
        messages = await this.read(command, 0x41);
      } catch (error) {
        if (isOptionalReadError(error)) {
          warnings.push({ code: 'pids-unavailable', detail: errorMessage(error) });
          break;
        }
        throw error;
      }

      const data = firstPayload(messages, 0x41, base);
      if (!data) {
        warnings.push({ code: 'malformed-response', detail: command });
        break;
      }

      let group: SupportedPidGroup;
      try {
        group = decodeSupportedPidGroup(base, data);
      } catch (error) {
        warnings.push({ code: 'malformed-response', detail: errorMessage(error) });
        break;
      }

      for (const pid of group.pids) pids.add(pid);
      onGroup?.(group);
      if (!group.next) break;
      base += 0x20;
    }

    return { pids: [...pids].sort((left, right) => left - right), warnings };
  }

  async readStatus(): Promise<ReadinessStatus> {
    return decodeReadinessStatus(await this.readPidData(0x01));
  }

  async readPid(pid: number): Promise<PidReading> {
    const [reading] = await this.readPidAll(pid);
    if (!reading) {
      throw new ObdError('malformed-response', `The answer does not contain PID ${pidLabel(pid)}`);
    }
    return reading;
  }

  /**
   * Every ECU that answered the same PID, each tagged with its CAN response
   * identifier. The first reading is the one used for scalar displays.
   */
  async readPidAll(pid: number): Promise<PidReading[]> {
    const messages = await this.read(commandWithPid(0x01, pid), 0x41);
    const matches = messagesFor(messages, 0x41, pid);
    if (matches.length === 0) {
      throw new ObdError('malformed-response', `The answer does not contain PID ${pidLabel(pid)}`);
    }

    return matches.map((message) => {
      const reading = decodePid(pid, message.bytes.slice(2));
      return message.ecuId ? { ...reading, ecuId: message.ecuId } : reading;
    });
  }

  async readDtcGroup(mode: DtcMode): Promise<Dtc[]> {
    const service = DTC_MODE_RESPONSE[mode];
    const messages = await this.read(DTC_MODE_REQUEST[mode], service);
    const codes: Dtc[] = [];

    // Each message is one ECU's answer. Decoding them separately keeps the
    // ISO 9141/14230 count byte meaningful when several ECUs answer.
    for (const message of messagesFor(messages, service)) {
      for (const dtc of decodeDtcPayload(message.bytes.slice(1))) {
        codes.push(message.ecuId ? { ...dtc, ecuId: message.ecuId } : dtc);
      }
    }

    return uniqueDtcs(codes);
  }

  async readVin(): Promise<VinResult> {
    const messages = await this.read('0902', 0x49);
    const vin = decodeVin(messages);
    if (!vin) {
      throw new ObdError('malformed-response', 'No VIN was found in the 0902 answer');
    }
    return vin;
  }

  /**
   * Reads and decodes the VIN identity. Any failure (no VIN, unsupported Mode
   * 09, transport hiccup) returns `null` and never blocks connection or scan.
   */
  async readVehicleIdentity(): Promise<VehicleIdentity | null> {
    try {
      const vin = await this.readVin();
      return decodeVehicleIdentity(vin.vin);
    } catch {
      return null;
    }
  }

  /**
   * Reads one freeze frame: supported PIDs, the DTC that caused it, and the
   * decoded core PIDs. Requires `42` answers shaped as `42 PID FRAME data...`.
   */
  async readFreezeFrame(frame: number): Promise<FreezeFrame> {
    const supported = await this.readFreezeFrameSupportedPids(frame);
    let dtc: Dtc | null = null;

    try {
      const dtcData = await this.readMode02Data(0x02, frame);
      if (dtcData.length >= 2) {
        const candidate = decodeDtcPair(dtcData[0] ?? 0, dtcData[1] ?? 0);
        if (!isZeroDtc(candidate)) dtc = candidate;
      }
    } catch (error) {
      if (!isOptionalReadError(error)) throw error;
    }

    const readings: PidReading[] = [];
    for (const pid of CORE_PID_IDS) {
      if (!supported.includes(pid)) continue;
      try {
        readings.push(decodePid(pid, await this.readMode02Data(pid, frame)));
      } catch (error) {
        if (!isOptionalReadError(error)) throw error;
      }
    }

    return { frame, dtc, readings };
  }

  private async readFreezeFrameSupportedPids(frame: number): Promise<number[]> {
    return decodeSupportedPidGroup(0x00, await this.readMode02Data(0x00, frame)).pids;
  }

  private async readPidData(pid: number): Promise<number[]> {
    const messages = await this.read(commandWithPid(0x01, pid), 0x41);
    const data = firstPayload(messages, 0x41, pid);
    if (!data) {
      throw new ObdError('malformed-response', `The answer does not contain PID ${pidLabel(pid)}`);
    }
    return data;
  }

  /**
   * Mode 02 answers echo the requested frame number: `42 PID FRAME data...`.
   * Adapters/ECUs that omit the echo are tolerated by only stripping it when it
   * matches the requested frame.
   */
  private async readMode02Data(pid: number, frame: number): Promise<number[]> {
    const command = `${commandWithPid(0x02, pid)}${hexByte(frame)}`;
    const messages = await this.read(command, 0x42);
    const message = messagesFor(messages, 0x42, pid)[0];
    if (!message) {
      throw new ObdError(
        'malformed-response',
        `The answer does not contain freeze-frame PID ${pidLabel(pid)}`,
      );
    }

    const rest = message.bytes.slice(2);
    if (rest.length === 0) {
      throw new ObdError('malformed-response', `Empty freeze-frame answer to ${command}`);
    }
    return rest[0] === frame ? rest.slice(1) : rest;
  }

  private async read(command: string, service: number): Promise<ObdMessage[]> {
    const response = await this.port.send(command);
    const messages = decodeMessages(response.lines);
    const negative = negativeResponse(messages);

    if (negative) {
      throw new ObdError(
        'service-rejected',
        `The ECU rejected ${command} with NRC 0x${hexByte(negative.nrc)}`,
        { nrc: negative.nrc },
      );
    }

    if (!messages.some((message) => message.bytes[0] === service)) {
      throw new ObdError(
        'malformed-response',
        `The answer to ${command} does not contain service ${hexByte(service)}`,
      );
    }

    return messages;
  }
}
