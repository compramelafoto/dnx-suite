import type { RenderedEmailSignature } from "@repo/communications/signature";
import { compose, type EmailBody } from "./application-emails";

/**
 * Avisos a la Secretaría sobre un socio de baja que quiere volver. Funciones PURAS.
 *
 * Como el aviso de solicitud nueva, van a casillas que puede leer más de uno: sólo nombre,
 * número y deuda, y para el resto está la ficha, que exige permiso.
 */

export function buildReactivationContactEmail(input: {
  institution: string;
  personName: string;
  memberNumber: string;
  email: string;
  /** Deuda ya formateada ("$ 32.000"), o `null` si no debe nada. */
  debtLabel: string | null;
  memberUrl: string;
  signature: RenderedEmailSignature | null;
}): EmailBody {
  return compose({
    subject: `${input.institution}: ${input.personName} quiere reactivar su ficha`,
    paragraphs: [
      `${input.personName} (socio ${input.memberNumber}) intentó entrar al portal, encontró su ficha dada de baja y pidió que lo contacten para reactivarla.`,
      input.debtLabel
        ? `Hoy figura con una deuda de ${input.debtLabel}. Si la paga en línea, la ficha se reactiva sola; si prefiere otro medio, la reactivación es a mano desde su ficha.`
        : "No figura con deuda pendiente: la reactivación es a mano desde su ficha.",
      `Escribió desde ${input.email}.`,
    ],
    cta: { label: "Ver la ficha", url: input.memberUrl },
    signature: input.signature,
  });
}

export function buildSelfReactivatedEmail(input: {
  institution: string;
  personName: string;
  memberNumber: string;
  memberUrl: string;
  signature: RenderedEmailSignature | null;
}): EmailBody {
  return compose({
    subject: `${input.institution}: ${input.personName} se reactivó pagando su deuda`,
    paragraphs: [
      `${input.personName} (socio ${input.memberNumber}) pagó en línea toda su deuda y su ficha volvió a estar activa.`,
      "No hace falta que hagas nada. Si la baja había sido por otro motivo que no fuera la deuda, podés volver a darla de baja desde su ficha.",
    ],
    cta: { label: "Ver la ficha", url: input.memberUrl },
    signature: input.signature,
  });
}
