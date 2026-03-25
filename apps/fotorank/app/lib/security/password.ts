import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { compareSync } from "bcryptjs";

const KEY_LEN = 64;
const BCRYPT_PREFIX_REGEX = /^\$2[aby]\$/;

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(plain, salt, KEY_LEN).toString("hex");
  return `${salt}:${digest}`;
}

export function verifyPassword(plain: string, encoded: string): boolean {
  if (isBcryptHash(encoded)) return compareSync(plain, encoded);
  return verifyScryptPassword(plain, encoded);
}

function isBcryptHash(encoded: string): boolean {
  return BCRYPT_PREFIX_REGEX.test(encoded);
}

function verifyScryptPassword(plain: string, encoded: string): boolean {
  const [salt, stored] = encoded.split(":");
  if (!salt || !stored) return false;
  const digest = scryptSync(plain, salt, KEY_LEN).toString("hex");
  const a = Buffer.from(stored, "hex");
  const b = Buffer.from(digest, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
