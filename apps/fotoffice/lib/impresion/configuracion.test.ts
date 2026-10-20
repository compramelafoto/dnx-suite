import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
const C = await import("./configuracion");
const { SALIDAS_INICIALES, TAMANOS_INICIALES } = await import("./medidas");

describe("configuración de impresión", () => {
  beforeEach(() => {
    B.vaciar();
    B.agregar("product", { id: "carnet", workspaceId: "ws-1", name: "Foto carnet", priceArs: "3500", isActive: true });
    B.agregar("product", { id: "ajeno", workspaceId: "ws-2", name: "Otro", priceArs: "1", isActive: true });
  });

  it("crea las dos impresoras y los siete tamaños una sola vez", async () => {
    await C.asegurarConfiguracion("ws-1");
    await C.asegurarConfiguracion("ws-1");
    const salidas = await C.listarSalidas("ws-1");
    expect(salidas.map((s) => s.nombre)).toEqual(["Epson L800", "Kodak 305"]);
    expect(salidas.find((s) => s.nombre === "Kodak 305")!.tamanos.map((t) => t.nombre)).toEqual(["10x15", "13x18", "15x20"]);
    expect(B.datos.fotofficeTamanoImpresion).toHaveLength(7);
  });

  it("la escala sale de lo que midió la regla y rechaza medidas absurdas", async () => {
    await C.asegurarConfiguracion("ws-1");
    const kodak = (await C.listarSalidas("ws-1")).find((s) => s.nombre === "Kodak 305")!;
    expect(await C.guardarEscala("ws-1", kodak.id, 99, 100)).toEqual({ ok: true });
    const otra = (await C.listarSalidas("ws-1")).find((s) => s.id === kodak.id)!;
    expect([otra.escalaXMil, otra.escalaYMil]).toEqual([1010, 1000]);
    expect((await C.guardarEscala("ws-1", kodak.id, 50, 100)).ok).toBe(false);
    expect((await C.guardarEscala("ws-2", kodak.id, 99, 100)).ok).toBe(false);
  });

  it("un carnet en la Kodak usa hoja 10x15; la Epson no acepta copias; otro negocio no puede", async () => {
    await C.asegurarConfiguracion("ws-1");
    const s = await C.listarSalidas("ws-1");
    const kodak = s.find((x) => x.nombre === "Kodak 305")!;
    const epson = s.find((x) => x.nombre === "Epson L800")!;
    const t10 = kodak.tamanos.find((t) => t.nombre === "10x15")!;
    expect(await C.guardarProduccion("ws-1", "carnet", { tipoPieza: "CARNET", salidaId: kodak.id, tamanoHojaId: t10.id, unidad: "HOJA" })).toEqual({ ok: true });
    expect(await C.leerProduccion("ws-1", "carnet")).toMatchObject({ tipoPieza: "CARNET", salidaId: kodak.id });
    expect((await C.guardarProduccion("ws-1", "carnet", { tipoPieza: "COPIA", salidaId: epson.id, tamanoHojaId: t10.id, unidad: "COPIA" })).ok).toBe(false);
    const a4 = epson.tamanos.find((t) => t.nombre === "A4")!;
    expect((await C.guardarProduccion("ws-1", "carnet", { tipoPieza: "CARNET", salidaId: kodak.id, tamanoHojaId: a4.id, unidad: "HOJA" })).ok).toBe(false);
    expect((await C.guardarProduccion("ws-2", "ajeno", { tipoPieza: "CARNET", salidaId: kodak.id, tamanoHojaId: t10.id, unidad: "HOJA" })).ok).toBe(false);
    expect(await C.produccionDeProductos("ws-1")).toEqual({ carnet: { tipoPieza: "CARNET" } });
    expect(await C.guardarProduccion("ws-1", "carnet", null)).toEqual({ ok: true });
    expect(await C.leerProduccion("ws-1", "carnet")).toBeNull();
  });

  it("tolera que otro pedido simultáneo ya haya sembrado (P2002)", async () => {
    const t = B.tablas.fotofficeTamanoImpresion as unknown as { create: (a: unknown) => Promise<unknown> };
    const original = t.create;
    t.create = async () => {
      // El pedido que ganó confirma la siembra completa; el nuestro choca con el índice único.
      const ids = new Map<string, string>();
      for (const x of TAMANOS_INICIALES) {
        ids.set(x.nombre, B.agregarDeOtraTransaccion("fotofficeTamanoImpresion", { workspaceId: "ws-1", nombre: x.nombre, anchoMm: x.anchoMm, altoMm: x.altoMm, orden: x.orden }).id as string);
      }
      for (const s of SALIDAS_INICIALES) {
        const f = B.agregarDeOtraTransaccion("fotofficeSalidaImpresion", { workspaceId: "ws-1", nombre: s.nombre, tipo: "LOCAL", ppp: s.ppp, nitidez: s.nitidez, admiteCopias: s.admiteCopias });
        for (const n of s.tamanos) B.agregarDeOtraTransaccion("fotofficeSalidaTamano", { salidaId: f.id, tamanoId: ids.get(n)! });
      }
      throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    };
    try {
      await expect(C.asegurarConfiguracion("ws-1")).resolves.toBeUndefined();
    } finally {
      t.create = original;
    }
    const salidas = await C.listarSalidas("ws-1");
    expect(salidas.map((s) => s.nombre)).toEqual(["Epson L800", "Kodak 305"]);
    expect(salidas.find((s) => s.nombre === "Kodak 305")!.tamanos).toHaveLength(3);
    expect(B.datos.fotofficeTamanoImpresion.filter((x) => x.workspaceId === "ws-1")).toHaveLength(7);
    expect(B.datos.fotofficeSalidaImpresion).toHaveLength(2);
  });
});
