import { describe, expect, it } from "vitest";
import {
  buildStoreOrderUrl,
  renderCreditFailureAlert,
  renderDuplicatePaymentAlert,
  renderNewOrderNotice,
  renderOrderPaid,
  renderOrderReady,
  renderOrderShipped,
  renderPaidNoStockAlert,
  renderRegretNotice,
  type StoreEmailOrder,
} from "./email-render";

const pedido: StoreEmailOrder = {
  institution: "Sociedad Fotográfica",
  orderNumber: 42,
  buyerName: "Ana Pérez",
  buyerEmail: "ana@example.com",
  buyerPhone: "341 555 1234",
  totalMinor: 25_000_00,
  items: [
    { description: "Remera — M", qty: 2, lineTotalMinor: 20_000_00 },
    { description: "Taza", qty: 1, lineTotalMinor: 5_000_00 },
  ],
  pickup: { address: "San Martín 1234, Rosario", hours: "Lunes a viernes de 10 a 18", instructions: "Tocá timbre 2" },
  orderUrl: "https://sfpr.com.ar/tienda/pedido/ped_abcdefgh?t=tok",
  panelUrl: "https://fotoffice.app/ventas/tienda/ord1",
};

const JERGA = /workspace|token|webhook|PAID|PENDING|status|null|undefined/;

describe("buildStoreOrderUrl", () => {
  const base = { slug: "sfpr", publicId: "ped_abcdefgh", token: "tok" };
  it("con dominio propio conectado: el dominio de la institución, sin /w/<slug>", () => {
    expect(buildStoreOrderUrl({ ...base, customDomain: "sfpr.com.ar", appOrigin: "https://fotoffice.app" })).toBe(
      "https://sfpr.com.ar/tienda/pedido/ped_abcdefgh?t=tok",
    );
  });
  it("sin dominio propio: FOTOFFICE con /w/<slug>/tienda", () => {
    expect(buildStoreOrderUrl({ ...base, customDomain: null, appOrigin: "https://fotoffice.app" })).toBe(
      "https://fotoffice.app/w/sfpr/tienda/pedido/ped_abcdefgh?t=tok",
    );
  });
  it("el token va codificado", () => {
    expect(
      buildStoreOrderUrl({ ...base, token: "a+b/c", customDomain: null, appOrigin: "https://fotoffice.app" }),
    ).toContain("?t=a%2Bb%2Fc");
  });
  it("sin clave para el token, sin slug o sin dirección: no hay enlace", () => {
    expect(buildStoreOrderUrl({ ...base, token: null, customDomain: null, appOrigin: "https://fotoffice.app" })).toBeNull();
    expect(buildStoreOrderUrl({ ...base, slug: null, customDomain: null, appOrigin: "https://fotoffice.app" })).toBeNull();
    expect(buildStoreOrderUrl({ ...base, customDomain: null, appOrigin: "" })).toBeNull();
  });
});

describe("correos al comprador", () => {
  it.each([
    ["pagado", renderOrderPaid],
    ["listo", renderOrderReady],
  ] as const)("%s: número, total, renglones, retiro y enlace, en texto y en HTML", (_n, render) => {
    const r = render(pedido);
    expect(r.subject).toContain("#42");
    for (const parte of [r.text, r.html]) {
      expect(parte).toContain("42");
      expect(parte).toContain("$ 25.000,00");
      expect(parte).toContain("Remera — M");
      expect(parte).toContain("Taza");
      expect(parte).toContain("San Martín 1234, Rosario");
      expect(parte).toContain("Lunes a viernes de 10 a 18");
      expect(parte).toContain("Tocá timbre 2");
    }
    expect(r.text).toContain(pedido.orderUrl!);
    expect(r.html).toContain("https://sfpr.com.ar/tienda/pedido/ped_abcdefgh?t=tok");
    expect(r.text).not.toMatch(JERGA);
  });

  it("pagado dice que se recibió el pago; listo dice que se puede retirar", () => {
    expect(renderOrderPaid(pedido).text).toMatch(/recibimos tu pago/i);
    expect(renderOrderReady(pedido).subject).toMatch(/listo para retirar/i);
    expect(renderOrderReady(pedido).text).toMatch(/ya podés retirarlo/i);
  });

  it("sin enlace (falta la clave): el correo sale igual, sin botón", () => {
    const r = renderOrderPaid({ ...pedido, orderUrl: null });
    expect(r.text).not.toContain("http");
    expect(r.html).not.toContain("<a ");
    expect(r.text).toContain("$ 25.000,00");
  });

  it("sin datos de retiro cargados, no muestra renglones vacíos", () => {
    const r = renderOrderReady({ ...pedido, pickup: { address: null, hours: null, instructions: null } });
    expect(r.text).not.toMatch(/Dirección:|Horarios:/);
  });

  it("escapa el HTML de lo que escribió el comprador o la institución", () => {
    const r = renderOrderPaid({ ...pedido, buyerName: "<script>x</script>", items: [{ description: "<b>", qty: 1, lineTotalMinor: 1 }] });
    expect(r.html).not.toContain("<script>");
    expect(r.html).toContain("&lt;script&gt;");
    expect(r.html).not.toContain("<b>");
  });
});

