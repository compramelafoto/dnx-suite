import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PricingBlockView } from "@/components/website/render/blocks/pricing-block-view";
import { createEmptyBlock, pricingLines, websiteBlockSchema, type PricingBlockConfig } from "./blocks";

function config(parcial: Partial<PricingBlockConfig> = {}): PricingBlockConfig {
  const base = websiteBlockSchema.parse({ id: "b", type: "PRICING", visible: true, order: 0, config: {} });
  if (base.type !== "PRICING") throw new Error("tipo");
  return { ...base.config, ...parcial };
}

const plan = (cambio: Partial<PricingBlockConfig["plans"][number]>) => ({
  id: "p",
  name: "",
  price: "",
  period: "",
  tagline: "",
  badge: "",
  highlighted: false,
  valueNote: "",
  featuresLead: "",
  features: "",
  buttonLabel: "",
  buttonUrl: "",
  footnote: "",
  ...cambio,
});

describe("bloque Planes y precios", () => {
  it("un bloque guardado vacío o roto se lee igual, sin tirar la página", () => {
    const c = config();
    expect(c.title).toBe("");
    expect(c.plans).toEqual([]);
    const roto = websiteBlockSchema.parse({
      id: "b",
      type: "PRICING",
      visible: true,
      order: 0,
      config: { title: 5, plans: [{ name: "Base", highlighted: "sí" }, "basura"] },
    });
    if (roto.type !== "PRICING") throw new Error("tipo");
    expect(roto.config.plans).toHaveLength(1);
    expect(roto.config.plans[0].highlighted).toBe(false);
  });

  it("el bloque nuevo trae dos planes y el segundo destacado", () => {
    const b = createEmptyBlock("PRICING", 0);
    if (b.type !== "PRICING") throw new Error("tipo");
    expect(b.config.plans.map((p) => p.highlighted)).toEqual([false, true]);
    expect(websiteBlockSchema.safeParse(b).success).toBe(true);
  });

  it("lo que incluye es un ítem por renglón, sin renglones vacíos", () => {
    expect(pricingLines("Clases grabadas\n\n  Clase en vivo  \n")).toEqual(["Clases grabadas", "Clase en vivo"]);
  });

  it("dibuja precio, lista, frase de valor y el botón con el enlace del sitio", () => {
    const html = renderToStaticMarkup(
      createElement(PricingBlockView, {
        config: config({
          title: "Elegí tu plan",
          plans: [
            plan({ id: "a", name: "Base", price: "$30.000", period: "por mes", features: "Uno\nDos", buttonLabel: "Quiero Base", buttonUrl: "/asociarse?plan=x" }),
            plan({ id: "b", name: "Premium", price: "$70.000", highlighted: true, badge: "Recomendado", valueNote: "Vale más", buttonLabel: "Quiero Premium", buttonUrl: "/asociarse" }),
          ],
          reassurance: "Pagás con Mercado Pago\nCancelás cuando quieras",
        }),
        data: { paginasDelSitio: { asociarse: "/w/club/asociarse" } } as never,
      }),
    );
    expect(html).toContain("$30.000");
    expect(html).toContain("Recomendado");
    expect(html).toContain("Vale más");
    expect(html).toContain('href="/w/club/asociarse?plan=x"');
    expect(html).toContain("Cancelás cuando quieras");
    expect(html.match(/<svg/g)?.length).toBeGreaterThanOrEqual(1);
  });

  it("sin planes con nombre o precio, en el sitio no aparece nada", () => {
    const html = renderToStaticMarkup(
      createElement(PricingBlockView, { config: config({ plans: [plan({})] }), data: {} as never }),
    );
    expect(html).toBe("");
  });
});
