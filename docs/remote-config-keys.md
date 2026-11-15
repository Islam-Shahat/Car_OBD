# Remote Configuration Security & Key Management Guide

Date: 2026-11-15  
Status: Active

---

## 1. Overview

The OBD Diagnose desktop application uses **Ed25519 digital signatures** to securely manage remote control, feature gating, emergency disabling, and update policies.

Because the desktop application runs offline on end-user machines, security relies on an asymmetric cryptographic trust boundary:

- **Public Key**: Embedded directly in the application binary (`DEFAULT_REMOTE_CONFIG_PUBLIC_KEY`). It is public information and used only for verification.
- **Private Key**: Held offline by project maintainers and stored in secure CI secrets (`ED25519_CONFIG_SIGNING_KEY`). **The private key is never committed to git or bundled in the client application.**

---

## 2. Remote Configuration Schema

Remote configuration is hosted as a static JSON file on GitHub Pages or Cloudflare Pages (`config.json`), wrapped in a signed envelope:

```json
{
  "config": {
    "app_enabled": true,
    "min_version": "0.1.0",
    "latest_version": "0.1.1",
    "message": {
      "ar": "النظام يعمل بشكل طبيعي",
      "en": "All systems operational"
    },
    "features": {
      "clear_codes": true,
      "live_data": true,
      "pre_purchase_report": true
    },
    "dtc_pack": {
      "version": "1.1.0",
      "url": "https://example.com/dtc-pack-v1.1.0.json",
      "signature": "..."
    },
    "issued_at": "2026-11-15T12:00:00.000Z"
  },
  "signature": "<base64_ed25519_signature>"
}
```

### Safety Principles:

1. **Deterministic Canonical Hashing**: The signature is generated over a canonical representation with lexicographically sorted keys.
2. **Anti-Rollback**: Every valid config contains an `issued_at` ISO 8601 timestamp. The client rejects any configuration with an `issued_at` timestamp older than the currently cached version.
3. **Fail-Open & Offline Grace**: If the user is offline or the remote endpoint is unreachable, the client falls back to the last cryptographically verified config cached in local SQLite. On a brand-new offline installation with no cache, safe defaults are used.
4. **Tamper Rejection**: Any modification to values, flags, or messages immediately invalidates the Ed25519 signature; the application rejects the payload and logs the anomaly.
5. **In-Flight Operation Protection**: A new remote config that disables features or clears is never applied during an active scan or code clearing operation; changes are staged and applied when the operation concludes.

---

## 3. Signing Tooling (`tools/sign-remote-config.mjs`)

The repository includes a dedicated CLI tool:

### Generating a New Keypair

```bash
node tools/sign-remote-config.mjs --generate-keys
```

### Signing a Remote Config

```bash
node tools/sign-remote-config.mjs \
  --config ./config.json \
  --key $ED25519_CONFIG_SIGNING_KEY \
  --out ./public-config/config.json
```

### Verifying a Signed Envelope

```bash
node tools/sign-remote-config.mjs \
  --verify ./public-config/config.json \
  --pubkey ZVRZNYrjEECIBwbxasdiuqIXMIIpVv2aD7YEcfNAwQs=
```

---

## 4. Key Storage and Rotation Rules

1. **GitHub Secrets**:
   - `ED25519_CONFIG_SIGNING_KEY`: Store the Base64 PKCS#8 private key in the repository's GitHub Action Secrets.
2. **Key Rotation**:
   - If the private key is suspected of being compromised, generate a new key pair.
   - Update `DEFAULT_REMOTE_CONFIG_PUBLIC_KEY` in `src/lib/remoteConfig/defaults.ts` and release an update with bumped `min_version`.
3. **Strict Ban**:
   - Never paste the private key into issues, commit messages, or chat transcripts.
