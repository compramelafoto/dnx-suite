import "server-only";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/admin/db";
import { confirmFreeRegistration } from "@/lib/registration/application/confirm-free-registration";
import { evaluateAccreditationEligibility } from "@/lib/accreditation/eligibility";
import { createPrismaPublicRegistrationRepository } from "@/lib/public-registration/infrastructure/prisma-public-registration-repository";
import { createPublicRegistrationService } from "@/lib/public-registration/application/public-registration-service";
import { fixedClock, systemClock, type EditionClock } from "@/lib/timeline/clock";
import { clonarEdicionParaEnsayo } from "./clone-edition";
import { correoDelEnsayo, descartarEdicionDeEnsayo } from "./discard-edition";
import { correrPasosEnSeco, type ModoDeEnsayo } from "./dry-run-steps";
import { cargarFotoDeEdicion } from "./load-edition-snapshot";
import type { ResultadoEnsayo, ResultadoPaso } from "../domain/types";

/**
 * Ensayo completo: crea una copia descartable de la edición, recorre el camino
 * escribiendo de verdad en la base, y al terminar borra la copia entera.
 *
 * La edición real nunca recibe un dato ficticio: todo lo que se escribe cuelga
 * de la copia, que nace marcada como descartable y muere al final.
 */

export type ResultadoEnsayoCompleto =
  | {
      ok: true;
      resultado: ResultadoEnsayo;
      copiaId: string;
      copiaNombre: string;
      creado: Record<string, number>;
      borrado: Record<string, number> | null;
      avisoDeLimpieza: string | null;
    }
  | { ok: false; mensaje: string; copiaId?: string };

function paso(
  numero: number,
  nombre: string,
  estado: ResultadoPaso["estado"],
  queVeria: string,
  detalle: string,
  comoArreglar: string | null = null,
): ResultadoPaso {
  return { numero, nombre, estado, queVeria, detalle, comoArreglar };
}

/**
 * Crea la inscripción de prueba en la copia, de verdad, con el mismo servicio
 * que usa el sitio público. Es lo que demuestra que la base responde.
 */
async function inscribirParticipanteDePrueba(input: {
  copiaId: string;
  copiaSlug: string;
  correo: string;
  clock: EditionClock;
}): Promise<
  | { ok: true; registrationId: string; pasos: ResultadoPaso[] }
  | { ok: false; pasos: ResultadoPaso[] }
> {
  const servicio = createPublicRegistrationService({
    repo: createPrismaPublicRegistrationRepository({ clock: input.clock }),
    clock: input.clock,
    // La copia no ofrece el Pack 4: no tiene sentido y evita una escritura más.
    ensurePackTicket: async () => null,
  });

  const contexto = await servicio.getContext(input.copiaSlug);
  const entrada = contexto?.tickets.find((t) => t.salesStatus === "open");

  if (!entrada) {
    return {
      ok: false,
      pasos: [
        paso(
          1,
          "Mira la página de la maratón",
          "FALLO",
          "La copia no ofrece ninguna entrada.",
          "En la copia no quedó ninguna entrada a la venta, así que no se puede inscribir a nadie.",
          "Revisá las fechas de venta de las entradas en Precios.",
        ),
        paso(2, "Se inscribe", "NO_CORRESPONDE", "No llegó al formulario.", "No se pudo llegar hasta acá."),
      ],
    };
  }

  try {
    const inscripcion = await servicio.createRegistration({
      editionSlug: input.copiaSlug,
      venueId: null,
      ticketTypeId: entrada.id,
      variantChoices: [],
      idempotencyKey: `ensayo-${randomUUID()}`,
      acceptTerms: true,
      acceptPrivacy: true,
      acceptImage: true,
      participant: {
        firstName: "Participante",
        lastName: "De Ensayo",
        email: input.correo,
        phone: "1100000000",
        documentNumber: "99999999",
        city: "—",
        province: "—",
        country: "AR",
      },
    });

    return {
      ok: true,
      registrationId: inscripcion.registrationId,
      pasos: [
        paso(
          1,
          "Mira la página de la maratón",
          "PASO",
          `Ve la entrada «${entrada.name}» disponible.`,
          "La copia sirve la página de inscripción igual que la edición real.",
        ),
        paso(
          2,
          "Se inscribe",
          "PASO",
          "Completa sus datos y la inscripción queda registrada.",
          `Se creó la inscripción ${inscripcion.registrationId} en la base, dentro de la copia.`,
        ),
      ],
    };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "error desconocido";
    return {
      ok: false,
      pasos: [
        paso(
          1,
          "Mira la página de la maratón",
          "PASO",
          `Ve la entrada «${entrada.name}» disponible.`,
          "La copia sirve la página de inscripción.",
        ),
        paso(
          2,
          "Se inscribe",
          "FALLO",
          "Completa sus datos y la inscripción no se guarda.",
          `La base rechazó la inscripción: ${mensaje}`,
          "Revisá el detalle: es un problema de guardado, no de configuración.",
        ),
      ],
    };
  }
}

