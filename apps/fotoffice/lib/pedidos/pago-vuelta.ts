/**
 * Qué le dice la página pública del pedido al cliente cuando vuelve de Mercado Pago o cuando no se
 * pudo abrir el pago (etapa 3, Entrega B2). Módulo PURO: sólo textos fijos, nunca texto de un error
 * del servidor ni de Mercado Pago.
 */

export type AvisoDePago = { tono: "ok" | "info" | "error"; texto: string; conRecibo: boolean };

/** Resultado de verificar la vuelta (`VerificacionPago["resultado"]`), sin importar el módulo del servidor. */
export type ResultadoVuelta =
  | "acreditado" | "ya_acreditado" | "no_aprobado" | "sin_pago" | "sin_cobros" | "no_disponible" | "sin_aplicar" | "fallo";

const MOTIVOS: Record<string, string> = {
  limite: "Hiciste demasiados intentos. Esperá unos minutos y probá de nuevo.",
  enlace: "El enlace ya no está disponible. Pedile uno nuevo a la organización.",
  noExiste: "No encontramos esa cuota.",
  cancelado: "El pedido está cancelado: no admite pagos.",
  sinSaldo: "Esa cuota ya está paga.",
  sinCobros: "La organización todavía no tiene los cobros habilitados. Escribile para pagar de otra forma.",
  sinDireccion: "No pudimos abrir el pago. Escribile a la organización.",
  sinEnlace: "No pudimos abrir el pago. Escribile a la organización.",
  fallo: "No pudimos abrir el pago. Probá de nuevo en unos minutos.",
};

const PENDIENTE = "Tu pago está en proceso. Te avisamos cuando se acredite.";

/** `motivo` de la dirección → mensaje conocido, o null (un valor desconocido no se muestra). */
export function mensajeDeMotivo(motivo: unknown): string | null {
  return typeof motivo === "string" && Object.hasOwn(MOTIVOS, motivo) ? MOTIVOS[motivo]! : null;
}

/**
 * El aviso de la página. `verificacion` sólo viene con `pago=ok` (null si no se verificó); un
 * `pago=ok` que Mercado Pago no confirma NUNCA muestra el agradecimiento.
 */
export function avisoDeVuelta(pago: unknown, motivo: unknown, verificacion: ResultadoVuelta | null): AvisoDePago | null {
  if (pago === "error") {
    return { tono: "error", conRecibo: false, texto: mensajeDeMotivo(motivo) ?? "No se pudo completar el pago. Podés intentarlo de nuevo." };
  }
  if (pago === "pendiente") return { tono: "info", conRecibo: false, texto: PENDIENTE };
  if (pago !== "ok") return null;
  switch (verificacion) {
    case "acreditado":
    case "ya_acreditado":
      return { tono: "ok", conRecibo: true, texto: "¡Gracias! Registramos tu pago." };
    case "sin_aplicar":
      return { tono: "info", conRecibo: false, texto: "Recibimos tu pago, pero la organización tiene que aplicarlo a mano. Ya le avisamos." };
    case "fallo":
      return { tono: "info", conRecibo: false, texto: "No pudimos confirmar tu pago por ahora. Si ya pagaste, escribinos." };
    default:
      return { tono: "info", conRecibo: false, texto: PENDIENTE };
  }
}
