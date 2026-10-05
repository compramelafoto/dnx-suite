import { z } from "zod";

export type CheckoutInput = {
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string | null;
  acceptsTerms: true;
  clientIdempotencyKey: string;
  lines: { productId: string; variantId: string | null; qty: number }[];
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
});

export function parseCheckoutInput(
  raw: unknown,
): { ok: true; value: CheckoutInput } | { ok: false; errors: Record<string, string> } {
  const r = schema.safeParse(raw);
  if (r.success) return { ok: true, value: r.data as CheckoutInput };
  const errors: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const field = String(issue.path[0] ?? "lines");
    if (!(field in errors)) {
      errors[field] =
        field === "lines" && issue.path.length > 1
          ? "Alguna línea del carrito es inválida."
          : issue.message;
    }
  }
  return { ok: false, errors };
}
