#!/usr/bin/env node

/**
 * CLI utility to generate Ed25519 signing keys, sign remote configuration files,
 * and verify signed configuration envelopes for the OBD Diagnose desktop application.
 *
 * Usage:
 *   node tools/sign-remote-config.mjs --generate-keys
 *   node tools/sign-remote-config.mjs --config config.json --key <PRIVATE_KEY_PKCS8_BASE64> --out config.signed.json
 *   node tools/sign-remote-config.mjs --verify config.signed.json --pubkey <PUBLIC_KEY_RAW_BASE64>
 */

import fs from 'node:fs';
import path from 'node:path';

function base64ToBytes(base64) {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

function canonicalJsonStringify(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJsonStringify).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  const pairs = keys.map((k) => `${JSON.stringify(k)}:${canonicalJsonStringify(obj[k])}`);
  return '{' + pairs.join(',') + '}';
}

async function generateKeys() {
  const keyPair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const pubRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const privPkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  const pubB64 = bytesToBase64(new Uint8Array(pubRaw));
  const privB64 = bytesToBase64(new Uint8Array(privPkcs8));

  console.log('\n--- Generated Ed25519 Keypair ---');
  console.log('PUBLIC KEY (Raw Base64, embed in client):');
  console.log(pubB64);
  console.log('\nPRIVATE KEY (PKCS#8 Base64, keep SECRET, never commit):');
  console.log(privB64);
  console.log('--------------------------------\n');
}

async function signConfigFile(configPath, privateKeyB64, outPath) {
  const content = fs.readFileSync(path.resolve(configPath), 'utf8');
  const parsed = JSON.parse(content);

  // If already in an envelope, extract config
  const config = parsed.config ?? parsed;

  if (!config.issued_at) {
    config.issued_at = new Date().toISOString();
  }

  const canonical = canonicalJsonStringify(config);
  const privBytes = base64ToBytes(privateKeyB64);
  const privKey = await crypto.subtle.importKey('pkcs8', privBytes, 'Ed25519', false, ['sign']);
  const sigBuffer = await crypto.subtle.sign(
    'Ed25519',
    privKey,
    new TextEncoder().encode(canonical),
  );
  const signature = bytesToBase64(new Uint8Array(sigBuffer));

  const envelope = {
    config,
    signature,
  };

  const outputJson = JSON.stringify(envelope, null, 2);
  if (outPath) {
    fs.writeFileSync(path.resolve(outPath), outputJson, 'utf8');
    console.log(`Successfully signed config written to: ${outPath}`);
  } else {
    console.log(outputJson);
  }
}

async function verifyEnvelope(filePath, publicKeyB64) {
  const content = fs.readFileSync(path.resolve(filePath), 'utf8');
  const envelope = JSON.parse(content);

  if (!envelope.config || !envelope.signature) {
    console.error('Error: Envelope missing "config" or "signature" fields.');
    process.exit(1);
  }

  const canonical = canonicalJsonStringify(envelope.config);
  const pubBytes = base64ToBytes(publicKeyB64);
  const pubKey = await crypto.subtle.importKey('raw', pubBytes, 'Ed25519', false, ['verify']);
  const sigBytes = base64ToBytes(envelope.signature);

  const isValid = await crypto.subtle.verify(
    'Ed25519',
    pubKey,
    sigBytes,
    new TextEncoder().encode(canonical),
  );

  if (isValid) {
    console.log('OK: Signature is VALID.');
    console.log(`App Enabled: ${envelope.config.app_enabled}`);
    console.log(`Min Version: ${envelope.config.min_version}`);
    console.log(`Issued At: ${envelope.config.issued_at}`);
    process.exit(0);
  } else {
    console.error('FAILED: Signature is INVALID or payload has been tampered with.');
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--generate-keys')) {
    await generateKeys();
    return;
  }

  const configIdx = args.indexOf('--config');
  const keyIdx = args.indexOf('--key');
  const outIdx = args.indexOf('--out');

  if (configIdx !== -1 && keyIdx !== -1) {
    const configPath = args[configIdx + 1];
    const key = args[keyIdx + 1];
    const outPath = outIdx !== -1 ? args[outIdx + 1] : null;
    await signConfigFile(configPath, key, outPath);
    return;
  }

  const verifyIdx = args.indexOf('--verify');
  const pubKeyIdx = args.indexOf('--pubkey');
  if (verifyIdx !== -1 && pubKeyIdx !== -1) {
    const filePath = args[verifyIdx + 1];
    const pubKey = args[pubKeyIdx + 1];
    await verifyEnvelope(filePath, pubKey);
    return;
  }

  console.log(`Usage:
  node tools/sign-remote-config.mjs --generate-keys
  node tools/sign-remote-config.mjs --config <config.json> --key <PRIVATE_KEY_B64> [--out <signed.json>]
  node tools/sign-remote-config.mjs --verify <signed.json> --pubkey <PUBLIC_KEY_B64>
`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
