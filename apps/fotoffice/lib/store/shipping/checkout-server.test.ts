import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MiCorreoAgency } from "@/lib/integrations/correo-argentino/client";

const findUnique = vi.fn();
vi.mock("@repo/db", () => ({ prisma: { storeShippingSettings: { findUnique } } }));
vi.mock("@/lib/integrations/correo-argentino/credentials", () => ({
  loadCorreoArgentinoClient: vi.fn(async () => {
    throw new Error("no debe usarse en los tests");
  }),
  markCorreoNeedsReconsent: vi.fn(async () => undefined),
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

    expect(await pedir("s")).toEqual([{ id: "A1", name: "Centro", address: "Córdoba 721", city: "Rosario", postalCode: "2000" }]);
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

  it("vacía si sucursal está apagada, la fuente no es Correo o Correo no está conectado", async () => {
    const { agencies, loadCorreo } = correo(async () => agencias);
    findUnique.mockResolvedValue(settings({ branchDeliveryEnabled: false }));
    expect(await listAgenciesForCheckout({ workspaceId: "w1", provinceCode: "S", deps: { loadCorreo } })).toEqual([]);
    findUnique.mockResolvedValue(settings({ source: "TABLE" }));
    expect(await listAgenciesForCheckout({ workspaceId: "w1", provinceCode: "S", deps: { loadCorreo } })).toEqual([]);
    findUnique.mockResolvedValue(null);
    expect(await listAgenciesForCheckout({ workspaceId: "w1", provinceCode: "S", deps: { loadCorreo } })).toEqual([]);
    expect(agencies).not.toHaveBeenCalled();

    findUnique.mockResolvedValue(settings());
    expect(
      await listAgenciesForCheckout({ workspaceId: "w1", provinceCode: "S", deps: { loadCorreo: vi.fn(async () => null) } }),
    ).toEqual([]);
  });

  it("provincia inválida: vacía sin ir a la base", async () => {
    expect(await listAgenciesForCheckout({ workspaceId: "w1", provinceCode: "Ñ" })).toEqual([]);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("una falla de Correo da vacía y no queda en memoria", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    findUnique.mockResolvedValue(settings());
    let falla = true;
    const { agencies, loadCorreo } = correo(async () => {
      if (falla) throw new Error("caído");
      return agencias;
    });
    expect(await listAgenciesForCheckout({ workspaceId: "w1", provinceCode: "S", deps: { loadCorreo } })).toEqual([]);
    falla = false;
    expect(await listAgenciesForCheckout({ workspaceId: "w1", provinceCode: "S", deps: { loadCorreo } })).toHaveLength(1);
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
