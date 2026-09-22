"use server";

import { revalidatePath } from "next/cache";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import { enqueueDiplomaQueueRow, enqueueEditionDiplomas } from "@/lib/diplomas/diploma-batch";
import { enqueueEditionDiplomaEmails, requeueDiplomaEmail } from "@/lib/diplomas/diploma-email";
import { resolveDiplomaTemplate } from "@/lib/diplomas/diploma-template";
import { DIPLOMA_ERROR_MESSAGES } from "@/lib/diplomas/diploma-types";

export type DiplomaActionState = { ok: true; message: string } | { ok: false; message: string };

function diplomasPath(editionId: string): string {
  return `${adminRoutes.editions}/${editionId}/diplomas`;
}

/**
 * Encola los diplomas pendientes de una edición: nuevos acreditados y los
 * que habían fracasado todas sus veces (se reviven). No dibuja nada acá —
 * eso lo hace el proceso automático (`processDueDiplomas`), de a tandas, así
 * que este botón responde al instante aunque haya cientos de acreditados.
 */
export async function generateEditionDiplomasAction(
  editionId: string,
): Promise<DiplomaActionState> {
  await requireClickatonAdmin();

  // El botón del panel ya viene deshabilitado sin plantilla asignada, pero
  // no hay que confiar en el cliente: se vuelve a chequear acá.
  const template = await resolveDiplomaTemplate({ editionId });
  if (!template.ok) {
    return { ok: false, message: DIPLOMA_ERROR_MESSAGES[template.code] };
  }

  const result = await enqueueEditionDiplomas(editionId);
  revalidatePath(diplomasPath(editionId));

  if (result.queued === 0) {
    return {
      ok: true,
      message:
        "No había nadie pendiente: todos los acreditados ya tienen su diploma o están en curso.",
    };
  }

  return {
    ok: true,
    message: `Se encolaron ${result.queued} diploma${
      result.queued === 1 ? "" : "s"
    }. El proceso automático los va generando en los próximos minutos.`,
  };
}

/**
 * Reintenta el diploma de un acreditado puntual — la fila "Reintentar" de
 * una fila fallida. Usa la misma cola que el lote: si ya está en curso, no
 * duplica nada.
 */
export async function regenerateDiplomaAction(
  editionId: string,
  registrationId: string,
): Promise<DiplomaActionState> {
  await requireClickatonAdmin();

  // La inscripción tiene que ser de esta edición: sin este chequeo, un
  // registrationId de otra edición encolaría una fila con datos cruzados.
  const registration = await prisma.clickatonRegistration.findUnique({
    where: { id: registrationId },
    select: { id: true, editionId: true },
  });
  if (!registration || registration.editionId !== editionId) {
    return { ok: false, message: "No encontramos esa inscripción en esta edición." };
  }

  const queued = await enqueueDiplomaQueueRow({ registrationId, editionId });
  revalidatePath(diplomasPath(editionId));

  if (!queued) {
    return { ok: true, message: "Ese diploma ya se está generando." };
  }
  return {
    ok: true,
    message: "Diploma reencolado. El proceso automático lo genera en los próximos minutos.",
  };
}

/**
 * Rehace varios diplomas de una vez — el botón "Rehacer seleccionados".
 *
 * Es la misma operación que `regenerateDiplomaAction` repetida: reencola a
 * cada uno para que el proceso automático lo vuelva a dibujar. Rehacer NO
 * emite un diploma distinto: `issueDiploma` conserva el código, el token y la
 * fecha de emisión (`reused: true`), así que un QR ya impreso o ya enviado
 * por correo sigue funcionando después de corregir el diseño.
 *
 * Las inscripciones se filtran contra la edición en UNA consulta, no una por
 * una: con 29 diplomas seleccionados serían 29 viajes a la base.
 */
