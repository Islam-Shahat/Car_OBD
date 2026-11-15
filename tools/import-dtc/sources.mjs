export const PINNED_COMMIT = '9ba1ffa095f3140d9e21b985b322ddea3134bb60';
export const REPOSITORY = 'foerbsnavi/OBDex';
export const DOWNLOADED_AT = '2026-11-14';
export const SOURCE_NAME = 'OBDex';
export const SOURCE_VERSION = PINNED_COMMIT;

export const DATA_FILES = [
  {
    name: 'P0xxx_enriched.yaml',
    sha256: 'b3aaf435b442ae0517e80da983d9cc0f0a98dd060d02487b417e6e7aa8ff5751',
  },
  {
    name: 'P2xxx_enriched.yaml',
    sha256: 'aceeccaf838e23539077fe0eea06b94d399474d844af1b2ac18cc86119a446a6',
  },
  {
    name: 'P3xxx_enriched.yaml',
    sha256: 'bc5264a0c66f982474816bf3b76527ade1f00a321f21a1ce4c657b9b0c560e0f',
  },
  {
    name: 'B0xxx_enriched.yaml',
    sha256: '414c00f8abede7d6b3c8e2eaf2ffc412ed67d7ed1cb6ea3a48a1d211d754b9c3',
  },
  {
    name: 'C0xxx_enriched.yaml',
    sha256: '70a08cacade9ebc2229bde582827732f46d44af17ad26a62a588196b87f0e067',
  },
  {
    name: 'U0xxx_enriched.yaml',
    sha256: '83a88aed8025c60bbaf7ad0846b4069f152aee110580c71a2506e244aab8c3d9',
  },
  {
    name: 'U3xxx_enriched.yaml',
    sha256: '145c5c379f3cccf50c1fb315daa99c8adc1e37283d325d4c09168eae28074a03',
  },
];

export function rawUrl(fileName) {
  return `https://raw.githubusercontent.com/${REPOSITORY}/${PINNED_COMMIT}/data/generic/${fileName}`;
}
