import { verifyEd25519 } from '../remoteConfig/crypto';
import type { DtcSeedFile } from './dtcPack';
import type { SqlExecutor } from './sql';

export interface DtcPackUpdateResult {
  appliedVersion: string;
  totalCodes: number;
  preservedReviews: number;
}

/**
 * Validates and applies a versioned DTC data pack update within an atomic SQLite transaction.
 *
 * Rules:
 * 1. Verifies the Ed25519 signature against the raw pack JSON text.
 * 2. Runs inside a single transaction so failure rolls back completely.
 * 3. Never overwrites human-reviewed translations (where needs_review = 0).
 * 4. Records the applied pack version in the `settings` table (`dtc_pack_version`).
 */
export async function applyDtcPackUpdate(
  db: SqlExecutor,
  pack: DtcSeedFile,
  packRawJson: string,
  signatureBase64: string,
  publicKeyBase64: string,
): Promise<DtcPackUpdateResult> {
  // 1. Verify Ed25519 signature
  const isSignatureValid = await verifyEd25519(publicKeyBase64, signatureBase64, packRawJson);
  if (!isSignatureValid) {
    throw new Error('DTC pack signature verification failed — file is corrupt or untrusted');
  }

  if (!pack.version || !Array.isArray(pack.codes) || pack.codes.length === 0) {
    throw new Error('DTC pack content is invalid or contains no codes');
  }

  let preservedReviews = 0;
  const now = new Date().toISOString();

  // 2. Atomic transaction update
  await db.transaction(async () => {
    // Find all codes with human-verified translations to protect them
    const existingReviewed = await db.select<{ code: string }>(
      'SELECT code FROM dtc_codes WHERE needs_review = 0 AND deleted_at IS NULL',
    );
    const protectedCodes = new Set(existingReviewed.map((r) => r.code));
    preservedReviews = protectedCodes.size;

    for (const item of pack.codes) {
      const isProtected = protectedCodes.has(item.code);

      if (isProtected) {
        // Only update English text, severity, and pack metadata; preserve Arabic review
        await db.execute(
          `UPDATE dtc_codes SET
            description_en = $1,
            severity = $2,
            possible_causes_en = $3,
            inspection_steps_en = $4,
            source_version = $5,
            updated_at = $6
           WHERE code = $7 AND make IS NULL`,
          [
            item.descriptionEn,
            item.severity,
            JSON.stringify(item.causesEn ?? []),
            JSON.stringify(item.stepsEn ?? []),
            pack.version,
            now,
            item.code,
          ],
        );
      } else {
        // Insert or replace unreviewed row
        const id = `dtc-${item.code.toLowerCase()}`;
        await db.execute(
          `INSERT INTO dtc_codes (
            id, code, make, description_en, description_ar, severity, severity_source,
            possible_causes_en, possible_causes_ar, inspection_steps_en, inspection_steps_ar,
            source, source_version, translation_tier, needs_review, reviewed_by, reviewed_at,
            created_at, updated_at, deleted_at
          ) VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $17, NULL)
          ON CONFLICT(id) DO UPDATE SET
            description_en = excluded.description_en,
            description_ar = excluded.description_ar,
            severity = excluded.severity,
            severity_source = excluded.severity_source,
            possible_causes_en = excluded.possible_causes_en,
            possible_causes_ar = excluded.possible_causes_ar,
            inspection_steps_en = excluded.inspection_steps_en,
            inspection_steps_ar = excluded.inspection_steps_ar,
            source_version = excluded.source_version,
            translation_tier = excluded.translation_tier,
            needs_review = excluded.needs_review,
            updated_at = excluded.updated_at`,
          [
            id,
            item.code,
            item.descriptionEn,
            item.descriptionAr,
            item.severity,
            item.severitySource ?? 'heuristic',
            JSON.stringify(item.causesEn ?? []),
            JSON.stringify(item.causesAr ?? []),
            JSON.stringify(item.stepsEn ?? []),
            JSON.stringify(item.stepsAr ?? []),
            pack.source ?? 'OBDex',
            pack.version,
            item.tier ?? 2,
            item.needsReview ? 1 : 0,
            item.reviewedBy ?? null,
            item.reviewedAt ?? null,
            now,
          ],
        );
      }
    }

    // 3. Record new pack version in settings table
    const settingId = 'setting-dtc-pack-version';
    await db.execute(
      `INSERT INTO settings (id, key, value, created_at, updated_at, deleted_at)
       VALUES ($1, 'dtc_pack_version', $2, $3, $3, NULL)
       ON CONFLICT(key) DO UPDATE SET value = $2, updated_at = $3`,
      [settingId, pack.version, now],
    );
  });

  return {
    appliedVersion: pack.version,
    totalCodes: pack.codes.length,
    preservedReviews,
  };
}
