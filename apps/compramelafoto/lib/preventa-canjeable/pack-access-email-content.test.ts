import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  buildIncludedLines,
  buildPreventaPackAccessEmailContent,
} from "./pack-access-email-content";
import type { PreventaPackSnapshotV1 } from "./preventa-pack-snapshot-v1";

function snapshot(overrides?: Partial<PreventaPackSnapshotV1>): PreventaPackSnapshotV1 {
  return {
    schemaVersion: 1,
    frozenAt: "2026-09-10T23:12:13.016Z",
    packDefinitionId: 60,
    packName: "Pack 1 - Copia",
    packDescription: "1 copia grupal de 15x21 cm en papel mate.",
    packVersion: 1,
    priceClientArs: 18584,
    currency: "ARS",
    redemptionDeadlineAt: null,
    benefits: [
      {
        stableKey: "60:benefit:80",
        benefitDefinitionId: 80,
        kind: "PHYSICAL",
        selectionMode: "SINGLE_PHOTO",
        includedQuantity: 1,
        requiredPhotoCount: 1,
        maxPhotosPerUnit: null,
        photographerProductId: 573,
        templatePolicy: "NONE",
        templateId: null,
        extraUnitPriceOverrideArs: 16160,
        regularUnitPriceAfterPreventaArs: 23230,
        sortOrder: 0,
        name: "1× Copia grupal",
        description: null,
        kindLabel: "Producto impreso",
        summary: "Texto interno para el fotógrafo: podés vincular el producto del laboratorio.",
      },
    ],
    ...overrides,
  };
}

function baseInput() {
  return {
    orderId: 3196,
    buyerName: "Stephanie Hourcade",
    buyerEmail: "madre@example.com",
    albumTitle: "Colegio Goethe - General",
    purchasedAt: new Date("2026-09-10T23:12:13.366Z"),
    totalArs: 18584,
    mpPaymentId: "123456789",
    packAccessUrl: "https://compramelafoto.com/cliente/pack/TOKEN",
    recoverUrl: "https://compramelafoto.com/cliente/recuperar-pack",
    snapshot: snapshot(),
  };
}

test("incluye detalle del pack, monto y fecha en texto y HTML", () => {
  const { subject, text, html } = buildPreventaPackAccessEmailContent(baseInput());

  assert.match(subject, /#3196/);
  assert.match(subject, /Pack 1 - Copia/);

  for (const body of [text, html]) {
    assert.ok(body.includes("Pack 1 - Copia"), "falta el nombre del pack");
    assert.ok(body.includes("1× Copia grupal"), "falta el detalle de lo incluido");
    assert.ok(body.includes("18.584"), "falta el monto");
    assert.ok(body.includes("10/09/2026"), "falta la fecha de compra");
    assert.ok(body.includes("20:12"), "falta la hora argentina de la compra");
    assert.ok(body.includes("123456789"), "falta la operación de Mercado Pago");
    assert.ok(body.includes("Colegio Goethe - General"), "falta el álbum");
  }
});

test("no filtra el texto interno pensado para el fotógrafo", () => {
  const { text, html } = buildPreventaPackAccessEmailContent(baseInput());
  assert.ok(!text.includes("laboratorio"), "el texto interno no debe llegar al cliente");
  assert.ok(!html.includes("laboratorio"), "el texto interno no debe llegar al cliente");
});

test("sin link de acceso explica cómo recuperarlo en vez de omitir el email", () => {
  const { text, html } = buildPreventaPackAccessEmailContent({
    ...baseInput(),
    packAccessUrl: null,
  });

  for (const body of [text, html]) {
    assert.ok(body.includes("recuperar-pack"), "debe ofrecer la recuperación del acceso");
    assert.ok(body.includes("18.584"), "el comprobante sigue completo sin link");
  }
  assert.ok(!text.includes("/cliente/pack/TOKEN"));
});

test("funciona sin snapshot (pedidos viejos) sin romper el comprobante", () => {
  const { subject, text } = buildPreventaPackAccessEmailContent({
    ...baseInput(),
    snapshot: null,
  });
  assert.match(subject, /pack de preventa/);
  assert.ok(text.includes("18.584"));
  assert.ok(text.includes("#3196"));
});

test("usa el email como nombre cuando no hay nombre del comprador", () => {
  const { text } = buildPreventaPackAccessEmailContent({
    ...baseInput(),
    buyerName: null,
  });
  assert.ok(text.startsWith("Hola madre,"));
});

test("escapa HTML de los datos cargados por el fotógrafo", () => {
  const { html } = buildPreventaPackAccessEmailContent({
    ...baseInput(),
    snapshot: snapshot({ packName: 'Pack <img src=x onerror="alert(1)">' }),
  });
  assert.ok(!html.includes("<img src=x"), "no debe inyectar HTML crudo");
  assert.ok(html.includes("&lt;img"));
});

test("ordena y filtra los beneficios incluidos", () => {
  const snap = snapshot({
    benefits: [
      { ...snapshot().benefits[0], sortOrder: 1, name: "2× Foto individual" },
      { ...snapshot().benefits[0], sortOrder: 0, name: "1× Copia grupal" },
      { ...snapshot().benefits[0], sortOrder: 2, name: "vacío", includedQuantity: 0 },
    ],
  });
  assert.deepEqual(buildIncludedLines(snap), ["1× Copia grupal", "2× Foto individual"]);
});

test("aclara la cantidad cuando se compró más de una unidad del pack", () => {
  const { text, html } = buildPreventaPackAccessEmailContent({
    ...baseInput(),
    packQuantity: 3,
    totalArs: 55752,
  });

  for (const body of [text, html]) {
    assert.ok(body.includes("Pack 1 - Copia (×3)"), "debe mostrar la cantidad de packs");
    assert.ok(body.includes("Cada pack:"), "debe aclarar que la descripción es por pack");
    assert.ok(body.includes("55.752"));
  }
});

test("con una sola unidad no agrega ruido", () => {
  const { text } = buildPreventaPackAccessEmailContent({ ...baseInput(), packQuantity: 1 });
  assert.ok(!text.includes("(×1)"));
  assert.ok(!text.includes("Cada pack:"));
});
