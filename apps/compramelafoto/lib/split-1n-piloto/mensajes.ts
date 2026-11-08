/** Lo que ve el comprador cuando Mercado Pago rechaza la tarjeta. */
export function mensajeRechazo(statusDetail: string | null | undefined): string {
  const d = (statusDetail ?? "").toLowerCase();
  if (d.includes("insufficient")) {
    return "La tarjeta no tiene fondos suficientes. Probá con otra tarjeta.";
  }
  if (d.includes("bad_filled") || d.includes("invalid")) {
    return "Algún dato de la tarjeta no es correcto. Revisá el número, el vencimiento y el código de seguridad.";
  }
  return "No se pudo hacer el pago. Probá con otra tarjeta o comunicate con tu banco.";
}
