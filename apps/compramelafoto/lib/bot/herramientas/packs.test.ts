import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ album: vi.fn(), create: vi.fn(), pack: vi.fn(), update: vi.fn(), lock: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    album: { findFirst: (...a: unknown[]) => m.album(...a) },
    albumPack: { create: (...a: unknown[]) => m.create(...a), findFirst: (...a: unknown[]) => m.pack(...a), update: (...a: unknown[]) => m.update(...a) },
  },
}));
vi.mock("@/lib/events/collaborative-event-pricing-lock", () => ({
  loadCollaborativeEventPricingSnapshot: (...a: unknown[]) => m.lock(...a),
  MSG_ORGANIZER_CONTROLS_EVENT_DIGITAL_PRICING: "El organizador controla el precio digital",
}));
import { packTools } from "./packs";

const actor = { userId: 7, role: "PHOTOGRAPHER", email: "f@x.com", name: "F" };
const tool = (n: string) => packTools.find((t) => t.name === n)!;
beforeEach(() => Object.values(m).forEach((f) => f.mockReset()));

describe("crear_pack_digital", () => {
  it("álbum ajeno → no encontrado", async () => {
    m.album.mockResolvedValue(null);
    expect(await tool("crear_pack_digital").run({ albumId: 3, nombre: "5 fotos", precio: 15000, cantidadFotos: 5 }, actor)).toMatchObject({ ok: false });
    expect(m.album.mock.calls[0]![0].where).toMatchObject({ id: 3, userId: 7, deletedAt: null });
    expect(m.create).not.toHaveBeenCalled();
  });
  it("crea DIGITAL con selección y precio en pesos (sin componentes, como la ruta)", async () => {
    m.album.mockResolvedValue({ id: 3, title: "E", eventId: null });
    m.create.mockResolvedValue({ id: "pk11" });
    const r = await tool("crear_pack_digital").run({ albumId: 3, nombre: " 5 fotos ", precio: 15000, cantidadFotos: 5 }, actor);
    expect(m.create.mock.calls[0]![0].data).toEqual({
      albumId: 3, name: "5 fotos", description: null, price: 15000, packType: "DIGITAL", availabilityPhase: "ALWAYS",
      requiresSelection: true, requiresDesign: false, includedPhotoCount: 5, templateId: null, templateV2Id: null, isActive: true,
    });
    expect(r).toMatchObject({ ok: true, after: { packId: "pk11" } });
  });
  it("no corre en álbum de evento (el organizador maneja los precios)", async () => {
    m.album.mockResolvedValue({ id: 3, title: "E", eventId: 4 });
    expect(await tool("crear_pack_digital").run({ albumId: 3, nombre: "x", precio: 1, cantidadFotos: 1 }, actor)).toMatchObject({ ok: false });
    expect(m.create).not.toHaveBeenCalled();
  });
  it("describe en pesos y verifica el dueño", async () => {
    m.album.mockResolvedValue({ id: 3, title: "Egresados", eventId: null });
    const d = await tool("crear_pack_digital").describe!({ albumId: 3, nombre: "5 fotos", precio: 15000, cantidadFotos: 5 }, actor);
    expect(d).toContain("15.000");
    expect(d).toContain("Egresados");
    m.album.mockResolvedValue(null);
    await expect(tool("crear_pack_digital").describe!({ albumId: 3, nombre: "x", precio: 1, cantidadFotos: 1 }, actor)).rejects.toThrow("No encontré ese álbum");
  });
  it("no tiene deshacer (borrar packs está prohibido)", () => {
    expect(tool("crear_pack_digital").undo).toBeUndefined();
  });
});

describe("editar_pack", () => {
  const pack = { id: "pk11", name: "A", price: 100, isActive: true, packType: "PRINT", album: { eventId: null } };
  it("guarda el valor anterior para deshacer y verifica el dueño", async () => {
    m.pack.mockResolvedValue(pack);
    m.update.mockResolvedValue({});
    const r = await tool("editar_pack").run({ albumId: 3, packId: "pk11", precio: 200 }, actor);
    expect(m.pack.mock.calls[0]![0].where).toMatchObject({ id: "pk11", albumId: 3, album: { userId: 7, deletedAt: null } });
    expect(m.update.mock.calls[0]![0]).toEqual({ where: { id: "pk11" }, data: { price: 200 } });
    expect(r).toMatchObject({ ok: true, before: { albumId: 3, packId: "pk11", valores: { price: 100 } } });
  });
  it("describe de un pack ajeno o inexistente lanza (sin tarjeta)", async () => {
    m.pack.mockResolvedValue(null);
    await expect(tool("editar_pack").describe!({ albumId: 3, packId: "pk11", activo: false }, actor)).rejects.toThrow("No encontré ese pack");
    expect(m.pack.mock.calls[0]![0].where).toMatchObject({ id: "pk11", albumId: 3, album: { userId: 7, deletedAt: null } });
  });
  it("pack ajeno → no encontrado, no actualiza", async () => {
    m.pack.mockResolvedValue(null);
    expect(await tool("editar_pack").run({ albumId: 3, packId: "pk11", activo: false }, actor)).toMatchObject({ ok: false });
    expect(m.update).not.toHaveBeenCalled();
  });
  it("sin cambios → error", async () => {
    m.pack.mockResolvedValue(pack);
    expect(await tool("editar_pack").run({ albumId: 3, packId: "pk11" }, actor)).toMatchObject({ ok: false });
    expect(m.update).not.toHaveBeenCalled();
  });
  it("pack digital en evento con precio fijado por el organizador → rechaza (como la ruta)", async () => {
    m.pack.mockResolvedValue({ ...pack, packType: "DIGITAL", album: { eventId: 9 } });
    m.lock.mockResolvedValue({ locksPhotographerDigitalPricing: true });
    expect(await tool("editar_pack").run({ albumId: 3, packId: "pk11", precio: 1 }, actor)).toMatchObject({ ok: false, message: "El organizador controla el precio digital" });
    expect(m.update).not.toHaveBeenCalled();
  });
  it("deshacer tras ida y vuelta por JSON restaura los valores", async () => {
    m.pack.mockResolvedValue(pack);
    m.update.mockResolvedValue({});
    const r = await tool("editar_pack").run({ albumId: 3, packId: "pk11", nombre: "B", precio: 200, activo: false }, actor);
    if (!r.ok) throw new Error("debía andar");
    const before = JSON.parse(JSON.stringify(r.before));
    m.update.mockClear();
    expect(await tool("editar_pack").undo!(before, actor)).toMatchObject({ ok: true });
    expect(m.update.mock.calls[0]![0]).toEqual({ where: { id: "pk11" }, data: { name: "A", price: 100, isActive: true } });
  });
  it("deshacer de un pack ajeno → no encontrado", async () => {
    m.pack.mockResolvedValue(null);
    expect(await tool("editar_pack").undo!({ albumId: 3, packId: "pk11", valores: { price: 1 } }, actor)).toMatchObject({ ok: false });
    expect(m.update).not.toHaveBeenCalled();
  });
  it("deshacer ignora claves que no son del pack", async () => {
    m.pack.mockResolvedValue(pack);
    await tool("editar_pack").undo!({ albumId: 3, packId: "pk11", valores: { price: 1, albumId: 99, packType: "DIGITAL" } }, actor);
    expect(m.update.mock.calls[0]![0].data).toEqual({ price: 1 });
  });
});
