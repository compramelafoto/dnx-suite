import "server-only";

import { prisma } from "@/lib/admin/db";

/**
 * Crea una copia descartable de una edición para el ensayo completo.
 *
 * La copia nace con `isOpsFixture: true`, que el resto de la plataforma ya usa
 * para dejarla afuera del home, del listado público y de la oferta de packs, y
 * que es además la condición que exige el guardián del borrado.
 *
 * Se copia sólo lo que el recorrido del participante necesita. Nada de sedes
 * con datos de terceros, sponsors, banners ni contenidos.
 */

export type ResultadoDeClonado =
  | { ok: true; copiaId: string; copiaSlug: string; copiaNombre: string }
  | { ok: false; mensaje: string };

export async function clonarEdicionParaEnsayo(editionId: string): Promise<ResultadoDeClonado> {
  const original = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    include: {
      pricePhases: { where: { isActive: true } },
      ticketTypes: { where: { isActive: true } },
      prompts: { orderBy: { sequence: "asc" } },
      timelines: { where: { status: "ACTIVE" }, take: 1, include: { events: true } },
      uploadConfig: true,
      accreditationConfig: true,
      admissionConfig: true,
    },
  });

  if (!original) return { ok: false, mensaje: "No encontramos esa edición." };

  const marca = Date.now();
  const copiaSlug = `${original.slug}-ensayo-${marca}`;
  const copiaNombre = `[ENSAYO] ${original.name}`;

  try {
    const copia = await prisma.$transaction(async (tx) => {
      const nueva = await tx.clickatonEdition.create({
        data: {
          name: copiaNombre,
          slug: copiaSlug,
          shortDescription: original.shortDescription,
          description: original.description,
          status: "DRAFT",
          isPublished: false,
          // La marca que hace descartable a esta edición. Sin esto, el
          // guardián del borrado se niega a tocarla.
          isOpsFixture: true,
          registrationEnabled: original.registrationEnabled,
          timezone: original.timezone,
          startAt: original.startAt,
          endAt: original.endAt,
          registrationOpenAt: original.registrationOpenAt,
          registrationCloseAt: original.registrationCloseAt,
          defaultCapacity: original.defaultCapacity,
          location: original.location,
          city: original.city,
          provinceOrState: original.provinceOrState,
          country: original.country,
          currency: original.currency,
          visibleCodePrefix: original.visibleCodePrefix,
          rulesConfig: original.rulesConfig ?? undefined,
        },
        select: { id: true },
      });

      for (const fase of original.pricePhases) {
        await tx.clickatonRegistrationPricePhase.create({
          data: {
            editionId: nueva.id,
            name: fase.name,
            description: fase.description,
            amount: fase.amount,
            currency: fase.currency,
            startsAt: fase.startsAt,
            endsAt: fase.endsAt,
            capacity: fase.capacity,
            priority: fase.priority,
            isActive: fase.isActive,
          },
        });
      }

      for (const entrada of original.ticketTypes) {
        await tx.clickatonTicketType.create({
          data: {
            editionId: nueva.id,
            venueId: null,
            name: entrada.name,
            description: entrada.description,
            code: entrada.code,
            /**
             * En la copia las entradas valen cero, a propósito: así el ensayo
             * recorre todo el camino sin pasar por Mercado Pago y sin mover un
             * peso. Que el precio real esté bien lo verifican el chequeo y el
             * ensayo en seco, que sí miran el importe y la fase vigente.
             */
            priceAmount: 0,
            currency: entrada.currency,
            capacity: entrada.capacity,
            holdMinutes: entrada.holdMinutes,
            isActive: entrada.isActive,
            salesStartAt: entrada.salesStartAt,
            salesEndAt: entrada.salesEndAt,
          },
        });
      }

      const cronograma = original.timelines[0];
      if (cronograma) {
        const nuevoCronograma = await tx.clickatonEditionTimeline.create({
          data: {
            editionId: nueva.id,
            version: 1,
            status: "ACTIVE",
            timezone: cronograma.timezone,
            activatedAt: new Date(),
          },
          select: { id: true },
        });
        for (const evento of cronograma.events) {
          await tx.clickatonTimelineEvent.create({
            data: {
              timelineId: nuevoCronograma.id,
              eventType: evento.eventType,
              name: evento.name,
              startsAt: evento.startsAt,
              endsAt: evento.endsAt,
              status: evento.status,
              sequence: evento.sequence,
              isCritical: evento.isCritical,
              visibilityPolicy: evento.visibilityPolicy,
              triggerMode: evento.triggerMode,
            },
          });
        }
      }

      for (const consigna of original.prompts) {
        await tx.clickatonPrompt.create({
          data: {
            editionId: nueva.id,
            sequence: consigna.sequence,
            internalName: consigna.internalName,
            title: consigna.title,
            instructions: consigna.instructions,
            shortDescription: consigna.shortDescription,
            captureStartsAt: consigna.captureStartsAt,
            captureEndsAt: consigna.captureEndsAt,
            uploadStartsAt: consigna.uploadStartsAt,
            uploadEndsAt: consigna.uploadEndsAt,
            releaseMode: consigna.releaseMode,
            status: consigna.status,
            minEntries: consigna.minEntries,
            maxEntries: consigna.maxEntries,
            allowReplacement: consigna.allowReplacement,
            replacementDeadline: consigna.replacementDeadline,
            required: consigna.required,
            captureClockToleranceMinutes: consigna.captureClockToleranceMinutes,
            gpsMode: consigna.gpsMode,
          },
        });
      }

      if (original.uploadConfig) {
        const c = original.uploadConfig;
        await tx.clickatonEditionUploadConfig.create({
          data: {
            editionId: nueva.id,
            uploadsEnabled: c.uploadsEnabled,
            globalPromptReveal: c.globalPromptReveal,
            eventRevealAt: c.eventRevealAt,
            captureWindowStartsAt: c.captureWindowStartsAt,
            captureWindowEndsAt: c.captureWindowEndsAt,
            uploadWindowStartsAt: c.uploadWindowStartsAt,
            uploadWindowEndsAt: c.uploadWindowEndsAt,
            allowReplacement: c.allowReplacement,
            maxFileSizeBytes: c.maxFileSizeBytes,
            minWidth: c.minWidth,
            minHeight: c.minHeight,
            maxWidth: c.maxWidth,
            maxHeight: c.maxHeight,
            captureClockToleranceMinutes: c.captureClockToleranceMinutes,
            defaultGpsMode: c.defaultGpsMode,
          },
        });
      }

      if (original.accreditationConfig) {
        const a = original.accreditationConfig;
        await tx.clickatonEditionAccreditationConfig.create({
          data: {
            editionId: nueva.id,
            accreditationEnabled: a.accreditationEnabled,
            identityMode: a.identityMode,
            geofenceMode: a.geofenceMode,
            allowOfflineEvents: a.allowOfflineEvents,
            shortCodeEnabled: a.shortCodeEnabled,
          },
        });
      }

      if (original.admissionConfig) {
        const ad = original.admissionConfig;
        await tx.clickatonEditionAdmissionConfig.create({
          data: {
            editionId: nueva.id,
            admissionEnabled: ad.admissionEnabled,
            accreditationRequiredForAdmission: ad.accreditationRequiredForAdmission,
            rulesVersion: ad.rulesVersion,
            engineVersion: ad.engineVersion,
            requireDeclaration: ad.requireDeclaration,
            allowAppealOnReject: ad.allowAppealOnReject,
          },
        });
      }

      return nueva;
    });

    return { ok: true, copiaId: copia.id, copiaSlug, copiaNombre };
  } catch {
    return {
      ok: false,
      mensaje: "No pudimos crear la copia de ensayo. No se modificó nada de la edición original.",
    };
  }
}
