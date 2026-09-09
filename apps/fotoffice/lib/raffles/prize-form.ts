import { parseLocalDateTime } from "@/lib/bookings/local-datetime";
import { RAFFLES_TIME_ZONE } from "./constants";

/**
 * El formulario de un premio, parseado. Módulo PURO.
 *
 * El `order` no es cosmético: entra en el cálculo del ganador. Dos premios con el mismo orden
 * sacarían el mismo número, y por eso la base también lo impide con un `@@unique`.
 *
 * El aliado tiene tres formas válidas, y las tres importan: una ficha de `DnxPartner` elegida
 * de la lista; un nombre suelto, para la marca que todavía no tiene ficha; o nada, porque la
 * institución también pone premios propios. Lo único que no se acepta es una ficha sin
 * nombre: quedaría un premio de nadie.
 */

export type PrizeFormValues = {
  order: number;
  title: string;
  description: string | null;
  conditions: string | null;
  pickupInstructions: string | null;
  pickupDeadline: Date | null;
  estimatedValueMinor: number | null;
  partnerId: string | null;
  partnerNameSnapshot: string | null;
};

export type PrizeFormResult =
  | { ok: true; values: PrizeFormValues }
  | { ok: false; error: string };

const texto = (fd: FormData, campo: string) => String(fd.get(campo) ?? "").trim();
const nulo = (v: string) => (v === "" ? null : v);

export function parsePrizeForm(formData: FormData): PrizeFormResult {
  const title = texto(formData, "title");
  if (title === "") return { ok: false, error: "Poné el nombre del premio." };

  const order = Number(texto(formData, "order"));
  if (!Number.isInteger(order) || order < 1) {
    return { ok: false, error: "El orden del premio tiene que ser un número entero desde 1." };
  }

  const crudoValor = texto(formData, "estimatedValue");
  let estimatedValueMinor: number | null = null;
  if (crudoValor !== "") {
    // "120.000,50" como se escribe acá: el punto separa miles y la coma, decimales.
    const pesos = Number(crudoValor.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(pesos) || pesos < 0) {
      return { ok: false, error: "El valor estimado no se entiende." };
    }
    estimatedValueMinor = Math.round(pesos * 100);
  }

  const partnerId = nulo(texto(formData, "partnerId"));
  const partnerName = nulo(texto(formData, "partnerName"));
  if (partnerId !== null && partnerName === null) {
    return { ok: false, error: "Elegí el aliado de la lista o escribí su nombre." };
  }

  const crudoPlazo = texto(formData, "pickupDeadline");
  let pickupDeadline: Date | null = null;
  if (crudoPlazo !== "") {
    // Al final de ese día: un plazo "hasta el 31" que vence a las 00:00 del 31 no es lo que
    // entiende quien lo escribe.
    const fin = parseLocalDateTime(`${crudoPlazo}T23:59`, RAFFLES_TIME_ZONE);
    if (!fin) return { ok: false, error: "El plazo de retiro no se entiende." };
    pickupDeadline = new Date(fin.getTime() + 59_999);
  }

  return {
    ok: true,
    values: {
      order,
      title,
      description: nulo(texto(formData, "description")),
      conditions: nulo(texto(formData, "conditions")),
      pickupInstructions: nulo(texto(formData, "pickupInstructions")),
      pickupDeadline,
      estimatedValueMinor,
      partnerId,
      partnerNameSnapshot: partnerName,
    },
  };
}
