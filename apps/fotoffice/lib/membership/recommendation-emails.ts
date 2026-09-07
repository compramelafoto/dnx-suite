import type { RenderedEmailSignature } from "@repo/communications/signature";
import { compose, type EmailBody } from "./application-emails";

/**
 * El aviso al socio que recomendó.
 *
 * Función PURA, como el resto de los emails del circuito: el vocabulario se verifica sin
 * enviar un solo correo.
 *
 * **No promete dinero.** El beneficio empieza y termina en la cuota, y el texto tiene que
 * decir exactamente eso: quien lea «ganaste» y entienda «me van a depositar» va a escribir a
 * la Secretaría, y con razón.
 */
export function buildRecommendationEarnedEmail(input: {
  firstName: string;
  /** Nombre completo del colega que se asoció. */
  recommendedName: string;
  institution: string;
  /** Porcentaje de la cuota que se bonifica. */
  percent: number;
  /** Dirección de "Mis cuotas" en el portal. */
  duesUrl: string;
  signature: RenderedEmailSignature | null;
}): EmailBody {
  const completa = input.percent >= 100;

  const parrafos = [
    `${input.recommendedName} se asoció a ${input.institution} por tu recomendación y ya pagó su ingreso. Gracias por hacer crecer la institución.`,
    completa
      ? "Por eso tu próxima cuota va sin cargo. El descuento se aplica solo: no tenés que hacer ningún trámite ni avisar nada."
      : `Por eso tu próxima cuota tiene un ${input.percent}% de descuento. Se aplica solo: no tenés que hacer ningún trámite ni avisar nada.`,
  ];

  return compose({
    subject: `${input.recommendedName}, a quien recomendaste, ya es socio`,
    greetingName: input.firstName,
    paragraphs: parrafos,
    cta: { label: "Ver mis cuotas", url: input.duesUrl },
    signature: input.signature,
  });
}
