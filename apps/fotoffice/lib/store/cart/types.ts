export type CartLine = {
  productId: string;
  variantId: string | null;
  slug: string;
  name: string;
  variantName: string | null;
  imageUrl: string | null;
  unitPriceMinor: number;
  qty: number;
};

export type CartState = { version: 1; lines: CartLine[] };

export type CartAction =
  | { type: "add"; line: CartLine }
  | { type: "setQty"; key: string; qty: number }
  | { type: "remove"; key: string }
  | { type: "clear" }
  | { type: "replaceLines"; lines: CartLine[] };
