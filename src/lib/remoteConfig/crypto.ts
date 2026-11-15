/**
 * Cross-platform Ed25519 signing, verification, and canonical serialization.
 * Uses native Web Crypto API (`crypto.subtle`) available in modern browsers and Node 20+.
 */

export function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(base64, 'base64');
    const ab = new ArrayBuffer(buf.byteLength);
    const view = new Uint8Array(ab);
    for (let i = 0; i < buf.byteLength; i++) {
      view[i] = buf[i]!;
    }
    return view;
  }
  const binString = atob(base64);
  const bytes = new Uint8Array(binString.length);
  for (let i = 0; i < binString.length; i++) {
    bytes[i] = binString.charCodeAt(i);
  }
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binString = '';
  for (let i = 0; i < bytes.length; i++) {
    binString += String.fromCharCode(bytes[i]!);
  }
  return btoa(binString);
}

/**
 * Serializes an object with lexicographically sorted keys for deterministic hashing/signing.
 */
export function canonicalJsonStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJsonStringify).join(',') + ']';
  }
  const record = obj as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const pairs = keys.map((k) => `${JSON.stringify(k)}:${canonicalJsonStringify(record[k])}`);
  return '{' + pairs.join(',') + '}';
}

/**
 * Verifies an Ed25519 signature against a canonical message payload.
 */
export async function verifyEd25519(
  publicKeyBase64: string,
  signatureBase64: string,
  messageText: string,
): Promise<boolean> {
  try {
    const pubKeyBytes = base64ToBytes(publicKeyBase64);
    const signatureBytes = base64ToBytes(signatureBase64);
    const dataBytes = new TextEncoder().encode(messageText);

    const subtle = typeof crypto !== 'undefined' ? crypto.subtle : undefined;
    if (!subtle) {
      throw new Error('Web Crypto API (crypto.subtle) is unavailable');
    }

    const key = await subtle.importKey(
      'raw',
      pubKeyBytes as unknown as BufferSource,
      'Ed25519',
      false,
      ['verify'],
    );
    return await subtle.verify(
      'Ed25519',
      key,
      signatureBytes as unknown as BufferSource,
      dataBytes,
    );
  } catch {
    return false;
  }
}

/**
 * Signs a message payload with an Ed25519 private key (PKCS#8 format).
 * Primarily used by release tooling and unit tests.
 */
export async function signEd25519(
  privateKeyPkcs8Base64: string,
  messageText: string,
): Promise<string> {
  const privKeyBytes = base64ToBytes(privateKeyPkcs8Base64);
  const dataBytes = new TextEncoder().encode(messageText);

  const subtle = typeof crypto !== 'undefined' ? crypto.subtle : undefined;
  if (!subtle) {
    throw new Error('Web Crypto API (crypto.subtle) is unavailable');
  }

  const key = await subtle.importKey(
    'pkcs8',
    privKeyBytes as unknown as BufferSource,
    'Ed25519',
    false,
    ['sign'],
  );
  const signatureBuffer = await subtle.sign('Ed25519', key, dataBytes);
  return bytesToBase64(new Uint8Array(signatureBuffer));
}
