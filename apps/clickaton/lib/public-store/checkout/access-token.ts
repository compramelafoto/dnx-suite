import { createHash, randomBytes } from "node:crypto";

const PUBLIC_ID_PREFIX = "sto_";

export function generateStoreOrderPublicId(): string {
  return `${PUBLIC_ID_PREFIX}${randomBytes(18).toString("base64url")}`;
}

export function generateStoreOrderAccessToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashStoreOrderAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function maskEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const [user, domain] = trimmed.split("@");
  if (!user || !domain) return "***";
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}***@${domain}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***${digits.slice(-4)}`;
}

export const STORE_ORDER_ACCESS_COOKIE = "ck_store_order_access";
