import { createHash, randomBytes, randomInt } from "node:crypto";
import { prisma, type Role } from "@/lib/prisma";

/**
 * DNX FLUX en CLF (modo agencia, etapa 3a): el fotógrafo genera un código corto en "Mis agencias" y DNX FLUX lo
 * canjea por una llave de dispositivo `clf_dev_…`. Del código y de la llave sólo se guarda el SHA-256; la llave
 * completa se devuelve una sola vez. La llave es del usuario: el acceso a cada agencia se chequea en cada pedido.
 */

export const DEVICE_KEY_PREFIX = "clf_dev_";
const DEVICE_KEY_FORMAT = /^clf_dev_[A-Za-z0-9_-]{43}$/;
export const LINK_CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_ACTIVE_DEVICE_KEYS = 10;
export const MAX_DEVICE_LABEL = 60;
/** Sin 0/O ni 1/I para que no se confundan al tipear. */
const LINK_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LINK_CODE_LENGTH = 8;
/** El último uso se actualiza como mucho cada 5 minutos. */
const LAST_USED_EVERY_MS = 5 * 60 * 1000;

export const FLUX_KEY_MESSAGES = {
  codeInvalid: "El código no es válido o ya venció. Generá uno nuevo en ComprameLaFoto (Agencias → Mis agencias).",
  tooManyDevices: `Ya tenés ${MAX_ACTIVE_DEVICE_KEYS} computadoras vinculadas. Desvinculá alguna en Agencias → Mis agencias.`,
  notMember: "Para vincular DNX FLUX tenés que ser parte del equipo de una agencia.",
} as const;

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function generateLinkCode(): { code: string; display: string; hash: string } {
  let code = "";
  for (let i = 0; i < LINK_CODE_LENGTH; i += 1) code += LINK_CODE_ALPHABET[randomInt(LINK_CODE_ALPHABET.length)];
  return { code, display: `${code.slice(0, 4)}-${code.slice(4)}`, hash: sha256Hex(code) };
}

/** "k7qm-4pxt" → "K7QM4PXT"; null si no puede ser un código. */
export function normalizeLinkCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const c = input.toUpperCase().replace(/[\s-]/g, "");
  if (c.length !== LINK_CODE_LENGTH) return null;
  for (const ch of c) if (!LINK_CODE_ALPHABET.includes(ch)) return null;
  return c;
}

export function generateDeviceKey(): { key: string; hash: string; prefix: string } {
  const secret = randomBytes(32).toString("base64url");
  const key = `${DEVICE_KEY_PREFIX}${secret}`;
  return { key, hash: sha256Hex(key), prefix: secret.slice(0, 8) };
}

export function normalizeDeviceLabel(input: unknown): string {
  const t = typeof input === "string" ? input.replace(/\s+/g, " ").trim().slice(0, MAX_DEVICE_LABEL) : "";
  return t || "Computadora";
}

export async function userCanLinkFlux(userId: number): Promise<boolean> {
  return (await prisma.agencyMember.count({ where: { userId, status: "ACTIVE" } })) > 0;
}

export async function issueLinkCode(userId: number, now: Date = new Date()): Promise<{ code: string; expiresAt: Date }> {
  const c = generateLinkCode();
  const expiresAt = new Date(now.getTime() + LINK_CODE_TTL_MS);
  await prisma.$transaction([
    prisma.agencyLinkCode.updateMany({ where: { userId, usedAt: null, expiresAt: { gt: now } }, data: { expiresAt: now } }),
    prisma.agencyLinkCode.create({ data: { userId, codeHash: c.hash, expiresAt } }),
  ]);
  return { code: c.display, expiresAt };
}

export async function redeemLinkCode(
  rawCode: unknown,
  rawLabel: unknown,
  now: Date = new Date()
): Promise<{ ok: true; key: string; deviceKeyId: number; userId: number } | { ok: false; status: 400 | 409; error: string }> {
  const code = normalizeLinkCode(rawCode);
  if (!code) return { ok: false, status: 400, error: FLUX_KEY_MESSAGES.codeInvalid };
  const label = normalizeDeviceLabel(rawLabel);
  return prisma.$transaction(async (tx) => {
    const row = await tx.agencyLinkCode.findUnique({
      where: { codeHash: sha256Hex(code) },
      select: { id: true, userId: true, usedAt: true, expiresAt: true },
    });
    if (!row || row.usedAt || row.expiresAt.getTime() <= now.getTime()) {
      return { ok: false as const, status: 400 as const, error: FLUX_KEY_MESSAGES.codeInvalid };
    }
    // El tope se mira antes de gastar el código: si está lleno, puede desvincular una y reusar el mismo código.
    const active = await tx.agencyDeviceKey.count({ where: { userId: row.userId, revokedAt: null } });
    if (active >= MAX_ACTIVE_DEVICE_KEYS) {
      return { ok: false as const, status: 409 as const, error: FLUX_KEY_MESSAGES.tooManyDevices };
    }
    // Marca de usado con condición: si llegan dos canjes juntos, gana uno solo.
    const claimed = await tx.agencyLinkCode.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
    if (claimed.count !== 1) return { ok: false as const, status: 400 as const, error: FLUX_KEY_MESSAGES.codeInvalid };
    const k = generateDeviceKey();
    const device = await tx.agencyDeviceKey.create({
      data: { userId: row.userId, keyHash: k.hash, keyPrefix: k.prefix, label },
      select: { id: true },
    });
    await tx.agencyLinkCode.update({ where: { id: row.id }, data: { deviceKeyId: device.id } });
    return { ok: true as const, key: k.key, deviceKeyId: device.id, userId: row.userId };
  });
}

export type FluxDeviceCtx = { deviceKeyId: number; userId: number; role: Role };

/** `Authorization: Bearer clf_dev_…` → llave vigente, o null (sin decir por qué). */
export async function authenticateAgencyDevice(authorization: string | null, now: Date = new Date()): Promise<FluxDeviceCtx | null> {
  if (!authorization) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
  if (!m || !DEVICE_KEY_FORMAT.test(m[1])) return null;
  const row = await prisma.agencyDeviceKey.findUnique({
    where: { keyHash: sha256Hex(m[1]) },
    select: { id: true, userId: true, revokedAt: true, user: { select: { role: true } } },
  });
  if (!row || row.revokedAt) return null;
  void prisma.agencyDeviceKey
    .updateMany({
      where: { id: row.id, revokedAt: null, OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: new Date(now.getTime() - LAST_USED_EVERY_MS) } }] },
      data: { lastUsedAt: now },
    })
    .catch(() => undefined);
  return { deviceKeyId: row.id, userId: row.userId, role: row.user.role };
}

export type FluxDeviceView = { id: number; label: string; keyPrefix: string; createdAt: string; lastUsedAt: string | null };

export async function listDeviceKeys(userId: number): Promise<FluxDeviceView[]> {
  const rows = await prisma.agencyDeviceKey.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, keyPrefix: true, createdAt: true, lastUsedAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    keyPrefix: r.keyPrefix,
    createdAt: r.createdAt.toISOString(),
    lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
  }));
}

export async function revokeDeviceKey(userId: number, id: number): Promise<boolean> {
  const r = await prisma.agencyDeviceKey.updateMany({ where: { id, userId, revokedAt: null }, data: { revokedAt: new Date() } });
  return r.count === 1;
}
