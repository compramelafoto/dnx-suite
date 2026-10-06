import type { DeliveryOptions } from "./checkout";

/**
 * La sección "Entrega" de los términos de la tienda. Módulo PURO.
 *
 * Sin envíos (sin configuración o todo apagado) es el texto de la etapa 1: retiro en la sede sin
 * costo. Con envíos, enumera sólo las formas que ve el comprador y dice cómo se calcula el costo.
 */
export function deliveryTermsParagraphs(
  options: DeliveryOptions,
  pickup: { pickupAddress: string | null; pickupHours: string | null },
): string[] {
  const { pickupAddress, pickupHours } = pickup;

  if (!options.home && !options.branch) {
    return [
      `Los pedidos se retiran en la sede, sin costo de envío${pickupAddress ? `: ${pickupAddress}` : ""}${
        pickupHours ? ` (${pickupHours})` : ""
      }. Te avisamos por email cuando tu pedido está listo para retirar.`,
    ];
  }

  const formas: string[] = [];
  if (options.pickup) {
    const sede = [pickupAddress, pickupHours].filter(Boolean).join(", ");
    formas.push(`retiro en la sede${sede ? ` (${sede})` : ""}, sin costo`);
  }
  const andreani = options.carrier === "ANDREANI";
  if (options.home) formas.push(andreani ? "envío a domicilio por Andreani" : "envío a domicilio");
  if (options.branch) formas.push(andreani ? "envío a una sucursal de Andreani" : "envío a una sucursal de Correo Argentino");

  const parrafos = [
    `Podés recibir tu pedido por ${enumerar(formas)}. La forma de entrega se elige al finalizar la compra.`,
    "El costo del envío se calcula según el destino y el peso del pedido, y se muestra antes de pagar.",
  ];
  if (options.handlingNote) parrafos.push(options.handlingNote);
  parrafos.push(
    options.pickup
      ? "Si retirás en la sede, te avisamos por email cuando tu pedido está listo. Si elegiste envío, te avisamos por email cuando lo despachamos, con el número de seguimiento."
      : "Te avisamos por email cuando despachamos tu pedido, con el número de seguimiento.",
  );
  return parrafos;
}

/** ["a"] → "a"; ["a","b"] → "a o b"; ["a","b","c"] → "a, b o c". */
function enumerar(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} o ${items[items.length - 1]}`;
}