describe("avisos a la institución", () => {
  it("pedido nuevo: número, total, comprador para contactarlo y el enlace al panel", () => {
    const r = renderNewOrderNotice(pedido);
    expect(r.subject).toContain("#42");
    expect(r.text).toContain("$ 25.000,00");
    expect(r.text).toContain("Ana Pérez");
    expect(r.text).toContain("ana@example.com");
    expect(r.text).toContain("341 555 1234");
    expect(r.text).toContain("Remera — M");
    expect(r.text).toContain(pedido.panelUrl!);
    // El enlace del comprador no va a la institución.
    expect(r.text).not.toContain("?t=");
    expect(r.text).not.toMatch(JERGA);
  });

  it("pagado sin stock: pide reponer o devolver", () => {
    const r = renderPaidNoStockAlert(pedido);
    expect(r.subject).toContain("#42");
    expect(r.text).toMatch(/reponer/i);
    expect(r.text).toMatch(/devolv/i);
    expect(r.text).toContain("Mercado Pago");
    expect(r.text).not.toMatch(JERGA);
  });

  it("pago duplicado: el número de operación a devolver", () => {
    const r = renderDuplicatePaymentAlert(pedido, "123456789");
    expect(r.subject).toContain("#42");
    expect(r.text).toContain("123456789");
    expect(r.text).toMatch(/dos veces/);
    expect(r.text).toMatch(/devolv/i);
    expect(r.text).not.toMatch(JERGA);
  });

  it("arrepentimiento: código de trámite, motivo escapado, comprador y el plazo para responder", () => {
    const r = renderRegretNotice(pedido, { code: "PED_ABCDEFGH", reason: "No me <queda> bien" });
    expect(r.subject).toContain("#42");
    expect(r.subject).toMatch(/arrepenti/i);
    expect(r.text).toContain("PED_ABCDEFGH");
    expect(r.text).toContain("No me <queda> bien");
    expect(r.html).toContain("No me &lt;queda&gt; bien");
    expect(r.html).not.toContain("<queda>");
    expect(r.text).toContain("ana@example.com");
    expect(r.text).toContain(pedido.panelUrl!);
    expect(r.text).not.toContain("?t=");
    expect(r.text).not.toMatch(JERGA);
  });

  it("arrepentimiento sin motivo: no inventa uno", () => {
    const r = renderRegretNotice(pedido, { code: "PED_ABCDEFGH", reason: null });
    expect(r.text).not.toMatch(/Motivo/);
  });

  it("pago que no se pudo registrar: pide revisarlo", () => {
    const r = renderCreditFailureAlert(pedido);
    expect(r.subject).toContain("#42");
    expect(r.text).toMatch(/Mercado Pago/);
    expect(r.text).toMatch(/revis/i);
    expect(r.text).not.toMatch(JERGA);
  });

  it("sin dirección del panel: el aviso sale igual, sin botón", () => {
    const r = renderPaidNoStockAlert({ ...pedido, panelUrl: null });
    expect(r.html).not.toContain("<a ");
  });
});

