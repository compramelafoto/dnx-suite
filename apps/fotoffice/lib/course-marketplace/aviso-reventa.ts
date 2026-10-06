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
