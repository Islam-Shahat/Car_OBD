export interface AdapterAssessment {
  version: string | null;
  /** Warning only: the version string is never proof either way. */
  likelyClone: boolean;
}

/** Versions released by ELM Electronics (v1.5 was never genuine). */
const GENUINE_ELM_VERSIONS = new Set([
  '1.0',
  '1.1',
  '1.2',
  '1.3',
  '1.3a',
  '1.4',
  '1.4b',
  '2.0',
  '2.1',
  '2.2',
  '2.3',
]);

/**
 * v2.1 exists as a genuine release but is overwhelmingly a clone label on budget
 * adapters, so it is surfaced as "likely clone" together with the never-genuine v1.5.
 */
const KNOWN_CLONE_VERSIONS = new Set(['1.5', '1.5a', '2.1']);

const ELM_VERSION_PATTERN = /ELM327\s+v?(\d+(?:\.\d+)?[a-z]?)/i;

export function parseElmVersion(identity: string): string | null {
  const match = ELM_VERSION_PATTERN.exec(identity);
  return match?.[1]?.toLowerCase() ?? null;
}

export function assessAdapter(identity: string): AdapterAssessment {
  const version = parseElmVersion(identity);

  if (version === null) {
    // Branded adapters (OBDLink/STN, Vgate, ...) do not report an ELM327 version.
    return { version: null, likelyClone: false };
  }

  return {
    version,
    likelyClone: KNOWN_CLONE_VERSIONS.has(version) || !GENUINE_ELM_VERSIONS.has(version),
  };
}
