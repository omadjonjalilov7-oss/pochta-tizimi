import * as crypto from 'crypto';

/**
 * Tashqi pochta parollarini bazada xavfsiz saqlash uchun
 * AES-256-GCM shifrlash. Kalit `.env`dan o'qiladi (EXTERNAL_MAIL_ENCRYPTION_KEY).
 *
 * Format: base64( iv (12 bayt) + authTag (16 bayt) + ciphertext )
 */

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const hex = process.env.EXTERNAL_MAIL_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'EXTERNAL_MAIL_ENCRYPTION_KEY .env da topilmadi yoki uzunligi 64 hex belgi emas (32 bayt)',
    );
  }
  return Buffer.from(hex, 'hex');
}

export function encryptSecret(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

export function decryptSecret(encoded: string): string {
  const key = getKey();
  const buf = Buffer.from(encoded, 'base64');
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error('Shifrlangan parol formati noto\'g\'ri');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}
