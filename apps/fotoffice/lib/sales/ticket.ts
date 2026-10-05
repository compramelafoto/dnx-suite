/**
 * El ticket. Módulo PURO.
 *
 * Es la cuenta que el cliente mira mientras espera. Un error acá cobra mal, y cobra mal
 * muchas veces antes de que alguien lo note: por eso se prueba solo, en centavos enteros
 * y con los bordes cubiertos.
 */

export type TicketLine = {
  productId: string | null;
  description: string;
  qty: number;
  unitPriceMinor: number;
  unitCostMinor: number | null;
  priceWasOverridden: boolean;
};

/** Cantidad por precio. Todo en centavos enteros: nada de punto flotante en la cuenta. */
export function lineTotalMinor(line: Pick<TicketLine, "qty" | "unitPriceMinor">): number {
  return line.qty * line.unitPriceMinor;
}

export function ticketTotals(
  lines: readonly TicketLine[],
  discountMinor: number,
): { subtotalMinor: number; discountMinor: number; totalMinor: number } {
  const subtotalMinor = lines.reduce((acc, line) => acc + lineTotalMinor(line), 0);
  return {
    subtotalMinor,
    discountMinor,
    totalMinor: subtotalMinor - discountMinor,
  };
}

export function validateTicket(
  lines: readonly TicketLine[],
  discountMinor: number,
): { ok: true } | { ok: false; error: string } {
  if (lines.length === 0) {
    return { ok: false, error: "Agregá algo al ticket antes de cobrar." };
  }

  for (const line of lines) {
    if (line.qty <= 0) {
      return { ok: false, error: "Todos los renglones necesitan una cantidad mayor que cero." };
    }
    // El precio cero es válido y el negativo no: un descuento va en el campo de descuento,
    // nunca como precio al revés. Permitir las dos formas garantiza que un día se contradigan.
    if (line.unitPriceMinor < 0) {
      return { ok: false, error: "Ningún renglón puede tener precio negativo." };
    }
    if (line.description.trim() === "") {
      // La venta se lee dentro de dos años, cuando el producto quizá ya no exista:
      // la descripción es lo único que va a quedar para entenderla.
      return { ok: false, error: "Todos los renglones necesitan una descripción." };
    }
  }

  if (discountMinor < 0) {
    return { ok: false, error: "El descuento no puede ser negativo." };
  }

  // El descuento no puede dejar el total negativo: un ticket que da menos que cero no es
  // una venta, es una devolución, y eso no existe en esta etapa.
  const { subtotalMinor } = ticketTotals(lines, discountMinor);
  if (discountMinor > subtotalMinor) {
    return { ok: false, error: "El descuento no puede ser mayor que el total." };
  }

  return { ok: true };
}