/** Confirma la inscripción, emite credencial y registra el ingreso. De verdad. */
async function confirmarYAcreditar(input: {
  registrationId: string;
  copiaSlug: string;
  acreditacionHabilitada: boolean;
  /** Quién corre el ensayo: queda como operador del ingreso, igual que en la puerta. */
  operadorUserId: number;
}): Promise<{ pasos: ResultadoPaso[]; creado: Record<string, number> }> {
  const creado: Record<string, number> = {};

  let publicCode: string | null = null;
  try {
    const confirmacion = await confirmFreeRegistration({
      registrationId: input.registrationId,
      editionSlug: input.copiaSlug,
      source: "edition_rehearsal",
    });
    publicCode = confirmacion.publicCode;
    creado["inscripciones confirmadas"] = 1;
    creado["credenciales emitidas"] = 1;
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "error desconocido";
    return {
      creado,
      pasos: [
        paso(
          3,
          "Confirma la inscripción",
          "FALLO",
          "La inscripción queda a medio camino.",
          `No se pudo confirmar: ${mensaje}`,
          "Es un problema de guardado. Revisá el detalle.",
        ),
        paso(4, "Recibe el correo de confirmación", "NO_CORRESPONDE", "No se confirmó.", "No se pudo llegar hasta acá."),
        paso(5, "Recibe su credencial con QR", "NO_CORRESPONDE", "No se confirmó.", "No se pudo llegar hasta acá."),
        paso(6, "Se acredita en la puerta", "NO_CORRESPONDE", "No tiene credencial.", "No se pudo llegar hasta acá."),
      ],
    };
  }

  const pasos: ResultadoPaso[] = [
    paso(
      3,
      "Confirma la inscripción",
      "PASO",
      "La inscripción queda confirmada.",
      "Se confirmó de verdad en la base. En la copia las entradas valen cero, así que no pasa por Mercado Pago ni mueve dinero.",
    ),
    paso(
      4,
      "Recibe el correo de confirmación",
      "PASO",
      "Se arma el correo con su código y el resumen.",
      "El correo se genera pero no se envía: el destinatario del ensayo es una casilla que no existe.",
    ),
    paso(
      5,
      "Recibe su credencial con QR",
      "PASO",
      `Ve su credencial con el código ${publicCode}.`,
      "La credencial se emitió y quedó guardada en la base.",
    ),
  ];

  // La elegibilidad la decide la misma función que usa el escáner del evento.
  const registro = await prisma.clickatonRegistration.findUnique({
    where: { id: input.registrationId },
    select: {
      status: true,
      paymentStatus: true,
      credential: { select: { id: true } },
      checkIns: { where: { reversedAt: null }, select: { id: true } },
    },
  });

  const elegibilidad = evaluateAccreditationEligibility({
    registrationStatus: registro?.status ?? "UNKNOWN",
    paymentStatus: registro?.paymentStatus ?? "UNKNOWN",
    hasActiveCredential: Boolean(registro?.credential),
    alreadyCheckedIn: (registro?.checkIns.length ?? 0) > 0,
    accreditationEnabled: input.acreditacionHabilitada,
    withinAccreditationWindow: null,
    grantException: false,
  });

  if (!elegibilidad.canCheckIn) {
    pasos.push(
      paso(
        6,
        "Se acredita en la puerta",
        "FALLO",
        "El escáner no lo deja pasar.",
        `El control de acreditación responde ${elegibilidad.reason}.`,
        elegibilidad.reason === "ACCREDITATION_DISABLED"
          ? "Encendé la acreditación de la edición."
          : "Revisá la configuración de acreditación.",
      ),
    );
    return { pasos, creado };
  }

  const credencialId = registro?.credential?.id;
  if (!credencialId) {
    pasos.push(
      paso(
        6,
        "Se acredita en la puerta",
        "FALLO",
        "El escáner no encuentra su credencial.",
        "La inscripción quedó confirmada pero sin credencial activa.",
        "Revisá la emisión de credenciales de la edición.",
      ),
    );
    return { pasos, creado };
  }

  await prisma.clickatonCheckIn.create({
    data: {
      registrationId: input.registrationId,
      credentialId: credencialId,
      operatorUserId: input.operadorUserId,
      checkedInAt: new Date(),
      // El enum no tiene un valor propio para el ensayo y agregarlo obligaría a
      // migrar las cinco bases. QR_SCAN es además lo que haría el escáner real.
      source: "QR_SCAN",
      notes: "Ingreso creado por el ensayo de edición.",
    },
  });
  creado["ingresos registrados"] = 1;

  pasos.push(
    paso(
      6,
      "Se acredita en la puerta",
      "PASO",
      "El escáner da verde y su ingreso queda registrado.",
      "El ingreso se guardó de verdad en la base.",
    ),
  );

  return { pasos, creado };
}

