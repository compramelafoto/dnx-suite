import type { CurrencyCode } from "../../../contracts/primitives.js";
import type { Money } from "../../../money/types.js";
import { isPositive, money } from "../../../money/index.js";
import { moneyToMercadoPagoAmount } from "../money-mapper.js";
import { OrderValidationError } from "./errors.js";
import { MERCADO_PAGO_ORDER_ITEM_TITLE_MAX_LENGTH } from "./constants.js";

/**
 * Canonical DNX Order item (industry: Otros intangibles).
 * unitPrice is money-safe minor units — never JS float.
 */
export interface OrderItemInput {
  id?: string;
  title: string;
  quantity: number;
  unitPrice: Money;
  categoryId?: string;
  description?: string;
}

export type ItemsTotalRelation = "informative" | "exact";

/**
 * Items may differ from Order total when the product domain applies discounts,
 * fees, or promotions. Default relation is informative (antifraud context).
 * Use `exact` only when the consumer guarantees sum(unit*qty) == total.
 */
export interface ValidateOrderItemsInput {
  items: OrderItemInput[];
  orderTotal: Money;
  itemsTotalRelation?: ItemsTotalRelation;
  /** Homologation path requires at least one intangible item. */
  requireAtLeastOne?: boolean;
}

export function sumOrderItemsMinor(items: OrderItemInput[], currency: CurrencyCode): bigint {
  let sum = 0n;
  for (const item of items) {
    if (item.unitPrice.currency !== currency) {
      throw new OrderValidationError(
        `ORDER_ITEMS_CURRENCY: item currency ${item.unitPrice.currency} != ${currency}`,
      );
    }
    sum += item.unitPrice.amountMinor * BigInt(item.quantity);
  }
  return sum;
}

export function validateOrderItems(input: ValidateOrderItemsInput): void {
  const requireAtLeastOne = input.requireAtLeastOne ?? true;
  if (!Array.isArray(input.items) || (requireAtLeastOne && input.items.length === 0)) {
    throw new OrderValidationError("ORDER_ITEMS_REQUIRED: at least one item is required");
  }

  for (const [index, item] of input.items.entries()) {
    const title = item.title?.trim() ?? "";
    if (!title) {
      throw new OrderValidationError(`ORDER_ITEM_TITLE_REQUIRED: items[${index}].title`);
    }
    if (title.length > MERCADO_PAGO_ORDER_ITEM_TITLE_MAX_LENGTH) {
      throw new OrderValidationError(
        `ORDER_ITEM_TITLE_INVALID: items[${index}].title exceeds max length`,
      );
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new OrderValidationError(
        `ORDER_ITEM_QUANTITY_INVALID: items[${index}].quantity must be integer > 0`,
      );
    }
    if (!isPositive(item.unitPrice)) {
      throw new OrderValidationError(
        `ORDER_ITEM_UNIT_PRICE_INVALID: items[${index}].unitPrice must be > 0`,
      );
    }
    if (item.unitPrice.currency !== input.orderTotal.currency) {
      throw new OrderValidationError(
        `ORDER_ITEMS_CURRENCY: items[${index}] currency mismatch`,
      );
    }
  }

  const sumMinor = sumOrderItemsMinor(input.items, input.orderTotal.currency);
  const relation = input.itemsTotalRelation ?? "informative";
  if (relation === "exact" && sumMinor !== input.orderTotal.amountMinor) {
    throw new OrderValidationError(
      `ORDER_ITEMS_TOTAL_MISMATCH: sum(items)=${sumMinor} orderTotal=${input.orderTotal.amountMinor}`,
    );
  }
}

export function mapOrderItemsToMercadoPago(
  items: OrderItemInput[],
): Array<{
  title: string;
  quantity: number;
  unit_price: string;
  category_id?: string;
  description?: string;
}> {
  return items.map((item) => {
    const mapped: {
      title: string;
      quantity: number;
      unit_price: string;
      category_id?: string;
      description?: string;
    } = {
      title: item.title.trim().slice(0, MERCADO_PAGO_ORDER_ITEM_TITLE_MAX_LENGTH),
      quantity: item.quantity,
      unit_price: moneyToMercadoPagoAmount(item.unitPrice),
    };
    if (item.categoryId?.trim()) mapped.category_id = item.categoryId.trim();
    if (item.description?.trim()) mapped.description = item.description.trim();
    return mapped;
  });
}

/** Helper for tests/consumers building a single intangible line. */
export function singleIntangibleItem(opts: {
  title: string;
  total: Money;
  categoryId?: string;
  id?: string;
}): OrderItemInput {
  return {
    ...(opts.id ? { id: opts.id } : {}),
    title: opts.title,
    quantity: 1,
    unitPrice: money(opts.total.currency, opts.total.amountMinor),
    ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
  };
}
