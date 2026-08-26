import "server-only";
import { prisma } from "@repo/db";
import { addMonthsUtc, CARNET_VALIDITY_MONTHS } from "./template";
import { nextCardSequence } from "./sequence";
import { formatCardNumber, generateCardToken, hashCardToken } from "./token";
import { sealCardToken } from "./token-vault";

/**
 * Emisión de carnets.
 *
 * El **digital no genera archivos**: es una página web, así que emitirlo es crear el registro
 * y el token. Los archivos —PDF de imprenta y PNG de cada cara— son de la tarjeta impresa y
 * se generan cuando alguien la pide y la paga.
 */

export type IssuedCard = {
  cardId: string;
  cardNumber: string;
  /** En claro **solo acá**: es lo único que va dentro del QR y no se vuelve a poder leer. */
  token: string;
  validUntil: Date;
};

export type IssueResult =
  | { ok: true; card: IssuedCard; created: true }
  | { ok: true; card: null; created: false; reason: string }
  | { ok: false; error: string };

const MAX_INTENTOS = 5;

/**
 * Emite el carnet digital de un socio, si todavía no tiene uno vigente.
 *
 * Es idempotente por diseño: llamarla dos veces no crea dos carnets. Eso importa porque se
 * la va a llamar en tanda sobre todo el padrón, y una tanda que se corta a la mitad tiene
 * que poder volver a correrse entera.
 */
export async function issueDigitalCard(input: {
  workspaceId: string;
  memberId: string;
  now?: Date;
}): Promise<IssueResult> {
  const ahora = input.now ?? new Date();

  const socio = await prisma.member.findFirst({
    where: { id: input.memberId, workspaceId: input.workspaceId },
    select: { id: true, status: true, avatarUrl: true },
  });
  if (!socio) return { ok: false, error: "No encontramos al socio." };
  if (socio.status !== "ACTIVE") {
    return { ok: true, card: null, created: false, reason: "el socio no está activo" };
  }

  const vigente = await prisma.memberCard.findFirst({
    where: {
      memberId: input.memberId,
      format: "DIGITAL",
      revokedAt: null,
      validUntil: { gt: ahora },
    },
    select: { id: true },
  });
  if (vigente) {
    return { ok: true, card: null, created: false, reason: "ya tiene un carnet vigente" };
  }

  const validUntil = addMonthsUtc(ahora, CARNET_VALIDITY_MONTHS);
  let ultimoError: unknown = null;

  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    // El token se genera nuevo en cada intento: si el choque fue por el hash —astronómicamente
    // improbable pero posible— reintentar con el mismo volvería a chocar para siempre.
    const token = generateCardToken();
    try {
      const emitidos = await prisma.memberCard.findMany({
        where: { workspaceId: input.workspaceId },
        select: { cardNumber: true },
      });
      const cardNumber = formatCardNumber(
        ahora.getUTCFullYear(),
        nextCardSequence(
          emitidos.map((c) => c.cardNumber),
          ahora.getUTCFullYear(),
        ),
      );

      const creado = await prisma.memberCard.create({
        data: {
          workspaceId: input.workspaceId,
          memberId: input.memberId,
          cardNumber,
          tokenHash: hashCardToken(token),
          // Cifrado además de hasheado: el hash sirve para buscar al escanear, el cifrado
          // para poder mostrarle al socio su propio QR.
          ...sealedColumns(token),
          format: "DIGITAL",
          issuedAt: ahora,
          validUntil,
        },
        select: { id: true, cardNumber: true },
      });

      return {
        ok: true,
        created: true,
        card: { cardId: creado.id, cardNumber: creado.cardNumber, token, validUntil },
      };
    } catch (error) {
      ultimoError = error;
      // P2002 = choque de restricción única: otra emisión tomó ese número. Se reintenta.
      if ((error as { code?: string })?.code !== "P2002") throw error;
    }
  }

  throw ultimoError ?? new Error("No se pudo emitir el carnet.");
}

export type BulkIssueReport = {
  emitidos: number;
  yaTenian: number;
  omitidos: number;
};

/**
 * Emite el carnet digital de todos los socios activos que no tengan uno vigente.
 *
 * De a uno y no en una transacción gigante: si falla el socio 200, los 199 anteriores ya
 * tienen su carnet y volver a correrla no los duplica.
 */
export async function issueMissingDigitalCards(
  workspaceId: string,
  opciones: { now?: Date; limit?: number } = {},
): Promise<BulkIssueReport> {
  const ahora = opciones.now ?? new Date();
  const socios = await prisma.member.findMany({
    where: { workspaceId, status: "ACTIVE" },
    select: { id: true },
    orderBy: { memberNumber: "asc" },
    take: opciones.limit ?? 1000,
  });

  const reporte: BulkIssueReport = { emitidos: 0, yaTenian: 0, omitidos: 0 };
  for (const socio of socios) {
    const r = await issueDigitalCard({ workspaceId, memberId: socio.id, now: ahora });
    if (!r.ok) {
      reporte.omitidos += 1;
      continue;
    }
    if (r.created) reporte.emitidos += 1;
    else if (r.reason === "ya tiene un carnet vigente") reporte.yaTenian += 1;
    else reporte.omitidos += 1;
  }
  return reporte;
}

function sealedColumns(token: string): {
  tokenCiphertext: string;
  tokenNonce: string;
  tokenAuthTag: string;
} {
  const sellado = sealCardToken(token);
  return {
    tokenCiphertext: sellado.ciphertext,
    tokenNonce: sellado.nonce,
    tokenAuthTag: sellado.authTag,
  };
}
