import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MiCorreoAgency } from "@/lib/integrations/correo-argentino/client";

const findUnique = vi.fn();
const isCorreoArgentinoActive = vi.fn<(workspaceId: string) => Promise<boolean>>(async () => true);
vi.mock("@repo/db", () => ({ prisma: { storeShippingSettings: { findUnique } } }));
vi.mock("@/lib/integrations/correo-argentino/credentials", () => ({
  loadCorreoArgentinoClient: vi.fn(async () => {
    throw new Error("no debe usarse en los tests");
  }),
  markCorreoNeedsReconsent: vi.fn(async () => undefined),
  isCorreoArgentinoActive,
}));

const { listAgenciesForCheckout, loadAgenciesForOrder, loadCheckoutDeliveryOptions, quoteForCheckout, resetAgenciesCacheForTests } =
  await import("./checkout-server");

const lines = [{ productId: "p1", variantId: null, qty: 1 }];

function settings(over: Record<string, unknown> = {}) {
  return {
    homeDeliveryEnabled: true,
    branchDeliveryEnabled: true,
    pickupEnabled: true,
    source: "CORREO_ARGENTINO",
    tableAsFallback: false,
    originPostalCode: "2000",
    surchargeKind: "NONE",
    surchargeValue: 0,
    packagingGrams: 0,
    defaultUnitGrams: 500,
    boxLengthCm: 30,
    boxWidthCm: 20,
    boxHeightCm: 10,
    handlingNote: null,
    ...over,
  };
}

