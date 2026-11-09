import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { CONOCIMIENTO_CLF } from "../bot/guia/conocimiento";
import {
  CAMPANA_ESCOLAR,
  MAX_ITEMS_CONSULTA,
  atribucionesPorToken,
  conocimientoVendedor,
  emailsCampanaEscolar,
  manejarConsultaVendedor,
  ventasDelPeriodo,
  type DepsConsultaVendedor,
  type PedidoCandidato,
} from "./consultas";

const DESDE = "2026-11-01T03:00:00.000Z";
const HASTA = "2026-12-01T03:00:00.000Z";

const pedido = (extra: Partial<PedidoCandidato>): PedidoCandidato => ({
  id: 1,
  userIds: [7],
  status: "PAID",
  createdAt: new Date("2026-11-15T15:00:00.000Z"),
  totalCents: 1000,
  currency: "ARS",
  checkoutPaymentSource: "MERCADO_PAGO",
  isTest: false,
  ...extra,
});

const buscarCon = (pedidos: PedidoCandidato[]) => {
  const pedidosHechos: Array<{ desde: Date; hasta: Date; userIds: number[] }> = [];
  const buscar = async (f: { desde: Date; hasta: Date; userIds: number[] }) => {
    pedidosHechos.push(f);
    return pedidos;
  };
  return { buscar, pedidosHechos };
};

describe("ventas del Vendedor", () => {
  it("ventas: cuenta sólo pagados posteriores al registro", async () => {
    const { buscar, pedidosHechos } = buscarCon([
      pedido({ id: 1, createdAt: new Date("2026-11-05T12:00:00.000Z"), totalCents: 5000 }),
      pedido({ id: 2, createdAt: new Date("2026-11-20T12:00:00.000Z"), totalCents: 3000 }),
    ]);
    const r = await ventasDelPeriodo(
      { desde: DESDE, hasta: HASTA, usuarios: [{ userId: 7, registradoEn: "2026-11-10T00:00:00.000Z" }] },
      buscar,
    );
    assert.deepEqual(r, [{ userId: 7, ventas: 1, totalPesos: 3000 }]);
    assert.deepEqual(pedidosHechos, [{ desde: new Date(DESDE), hasta: new Date(HASTA), userIds: [7] }]);
  });

  it("ventas: excluye reembolsados, cancelados, de prueba y canjes de pack", async () => {
    const { buscar } = buscarCon([
      pedido({ id: 1, status: "REFUNDED" }),
      pedido({ id: 2, status: "CANCELED" }),
      pedido({ id: 3, status: "FAILED" }),
      pedido({ id: 4, status: "PENDING" }),
      pedido({ id: 5, isTest: true }),
      pedido({ id: 6, checkoutPaymentSource: "PREPAID_PACK" }),
      pedido({ id: 7, checkoutPaymentSource: "SIMULATED" }),
      // Fuera del período (el límite de arriba no entra).
      pedido({ id: 8, createdAt: new Date(HASTA) }),
      pedido({ id: 9, createdAt: new Date("2026-10-31T12:00:00.000Z") }),
      pedido({ id: 10, totalCents: 2500 }),
    ]);
    const r = await ventasDelPeriodo(
      { desde: DESDE, hasta: HASTA, usuarios: [{ userId: 7, registradoEn: "2026-01-01T00:00:00.000Z" }] },
      buscar,
    );
    assert.deepEqual(r, [{ userId: 7, ventas: 1, totalPesos: 2500 }]);
  });

  it("ventas: suma pesos sólo en ARS y devuelve 0 a quien no vendió", async () => {
    const { buscar } = buscarCon([
      pedido({ id: 1, totalCents: 4000 }),
      pedido({ id: 2, totalCents: 90, currency: "USD" }),
    ]);
    const r = await ventasDelPeriodo(
      {
        desde: DESDE,
        hasta: HASTA,
        usuarios: [
          { userId: 7, registradoEn: "2026-01-01T00:00:00.000Z" },
          { userId: 8, registradoEn: "2026-01-01T00:00:00.000Z" },
        ],
      },
      buscar,
    );
    assert.deepEqual(r, [
      { userId: 7, ventas: 2, totalPesos: 4000 },
      { userId: 8, ventas: 0, totalPesos: 0 },
    ]);
  });

  it("ventas del organizador por sus eventos y de la escuela por sus organizadores", async () => {
    // Pedido 1: álbum del fotógrafo 7 en un evento creado por el organizador 20.
    // Pedido 2: álbum del fotógrafo 7 de una escuela cuyo organizador activo es 30.
    // Pedido 3: el 7 aparece dos veces (dueño y creador): cuenta una sola vez.
    const { buscar } = buscarCon([
      pedido({ id: 1, userIds: [7, 20], totalCents: 1000 }),
      pedido({ id: 2, userIds: [7, 30], totalCents: 2000 }),
      pedido({ id: 3, userIds: [7, 7], totalCents: 500 }),
    ]);
    const r = await ventasDelPeriodo(
      {
        desde: DESDE,
        hasta: HASTA,
        usuarios: [
          { userId: 20, registradoEn: "2026-01-01T00:00:00.000Z" },
          { userId: 30, registradoEn: "2026-01-01T00:00:00.000Z" },
          { userId: 7, registradoEn: "2026-01-01T00:00:00.000Z" },
        ],
      },
      buscar,
    );
    assert.deepEqual(r, [
      { userId: 20, ventas: 1, totalPesos: 1000 },
      { userId: 30, ventas: 1, totalPesos: 2000 },
      { userId: 7, ventas: 3, totalPesos: 3500 },
    ]);
  });
});