export async function regenerateDiplomasAction(
  editionId: string,
  registrationIds: string[],
): Promise<DiplomaActionState> {
  await requireClickatonAdmin();

  const pedidos = Array.from(new Set(registrationIds.filter((id) => id.trim().length > 0)));
  if (pedidos.length === 0) {
    return { ok: false, message: "No elegiste ningún diploma para rehacer." };
  }

  // Sin plantilla resoluble no se rehace nada: encolarlos igual los dejaría
  // agotar los cinco reintentos y quedar fallidos, tapando en la pantalla el
  // diploma que esas personas todavía tienen.
  const template = await resolveDiplomaTemplate({ editionId });
  if (!template.ok) {
    return { ok: false, message: DIPLOMA_ERROR_MESSAGES[template.code] };
  }

  const deLaEdicion = await prisma.clickatonRegistration.findMany({
    where: { id: { in: pedidos }, editionId },
    select: { id: true },
  });
  const validos = deLaEdicion.map((r) => r.id);
  if (validos.length === 0) {
    return { ok: false, message: "No encontramos esas inscripciones en esta edición." };
  }

  let encolados = 0;
  for (const registrationId of validos) {
    const queued = await enqueueDiplomaQueueRow({ registrationId, editionId });
    if (queued) encolados += 1;
  }
  revalidatePath(diplomasPath(editionId));

  const ajenos = pedidos.length - validos.length;
  const aviso =
    ajenos > 0
      ? ` ${ajenos} no ${ajenos === 1 ? "pertenecía" : "pertenecían"} a esta edición y no se ${
          ajenos === 1 ? "tocó" : "tocaron"
        }.`
      : "";

  if (encolados === 0) {
    return {
      ok: true,
      message: `Esos diplomas ya se están generando: no hacía falta reencolarlos.${aviso}`,
    };
  }

  return {
    ok: true,
    message: `Se reencolaron ${encolados} diploma${
      encolados === 1 ? "" : "s"
    }. El proceso automático los rehace en los próximos minutos; el código y el enlace de verificación no cambian.${aviso}`,
  };
}

/**
 * Encola el correo del diploma para toda la edición: sólo a quienes tienen
 * diploma vigente y dirección de correo (ver `enqueueEditionDiplomaEmails`).
 * No manda nada acá — nunca dentro de una petición web. El envío real lo
 * hace el proceso automático (`processDueDiplomaEmails`), de a tandas, desde
 * el cron — mismo criterio que `generateEditionDiplomasAction` arriba.
 *
 * Server action en vez de ruta API: es como el resto de los botones de este
 * panel (ver `generateEditionDiplomasAction`/`regenerateDiplomaAction`), y
 * evita sumar una tercera convención de URL de API admin (esta app ya tiene
 * `/api/admin/ediciones/` en español y `/api/admin/editions/` en inglés
 * conviviendo por razones históricas; no hacía falta un tercer camino para
 * esto).
 */
export async function sendEditionDiplomaEmailsAction(
  editionId: string,
): Promise<DiplomaActionState> {
  await requireClickatonAdmin();

  const result = await enqueueEditionDiplomaEmails(editionId);
  revalidatePath(diplomasPath(editionId));

  const sinDireccion =
    result.withoutEmail > 0
      ? ` ${result.withoutEmail} participante${result.withoutEmail === 1 ? "" : "s"} sigue${
          result.withoutEmail === 1 ? "" : "n"
        } sin dirección de correo y no recibe nada.`
      : "";

  if (result.queued === 0) {
    return {
      ok: true,
      message: `No había ningún correo pendiente de mandar.${sinDireccion}`,
    };
  }

  return {
    ok: true,
    message: `Se encolaron ${result.queued} correo${
      result.queued === 1 ? "" : "s"
    }. El proceso automático los va mandando en los próximos minutos.${sinDireccion}`,
  };
}

/**
 * Reintenta el correo de un diploma puntual — la fila "Reintentar" cuando el
 * envío rebotó. Sirve también para revivir un evento que agotó sus
 * reintentos automáticos y quedó `"DEAD"` en el buzón de salida (ver
 * `requeueDiplomaEmail` en `diploma-email.ts` para el porqué hace falta esto
 * y no alcanza con tocar sólo `emailStatus`).
 */
export async function retryDiplomaEmailAction(
  editionId: string,
  diplomaId: string,
): Promise<DiplomaActionState> {
  await requireClickatonAdmin();

  // El diploma tiene que ser de esta edición, igual que en
  // `regenerateDiplomaAction`: sin este chequeo, un `diplomaId` de otra
  // edición se reencolaba igual desde la pantalla de ésta.
  const diploma = await prisma.clickatonDiplomaIssue.findUnique({
    where: { id: diplomaId },
    select: { id: true, editionId: true },
  });
  if (!diploma || diploma.editionId !== editionId) {
    return { ok: false, message: "No encontramos ese diploma en esta edición." };
  }

  const result = await requeueDiplomaEmail(diplomaId);
  revalidatePath(diplomasPath(editionId));

  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === "ALREADY_SENT"
          ? "Ese correo ya se había mandado: no se reenvía."
          : "No encontramos ese diploma.",
    };
  }
  return {
    ok: true,
    message: "Correo reencolado. El proceso automático lo manda en los próximos minutos.",
  };
}
