import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => (await import("../circuitos/base-en-memoria")).crearBaseEnMemoria());
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
const PERMISO = { configurar: true };
vi.mock("@/lib/presupuestos/acceso", () => ({ puedeConfigurarPresupuestos: () => PERMISO.configurar, MENSAJES_PRESUPUESTO: { sinPermisoAjustes: "sin permiso", datosInvalidos: "datos inválidos" } }));
vi.mock("@/lib/geocode/nominatim", () => ({ geocodingProvider: () => ({ search: async () => [] }) }));

const H = await import("./por-horas");
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- base en memoria
const P = B.prisma as Record<string, any>;
const ctx = { workspaceId: "w1", userId: 7 } as never;

beforeEach(() => {
  B.vaciar();
  PERMISO.configurar = true;
});

describe("ajustes del presupuesto por horas", () => {
  it("sin fila devuelve la omisión (apagado)", async () => {
    expect((await H.leerAjustesPorHoras("w1")).encendido).toBe(false);
  });

  it("guardar exige configurar", async () => {
    PERMISO.configurar = false;
    expect(await H.guardarAjustesPorHoras(ctx, { encendido: true })).toMatchObject({ ok: false });
  });

  it("al cambiar la dirección de partida la ubica en el mapa y la guarda", async () => {
    const geocodificar = vi.fn(async () => ({ lat: -32.9, lon: -60.8 }));
    const r = await H.guardarAjustesPorHoras(ctx, { encendido: true, pesosPorKm: 3000, partida: { direccion: "García del Cossio 2050, Funes" } }, { geocodificar });
    expect(r).toEqual({ ok: true });
    expect(geocodificar).toHaveBeenCalledWith("García del Cossio 2050, Funes");
    const a = await H.leerAjustesPorHoras("w1");
    expect(a).toMatchObject({ encendido: true, partida: { direccion: "García del Cossio 2050, Funes", lat: -32.9, lon: -60.8 } });
    // misma dirección: no vuelve a geocodificar y conserva las coordenadas
    await H.guardarAjustesPorHoras(ctx, { encendido: true, partida: { direccion: "García del Cossio 2050, Funes" } }, { geocodificar });
    expect(geocodificar).toHaveBeenCalledTimes(1);
    expect((await H.leerAjustesPorHoras("w1")).partida.lat).toBe(-32.9);
  });

  it("si la tabla no tiene la columna (P2021/P2022), leer da la omisión", async () => {
    const original = P.fotofficePresupuestoAutoAjustes;
    Object.defineProperty(B.prisma, "fotofficePresupuestoAutoAjustes", {
      configurable: true,
      value: { findUnique: async () => { throw Object.assign(new Error("x"), { code: "P2022" }); } },
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      expect((await H.leerAjustesPorHoras("w1")).encendido).toBe(false);
    } finally {
      Object.defineProperty(B.prisma, "fotofficePresupuestoAutoAjustes", { configurable: true, value: original });
    }
  });
});

describe("horas de la consulta", () => {
  it("se guardan en metaJson.porHoras sin pisar otras claves", async () => {
    B.agregar("serviceSalesLead", { id: "l1", workspaceId: "w1", metaJson: { origen: "web" } });
    await H.guardarPorHorasDeConsulta("w1", "l1", { horas: 3 });
    await H.guardarPorHorasDeConsulta("w1", "l1", { km: 10, traslado: 30000, ubicado: true });
    expect(B.datos.serviceSalesLead[0].metaJson).toEqual({ origen: "web", porHoras: { horas: 3, km: 10, traslado: 30000, ubicado: true } });
    expect(await H.leerPorHorasDeConsulta("w1", "l1")).toEqual({ horas: 3, km: 10, traslado: 30000, ubicado: true, segundoFotografo: false });
    expect(await H.leerPorHorasDeConsulta("w1", "otra")).toBeNull();
  });
});
