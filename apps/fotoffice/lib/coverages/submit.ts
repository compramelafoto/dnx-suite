import "server-only";
import { Prisma, prisma } from "@repo/db";
import { findOrCreateClient } from "@/lib/clients/find-or-create";
import { recordEvent } from "./events";
import { nextPublicCode } from "./public-code";
import {
  generateTrackingToken,
  hashTrackingToken,
  trackingExpiryFrom,
} from "./tracking-token";
import type { ParsedConsent } from "./consents";
import type { ParsedRequest } from "./request-form";
import type { CoverageSettingsShape } from "./settings";

/**
 * Guarda la solicitud entera, o nada.
 *
 * Todo en una transacción por una razón concreta: la organización se crea o se reconoce en el
 * padrón de clientes, y un cliente creado con una solicitud que falló deja basura que después
 * alguien tiene que limpiar a mano. Es el mismo criterio con el que `findOrCreateClient` pide
 * una transacción en vez del cliente global.
 *
 * Devuelve el token **crudo**: es la única vez que existe. En la base queda su SHA-256.
 */
export async function saveCoverageRequest(input: {
  workspaceId: string;
  parsed: ParsedRequest;
  consents: ParsedConsent[];
  settings: CoverageSettingsShape;
  originHash: string | null;
  userAgent: string | null;
  now?: Date;
}): Promise<{ requestId: string; publicCode: string; rawToken: string }> {
  const ahora = input.now ?? new Date();

  // El correlativo se calcula leyendo el último `publicCode` y sumando uno, y dos envíos
  // casi simultáneos del formulario público pueden leer el mismo último: no es una carrera
  // teórica, es el mismo caso que ya resuelven `saveClientAction` y `findOrCreateClient` en
  // `lib/clients/` reintentando contra el índice único en vez de inventar un bloqueo o una
  // tabla de secuencias.
  //
  // Cada intento abre su propia `$transaction`, no reintenta dentro de una que ya falló:
  // en Postgres, una transacción que tuvo un error queda abortada y cualquier consulta
  // posterior en esa misma transacción también falla ("current transaction is aborted"),
  // así que reintentar el `create` ahí adentro no serviría de nada. Abrir una transacción
  // nueva por intento no rompe la garantía de que el `Client` y la `CoverageRequest` nacen
  // juntos o no nace ninguno: cada intento sigue siendo, en sí mismo, todo o nada, y si el
  // `create` choca, esa transacción entera se revierte (incluido un `Client` que se haya
  // creado recién) antes de que empiece el intento siguiente.
  for (let intento = 0; intento < 3; intento++) {
    const rawToken = generateTrackingToken();

    try {
      return await prisma.$transaction(async (tx) => {
        const cliente = await findOrCreateClient(tx, {
          workspaceId: input.workspaceId,
          email: input.parsed.contactEmail,
          phone: input.parsed.contactPhone,
          docNumber: input.parsed.orgTaxId,
          businessName: input.parsed.orgName,
        });

        const ultimo = await tx.coverageRequest.findFirst({
          where: {
            workspaceId: input.workspaceId,
            publicCode: { startsWith: `SC-${ahora.getFullYear()}-` },
          },
          orderBy: { publicCode: "desc" },
          select: { publicCode: true },
        });

        const solicitud = await tx.coverageRequest.create({
          data: {
            workspaceId: input.workspaceId,
            clientId: cliente.id,
            publicCode: nextPublicCode(ultimo?.publicCode ?? null, ahora.getFullYear()),
            tokenHash: hashTrackingToken(rawToken),
            tokenExpiresAt: trackingExpiryFrom(input.settings.trackingLinkTtlDays, ahora),
            eventTitle: input.parsed.eventTitle,
            eventDescription: input.parsed.eventDescription,
            startsAt: input.parsed.startsAt,
            endsAt: input.parsed.endsAt,
            addressLine: input.parsed.addressLine,
            city: input.parsed.city,
            activityKind: input.parsed.activityKind,
            expectedAttendees: input.parsed.expectedAttendees,
            venueKind: input.parsed.venueKind,
            onSiteContactName: input.parsed.onSiteContactName,
            onSitePhone: input.parsed.onSitePhone,
            mediaKinds: input.parsed.mediaKinds,
            coverageKind: input.parsed.coverageKind,
            purpose: input.parsed.purpose,
            keyMoments: input.parsed.keyMoments,
            requestedPhotographers: input.parsed.requestedPhotographers,
            equipmentNotes: input.parsed.equipmentNotes,
            needsLighting: input.parsed.needsLighting,
            expectedDeliveryAt: input.parsed.expectedDeliveryAt,
            deliveryChannel: input.parsed.deliveryChannel,
            notes: input.parsed.notes,
            documentationLinks: input.parsed.documentationLinks,
            status: "RECIBIDA",
            consents: {
              create: input.consents.map((c) => ({
                kind: c.kind,
                granted: c.granted,
                textVersion: c.textVersion,
                textHash: c.textHash,
                sourceHash: input.originHash,
                userAgent: input.userAgent,
              })),
            },
          },
          select: { id: true, publicCode: true },
        });

        await recordEvent(tx, {
          workspaceId: input.workspaceId,
          entityType: "REQUEST",
          entityId: solicitud.id,
          type: "CREADA",
          toStatus: "RECIBIDA",
          // Sin actor: la cargó alguien de afuera, que no tiene usuario.
          actorLabel: input.parsed.orgName,
        });

        return { requestId: solicitud.id, publicCode: solicitud.publicCode, rawToken };
      });
    } catch (e) {
      // P2002 = choque con un índice único. Puede ser `publicCode` (el caso que nos
      // ocupa) o, en una coincidencia astronómicamente más rara, `tokenHash`; en ambos
      // casos el intento siguiente parte de datos frescos porque generamos un `rawToken`
      // nuevo y releemos el último `publicCode` dentro de la transacción nueva.
      const choque = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!choque) throw e;
    }
  }

  throw new Error("No se pudo asignar un número de solicitud después de tres intentos.");
}