beforeEach(() => {
  findUnique.mockReset();
  isCorreoArgentinoActive.mockReset().mockResolvedValue(true);
  resetAgenciesCacheForTests();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("quoteForCheckout", () => {
  it("valida antes de cotizar y no llama al cotizador con basura", async () => {
    const quote = vi.fn();
    const r = await quoteForCheckout({ workspaceId: "w1", raw: { method: "HOME", postalCode: "x", provinceCode: "S", lines }, quote });
    expect(r.ok).toBe(false);
    expect(quote).not.toHaveBeenCalled();
  });

  it("pasa el pedido normalizado y devuelve sólo total y servicio", async () => {
    const quote = vi.fn(async () => ({
      ok: true as const,
      quote: {
        method: "HOME" as const,
        source: "TABLE" as const,
        baseMinor: 100,
        surchargeMinor: 10,
        totalMinor: 110,
        serviceName: "Envío a Rosario",
        package: { weightGrams: 500, lengthCm: 30, widthCm: 20, heightCm: 10 },
        raw: { zoneId: "z" },
      },
    }));
    const r = await quoteForCheckout({
      workspaceId: "w1",
      raw: { method: "HOME", postalCode: "S2000ABC", provinceCode: "s", lines },
      quote,
    });
    expect(r).toEqual({ ok: true, totalMinor: 110, serviceName: "Envío a Rosario" });
    expect(quote).toHaveBeenCalledWith({
      workspaceId: "w1",
      method: "HOME",
      destination: { postalCode: "2000", provinceCode: "S" },
      items: lines,
    });
  });

  it("si el cotizador revienta (la base, por ejemplo) es UNAVAILABLE y el log no lleva el mensaje", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const quote = vi.fn(async () => {
      throw new Error("conexión rechazada para ana@example.com");
    });
    const r = await quoteForCheckout({ workspaceId: "w1", raw: { method: "BRANCH", postalCode: "2000", provinceCode: "S", lines }, quote });
    expect(r).toEqual({ ok: false, message: "No pudimos calcular el envío. Probá de nuevo o elegí retiro en la sede." });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("ana@example.com");
  });

  it("sin retiro en la sede, la falla no lo sugiere", async () => {
    findUnique.mockResolvedValue(settings({ pickupEnabled: false }));
    const quote = vi.fn(async () => ({ ok: false as const, reason: "UNAVAILABLE" as const }));
    const r = await quoteForCheckout({ workspaceId: "w1", raw: { method: "HOME", postalCode: "2000", provinceCode: "S", lines }, quote });
    expect(r).toEqual({ ok: false, message: "No pudimos calcular el envío. Probá de nuevo en unos minutos." });
    expect(findUnique.mock.calls[0][0].where).toEqual({ workspaceId: "w1" });
  });
});

describe("loadCheckoutDeliveryOptions", () => {
  it("sin fila: sólo retiro", async () => {
    findUnique.mockResolvedValue(null);
    expect(await loadCheckoutDeliveryOptions("w1")).toEqual({ pickup: true, home: false, branch: false, handlingNote: null });
    expect(findUnique.mock.calls[0][0].where).toEqual({ workspaceId: "w1" });
  });
  it("con fila", async () => {
    findUnique.mockResolvedValue(settings({ handlingNote: "48 h" }));
    expect(await loadCheckoutDeliveryOptions("w1")).toEqual({ pickup: true, home: true, branch: true, handlingNote: "48 h" });
    expect(isCorreoArgentinoActive).toHaveBeenCalledWith("w1");
  });
  it("con Correo desconectado no ofrece lo que no se puede cotizar", async () => {
    isCorreoArgentinoActive.mockResolvedValue(false);
    findUnique.mockResolvedValue(settings());
    expect(await loadCheckoutDeliveryOptions("w1")).toEqual({ pickup: true, home: false, branch: false, handlingNote: null });
    findUnique.mockResolvedValue(settings({ tableAsFallback: true }));
    expect(await loadCheckoutDeliveryOptions("w1")).toMatchObject({ home: true, branch: false });
  });
  it("con la tabla como fuente no consulta la conexión de Correo", async () => {
    findUnique.mockResolvedValue(settings({ source: "TABLE" }));
    expect(await loadCheckoutDeliveryOptions("w1")).toMatchObject({ pickup: true, home: true, branch: false });
    expect(isCorreoArgentinoActive).not.toHaveBeenCalled();
  });
});

describe("listAgenciesForCheckout", () => {
  const agencias: MiCorreoAgency[] = [
    { id: "A1", name: "Centro", address: "Córdoba 721", city: "Rosario", postalCode: "2000" },
  ];

  function correo(list: () => Promise<MiCorreoAgency[]>) {
    const agencies = vi.fn(list);
    const loadCorreo = vi.fn(async () => ({
      customerId: "c1",
      client: { agencies, getToken: vi.fn(), validateUser: vi.fn(), rates: vi.fn() },
    }));
    return { agencies, loadCorreo };
  }

  it("lista y guarda en memoria 10 minutos por institución y provincia", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
    findUnique.mockResolvedValue(settings());
    const { agencies, loadCorreo } = correo(async () => agencias);
    const pedir = (provinceCode: string, workspaceId = "w1") =>
      listAgenciesForCheckout({ workspaceId, provinceCode, deps: { loadCorreo } });

    expect(await pedir("s")).toEqual({
      ok: true,
      agencies: [{ id: "A1", name: "Centro", address: "Córdoba 721", city: "Rosario", postalCode: "2000" }],
    });
    expect(agencies).toHaveBeenCalledWith({ customerId: "c1", provinceCode: "S" });
    await pedir("S");
    expect(agencies).toHaveBeenCalledTimes(1);
    await pedir("X");
    await pedir("S", "w2");
    expect(agencies).toHaveBeenCalledTimes(3);

    vi.setSystemTime(new Date("2026-10-05T12:10:01Z"));
    await pedir("S");
    expect(agencies).toHaveBeenCalledTimes(4);
  });

  const vacia = { ok: true, agencies: [] };
  const NO_SE_PUDO = "No pudimos calcular el envío. Probá de nuevo o elegí retiro en la sede.";

  it("vacía si sucursal está apagada o la fuente no es Correo", async () => {
    const { agencies, loadCorreo } = correo(async () => agencias);
    findUnique.mockResolvedValue(settings({ branchDeliveryEnabled: false }));
    expect(await listAgenciesForCheckout({ workspaceId: "w1", provinceCode: "S", deps: { loadCorreo } })).toEqual(vacia);
    findUnique.mockResolvedValue(settings({ source: "TABLE" }));
    expect(await listAgenciesForCheckout({ workspaceId: "w1", provinceCode: "S", deps: { loadCorreo } })).toEqual(vacia);
    findUnique.mockResolvedValue(null);
    expect(await listAgenciesForCheckout({ workspaceId: "w1", provinceCode: "S", deps: { loadCorreo } })).toEqual(vacia);
    expect(agencies).not.toHaveBeenCalled();
  });

  it("Correo no conectado es una falla con mensaje, no 'no hay sucursales'", async () => {
    findUnique.mockResolvedValue(settings());
    expect(
      await listAgenciesForCheckout({ workspaceId: "w1", provinceCode: "S", deps: { loadCorreo: vi.fn(async () => null) } }),
    ).toEqual({ ok: false, message: NO_SE_PUDO });
    findUnique.mockResolvedValue(settings({ pickupEnabled: false }));
    expect(
      await listAgenciesForCheckout({ workspaceId: "w1", provinceCode: "S", deps: { loadCorreo: vi.fn(async () => null) } }),
    ).toEqual({ ok: false, message: "No pudimos calcular el envío. Probá de nuevo en unos minutos." });
  });

  it("revisa la configuración y la conexión ANTES de la memoria", async () => {
    findUnique.mockResolvedValue(settings());
    const { agencies, loadCorreo } = correo(async () => agencias);
    const pedir = () => loadAgenciesForOrder({ workspaceId: "w1", provinceCode: "S", deps: { loadCorreo } });
    expect((await pedir()).ok).toBe(true);
    // La institución apagó la sucursal: lo guardado en memoria ya no se ofrece.
    findUnique.mockResolvedValue(settings({ branchDeliveryEnabled: false }));
    expect(await pedir()).toEqual(vacia);
    // Correo se desconectó: tampoco.
    findUnique.mockResolvedValue(settings());
    isCorreoArgentinoActive.mockResolvedValue(false);
    expect(await pedir()).toEqual({ ok: false });
    expect(agencies).toHaveBeenCalledTimes(1);
  });

  it("provincia inválida: vacía sin ir a la base", async () => {
    expect(await listAgenciesForCheckout({ workspaceId: "w1", provinceCode: "Ñ" })).toEqual(vacia);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("una falla de Correo da el mensaje y no queda en memoria", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    findUnique.mockResolvedValue(settings());
    let falla = true;
    const { agencies, loadCorreo } = correo(async () => {
      if (falla) throw new Error("caído");
      return agencias;
    });
    expect(await listAgenciesForCheckout({ workspaceId: "w1", provinceCode: "S", deps: { loadCorreo } })).toEqual({
      ok: false,
      message: NO_SE_PUDO,
    });
    falla = false;
    const r = await listAgenciesForCheckout({ workspaceId: "w1", provinceCode: "S", deps: { loadCorreo } });
    expect(r.ok && r.agencies).toHaveLength(1);
    expect(agencies).toHaveBeenCalledTimes(2);
  });

  it("para el pedido distingue la falla (Correo caído o desconectado) de la lista", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    findUnique.mockResolvedValue(settings());
    const caido = correo(async () => {
      throw new Error("caído");
    });
    expect(await loadAgenciesForOrder({ workspaceId: "w1", provinceCode: "S", deps: { loadCorreo: caido.loadCorreo } })).toEqual({ ok: false });
    expect(
      await loadAgenciesForOrder({ workspaceId: "w1", provinceCode: "S", deps: { loadCorreo: vi.fn(async () => null) } }),
    ).toEqual({ ok: false });
    const bien = correo(async () => agencias);
    expect(await loadAgenciesForOrder({ workspaceId: "w1", provinceCode: "S", deps: { loadCorreo: bien.loadCorreo } })).toEqual({
      ok: true,
      agencies: [{ id: "A1", name: "Centro", address: "Córdoba 721", city: "Rosario", postalCode: "2000" }],
    });
  });
});
