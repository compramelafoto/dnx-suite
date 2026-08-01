import "server-only";

import { Prisma, prisma } from "@repo/db";
import { validateStoreCartItems } from "@/lib/public-store/validate-store-cart";
import {
  generateStoreOrderAccessToken,
  generateStoreOrderPublicId,
  hashStoreOrderAccessToken,
} from "./access-token";
import { StoreCheckoutError } from "./errors";
import { commercialFingerprintFromValidated } from "./fingerprint";
import {
  isStoreCheckoutEnabled,
  storeHoldTtlMinutes,
} from "./feature-flags";
import { reserveStoreVariantStock } from "./hold-operations";
import { STORE_LEGAL_VERSION } from "./legal";
import { logStoreCheckoutEvent } from "./observability";
import { getStorePickupPoint } from "./pickup";
import {
  clientIpKey,
  assertStoreOrderRateLimit,
  normalizeEmailKey,
} from "./rate-limit";
import type { CreateStoreOrderBody } from "./schema";
import type { CreateStoreOrderResult, StoreDeliveryData } from "./types";
import { createStorePaymentPreference } from "./create-store-payment";

export async function createStoreOrder(input: {
  body: CreateStoreOrderBody;
  clientIp: string | null;
  userAgent: string | null;
}): Promise<CreateStoreOrderResult> {
  if (!isStoreCheckoutEnabled()) {
    throw new StoreCheckoutError(
      "CHECKOUT_DISABLED",
      "Checkout deshabilitado.",
      403,
    );
  }

  const rate = assertStoreOrderRateLimit([
    clientIpKey(input.clientIp),
    normalizeEmailKey(input.body.customer.email),
  ]);
  if (!rate.ok) {
    throw new StoreCheckoutError(
      "RATE_LIMITED",
      "Demasiados intentos.",
      429,
    );
  }

  if (input.body.legal.legalVersion !== STORE_LEGAL_VERSION) {
    throw new StoreCheckoutError("LEGAL_REQUIRED", "Versión legal inválida.");
  }

  const existing = await prisma.clickatonStoreOrder.findUnique({
    where: { clientIdempotencyKey: input.body.idempotencyKey },
    include: { items: true },
  });
  if (existing) {
    // Reutilizar solo si el fingerprint comercial coincide (revalidado abajo).
  }

  const validated = await validateStoreCartItems(input.body.items);
  if (validated.lines.length === 0) {
    throw new StoreCheckoutError("CART_EMPTY", "Carrito vacío.");
  }
  const purchasable = validated.lines.filter((l) => l.contributesToSubtotal);
  const blocking = validated.issues.filter((i) =>
    [
      "unavailable",
      "outOfStock",
      "insufficientStock",
      "productHidden",
      "variantMissing",
      "variantDisabled",
    ].includes(i.code),
  );
  const invalidLines = validated.lines.filter((l) => !l.contributesToSubtotal);
  if (blocking.length > 0 || invalidLines.length > 0 || purchasable.length === 0) {
    throw new StoreCheckoutError(
      "CART_INVALID",
      "Hay líneas inválidas en el carrito.",
      409,
    );
  }

  for (const line of purchasable) {
    if (!line.variantId) {
      throw new StoreCheckoutError("VARIANT_INVALID", "Variante requerida.");
    }
    if (line.status === "priceChanged") {
      throw new StoreCheckoutError("PRICE_CHANGED", "Precio actualizado.");
    }
  }

  const subtotalAmount = purchasable.reduce((s, l) => s + l.lineSubtotalMinor, 0);
  const deliveryAmount = 0; // solo retiro en Etapa 05
  const totalAmount = subtotalAmount + deliveryAmount;
  const currency = validated.totals.currency || "ARS";
  if (currency !== "ARS" || totalAmount <= 0) {
    throw new StoreCheckoutError("PAYLOAD_REJECTED", "Total inválido.");
  }

  let deliveryData: StoreDeliveryData;
  if (input.body.deliveryMethod === "PICKUP" && input.body.delivery.kind === "PICKUP") {
    const point = getStorePickupPoint(input.body.delivery.pickupPointId);
    if (!point) {
      throw new StoreCheckoutError("DELIVERY_UNSUPPORTED", "Punto de retiro inválido.");
    }
    deliveryData = {
      kind: "PICKUP",
      pickupPointId: point.id,
      pickupPointLabel: point.label,
      instructions: point.instructions,
      scheduleNote: point.scheduleNote,
      pickupPersonName: input.body.delivery.pickupPersonName,
    };
  } else {
    throw new StoreCheckoutError(
      "DELIVERY_UNSUPPORTED",
      "Modalidad de entrega no disponible.",
    );
  }

  const fingerprint = commercialFingerprintFromValidated({
    body: input.body,
    lines: purchasable.map((l) => ({
      productId: l.productId,
      productVariantId: l.variantId!,
      quantity: l.quantity,
      unitPriceAmount: l.unitPriceMinor,
    })),
    subtotalAmount,
    deliveryAmount,
    totalAmount,
    currency,
  });

  if (existing) {
    if (existing.commercialFingerprint !== fingerprint) {
      throw new StoreCheckoutError(
        "IDEMPOTENCY_CONFLICT",
        "La clave de idempotencia ya se usó con otro carrito.",
        409,
      );
    }
    // Reutilizar orden + intentar preferencia si falta URL
    const accessToken = generateStoreOrderAccessToken(); // no re-emitir token real
    // Token original no se regenera: el cliente debe usar cookie/enlace previo.
    // Devolvemos reused sin nuevo token; API setea cookie solo en creación.
    let checkoutUrl: string | null = null;
    try {
      const pay = await createStorePaymentPreference({
        orderId: existing.id,
        publicId: existing.publicId,
        reusedAccessToken: null,
      });
      checkoutUrl = pay.checkoutUrl;
    } catch {
      checkoutUrl = null;
    }
    return {
      publicId: existing.publicId,
      accessToken: "", // caller must already have cookie
      status: existing.status,
      paymentStatus: existing.paymentStatus,
      checkoutUrl,
      totalAmount: existing.totalAmount,
      currency: existing.currency,
      holdExpiresAt: existing.holdExpiresAt?.toISOString() ?? "",
      reused: true,
      commercialFingerprint: existing.commercialFingerprint,
    };
  }

  const publicId = generateStoreOrderPublicId();
  const accessToken = generateStoreOrderAccessToken();
  const accessTokenHash = hashStoreOrderAccessToken(accessToken);
  const holdMinutes = storeHoldTtlMinutes();
  const holdExpiresAt = new Date(Date.now() + holdMinutes * 60_000);
  const editionId = purchasable[0]
    ? (
        await prisma.clickatonProduct.findUnique({
          where: { id: purchasable[0]!.productId },
          select: { editionId: true },
        })
      )?.editionId ?? null
    : null;

  const pendingCount = await prisma.clickatonStoreOrder.count({
    where: {
      customerEmail: input.body.customer.email,
      status: "PENDING_PAYMENT",
      holdExpiresAt: { gt: new Date() },
    },
  });
  if (pendingCount >= 3) {
    throw new StoreCheckoutError(
      "RATE_LIMITED",
      "Tenés demasiados pedidos pendientes.",
      429,
    );
  }

  let orderId = "";
  try {
    const created = await prisma.$transaction(
      async (tx) => {
        const order = await tx.clickatonStoreOrder.create({
          data: {
            publicId,
            accessTokenHash,
            status: "PENDING_PAYMENT",
            paymentStatus: "CREATED",
            currency,
            subtotalAmount,
            deliveryAmount,
            totalAmount,
            customerFirstName: input.body.customer.firstName,
            customerLastName: input.body.customer.lastName,
            customerEmail: input.body.customer.email,
            customerPhone: input.body.customer.phone,
            deliveryMethod: "PICKUP",
            deliveryData: deliveryData as unknown as Prisma.InputJsonValue,
            legalVersion: STORE_LEGAL_VERSION,
            legalAcceptedAt: new Date(),
            clientIdempotencyKey: input.body.idempotencyKey,
            commercialFingerprint: fingerprint,
            holdExpiresAt,
            editionId,
            items: {
              create: purchasable.map((l) => ({
                productId: l.productId,
                productVariantId: l.variantId!,
                productNameSnapshot: l.product.name,
                variantNameSnapshot: l.variant?.name ?? "Única",
                skuSnapshot: l.variant?.code ?? null,
                unitPriceAmount: l.unitPriceMinor,
                quantity: l.quantity,
                lineSubtotalAmount: l.lineSubtotalMinor,
                currency,
                imageUrlSnapshot: l.product.imageUrl,
                storeSlugSnapshot: l.product.slug,
              })),
            },
          },
        });

        for (const l of purchasable) {
          await reserveStoreVariantStock(tx, {
            orderId: order.id,
            productId: l.productId,
            productVariantId: l.variantId!,
            quantity: l.quantity,
            expiresAt: holdExpiresAt,
          });
        }

        return order;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    orderId = created.id;
  } catch (err) {
    if (err instanceof StoreCheckoutError) throw err;
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new StoreCheckoutError(
        "IDEMPOTENCY_CONFLICT",
        "Orden duplicada.",
        409,
      );
    }
    logStoreCheckoutEvent("store_checkout_failed", {
      code: "INTERNAL",
      reason: err instanceof Error ? err.message.slice(0, 120) : "unknown",
    });
    throw new StoreCheckoutError("INTERNAL", "No se pudo crear el pedido.", 500);
  }

  logStoreCheckoutEvent("store_order_created", {
    orderId,
    publicId,
    totalAmount,
    holdExpiresAt: holdExpiresAt.toISOString(),
  });
  logStoreCheckoutEvent("store_hold_created", { orderId, publicId });

  let checkoutUrl: string | null = null;
  try {
    const pay = await createStorePaymentPreference({
      orderId,
      publicId,
      reusedAccessToken: accessToken,
    });
    checkoutUrl = pay.checkoutUrl;
  } catch (err) {
    logStoreCheckoutEvent("store_checkout_failed", {
      orderId,
      publicId,
      code: "PAYMENT_UNAVAILABLE",
      reason: err instanceof Error ? err.message.slice(0, 120) : "unknown",
    });
    // Orden + holds quedan; usuario puede reintentar pago desde /tienda/pedido
  }

  return {
    publicId,
    accessToken,
    status: "PENDING_PAYMENT",
    paymentStatus: "CREATED",
    checkoutUrl,
    totalAmount,
    currency,
    holdExpiresAt: holdExpiresAt.toISOString(),
    reused: false,
    commercialFingerprint: fingerprint,
  };
}
