import assert from "node:assert/strict";
import { test } from "node:test";

import { buildClientPreventaPackRows, type PreventaPackOrderForPanel } from "./client-panel-packs";

/** El pedido 5388: un padre compró el librito de la colación de Sala de 5 y no lo veía en su panel. */
function packOrder(over: Partial<PreventaPackOrderForPanel> = {}): PreventaPackOrderForPanel {
  return {
    id: 5388,
    origin: "PREVENTA_PACK",
    status: "PAID",
    createdAt: new Date("2026-10-29T13:38:12.975Z"),
    totalCents: 55000,
    redemptionOrderId: null,
    preventaPackSnapshotJson: { packName: "Pack 2 · Librito 3 fotos + digitales" },
    album: {
      title: "Acto de Colación · Sala de 5 · 2026",
      user: { name: "Ceci Donnelly", email: "ccldonnelly@gmail.com" },
    },
    ...over,
  };
}

test("un pack pagado aparece con su nombre, el total en pesos y el link al pack", () => {
  const [row] = buildClientPreventaPackRows([packOrder()]);
  assert.deepEqual(row, {
    orderId: 5388,
    orderCreatedAt: "2026-10-29T13:38:12.975Z",
    albumTitle: "Acto de Colación · Sala de 5 · 2026",
    packName: "Pack 2 · Librito 3 fotos + digitales",
    totalArs: 55000,
    photographerName: "Ceci Donnelly",
    redeemed: false,
    href: "/cliente/pack/5388",
  });
});

test("los packs sin pagar y los pedidos comunes de galería no se listan", () => {
  const rows = buildClientPreventaPackRows([
    packOrder({ id: 1, status: "PENDING" }),
    packOrder({ id: 2, status: "CANCELED" }),
    packOrder({ id: 3, origin: "STANDARD_CHECKOUT" }),
    packOrder({ id: 4, origin: "PACK_REDEMPTION" }),
  ]);
  assert.deepEqual(rows, []);
});

test("marca el pack como canjeado cuando ya tiene pedido de canje", () => {
  const [row] = buildClientPreventaPackRows([packOrder({ redemptionOrderId: 6001 })]);
  assert.equal(row.redeemed, true);
});

test("sin nombre de pack ni de fotógrafo usa textos de respaldo", () => {
  const [row] = buildClientPreventaPackRows([
    packOrder({
      preventaPackSnapshotJson: null,
      album: { title: "Álbum", user: { name: "  ", email: "foto@example.com" } },
    }),
  ]);
  assert.equal(row.packName, "Pack de preventa");
  assert.equal(row.photographerName, "foto@example.com");
});
