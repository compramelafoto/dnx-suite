import { feeFromBase, totalFromBase } from "@/lib/pricing/fee-formula";

export function formatAlbumPriceArs(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function getDigitalDiscountPercent(
  qty: number,
  discounts: { d5?: string; d10?: string; d20?: string }
): number {
  const parse = (v?: string) => (v && !isNaN(parseFloat(v)) ? parseFloat(v) : null);
  if (qty >= 20) {
    const d = parse(discounts.d20);
    if (d != null) return d;
  }
  if (qty >= 10) {
    const d = parse(discounts.d10);
    if (d != null) return d;
  }
  if (qty >= 5) {
    const d = parse(discounts.d5);
    if (d != null) return d;
  }
  return 0;
}

export function computeDigitalPricePreview(params: {
  priceInput: string;
  quantity: number;
  minPrice: number;
  platformFeePct: number;
  discounts: { d5?: string; d10?: string; d20?: string };
}) {
  if (!params.priceInput || isNaN(parseFloat(params.priceInput))) return null;
  const price = parseFloat(params.priceInput);
  const discountPercent = getDigitalDiscountPercent(params.quantity, params.discounts);
  const priceAfterDiscount = price * (1 - discountPercent / 100);
  const feePerUnit = feeFromBase(Math.round(priceAfterDiscount), params.platformFeePct);
  const priceWithFee = totalFromBase(price, params.platformFeePct);
  const priceAfterDiscountWithFee = totalFromBase(Math.round(priceAfterDiscount), params.platformFeePct);
  const totalForQuantity = priceAfterDiscountWithFee * params.quantity;
  const totalSavings = (priceWithFee - priceAfterDiscountWithFee) * params.quantity;

  return {
    price,
    minPrice: params.minPrice,
    isValid: price >= params.minPrice,
    discountPercent,
    priceAfterDiscount,
    platformFeePct: params.platformFeePct,
    feePerUnit,
    priceWithFee,
    priceAfterDiscountWithFee,
    totalForQuantity,
    totalSavings,
    quantity: params.quantity,
  };
}

export function computePrintBreakdown(params: {
  baseUnitPrice: number;
  albumMarginPercent: number;
  platformFeePercent: number;
  quantity: number;
}) {
  const base = Math.round(params.baseUnitPrice || 0);
  const marginPct = params.albumMarginPercent || 0;
  const feePct = params.platformFeePercent || 0;
  const qty = Math.max(1, Math.round(params.quantity || 1));
  const priceAfterAlbumMargin = Math.round(base * (1 + marginPct / 100));
  const finalUnitPrice = Math.round(priceAfterAlbumMargin * (1 + feePct / 100));
  const platformFeeAmountPerUnit = finalUnitPrice - priceAfterAlbumMargin;
  const subtotal = finalUnitPrice * qty;
  const priceAfterAlbumMarginTotal = priceAfterAlbumMargin * qty;
  const platformFeeTotal = subtotal - priceAfterAlbumMarginTotal;
  return {
    baseUnitPrice: base,
    albumMarginPercent: marginPct,
    priceAfterAlbumMargin,
    platformFeePercent: feePct,
    platformFeeAmountPerUnit,
    finalUnitPrice,
    quantity: qty,
    subtotal,
    priceAfterAlbumMarginTotal,
    platformFeeTotal,
  };
}

export function getLabDiscountPercent(
  discounts: Array<{ size: string; minQty: number; discountPercent: number }> | undefined,
  size: string,
  qty: number
): number {
  if (!discounts?.length) return 0;
  const sizeDiscounts = discounts.filter((d) => d.size === size);
  const d50 = sizeDiscounts.find((d) => d.minQty === 50)?.discountPercent;
  const d100 = sizeDiscounts.find((d) => d.minQty === 100)?.discountPercent;
  if (qty >= 100) return d100 ?? 0;
  if (qty >= 50) return d50 ?? 0;
  return 0;
}

export function computePrintDigitalAddon(params: {
  includeDigitalWithPrint: boolean;
  digitalPriceInput: string;
  digitalWithPrintDiscountInput: string;
  copyMode: "SAME_PHOTO" | "DIFFERENT_PHOTOS";
  quantity: number;
  platformFeePct: number;
}) {
  if (!params.includeDigitalWithPrint) {
    return { active: false as const };
  }
  const price =
    params.digitalPriceInput && !isNaN(parseFloat(params.digitalPriceInput))
      ? Math.round(parseFloat(params.digitalPriceInput))
      : 0;
  if (!price) return { active: false as const };

  const discountPct =
    params.digitalWithPrintDiscountInput && !isNaN(parseFloat(params.digitalWithPrintDiscountInput))
      ? Math.min(100, Math.max(0, parseFloat(params.digitalWithPrintDiscountInput)))
      : 0;
  const discountedBase = Math.round(price * (1 - discountPct / 100));
  const unitPriceWithFee = totalFromBase(discountedBase, params.platformFeePct);
  const feePerUnit = feeFromBase(discountedBase, params.platformFeePct);
  const qty =
    params.copyMode === "DIFFERENT_PHOTOS" ? Math.max(1, params.quantity) : 1;

  return {
    active: true as const,
    quantity: qty,
    unitPrice: unitPriceWithFee,
    total: unitPriceWithFee * qty,
    basePrice: price,
    discountPercent: discountPct,
    discountedBase,
    feePerUnit,
    platformFeePercent: params.platformFeePct,
  };
}
