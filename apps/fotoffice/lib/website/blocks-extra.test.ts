import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BeforeAfterBlockView } from "@/components/website/render/blocks/before-after-block-view";
import { CountdownBlockView } from "@/components/website/render/blocks/countdown-block-view";
import { DividerBlockView } from "@/components/website/render/blocks/divider-block-view";
import { FaqBlockView } from "@/components/website/render/blocks/faq-block-view";
import { FeaturesBlockView } from "@/components/website/render/blocks/features-block-view";
import { MapBlockView } from "@/components/website/render/blocks/map-block-view";
import { PartnersBlockView } from "@/components/website/render/blocks/partners-block-view";
import { PaymentButtonBlockView } from "@/components/website/render/blocks/payment-button-block-view";
import { WhatsappButtonBlockView } from "@/components/website/render/blocks/whatsapp-button-block-view";
import { createEmptyBlock, getBlockPreviewLabel, parseWebsiteSections, websiteBlockSchema, WEBSITE_BLOCK_DEFINITIONS, type WebsiteBlock } from "./blocks";
import {
  countdownParts,
  countdownTargetMs,
  externalHttpsUrl,
  externalHttpUrl,
  formatPesos,
  googleMapsDirectionsUrl,
  googleMapsEmbedUrl,
  isShowableImageUrl,
} from "./blocks-extra";
import { deriveHomeNavItems } from "./navigation";
import sfprFixture from "./__fixtures__/sfpr-sections.json";

const NUEVOS = ["DIVIDER", "FAQ", "COUNTDOWN", "BEFORE_AFTER", "PARTNERS", "FEATURES", "MAP", "WHATSAPP_BUTTON", "PAYMENT_BUTTON"] as const;
type Nuevo = (typeof NUEVOS)[number];

function parse<T extends Nuevo>(type: T, config: unknown) {
  return websiteBlockSchema.parse({ id: "b1", type, visible: true, order: 0, config }).config as Extract<WebsiteBlock, { type: T }>["config"];
}

/** `data: {}` = sitio público (no la vista previa del builder, que no recibe datos). */
const publico = {};

