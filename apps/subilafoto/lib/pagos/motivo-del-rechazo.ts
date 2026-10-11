/**
 * Por qué no se pudo cobrar, dicho de dos maneras.
 *
 * El 10/10/2026 quedó una orden de $150.000 en `PENDING` sin preferencia de Mercado
 * Pago: alguien llenó el formulario y nunca llegó a la pantalla de pago. Al día
 * siguiente no había forma de saber qué pasó — lo único que se había guardado era
 * `error.name` en un `console.error`, y los registros de Vercel de ese día ya no
 * existían.
 *
 * Una venta que falla en silencio es peor que una que falla ruidosamente: el cliente se
 * va, el fotógrafo no se entera, y cuando alguien pregunta ya no queda nada que mirar.
 *
 * Por eso se guardan **dos textos distintos**:
 *
 * - El del fotógrafo, que tiene que poder hacer algo con lo que lee. "Reconectá tu
 *   cuenta" es accionable; "error 401" no.
 * - El detalle crudo, para el que después tenga que entender qué contestó Mercado Pago.
 */

export type Falla = {
  /** Lo que ve el fotógrafo. Dice qué hacer, no qué pasó. */
  paraElFotografo: string;
  /** Lo que se guarda para entenderlo después. */
  detalle: string;
};

const GENERICO =
  "Mercado Pago no aceptó el cobro. Si se repite, escribinos con la fecha y la hora.";

/*
  Las causas que sabemos traducir. Se busca en el texto completo del error porque el
  SDK de Mercado Pago las acomoda distinto según el caso: a veces en el mensaje, a
  veces en una causa anidada.
*/
const CONOCIDAS: { busca: RegExp; dice: string }[] = [
  {
    busca: /invalid[_ ]?(access[_ ]?)?token|unauthorized|401|token.*(expired|venc)/i,
    dice: "La conexión con Mercado Pago venció. Reconectá tu cuenta desde Perfil y precios.",
  },
  {
    busca: /marketplace|application[_ ]?fee|collector/i,
    dice:
      "Mercado Pago no aceptó la comisión de la plataforma. Suele pasar cuando la cuenta se conectó a medias: reconectala desde Perfil y precios.",
  },
  {
    busca: /forbidden|403|not[_ ]?authorized|permission/i,
    dice:
      "Tu cuenta de Mercado Pago no tiene permiso para esta operación. Reconectala desde Perfil y precios.",
  },
  {
    busca: /timeout|etimedout|econnreset|network|fetch failed|socket/i,
    dice: "No pudimos comunicarnos con Mercado Pago. Probá de nuevo en un momento.",
  },
  {
    busca: /amount|currency|invalid[_ ]?parameter|bad[_ ]?request|400/i,
    dice:
      "Mercado Pago rechazó los datos del cobro. Revisá el precio en Perfil y precios.",
  },
];

/** Todo lo que el error traiga, aplanado, para poder buscar adentro. */
function textoDelError(error: unknown): string {
  /*
    `JSON.stringify(undefined)` devuelve `undefined` y `String(undefined)` devuelve el
    texto "undefined", que es verdadero y se colaba como si fuera un detalle. Guardar
    "undefined" en la base es peor que guardar "sin detalle": parece información.
  */
  if (error === undefined || error === null) return "";
  if (error instanceof Error) {
    const causa = (error as { cause?: unknown }).cause;
    const extra = causa ? ` | ${textoDelError(causa)}` : "";
    return `${error.name}: ${error.message}${extra}`;
  }
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
}

export function resumenDeFalla(error: unknown): Falla {
  // Se recorta: es para leer y para guardar, no para reconstruir la respuesta entera.
  const detalle = textoDelError(error).slice(0, 600) || "sin detalle";
  const conocida = CONOCIDAS.find((c) => c.busca.test(detalle));

  return { paraElFotografo: conocida?.dice ?? GENERICO, detalle };
}
