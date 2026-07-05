import { describe, expect, it } from "vitest";
import {
  computeQuoteItemPriceFromBaseCost,
  createEmptyQuoteItem,
  getQuoteItemEffectiveMarginPercent,
} from "./quote-items";

describe("quote item margin by type", () => {
  it("servicio propio sin margen guardado no aplica porcentaje", () => {
    const item = createEmptyQuoteItem({
      itemType: "own-service",
      desiredMarginPercent: "",
    });

    expect(getQuoteItemEffectiveMarginPercent(item)).toBe(0);
    expect(computeQuoteItemPriceFromBaseCost(4_000, item)).toEqual({
      marginPercent: 0,
      marginAmount: 0,
      suggestedPrice: 4_000,
    });
  });

  it("servicio propio legacy con margen guardado sigue aplicándolo", () => {
    const item = createEmptyQuoteItem({
      itemType: "own-service",
      desiredMarginPercent: "30",
    });

    expect(getQuoteItemEffectiveMarginPercent(item)).toBe(30);
    expect(computeQuoteItemPriceFromBaseCost(4_000, item)).toEqual({
      marginPercent: 30,
      marginAmount: 1_200,
      suggestedPrice: 5_200,
    });
  });

  it("producto físico aplica ganancia configurable", () => {
    const item = createEmptyQuoteItem({
      itemType: "physical-product",
      desiredMarginPercent: "25",
    });

    expect(computeQuoteItemPriceFromBaseCost(10_000, item)).toEqual({
      marginPercent: 25,
      marginAmount: 2_500,
      suggestedPrice: 12_500,
    });
  });

  it("servicio tercerizado aplica margen configurable", () => {
    const item = createEmptyQuoteItem({
      itemType: "outsourced",
      desiredMarginPercent: "20",
    });

    expect(computeQuoteItemPriceFromBaseCost(10_000, item)).toEqual({
      marginPercent: 20,
      marginAmount: 2_000,
      suggestedPrice: 12_000,
    });
  });

  it("gasto no aplica margen aunque exista valor legacy guardado", () => {
    const item = createEmptyQuoteItem({
      itemType: "expense",
      desiredMarginPercent: "15",
    });

    expect(computeQuoteItemPriceFromBaseCost(5_000, item)).toEqual({
      marginPercent: 0,
      marginAmount: 0,
      suggestedPrice: 5_000,
    });
  });
});
