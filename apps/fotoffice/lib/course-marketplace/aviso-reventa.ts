import { escaparHtml } from "@/lib/course-classroom/email";

type Correo = { subject: string; html: string; text: string };

/** Al dueño: un pedido por encima del % sugerido necesita su aprobación (spec, sección 4.3). */
export function buildAvisoPedidoDeReventaEmail(input: {
  revendedor: string;
  curso: string;
  porcentaje: string;
  sugerido: string;
  enlace: string;
}): Correo {
  const subject = `${input.revendedor} quiere vender ${input.curso}`;
  const html = `
<div>
  <p><strong>${escaparHtml(input.revendedor)}</strong> pidió vender tu curso <strong>${escaparHtml(input.curso)}</strong> quedándose con el <strong>${escaparHtml(input.porcentaje)}</strong> de cada venta.</p>
  <p>Vos sugeriste ${escaparHtml(input.sugerido)}: como lo supera, el acuerdo espera tu aprobación.</p>
  <p><a href="${escaparHtml(input.enlace)}">Ver el pedido</a></p>
</div>`.trim();
  const text = [
    `${input.revendedor} pidió vender tu curso ${input.curso} quedándose con el ${input.porcentaje} de cada venta.`,
    `Vos sugeriste ${input.sugerido}: como lo supera, el acuerdo espera tu aprobación.`,
    "",
    `Ver el pedido: ${input.enlace}`,
  ].join("\n");
  return { subject, html, text };
}

/** Al revendedor: el dueño respondió su pedido. */
export function buildAvisoRespuestaReventaEmail(input: { dueno: string; curso: string; aprobado: boolean; enlace: string }): Correo {
  const verbo = input.aprobado ? "aprobó" : "rechazó";
  const subject = `${input.dueno} ${verbo} tu pedido para vender ${input.curso}`;
  const detalle = input.aprobado
    ? "Ya podés venderlo: aparece en tu sitio y en el portal de tus socios."
    : "Podés volver a pedirlo con otro porcentaje.";
  const html = `
<div>
  <p><strong>${escaparHtml(input.dueno)}</strong> ${verbo} tu pedido para vender <strong>${escaparHtml(input.curso)}</strong>.</p>
  <p>${escaparHtml(detalle)}</p>
  <p><a href="${escaparHtml(input.enlace)}">Ver tus acuerdos</a></p>
</div>`.trim();
  const text = [`${input.dueno} ${verbo} tu pedido para vender ${input.curso}.`, detalle, "", `Ver tus acuerdos: ${input.enlace}`].join("\n");
  return { subject, html, text };
}

/** Al invitado: el dueño le comparte un curso ("Compartir con un espacio"). */
export function buildAvisoInvitacionACompartirEmail(input: {
  dueno: string;
  curso: string;
  porcentaje: string;
  regalado: boolean;
  gratisSocios: boolean;
  enlace: string;
}): Correo {
  const subject = `${input.dueno} te comparte el curso ${input.curso}`;
  const condiciones = [
    input.regalado ? "Si lo vendés, te quedás con todo lo que cobres." : `Si lo vendés, te quedás con el ${input.porcentaje} de cada venta.`,
    input.gratisSocios ? "Tus socios activos lo pueden tomar gratis desde su portal." : null,
  ].filter((x): x is string => x !== null);
  const html = `
<div>
  <p><strong>${escaparHtml(input.dueno)}</strong> te invita a ofrecer su curso <strong>${escaparHtml(input.curso)}</strong> en tu espacio.</p>
  ${condiciones.map((c) => `<p>${escaparHtml(c)}</p>`).join("\n  ")}
  <p><a href="${escaparHtml(input.enlace)}">Ver la invitación y aceptarla</a></p>
</div>`.trim();
  const text = [`${input.dueno} te invita a ofrecer su curso ${input.curso} en tu espacio.`, ...condiciones, "", `Ver la invitación: ${input.enlace}`].join("\n");
  return { subject, html, text };
}

/** Al dueño: el espacio invitado respondió. */
export function buildAvisoRespuestaInvitacionEmail(input: { invitado: string; curso: string; aceptado: boolean; enlace: string }): Correo {
  const verbo = input.aceptado ? "aceptó" : "rechazó";
  const subject = `${input.invitado} ${verbo} tu curso ${input.curso}`;
  const detalle = input.aceptado ? "Ya lo ofrece en su espacio." : "Podés volver a invitarlo con otras condiciones.";
  const html = `
<div>
  <p><strong>${escaparHtml(input.invitado)}</strong> ${verbo} tu invitación para ofrecer <strong>${escaparHtml(input.curso)}</strong>.</p>
  <p>${escaparHtml(detalle)}</p>
  <p><a href="${escaparHtml(input.enlace)}">Ver tus cursos compartidos</a></p>
</div>`.trim();
  const text = [`${input.invitado} ${verbo} tu invitación para ofrecer ${input.curso}.`, detalle, "", `Ver tus cursos compartidos: ${input.enlace}`].join("\n");
  return { subject, html, text };
}
