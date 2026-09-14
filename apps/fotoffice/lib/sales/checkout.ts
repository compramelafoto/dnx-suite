/**
 * La costura entre lo que manda el mostrador y lo que de verdad se va a grabar. Módulo PURO.
 *
 * Nada de esto toca la base: recibe lo que ya se leyó (productos verificados del workspace)
 * y lo que mandó el navegador (crudo, sin verificar), y decide. Así se puede probar sin
 * levantar Postgres, que es el criterio de todo este módulo.
 */

import type { TicketLine } from "./ticket";

/** Un renglón tal cual lo arma la pantalla, antes de cruzarlo contra la base. */
export type RawCheckoutLine = {
  productId: string | null;
  description: string;
  qty: number;
  unitPriceMinor: number;
  priceWasOverridden: boolean;
};

/**
 * Lo que el servidor sabe de un producto citado en el ticket, recién leído de la base —nunca
 * lo que mandó el navegador. El costo ni siquiera viaja hasta el mostrador (la grilla de
 * venta no lo expone: ver `ProductRow` en `lib/sales/repository.ts`), así que no hay otra
 * fuente posible.
 */
export type CheckoutProductInfo = {
  id: string;
  name: string;
  costMinor: number | null;
};

export type BuildTicketLinesResult = { ok: true; lines: TicketLine[] } | { ok: false; error: string };

/**
 * Cruza los renglones crudos contra los productos que el servidor acaba de leer del
 * workspace. Es acá donde se verifica que ningún `productId` sea de otro negocio (§regla 5
 * de la Tarea 7: la fuga de la categoría en la tarea anterior fue exactamente este tipo de
 * descuido): si un id no aparece en `products`, no es de este workspace —o ya no existe— y
 * el ticket entero se rechaza antes de escribir nada.
 *
 * La descripción y el costo de todo renglón CON producto salen siempre de `products`: la
 * descripción para que no se pueda mandar cualquier texto a mano en el lugar del nombre real,
 * y el costo porque el navegador ni lo tiene. El precio y la cantidad sí vienen del
 * mostrador —ahí es donde se vende y se puede pisar el precio a mano—, pero tienen que ser
 * números enteros de verdad.
 */
export function buildTicketLines(
  rawLines: readonly RawCheckoutLine[],
  products: ReadonlyMap<string, CheckoutProductInfo>,
): BuildTicketLinesResult {
  const lines: TicketLine[] = [];

  for (const raw of rawLines) {
    if (!Number.isInteger(raw.qty)) {
      return { ok: false, error: "Alguna cantidad del ticket no es un número entero." };
    }
    if (!Number.isInteger(raw.unitPriceMinor)) {
      return { ok: false, error: "Algún precio del ticket no se entiende." };
    }

    if (raw.productId === null) {
      // Renglón suelto: no hay producto que cruzar, la descripción es la que se tipeó.
      lines.push({
        productId: null,
        description: raw.description.trim(),
        qty: raw.qty,
        unitPriceMinor: raw.unitPriceMinor,
        unitCostMinor: null,
        priceWasOverridden: raw.priceWasOverridden,
      });
      continue;
    }

    const producto = products.get(raw.productId);
    if (!producto) {
      return {
        ok: false,
        error: "Alguno de los productos del ticket ya no está disponible en este negocio. Actualizá la pantalla e intentá de nuevo.",
      };
    }

    lines.push({
      productId: producto.id,
      description: producto.name,
      qty: raw.qty,
      unitPriceMinor: raw.unitPriceMinor,
      unitCostMinor: producto.costMinor,
      priceWasOverridden: raw.priceWasOverridden,
    });
  }

  return { ok: true, lines };
}

/** Cómo llega el cliente desde la pantalla: crudo, sin verificar. */
export type RawCheckoutClient =
  | { mode: "none" }
  | { mode: "existing"; clientId: string }
  | { mode: "new"; firstName: string; lastName: string; phone: string; email: string };

/** Ya interpretado: listo para que `recordSale` lo resuelva contra la base, dentro de la transacción. */
export type CheckoutClientResolution =
  | { mode: "none" }
  | { mode: "existing"; clientId: string }
  | { mode: "new"; firstName: string; lastName: string | null; phone: string | null; email: string | null };

function vacioANull(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

/**
 * Interpreta la elección de cliente de la pantalla. No toca la base —eso es
 * `findOrCreateClient`, y tiene que pasar DENTRO de la transacción de la venta— acá sólo se
 * decide la forma del pedido.
 *
 * Un "cliente nuevo" sin nombre se trata como "sin cliente": no tiene sentido dar de alta una
 * ficha vacía que después nadie va a poder ubicar, y la venta tiene que poder cerrarse igual.
 */
export function resolveCheckoutClientInput(raw: RawCheckoutClient): CheckoutClientResolution {
  if (raw.mode === "existing") {
    const clientId = raw.clientId.trim();
    return clientId === "" ? { mode: "none" } : { mode: "existing", clientId };
  }

  if (raw.mode === "new") {
    const firstName = raw.firstName.trim();
    if (firstName === "") return { mode: "none" };
    return {
      mode: "new",
      firstName,
      lastName: vacioANull(raw.lastName),
      phone: vacioANull(raw.phone),
      email: vacioANull(raw.email),
    };
  }

  return { mode: "none" };
}