describe("otras consultas del Vendedor", () => {
  it("atribuciones por token", async () => {
    let pedidos: string[] = [];
    const r = await atribucionesPorToken(["tok-uno-1234567890", "tok-uno-1234567890", "tok-dos-1234567890"], async (tokens) => {
      pedidos = tokens;
      return [{ token: "tok-uno-1234567890", userId: 5, rol: "PHOTOGRAPHER", creadoEn: new Date("2026-11-12T10:00:00.000Z") }];
    });
    assert.deepEqual(pedidos, ["tok-uno-1234567890", "tok-dos-1234567890"]);
    assert.deepEqual(r, [{ token: "tok-uno-1234567890", userId: 5, rol: "PHOTOGRAPHER", creadoEn: "2026-11-12T10:00:00.000Z" }]);
    assert.deepEqual(await atribucionesPorToken([], async () => { throw new Error("no debía consultar"); }), []);
  });

  it("campaña escolar: minúsculas y sin repetidos", async () => {
    assert.equal(CAMPANA_ESCOLAR, "dnx-escolar-2026-10");
    const r = await emailsCampanaEscolar(async () => ["Colegio@Mail.com", "colegio@mail.com ", "otro@mail.com"]);
    assert.deepEqual(r, ["colegio@mail.com", "otro@mail.com"]);
  });

  it("conocimiento: es CONOCIMIENTO_CLF y la versión no cambia entre llamadas", () => {
    const a = conocimientoVendedor();
    const b = conocimientoVendedor();
    assert.equal(a.texto, CONOCIMIENTO_CLF);
    assert.equal(a.version, createHash("sha256").update(CONOCIMIENTO_CLF).digest("hex").slice(0, 16));
    assert.match(a.version, /^[0-9a-f]{16}$/);
    assert.deepEqual(a, b);
  });
});

// ---------------------------------------------------------------------------------------------
// Ruta

const req = (body: unknown, auth?: string) =>
  new Request("https://www.compramelafoto.com/api/internal/vendedor", {
    method: "POST",
    headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const deps = (secreto: string | undefined): DepsConsultaVendedor => ({
  secreto,
  buscarAtribuciones: async () => [],
  buscarPedidos: async () => [pedido({ totalCents: 1500 })],
  buscarEmailsCampana: async () => ["A@b.com"],
});

describe("ruta interna del Vendedor", () => {
  it("sin secreto 503", async () => {
    const r = await manejarConsultaVendedor(req({ consulta: "conocimiento" }, "Bearer algo"), deps(undefined));
    assert.equal(r.status, 503);
  });

  it("secreto incorrecto 401", async () => {
    assert.equal((await manejarConsultaVendedor(req({ consulta: "conocimiento" }, "Bearer malo"), deps("bueno"))).status, 401);
    assert.equal((await manejarConsultaVendedor(req({ consulta: "conocimiento" }), deps("bueno"))).status, 401);
  });

  it("consulta desconocida 400", async () => {
    assert.equal((await manejarConsultaVendedor(req({ consulta: "otra" }, "Bearer s"), deps("s"))).status, 400);
    assert.equal((await manejarConsultaVendedor(req("{mal", "Bearer s"), deps("s"))).status, 400);
  });

  it("más de 500 tokens o usuarios 400", async () => {
    const tokens = Array.from({ length: MAX_ITEMS_CONSULTA + 1 }, (_, i) => `token-${i}-abcdefghijkl`);
    assert.equal((await manejarConsultaVendedor(req({ consulta: "atribuciones", tokens }, "Bearer s"), deps("s"))).status, 400);
    const usuarios = Array.from({ length: MAX_ITEMS_CONSULTA + 1 }, (_, i) => ({ userId: i + 1, registradoEn: DESDE }));
    assert.equal(
      (await manejarConsultaVendedor(req({ consulta: "ventas", desde: DESDE, hasta: HASTA, usuarios }, "Bearer s"), deps("s"))).status,
      400,
    );
  });

  it("responde cada consulta", async () => {
    const d = deps("s");
    const ventas = await manejarConsultaVendedor(
      req({ consulta: "ventas", desde: DESDE, hasta: HASTA, usuarios: [{ userId: 7, registradoEn: "2026-01-01T00:00:00.000Z" }] }, "Bearer s"),
      d,
    );
    assert.equal(ventas.status, 200);
    assert.deepEqual(await ventas.json(), { ventas: [{ userId: 7, ventas: 1, totalPesos: 1500 }] });

    const camp = await manejarConsultaVendedor(req({ consulta: "campana-escolar" }, "Bearer s"), d);
    assert.deepEqual(await camp.json(), { emails: ["a@b.com"] });

    const con = await manejarConsultaVendedor(req({ consulta: "conocimiento" }, "Bearer s"), d);
    assert.deepEqual(await con.json(), conocimientoVendedor());

    const atr = await manejarConsultaVendedor(req({ consulta: "atribuciones", tokens: ["tok-uno-1234567890"] }, "Bearer s"), d);
    assert.deepEqual(await atr.json(), { atribuciones: [] });

    const fechaMala = await manejarConsultaVendedor(req({ consulta: "ventas", desde: "ayer", hasta: HASTA, usuarios: [] }, "Bearer s"), d);
    assert.equal(fechaMala.status, 400);
  });
});
