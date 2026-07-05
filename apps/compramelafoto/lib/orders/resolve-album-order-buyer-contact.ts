type BuyerUserContact = {
  name?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
} | null | undefined;

type OrderBuyerFields = {
  buyerName?: string | null;
  buyerPhone?: string | null;
  buyerEmail?: string | null;
};

function trimOrNull(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

export function resolveAlbumOrderBuyerName(
  order: OrderBuyerFields,
  buyerUser?: BuyerUserContact
): string | null {
  return trimOrNull(order.buyerName) ?? trimOrNull(buyerUser?.name);
}

export function resolveAlbumOrderBuyerPhone(
  order: OrderBuyerFields,
  buyerUser?: BuyerUserContact
): string | null {
  return (
    trimOrNull(order.buyerPhone) ??
    trimOrNull(buyerUser?.whatsapp) ??
    trimOrNull(buyerUser?.phone)
  );
}

export function formatBuyerContactForPhotographer(
  order: OrderBuyerFields,
  buyerUser?: BuyerUserContact
): { name: string | null; email: string | null; phone: string | null } {
  return {
    name: resolveAlbumOrderBuyerName(order, buyerUser),
    email: trimOrNull(order.buyerEmail),
    phone: resolveAlbumOrderBuyerPhone(order, buyerUser),
  };
}