describe("pedido con envío", () => {
  const conEnvio: StoreEmailOrder = {
    ...pedido,
    totalMinor: 29_500_00,
    shipping: {
      label: "Envío a domicilio",
      amountMinor: 4_500_00,
      lines: ["Mitre 10, 2 A", "Rosario, Santa Fe (CP 2000)", "Recibe: Ana Pérez · 341 555 1234"],
    },
  };

  it("pagado: renglón de envío, total con envío y la dirección en vez del retiro", () => {
    const m = renderOrderPaid(conEnvio);
    for (const salida of [m.text, m.html]) {
      expect(salida).toContain("Envío a domicilio");
      expect(salida).toContain("4.500");
      expect(salida).toContain("29.500");
      expect(salida).toContain("Mitre 10, 2 A");
      expect(salida).not.toContain("Dónde retirarlo");
      expect(salida).not.toContain("Tocá timbre 2");
    }
    expect(m.text).not.toMatch(/para retirar/);
    expect(m.text).not.toMatch(JERGA);
  });

  it("aviso a la institución: a dónde mandarlo", () => {
    const m = renderNewOrderNotice(conEnvio);
    expect(m.text).toContain("Envío a domicilio");
    expect(m.text).toContain("Rosario, Santa Fe (CP 2000)");
    expect(m.text).not.toMatch(/lo retire/);
  });

  it("escapa el HTML de la dirección", () => {
    const m = renderOrderPaid({ ...conEnvio, shipping: { ...conEnvio.shipping!, lines: ["<b>calle</b>"] } });
    expect(m.html).not.toContain("<b>calle</b>");
    expect(m.html).toContain("&lt;b&gt;calle&lt;/b&gt;");
  });

  it("sin envío: el detalle no muestra renglón de envío", () => {
    expect(renderOrderPaid(pedido).text).not.toContain("Envío");
  });
});

describe("despachado: tu pedido está en camino", () => {
  const conEnvio: StoreEmailOrder = {
    ...pedido,
    totalMinor: 29_500_00,
    shipping: {
      label: "Envío a sucursal",
      amountMinor: 4_500_00,
      lines: ["Sucursal Centro", "Córdoba 1000", "Rosario, Santa Fe (CP 2000)"],
    },
  };

  it("número, enlace de Correo Argentino, a dónde va y el enlace al pedido", () => {
    const r = renderOrderShipped({
      ...conEnvio,
      tracking: { number: "CP123456789AR", url: "https://www.correoargentino.com.ar/formularios/e-commerce?id=CP123456789AR" },
    });
    expect(r.subject).toContain("#42");
    expect(r.subject).toMatch(/en camino/i);
    for (const salida of [r.text, r.html]) {
      expect(salida).toMatch(/Tu pedido está en camino/);
      expect(salida).toContain("CP123456789AR");
      expect(salida).toContain("https://www.correoargentino.com.ar/formularios/e-commerce?id=CP123456789AR");
      expect(salida).toContain("Envío a sucursal");
      expect(salida).toContain("Sucursal Centro");
      expect(salida).toContain("29.500");
      expect(salida).not.toContain("Dónde retirarlo");
    }
    expect(r.text).toContain(pedido.orderUrl!);
    expect(r.text).not.toMatch(JERGA);
  });

  it("sin enlace de seguimiento (otra fuente): sólo el número", () => {
    const r = renderOrderShipped({ ...conEnvio, tracking: { number: "ABC-1", url: null } });
    expect(r.text).toContain("ABC-1");
    expect(r.text).not.toContain("correoargentino");
    expect(r.html).not.toContain("correoargentino");
  });

  it("sin número: no inventa uno", () => {
    const r = renderOrderShipped({ ...conEnvio, tracking: null });
    expect(r.text).toMatch(/en camino/i);
    expect(r.text).not.toMatch(/seguimiento/i);
  });

  it("escapa el número, el enlace y la dirección", () => {
    const r = renderOrderShipped({
      ...conEnvio,
      shipping: { ...conEnvio.shipping!, lines: ["<i>calle</i>"] },
      tracking: { number: "<b>1</b>", url: "https://x.test/?a=1&b=\"><script>" },
    });
    expect(r.html).not.toContain("<b>1</b>");
    expect(r.html).toContain("&lt;b&gt;1&lt;/b&gt;");
    expect(r.html).not.toContain("<i>calle</i>");
    expect(r.html).not.toContain('"><script>');
  });
});
