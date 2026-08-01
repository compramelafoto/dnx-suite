import { STORE_CART_MAX_LINES } from "@/lib/public-store/cart/constants";
import { STORE_LEGAL_VERSION } from "./legal";
import { STORE_SHIPPING_ENABLED } from "./pickup";

const ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;
const NAME_RE = /^[\p{L}\p{M}\s'\-.]+$/u;
const PHONE_RE = /^[+\d\s()-]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CreateStoreOrderBody = {
  items: Array<{
    productId: string;
    variantId: string | null;
    quantity: number;
  }>;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  deliveryMethod: "PICKUP" | "SHIPPING";
  delivery:
    | {
        kind: "PICKUP";
        pickupPointId: string;
        pickupPersonName: string;
      }
    | {
        kind: "SHIPPING";
        street: string;
        number: string;
        floor?: string;
        city: string;
        province: string;
        postalCode: string;
        reference?: string;
      };
  legal: {
    acceptedPurchaseTerms: true;
    acceptedReturnsPolicy: true;
    acceptedPrivacy: true;
    legalVersion: string;
  };
  idempotencyKey: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function parseName(value: unknown, label: string): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (t.length < 2 || t.length > 80) return null;
  if (!NAME_RE.test(t)) return null;
  return t;
}

export function parseCreateStoreOrderBody(
  raw: unknown,
):
  | { ok: true; data: CreateStoreOrderBody }
  | { ok: false; error: string } {
  const obj = asRecord(raw);
  if (!obj) return { ok: false, error: "Payload inválido." };
  if (Object.keys(obj).length > 40) {
    return { ok: false, error: "Payload excesivo." };
  }

  if (!Array.isArray(obj.items) || obj.items.length === 0) {
    return { ok: false, error: "El carrito está vacío." };
  }
  if (obj.items.length > STORE_CART_MAX_LINES) {
    return { ok: false, error: "Demasiadas líneas en el carrito." };
  }

  const items: CreateStoreOrderBody["items"] = [];
  for (const entry of obj.items) {
    const row = asRecord(entry);
    if (!row) return { ok: false, error: "Ítem de carrito inválido." };
    if (typeof row.productId !== "string" || !ID_RE.test(row.productId.trim())) {
      return { ok: false, error: "productId inválido." };
    }
    let variantId: string | null = null;
    if (row.variantId != null && row.variantId !== "") {
      if (typeof row.variantId !== "string" || !ID_RE.test(row.variantId.trim())) {
        return { ok: false, error: "variantId inválido." };
      }
      variantId = row.variantId.trim();
    }
    if (
      typeof row.quantity !== "number" ||
      !Number.isInteger(row.quantity) ||
      row.quantity < 1 ||
      row.quantity > 10
    ) {
      return { ok: false, error: "Cantidad inválida." };
    }
    items.push({
      productId: row.productId.trim(),
      variantId,
      quantity: row.quantity,
    });
  }

  const customer = asRecord(obj.customer);
  if (!customer) return { ok: false, error: "Datos de contacto incompletos." };
  const firstName = parseName(customer.firstName, "nombre");
  const lastName = parseName(customer.lastName, "apellido");
  if (!firstName || !lastName) {
    return { ok: false, error: "Nombre o apellido inválido." };
  }
  if (typeof customer.email !== "string") {
    return { ok: false, error: "Email inválido." };
  }
  const email = customer.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 160) {
    return { ok: false, error: "Email inválido." };
  }
  if (typeof customer.phone !== "string") {
    return { ok: false, error: "Teléfono inválido." };
  }
  const phone = customer.phone.trim();
  if (phone.length < 8 || phone.length > 32 || !PHONE_RE.test(phone)) {
    return { ok: false, error: "Teléfono inválido." };
  }

  if (obj.deliveryMethod !== "PICKUP" && obj.deliveryMethod !== "SHIPPING") {
    return { ok: false, error: "Modalidad de entrega inválida." };
  }
  if (obj.deliveryMethod === "SHIPPING" && !STORE_SHIPPING_ENABLED) {
    return {
      ok: false,
      error: "El envío a domicilio no está disponible todavía.",
    };
  }

  const deliveryRaw = asRecord(obj.delivery);
  if (!deliveryRaw) return { ok: false, error: "Datos de entrega incompletos." };

  let delivery: CreateStoreOrderBody["delivery"];
  if (obj.deliveryMethod === "PICKUP") {
    if (deliveryRaw.kind !== "PICKUP") {
      return { ok: false, error: "Datos de retiro incompletos." };
    }
    if (
      typeof deliveryRaw.pickupPointId !== "string" ||
      deliveryRaw.pickupPointId.trim().length < 1 ||
      deliveryRaw.pickupPointId.length > 64
    ) {
      return { ok: false, error: "Punto de retiro inválido." };
    }
    const pickupPersonName = parseName(deliveryRaw.pickupPersonName, "quien retira");
    if (!pickupPersonName) {
      return { ok: false, error: "Nombre de quien retira inválido." };
    }
    delivery = {
      kind: "PICKUP",
      pickupPointId: deliveryRaw.pickupPointId.trim(),
      pickupPersonName,
    };
  } else {
    if (deliveryRaw.kind !== "SHIPPING") {
      return { ok: false, error: "Datos de envío incompletos." };
    }
    const street = typeof deliveryRaw.street === "string" ? deliveryRaw.street.trim() : "";
    const number = typeof deliveryRaw.number === "string" ? deliveryRaw.number.trim() : "";
    const city = typeof deliveryRaw.city === "string" ? deliveryRaw.city.trim() : "";
    const province =
      typeof deliveryRaw.province === "string" ? deliveryRaw.province.trim() : "";
    const postalCode =
      typeof deliveryRaw.postalCode === "string" ? deliveryRaw.postalCode.trim() : "";
    if (
      street.length < 2 ||
      number.length < 1 ||
      city.length < 2 ||
      province.length < 2 ||
      postalCode.length < 3
    ) {
      return { ok: false, error: "Dirección incompleta." };
    }
    delivery = {
      kind: "SHIPPING",
      street: street.slice(0, 120),
      number: number.slice(0, 20),
      floor:
        typeof deliveryRaw.floor === "string"
          ? deliveryRaw.floor.trim().slice(0, 40)
          : undefined,
      city: city.slice(0, 80),
      province: province.slice(0, 80),
      postalCode: postalCode.slice(0, 20),
      reference:
        typeof deliveryRaw.reference === "string"
          ? deliveryRaw.reference.trim().slice(0, 200)
          : undefined,
    };
  }

  const legal = asRecord(obj.legal);
  if (!legal) return { ok: false, error: "Debés aceptar los términos." };
  if (
    legal.acceptedPurchaseTerms !== true ||
    legal.acceptedReturnsPolicy !== true ||
    legal.acceptedPrivacy !== true
  ) {
    return { ok: false, error: "Debés aceptar los términos para continuar." };
  }
  if (
    typeof legal.legalVersion !== "string" ||
    legal.legalVersion !== STORE_LEGAL_VERSION
  ) {
    return { ok: false, error: "Versión legal desactualizada. Recargá la página." };
  }

  if (
    typeof obj.idempotencyKey !== "string" ||
    obj.idempotencyKey.trim().length < 16 ||
    obj.idempotencyKey.length > 128
  ) {
    return { ok: false, error: "Clave de idempotencia inválida." };
  }

  return {
    ok: true,
    data: {
      items,
      customer: { firstName, lastName, email, phone },
      deliveryMethod: obj.deliveryMethod,
      delivery,
      legal: {
        acceptedPurchaseTerms: true,
        acceptedReturnsPolicy: true,
        acceptedPrivacy: true,
        legalVersion: STORE_LEGAL_VERSION,
      },
      idempotencyKey: obj.idempotencyKey.trim(),
    },
  };
}