describe("bloques nuevos del armador: alta, defaults y selector", () => {
  it.each(NUEVOS)("%s nace con una config que pasa su propio schema y tiene nombre y descripción", (type) => {
    const block = createEmptyBlock(type, 0);
    expect(websiteBlockSchema.parse(block)).toEqual(block);
    const def = WEBSITE_BLOCK_DEFINITIONS[type];
    expect(def.label.length).toBeGreaterThan(3);
    expect(def.description.length).toBeGreaterThan(10);
    expect(getBlockPreviewLabel(block).length).toBeGreaterThan(0);
  });

  it.each(NUEVOS)("%s con config vacía o basura cae a los defaults en vez de descartarse", (type) => {
    expect(websiteBlockSchema.safeParse({ id: "b1", type, visible: true, order: 0, config: {} }).success).toBe(true);
    expect(websiteBlockSchema.safeParse({ id: "b1", type, visible: true, order: 0, config: { title: 5, items: "no", style: "zig" } }).success).toBe(true);
  });

  it("el parseo es idempotente (el renderer vuelve a parsear lo guardado)", () => {
    for (const type of NUEVOS) {
      const once = websiteBlockSchema.parse(createEmptyBlock(type, 0));
      expect(websiteBlockSchema.parse(once)).toEqual(once);
    }
  });

  it("el divisor y los botones de WhatsApp y de pago no entran al menú; los demás con título sí", () => {
    const blocks = [createEmptyBlock("DIVIDER", 0), createEmptyBlock("FAQ", 1), createEmptyBlock("WHATSAPP_BUTTON", 2), createEmptyBlock("PAYMENT_BUTTON", 3)];
    expect(deriveHomeNavItems(blocks).map((i) => i.label)).toEqual(["Inicio", "Preguntas frecuentes"]);
  });

  it("los sitios existentes (fixture de SFPR) parsean igual que antes", () => {
    const parsed = parseWebsiteSections(sfprFixture);
    expect(parsed.pages.home.length).toBeGreaterThan(0);
    expect(parseWebsiteSections(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });
});

describe("ayudas puras", () => {
  it("enlaces externos: sólo http/https bien formados", () => {
    expect(externalHttpUrl("https://photostraps.com")).toBe("https://photostraps.com");
    expect(externalHttpUrl("http://clog.com.ar/x")).toBe("http://clog.com.ar/x");
    expect(externalHttpUrl("javascript:alert(1)")).toBeUndefined();
    expect(externalHttpUrl("ftp://a.com")).toBeUndefined();
    expect(externalHttpUrl("https://user:pass@a.com")).toBeUndefined();
    expect(externalHttpUrl("https://localhost")).toBeUndefined();
    expect(externalHttpUrl("www.a.com")).toBeUndefined();
    expect(externalHttpsUrl("http://mpago.la/abc")).toBeUndefined();
    expect(externalHttpsUrl("https://mpago.la/abc")).toBe("https://mpago.la/abc");
  });

  it("fotos: https o ruta propia, nunca data: ni javascript:", () => {
    expect(isShowableImageUrl("https://cdn.x.com/a.jpg")).toBe(true);
    expect(isShowableImageUrl("/fotos/a.jpg")).toBe(true);
    expect(isShowableImageUrl("//evil.com/a.jpg")).toBe(false);
    expect(isShowableImageUrl("data:image/png;base64,xx")).toBe(false);
    expect(isShowableImageUrl("")).toBe(false);
  });

  it("mapa: la dirección viaja codificada como búsqueda de google.com/maps", () => {
    expect(googleMapsEmbedUrl("Córdoba 1234, Rosario")).toBe("https://www.google.com/maps?q=C%C3%B3rdoba%201234%2C%20Rosario&output=embed");
    expect(googleMapsEmbedUrl('"><script>')).toMatch(/^https:\/\/www\.google\.com\/maps\?q=%22%3E%3Cscript%3E&output=embed$/);
    expect(googleMapsEmbedUrl("  ")).toBeNull();
    expect(googleMapsDirectionsUrl("-32.95, -60.64")).toBe("https://www.google.com/maps/dir/?api=1&destination=-32.95%2C%20-60.64");
  });

  it("pesos en formato argentino, sin centavos", () => {
    expect(formatPesos(25000)).toMatch(/^\$\s25\.000$/);
  });

  it("cuenta regresiva en hora argentina (UTC−3) y fechas imposibles rechazadas", () => {
    expect(countdownTargetMs("2026-12-26", "20:30")).toBe(Date.UTC(2026, 11, 26, 23, 30));
    expect(countdownTargetMs("2026-02-31", "10:00")).toBeNull();
    expect(countdownTargetMs("", "10:00")).toBeNull();
    expect(countdownTargetMs("2026-12-26", "25:00")).toBeNull();
    const target = Date.UTC(2026, 0, 2, 3, 4, 5);
    expect(countdownParts(target, Date.UTC(2026, 0, 1, 0, 0, 0))).toEqual({ days: 1, hours: 3, minutes: 4, seconds: 5, done: false });
    expect(countdownParts(target, target + 1000).done).toBe(true);
  });
});

describe("DIVIDER", () => {
  it("valores fuera de lo permitido caen al default", () => {
    expect(parse("DIVIDER", { style: "wavy", width: 3, spacing: "xl" })).toEqual({ style: "solid", width: "medium", spacing: "md" });
  });
  it("con adorno dibuja el rombo", () => {
    expect(renderToStaticMarkup(createElement(DividerBlockView, { config: { style: "ornament", width: "short", spacing: "sm" } }))).toContain("◆");
  });
});

describe("FAQ", () => {
  it("recorta textos largos, descarta ítems rotos y limita a 40", () => {
    const c = parse("FAQ", { title: "x".repeat(500), items: [{ id: "a", question: "q".repeat(400), answer: "r" }, "basura", null, ...Array.from({ length: 50 }, (_, i) => ({ id: `i${i}`, question: "p", answer: "" }))] });
    expect(c.title).toHaveLength(200);
    expect(c.items[0].question).toHaveLength(300);
    expect(c.items).toHaveLength(40);
  });
  it("en el sitio: acordeón con <details>, la respuesta como texto (sin HTML) y sin preguntas no se dibuja", () => {
    const html = renderToStaticMarkup(
      createElement(FaqBlockView, { config: { title: "Preguntas", items: [{ id: "a", question: "¿Entregan?", answer: "<b>Sí</b>\nen 15 días" }] }, data: publico }),
    );
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
    expect(html).toContain("&lt;b&gt;Sí&lt;/b&gt;");
    expect(FaqBlockView({ config: { title: "P", items: [{ id: "a", question: " ", answer: "x" }] }, data: publico })).toBeNull();
  });
});

describe("COUNTDOWN", () => {
  it("fecha u hora con formato inválido quedan vacías / 00:00", () => {
    expect(parse("COUNTDOWN", { date: "26/12/2026", time: "8pm" })).toMatchObject({ date: "", time: "00:00", doneText: "¡Llegó el día!" });
    expect(parse("COUNTDOWN", { date: "2026-12-26", time: "20:30" })).toMatchObject({ date: "2026-12-26", time: "20:30" });
  });
  it("render inicial estable (guiones, sin la hora del servidor) y sin fecha en el sitio no se dibuja", () => {
    const html = renderToStaticMarkup(createElement(CountdownBlockView, { config: { title: "Faltan", date: "2026-12-26", time: "20:30", doneText: "¡Ya!" }, data: publico }));
    expect(html).toContain("--");
    expect(html).toContain("segundos");
    expect(CountdownBlockView({ config: { title: "", date: "", time: "00:00", doneText: "" }, data: publico })).toBeNull();
  });
});

describe("BEFORE_AFTER", () => {
  it("etiquetas por defecto y slider accesible con las dos fotos", () => {
    const c = parse("BEFORE_AFTER", { beforeUrl: "https://a.com/1.jpg", afterUrl: "https://a.com/2.jpg" });
    expect(c).toMatchObject({ beforeLabel: "Antes", afterLabel: "Después" });
    const html = renderToStaticMarkup(createElement(BeforeAfterBlockView, { config: c, data: publico }));
    expect(html).toContain('type="range"');
    expect(html).toContain("aria-label=");
    expect(html).toContain("https://a.com/1.jpg");
  });
  it("con una foto inválida, en el sitio no se dibuja", () => {
    const c = parse("BEFORE_AFTER", { beforeUrl: "javascript:alert(1)", afterUrl: "https://a.com/2.jpg" });
    expect(renderToStaticMarkup(createElement(BeforeAfterBlockView, { config: c, data: publico }))).toBe("");
  });
});

describe("PARTNERS", () => {
  it("enlaces no http/https se descartan al parsear; el logo queda", () => {
    const c = parse("PARTNERS", {
      items: [
        { id: "1", imageUrl: "https://cdn/x.png", name: "Photostraps", url: "https://photostraps.com" },
        { id: "2", imageUrl: "https://cdn/y.png", name: "Malo", url: "javascript:alert(1)" },
      ],
    });
    expect(c.title).toBe("Colaboradores");
    expect(c.grayscale).toBe(true);
    expect(c.items[0].url).toBe("https://photostraps.com");
    expect(c.items[1].url).toBeUndefined();
  });
  it("el enlace abre en otra pestaña con noopener noreferrer", () => {
    const c = parse("PARTNERS", { items: [{ id: "1", imageUrl: "https://cdn/x.png", name: "Clog", url: "https://clog.com.ar" }, { id: "2", imageUrl: "https://cdn/y.png", name: "Stan" }] });
    const html = renderToStaticMarkup(createElement(PartnersBlockView, { config: c, data: publico }));
    expect(html).toContain('href="https://clog.com.ar" target="_blank" rel="noopener noreferrer"');
    expect(html).toContain('alt="Stan"');
    expect(html).toContain("grayscale");
    expect(PartnersBlockView({ config: { ...c, items: [] }, data: publico })).toBeNull();
  });
});

describe("FEATURES", () => {
  it("ícono fuera del set cae a «star» y se limita a 6 ítems", () => {
    const c = parse("FEATURES", { items: Array.from({ length: 9 }, (_, i) => ({ id: `${i}`, icon: i === 0 ? "bomba" : "camera", title: "t", text: "x" })) });
    expect(c.items).toHaveLength(6);
    expect(c.items[0].icon).toBe("star");
  });
  it("dibuja los ítems con título y omite los vacíos", () => {
    const html = renderToStaticMarkup(
      createElement(FeaturesBlockView, {
        config: { title: "", items: [{ id: "1", icon: "camera", title: "Cobertura", text: "Todo el evento" }, { id: "2", icon: "heart", title: "", text: "" }] },
        data: publico,
      }),
    );
    expect(html).toContain("Cobertura");
    expect(html.match(/<li/g)).toHaveLength(1);
    expect(html).toContain("<svg");
  });
});

describe("MAP", () => {
  it("alto fuera de rango cae a 400", () => {
    expect(parse("MAP", { query: "Rosario", heightPx: 5000 }).heightPx).toBe(400);
  });
  it("iframe a google.com/maps y botón «Cómo llegar»; sin dirección no se dibuja", () => {
    const html = renderToStaticMarkup(createElement(MapBlockView, { config: parse("MAP", { query: "Rosario" }), data: publico }));
    expect(html).toContain('src="https://www.google.com/maps?q=Rosario&amp;output=embed"');
    expect(html).toContain("Cómo llegar");
    expect(MapBlockView({ config: parse("MAP", {}), data: publico })).toBeNull();
  });
});

describe("WHATSAPP_BUTTON", () => {
  it("arma el enlace con whatsappHref y el mensaje", () => {
    const html = renderToStaticMarkup(createElement(WhatsappButtonBlockView, { config: parse("WHATSAPP_BUTTON", { phone: "341 341-9869", message: "Hola" }), data: publico }));
    expect(html).toContain('href="https://wa.me/5493413419869?text=Hola"');
    expect(html).toContain("Escribinos por WhatsApp");
  });
  it("con número inválido, en el sitio no se dibuja", () => {
    expect(WhatsappButtonBlockView({ config: parse("WHATSAPP_BUTTON", { phone: "12" }), data: publico })).toBeNull();
  });
});

describe("PAYMENT_BUTTON", () => {
  it("sólo https; monto inválido queda en null", () => {
    expect(parse("PAYMENT_BUTTON", { url: "http://mpago.la/x", amount: -5 })).toMatchObject({ url: "", amount: null, buttonLabel: "Pagar" });
    expect(parse("PAYMENT_BUTTON", { url: "https://mpago.la/x", amount: 25000 })).toMatchObject({ url: "https://mpago.la/x", amount: 25000 });
    expect(parse("PAYMENT_BUTTON", { amount: 12.5 }).amount).toBeNull();
  });
  it("muestra el monto en pesos y el enlace; sin enlace no se dibuja", () => {
    const html = renderToStaticMarkup(createElement(PaymentButtonBlockView, { config: parse("PAYMENT_BUTTON", { title: "Seña", url: "https://mpago.la/x", amount: 25000 }), data: publico }));
    expect(html).toMatch(/\$\s25\.000/);
    expect(html).toContain('href="https://mpago.la/x" target="_blank" rel="noopener noreferrer"');
    expect(PaymentButtonBlockView({ config: parse("PAYMENT_BUTTON", {}), data: publico })).toBeNull();
  });
});
