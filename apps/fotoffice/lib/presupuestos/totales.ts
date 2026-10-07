/**
 * Totales de un presupuesto. Módulo PURO.
 *
 * Todo se cuenta en centavos enteros y se devuelve en pesos con dos decimales: sumar decimales
 * de punto flotante deja restos (0,1 + 0,2) que después se ven en el total.
 *
 * Reglas:
 * - el bruto de un renglón es cantidad × precio unitario;
 * - el descuento del renglón es un % de su bruto o un monto en pesos, nunca más que el bruto;
 * - los OPCIONALES se muestran aparte y no suman al subtotal ni al total;
 * - el descuento global se aplica sobre lo que queda de los renglones no opcionales, nunca más que eso;
 * - IVA: no se calcula (DNX no factura con IVA); el campo queda en 0.
 */
import type { Descuento, ItemPresupuesto } from "./constantes";

export type TotalesSeccion = {
  /** null: los ítems sin sección. */
  seccion: string | null;
  /** Neto de los renglones no opcionales de la sección (después de su descuento, antes del global). */
  subtotal: number;
  /** Neto de los opcionales de la sección. */
  opcionales: number;
};

export type TotalesPresupuesto = {
  /** Suma de los brutos de los renglones no opcionales. */
  subtotal: number;
  /** Suma de los descuentos de esos renglones. */
  descuentoItems: number;
  /** Lo que se descontó con el descuento global. */
  descuentoGlobal: number;
  iva: 0;
  total: number;
  /** Los opcionales, aparte: cuántos son y cuánto suman (con su descuento). */
  opcionales: { cantidad: number; total: number };
  /** En el orden en que aparece cada sección por primera vez. */
  secciones: TotalesSeccion[];
  /** Neto por renglón (clave = `item.id`), para mostrar en cada fila. */
  renglones: Record<string, { bruto: number; descuento: number; neto: number }>;
};

type ItemParaTotales = Pick<ItemPresupuesto, "id" | "cantidad" | "precioUnitario" | "descuento" | "opcional" | "seccion">;

const aCentavos = (pesos: number): number => Math.round(pesos * 100);
const aPesos = (centavos: number): number => centavos / 100;

/** Descuento en centavos sobre una base en centavos, acotado a [0, base]. */
function descuentoCentavos(base: number, d: Descuento | null): number {
  if (!d || base <= 0) return 0;
  const valor = Number.isFinite(d.valor) ? Math.max(0, d.valor) : 0;
  const crudo = d.tipo === "PORCENTAJE" ? Math.round((base * Math.min(valor, 100)) / 100) : aCentavos(valor);
  return Math.min(Math.max(crudo, 0), base);
}

export function calcularTotales(items: readonly ItemParaTotales[], descuentoGlobal: Descuento | null): TotalesPresupuesto {
  let bruto = 0;
  let descItems = 0;
  let netoNoOpcional = 0;
  let netoOpcional = 0;
  let cantidadOpcionales = 0;
  const secciones = new Map<string | null, { subtotal: number; opcionales: number }>();
  const renglones: TotalesPresupuesto["renglones"] = {};

  for (const it of items) {
    const cantidad = Number.isFinite(it.cantidad) ? Math.max(0, it.cantidad) : 0;
    const precio = Number.isFinite(it.precioUnitario) ? Math.max(0, it.precioUnitario) : 0;
    const b = Math.round(cantidad * aCentavos(precio));
    const d = descuentoCentavos(b, it.descuento);
    const n = b - d;
    renglones[it.id] = { bruto: aPesos(b), descuento: aPesos(d), neto: aPesos(n) };

    const clave = it.seccion ?? null;
    const sec = secciones.get(clave) ?? { subtotal: 0, opcionales: 0 };
    if (it.opcional) {
      netoOpcional += n;
      cantidadOpcionales += 1;
      sec.opcionales += n;
    } else {
      bruto += b;
      descItems += d;
      netoNoOpcional += n;
      sec.subtotal += n;
    }
    secciones.set(clave, sec);
  }

  const descGlobal = descuentoCentavos(netoNoOpcional, descuentoGlobal);
  return {
    subtotal: aPesos(bruto),
    descuentoItems: aPesos(descItems),
    descuentoGlobal: aPesos(descGlobal),
    iva: 0,
    total: aPesos(netoNoOpcional - descGlobal),
    opcionales: { cantidad: cantidadOpcionales, total: aPesos(netoOpcional) },
    secciones: [...secciones.entries()].map(([seccion, s]) => ({
      seccion,
      subtotal: aPesos(s.subtotal),
      opcionales: aPesos(s.opcionales),
    })),
    renglones,
  };
}
