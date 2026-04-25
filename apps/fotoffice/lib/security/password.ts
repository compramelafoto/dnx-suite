import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { compareSync } from "bcryptjs";

const KEY_LEN = 64;
const BCRYPT_PREFIX_REGEX = /^\$2[aby]\$/;

/** Hash compatible con el seed del monorepo (`scrypt` + `salt:hex`). */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(plain, salt, KEY_LEN).toString("hex");
  return `${salt}:${digest}`;
}

export function verifyPassword(plain: string, encoded: string): boolean {
  if (BCRYPT_PREFIX_REGEX.test(encoded)) return compareSync(plain, encoded);
  const [salt, stored] = encoded.split(":");
  if (!salt || !stored) return false;
  const digest = scryptSync(plain, salt, KEY_LEN).toString("hex");
  const a = Buffer.from(stored, "hex");
  const b = Buffer.from(digest, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
