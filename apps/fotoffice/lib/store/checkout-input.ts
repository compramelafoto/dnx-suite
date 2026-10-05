import { z } from "zod";
import { normalizePostalCode } from "./shipping/package";
import { isProvinceCode } from "./shipping/provinces";

/** Dirección de envío a domicilio, ya normalizada (provincia en mayúscula, CP de 4 dígitos). */
export type CheckoutAddress = {
  street: string;
  number: string;
  floorApt: string | null;
  city: string;
  provinceCode: string;
  postalCode: string;
  /** Si quien compra no puso otro, el suyo; `null` si no hay ninguno. */
  recipientPhone: string | null;
};

/**
 * Cómo se entrega. La sucursal sólo trae la FORMA que eligió el navegador: que exista y sea de
 * esa provincia se vuelve a comprobar en el servidor al crear el pedido. Y el precio del envío
 * nunca viene de acá: se cotiza en el servidor (E10).
 */
export type CheckoutDelivery =
  | { method: "PICKUP" }
  | { method: "HOME"; address: CheckoutAddress }
  | { method: "BRANCH"; provinceCode: string; agency: { id: string; name: string; address: string } };

export type CheckoutInput = {
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string | null;
  acceptsTerms: true;
  clientIdempotencyKey: string;
  lines: { productId: string; variantId: string | null; qty: number }[];
  delivery: CheckoutDelivery;
  /**
   * El envío que el navegador le MOSTRÓ (centavos), sólo para comparar: si el que se re-cotiza en
   * el servidor es mayor, no se crea el pedido y se le muestra el nuevo. Nunca se usa para cobrar.
   */
  shownShippingMinor: number | null;
};

const phone = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v, ctx) => {
    const t = (v ?? "").trim();
    if (t === "") return null;
    const digits = t.replace(/\D/g, "").length;
    if (digits < 6 || digits > 20 || !/^[\d\s()+.-]+$/.test(t)) {
      ctx.addIssue({ code: "custom", message: "El teléfono debe tener entre 6 y 20 dígitos." });
      return z.NEVER;
    }
    return t;
  });

function requerido(max: number, vacio: string, largo: string) {
  return z.string({ message: vacio }).trim().min(1, vacio).max(max, largo);
}

const opcional = (max: number, largo: string) =>
  z.union([z.string(), z.null(), z.undefined()]).transform((v, ctx) => {
    const t = (v ?? "").trim();
    if (t === "") return null;
    if (t.length > max) {
      ctx.addIssue({ code: "custom", message: largo });
      return z.NEVER;
    }
    return t;
  });

const provincia = z.string({ message: "Elegí la provincia." }).transform((v, ctx) => {
  const code = v.trim().toUpperCase();
  if (!isProvinceCode(code)) {
    ctx.addIssue({ code: "custom", message: "Elegí la provincia." });
    return z.NEVER;
  }
  return code;
});

const codigoPostal = z.string({ message: "Ingresá el código postal." }).transform((v, ctx) => {
  const cp = normalizePostalCode(v);
  if (!cp) {
    ctx.addIssue({ code: "custom", message: "Ingresá un código postal válido (4 números, ej. 2000)." });
    return z.NEVER;
  }
  return cp;
});

const SUCURSAL = "Elegí una sucursal de la lista.";
const sucursalTexto = z.string({ message: SUCURSAL }).trim().min(1, SUCURSAL).max(200, SUCURSAL);

const delivery = z.preprocess(
  // Sin entrega es retiro en la sede: así compraban los carritos de la etapa 1.
  (v) => (v === undefined || v === null ? { method: "PICKUP" } : v),
  z.discriminatedUnion(
    "method",
    [
      z.object({ method: z.literal("PICKUP") }),
      z.object({
        method: z.literal("HOME"),
        address: z.object(
          {
            street: requerido(120, "Ingresá la calle.", "La calle es demasiado larga (máximo 120 letras)."),
            number: requerido(20, "Ingresá la altura.", "La altura es demasiado larga (máximo 20 caracteres)."),
            floorApt: opcional(40, "Piso y departamento: máximo 40 caracteres."),
            city: requerido(80, "Ingresá la localidad.", "La localidad es demasiado larga (máximo 80 letras)."),
            provinceCode: provincia,
            postalCode: codigoPostal,
            recipientPhone: phone,
          },
          { message: "Completá la dirección de envío." },
        ),
      }),
      z.object({
        method: z.literal("BRANCH"),
        provinceCode: provincia,
        agency: z.object(
          { id: sucursalTexto, name: sucursalTexto, address: sucursalTexto },
          { message: SUCURSAL },
        ),
      }),
    ],
    { errorMap: () => ({ message: "Elegí cómo recibir tu compra." }) },
  ),
);

const schema = z.object({
  buyerName: z
    .string({ message: "Ingresá tu nombre." })
    .trim()
    .min(2, "Ingresá tu nombre (mínimo 2 letras)."),
  buyerEmail: z
    .string({ message: "Ingresá tu email." })
    .trim()
    .toLowerCase()
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Ingresá un email válido."),
  buyerPhone: phone,
  acceptsTerms: z.literal(true, { message: "Tenés que aceptar los términos para comprar." }),
  clientIdempotencyKey: z
    .string({ message: "Falta la clave de la compra." })
    .min(16, "La clave de la compra es inválida.")
    .max(64, "La clave de la compra es inválida."),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().min(1).nullable(),
        qty: z.number().int().min(1).max(99),
      }),
      { message: "El carrito es inválido." },
    )
    .min(1, "El carrito está vacío.")
    .max(30, "El carrito tiene demasiados productos (máximo 30)."),
  delivery,
  // Basura (negativo, decimal, texto) cuenta como no mandado: no rompe la compra, sólo obliga a
  // mostrar el precio del envío de nuevo.
  shownShippingMinor: z
    .unknown()
    .transform((v) => (typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : null)),
});

/**
 * A qué campo del formulario va un error. Los de la entrega van como `delivery.<campo>` (los de
 * la dirección sin el `address.` del medio; los de la sucursal, todos a `delivery.agency`).
 */
function campoDelError(path: readonly PropertyKey[]): string {
  const field = String(path[0] ?? "lines");
  if (field !== "delivery") return field;
  const segundo = path[1];
  if (segundo === undefined || segundo === "method") return "delivery.method";
  if (segundo === "address") return path[2] === undefined ? "delivery.address" : `delivery.${String(path[2])}`;
  return `delivery.${String(segundo)}`;
}

export function parseCheckoutInput(
  raw: unknown,
): { ok: true; value: CheckoutInput } | { ok: false; errors: Record<string, string> } {
  const r = schema.safeParse(raw);
  if (r.success) {
    const value = r.data as CheckoutInput;
    if (value.delivery.method === "HOME" && value.delivery.address.recipientPhone === null) {
      value.delivery.address.recipientPhone = value.buyerPhone;
    }
    return { ok: true, value };
  }
  const errors: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const field = campoDelError(issue.path);
    if (!(field in errors)) {
      errors[field] =
        field === "lines" && issue.path.length > 1
          ? "Alguna línea del carrito es inválida."
          : issue.message;
    }
  }
  return { ok: false, errors };
}