export async function correrEnsayoCompleto(input: {
  editionId: string;
  /** Admin que corre el ensayo: queda como operador del ingreso simulado. */
  operadorUserId: number;
  momento?: Date | null;
  modo?: ModoDeEnsayo;
}): Promise<ResultadoEnsayoCompleto> {
  const modo = input.modo ?? "RECORRIDO";
  const clock: EditionClock = input.momento ? fixedClock(input.momento) : systemClock();

  const clon = await clonarEdicionParaEnsayo(input.editionId);
  if (!clon.ok) return { ok: false, mensaje: clon.mensaje };

  const creado: Record<string, number> = { "ediciones de ensayo": 1 };
  let pasos: ResultadoPaso[] = [];
  let borrado: Record<string, number> | null = null;
  let avisoDeLimpieza: string | null = null;

  try {
    const fotoDeLaCopia = await cargarFotoDeEdicion(clon.copiaId);
    if (!fotoDeLaCopia) {
      return { ok: false, mensaje: "La copia se creó pero no se pudo leer.", copiaId: clon.copiaId };
    }

    const inscripcion = await inscribirParticipanteDePrueba({
      copiaId: clon.copiaId,
      copiaSlug: clon.copiaSlug,
      correo: correoDelEnsayo(clon.copiaId),
      clock,
    });

    if (!inscripcion.ok) {
      const cortados = [3, 4, 5, 6, 7, 8, 9, 10].map((numero) =>
        paso(numero, NOMBRES[numero] ?? `Paso ${numero}`, "NO_CORRESPONDE", "No llegó hasta acá.", "El recorrido se cortó en la inscripción."),
      );
      pasos = [...inscripcion.pasos, ...cortados];
    } else {
      creado["inscripciones"] = 1;
      const confirmacion = await confirmarYAcreditar({
        registrationId: inscripcion.registrationId,
        copiaSlug: clon.copiaSlug,
        acreditacionHabilitada: fotoDeLaCopia.acreditacionHabilitada,
        operadorUserId: input.operadorUserId,
      });
      Object.assign(creado, confirmacion.creado);

      /**
       * Los pasos 7 a 10 (consignas, subida y admisión) se evalúan sobre la
       * copia ya escrita, con las mismas reglas del sitio. La foto en sí no se
       * sube a R2: eso mueve archivos a un bucket real y el ensayo no debería
       * dejar basura afuera de la base. La pantalla lo aclara.
       */
      const restantes = await correrPasosEnSeco({ foto: fotoDeLaCopia, clock, modo });
      pasos = [
        ...inscripcion.pasos,
        ...confirmacion.pasos,
        ...restantes.filter((p) => p.numero >= 7),
      ];
    }
  } finally {
    const limpieza = await descartarEdicionDeEnsayo(clon.copiaId);
    if (limpieza.ok) {
      borrado = limpieza.borrado;
    } else {
      avisoDeLimpieza = limpieza.mensaje;
    }
  }

  const fallidos = pasos.filter((p) => p.estado === "FALLO");
  const veredicto =
    fallidos.length === 0
      ? "El recorrido completo funciona de punta a punta, escribiendo en la base de verdad."
      : `El recorrido se corta en el paso ${fallidos[0]!.numero}: ${fallidos[0]!.nombre.toLowerCase()}.`;

  return {
    ok: true,
    resultado: { momentoSimulado: clock.now().toISOString(), pasos, veredicto },
    copiaId: clon.copiaId,
    copiaNombre: clon.copiaNombre,
    creado,
    borrado,
    avisoDeLimpieza,
  };
}

const NOMBRES: Record<number, string> = {
  3: "Confirma la inscripción",
  4: "Recibe el correo de confirmación",
  5: "Recibe su credencial con QR",
  6: "Se acredita en la puerta",
  7: "Entra a la pantalla de la maratón",
  8: "Se abren las consignas",
  9: "Sube una foto",
  10: "La admisión técnica la revisa",
};
