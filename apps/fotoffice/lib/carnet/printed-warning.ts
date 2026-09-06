import type { FulfillmentState } from "./fulfillment";

/**
 * Qué se le dice al socio sobre su tarjeta impresa.
 *
 * `printedCardOffer` decide **si** se le puede ofrecer una tarjeta —esa es la regla de
 * cobro—. Esto decide **qué se le dice**, que es otra cosa: hasta ahora, quien nunca había
 * registrado una tarjeta veía un ofrecimiento neutro, y el socio que anda con una credencial
 * de papel de hace años no tenía cómo enterarse de que podía estar vencida.
 *
 * El sistema no puede saber si tiene una credencial vieja en la billetera: sólo sabe que no
 * le consta ninguna. El texto dice exactamente eso y le pide que la mire él, en vez de
 * afirmar que no la tiene.
 *
 * Función pura: no lee la base ni el reloj más que por parámetro.
 */

export type PrintedWarningKind =
  /** No hay ninguna tarjeta registrada, o la última se anuló. */
  | "SIN_REGISTRO"
  /** La tarjeta registrada perdió vigencia. */
  | "VENCIDA"
  /** Ya la pidió y está en algún punto del circuito. */
  | "EN_CURSO"
  /** La tiene y está vigente. No hay nada que advertir, pero puede pedir otra. */
  | "VIGENTE";

export type PrintedWarning = {
  kind: PrintedWarningKind;
  tone: "warn" | "info";
  title: string;
  body: string;
  /** Texto del botón, cuando corresponde ofrecerlo. */
  actionLabel: string | null;
};

/** Estados en los que la tarjeta está en camino. */
const EN_CURSO: ReadonlySet<FulfillmentState> = new Set([
  "PENDIENTE_PAGO",
  "EN_COLA",
  "IMPRESO",
  "LISTO_PARA_RETIRAR",
  "ENVIADO",
]);

function fechaLegible(d: Date): string {
  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${d.getUTCFullYear()}`;
}

export function printedCardWarning(input: {
  /** Estado de la última tarjeta impresa no revocada. `null` si no consta ninguna. */
  state: FulfillmentState | null;
  /** Hasta cuándo vale esa tarjeta. */
  validUntil: Date | null;
  now: Date;
}): PrintedWarning {
  // El vencimiento se mira primero y vale para cualquier estado: un trámite que quedó a
  // mitad de camino hace tres años no puede seguir contando como tarjeta en curso.
  const vencida =
    input.state !== null &&
    input.validUntil !== null &&
    input.validUntil.getTime() <= input.now.getTime();

  if (vencida && input.validUntil) {
    return {
      kind: "VENCIDA",
      tone: "warn",
      title: "Tu tarjeta impresa está vencida",
      body: `La tarjeta que tenemos registrada venció el ${fechaLegible(input.validUntil)}. El carnet digital de esta pantalla sigue valiendo; si querés la credencial física al día, pedí una nueva.`,
      actionLabel: "Pedir renovación",
    };
  }

  // Anulado se trata como si no hubiera: el pedido anterior terminó sin tarjeta.
  if (input.state === null || input.state === "ANULADO") {
    return {
      kind: "SIN_REGISTRO",
      tone: "warn",
      title: "No nos consta que tengas la credencial impresa",
      body: "Si tenés una tarjeta física de antes, revisá su vigencia: puede estar vencida. Tu carnet digital, el de esta pantalla, vale igual y se renueva solo.",
      actionLabel: "Pedir tarjeta impresa",
    };
  }

  if (EN_CURSO.has(input.state)) {
    return {
      kind: "EN_CURSO",
      tone: "info",
      title: "Tu tarjeta impresa está en camino",
      body: "Ya la pediste. Te vamos a avisar cuando puedas retirarla o cuando salga por correo.",
      actionLabel: null,
    };
  }

  // Entregada y vigente. No hay nada que advertir, pero el ofrecimiento no puede
  // desaparecer: se cambia de categoría, se muda, o simplemente la pierde. Cada tarjeta
  // nueva se cobra igual que la primera.
  return {
    kind: "VIGENTE",
    tone: "info",
    title: "Tenés tu tarjeta impresa al día",
    body: "Si cambiaste de categoría, actualizaste tus datos o la perdiste, podés pedir una nueva. Cada tarjeta se cobra aparte, como la primera.",
    actionLabel: "Pedir otra tarjeta",
  };
}
