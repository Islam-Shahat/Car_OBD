/**
 * One logical OBD response. Multi-frame ISO-TP responses are reassembled into a
 * single byte array; each `0:`, `1:` block from the adapter starts a message.
 */
export interface ObdMessage {
  bytes: number[];
  /** Adapter lines that produced this message, kept for diagnostics. */
  lines: string[];
}

const HEX = /^[0-9A-F]+$/;
const FRAME_PREFIX = /^(\d+):\s*(.*)$/;
const LENGTH_LINE = /^[0-9A-F]{1,3}$/;

function isIsoTpLengthLine(line: string, next: string | undefined): boolean {
  if (!LENGTH_LINE.test(line.toUpperCase())) return false;
  const value = Number.parseInt(line, 16);
  if (!Number.isFinite(value) || value <= 0) return false;

  // A two-digit length (`09`) is also valid hex data; it is only a length line
  // when the next line opens a multi-frame block.
  if (parseHexBytes(line)) {
    return /^\d+:/.test(next ?? '');
  }
  return true;
}

/**
 * Parses one adapter line into bytes.
 * Returns `null` for non-data lines (the ISO-TP length line such as `014`,
 * whitespace, partial text) and for odd-length hex, which cannot be whole bytes.
 */
export function parseHexBytes(text: string): number[] | null {
  const compact = text.replace(/\s+/g, '').toUpperCase();
  if (compact.length === 0 || compact.length % 2 !== 0 || !HEX.test(compact)) {
    return null;
  }

  const bytes: number[] = [];
  for (let offset = 0; offset < compact.length; offset += 2) {
    bytes.push(Number.parseInt(compact.slice(offset, offset + 2), 16));
  }
  return bytes;
}

/**
 * Turns cleaned ELM327 lines into logical messages.
 *
 * With headers off, ELM327 prints single-frame answers as one hex line and
 * multi-frame answers as `0: ...`, `1: ...` blocks (the preceding line is the
 * ISO-TP length, e.g. `014`). A new `0:` block starts a new message so that
 * answers from several ECUs are not merged.
 */
export function decodeMessages(lines: readonly string[]): ObdMessage[] {
  const messages: ObdMessage[] = [];
  let current: ObdMessage | null = null;
  let currentLength: number | null = null;
  let pendingLength: number | null = null;

  const flush = () => {
    if (current && current.bytes.length > 0) {
      if (currentLength !== null && current.bytes.length > currentLength) {
        // Multi-frame ISO-TP frames are padded to 7 bytes; the adapter prints
        // the real payload length above the frames.
        current.bytes = current.bytes.slice(0, currentLength);
      }
      messages.push(current);
    }
    current = null;
    currentLength = null;
  };

  for (const [index, line] of lines.entries()) {
    const framed = FRAME_PREFIX.exec(line);

    if (framed) {
      const frameIndex = Number.parseInt(framed[1] ?? '', 10);
      const bytes = parseHexBytes(framed[2] ?? '');
      if (!bytes) {
        flush();
        continue;
      }

      if (frameIndex === 0 || current === null) {
        flush();
        current = { bytes: [...bytes], lines: [line] };
        currentLength = pendingLength;
      } else {
        current.bytes.push(...bytes);
        current.lines.push(line);
      }
      pendingLength = null;
      continue;
    }

    const bytes = parseHexBytes(line);
    if (!bytes) {
      if (isIsoTpLengthLine(line, lines[index + 1])) {
        pendingLength = Number.parseInt(line, 16);
      }
      continue;
    }

    flush();
    pendingLength = null;
    messages.push({ bytes, lines: [line] });
  }

  flush();
  return messages;
}

/** Messages whose payload starts with the expected service (and optional PID). */
export function messagesFor(
  messages: readonly ObdMessage[],
  service: number,
  pid?: number,
): ObdMessage[] {
  return messages.filter((message) => {
    if (message.bytes[0] !== service) return false;
    return pid === undefined || message.bytes[1] === pid;
  });
}

/**
 * Data bytes after the service and PID bytes for the first matching message.
 * When several ECUs answer the same request, the first answer is used.
 */
export function firstPayload(
  messages: readonly ObdMessage[],
  service: number,
  pid: number,
): number[] | null {
  const message = messagesFor(messages, service, pid)[0];
  return message ? message.bytes.slice(2) : null;
}

/** Finds a negative response (0x7F) in a decoded answer. */
export function negativeResponse(
  messages: readonly ObdMessage[],
): { service: number; nrc: number } | null {
  for (const message of messages) {
    if (message.bytes[0] !== 0x7f) continue;
    return { service: message.bytes[1] ?? 0, nrc: message.bytes[2] ?? 0 };
  }
  return null;
}

export function commandWithPid(service: number, pid: number): string {
  return `${hexByte(service)}${hexByte(pid)}`;
}

export function hexByte(value: number): string {
  return value.toString(16).toUpperCase().padStart(2, '0');
}

/** `0x0C`-style PID label used in warnings and tests. */
export function pidLabel(pid: number): string {
  return `0x${hexByte(pid)}`;
}
