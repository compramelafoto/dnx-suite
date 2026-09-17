/**
 * Los dos correos que salen cuando alguien pide cancelar.
 *
 * La Resolución 424/2020 pide **dar constancia** de la solicitud. Mostrarla en pantalla es
 * la mitad: si la persona cierra la pestaña, pierde el número. El correo es lo que le
 * queda.
 *
 * Acá **sí firmamos nosotros**, al revés que los avisos posteriores al evento. Aquellos
 * son del fotógrafo y por eso van con su nombre; el arrepentimiento es contra la
 * plataforma, y quien lo pide tiene que saber con quién está hablando.
 */

import { EMAIL_LEGAL } from "./contenido";
import { DIAS_PARA_ARREPENTIRSE } from "./arrepentimiento";
import { HORAS_PARA_CONTESTAR } from "./urgencia";

export type DatosDelAvisoLegal = {
  constancia: string;
  referencia: string;
  email: string;
  motivo: string | null;
};

export type Correo = { asunto: string; texto: string };

export function correoParaQuienPide(d: DatosDelAvisoLegal): Correo {
  return {
    // La constancia va en el asunto: es lo que va a buscar en su bandeja dentro de un mes.
    asunto: `Recibimos tu pedido de cancelación — ${d.constancia}`,
    texto: [
      "Recibimos tu pedido de cancelación.",
      "",
      `Número de constancia: ${d.constancia}`,
      `Lo pediste para: ${d.referencia}`,
      "",
      `Te contestamos dentro de las ${HORAS_PARA_CONTESTAR} horas. Si no tenés noticias,`,
      `escribinos a ${EMAIL_LEGAL} citando ese número.`,
      "",
      `Te recordamos que tenés ${DIAS_PARA_ARREPENTIRSE} días corridos desde la compra para`,
      "cancelar sin costo, por el artículo 34 de la Ley 24.240.",
      "",
      "— SubiLaFoto",
    ].join("\n"),
  };
}

export function correoParaElTitular(d: DatosDelAvisoLegal): Correo {
  const lineas = [
    "Entró un pedido de cancelación.",
    "",
    `Constancia: ${d.constancia}`,
    `Correo: ${d.email}`,
    `Referencia: ${d.referencia}`,
  ];

  // Sin motivo no se escribe la etiqueta vacía: la ley no obliga a explicar nada y un
  // "Motivo:" seguido de nada parece un error del sistema.
  if (d.motivo) lineas.push(`Motivo: ${d.motivo}`);

  lineas.push(
    "",
    `Hay ${HORAS_PARA_CONTESTAR} horas para contestar: lo pide la Resolución 424/2020.`,
    "Se resuelve en /panel/arrepentimientos, que ya busca la compra sola.",
  );

  return { asunto: `Arrepentimiento ${d.constancia} — ${d.referencia}`, texto: lineas.join("\n") };
}
