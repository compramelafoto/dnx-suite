import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ user: vi.fn(), other: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: (...a: unknown[]) => m.user(...a), findFirst: (...a: unknown[]) => m.other(...a), update: (...a: unknown[]) => m.update(...a) } } }));
vi.mock("@/lib/services/settingsService", () => ({ getAppConfig: async () => ({ minDigitalPhotoPrice: 5000 }) }));
import { perfilTools } from "./perfil";

const actor = { userId: 7, role: "PHOTOGRAPHER", email: "f@x.com", name: "F" };
const tool = (n: string) => perfilTools.find((t) => t.name === n)!;
beforeEach(() => Object.values(m).forEach((f) => f.mockReset()));

describe("actualizar_perfil", () => {
  it("el esquema rechaza campos de cobro, email y contraseña", () => {
    for (const k of ["mpAccessToken", "mpRefreshToken", "mpUserId", "mpConnectedAt", "cuit", "cbu", "alias", "email", "password"]) {
      expect(tool("actualizar_perfil").input.safeParse({ cambios: { [k]: "x" } }).success).toBe(false);
    }
  });
  it("handler en uso → error", async () => {
    m.user.mockResolvedValue({ publicPageHandler: null });
    m.other.mockResolvedValue({ id: 8 });
    expect(await tool("actualizar_perfil").run({ cambios: { publicPageHandler: "estudio" } }, actor)).toMatchObject({ ok: false });
    expect(m.other.mock.calls[0]![0].where).toEqual({ publicPageHandler: "estudio", id: { not: 7 } });
    expect(m.update).not.toHaveBeenCalled();
  });
  it("handler con espacios → error con el texto de la ruta", async () => {
    expect(await tool("actualizar_perfil").run({ cambios: { publicPageHandler: "mi estudio" } }, actor)).toMatchObject({ ok: false });
    expect(m.update).not.toHaveBeenCalled();
  });
  it("sólo escribe al usuario que habla", async () => {
    m.user.mockResolvedValue({ instagram: null });
    m.update.mockResolvedValue({});
    await tool("actualizar_perfil").run({ cambios: { instagram: " @yo " } }, actor);
    expect(m.user.mock.calls[0]![0].where).toEqual({ id: 7 });
    expect(m.update.mock.calls[0]![0]).toEqual({ where: { id: 7 }, data: { instagram: "@yo" } });
  });
  it("color null borra el color", async () => {
    m.user.mockResolvedValue({ primaryColor: "#000000" });
    m.update.mockResolvedValue({});
    await tool("actualizar_perfil").run({ cambios: { primaryColor: null } }, actor);
    expect(m.update.mock.calls[0]![0].data).toEqual({ primaryColor: null });
  });
  it("describe en castellano, sin nombres de columnas", async () => {
    const d = await tool("actualizar_perfil").describe!({ cambios: { instagram: "@yo", isPublicPageEnabled: true } }, actor);
    expect(d).toContain("Instagram");
    expect(d).not.toContain("isPublicPageEnabled");
  });
  it("deshacer tras ida y vuelta por JSON restaura los valores", async () => {
    m.user.mockResolvedValue({ instagram: null, primaryColor: "#112233", publicPageHandler: "viejo", isPublicPageEnabled: false });
    m.other.mockResolvedValue(null);
    m.update.mockResolvedValue({});
    const r = await tool("actualizar_perfil").run({ cambios: { instagram: "@yo", primaryColor: "#AABBCC", publicPageHandler: "Nuevo", isPublicPageEnabled: true } }, actor);
    if (!r.ok) throw new Error("debía andar");
    expect(m.update.mock.calls[0]![0].data).toEqual({ instagram: "@yo", primaryColor: "#AABBCC", publicPageHandler: "nuevo", isPublicPageEnabled: true });
    const before = JSON.parse(JSON.stringify(r.before));
    m.update.mockClear();
    expect(await tool("actualizar_perfil").undo!(before, actor)).toMatchObject({ ok: true });
    expect(m.update.mock.calls[0]![0]).toEqual({
      where: { id: 7 },
      data: { instagram: null, primaryColor: "#112233", publicPageHandler: "viejo", isPublicPageEnabled: false },
    });
  });
  it("deshacer no escribe claves fuera del perfil (cobro)", async () => {
    m.update.mockResolvedValue({});
    m.other.mockResolvedValue(null);
    await tool("actualizar_perfil").undo!({ instagram: "x", mpAccessToken: "robado", cuit: "1" }, actor);
    expect(m.update.mock.calls[0]![0]).toEqual({ where: { id: 7 }, data: { instagram: "x" } });
  });
  it("deshacer con el handler viejo tomado por otro → error", async () => {
    m.other.mockResolvedValue({ id: 8 });
    expect(await tool("actualizar_perfil").undo!({ publicPageHandler: "viejo" }, actor)).toMatchObject({ ok: false });
    expect(m.update).not.toHaveBeenCalled();
  });
});

describe("actualizar_precios_por_defecto", () => {
  it("debajo del mínimo → error con el mínimo", async () => {
    m.user.mockResolvedValue({ defaultDigitalPhotoPrice: 6000 });
    const r = await tool("actualizar_precios_por_defecto").run({ cambios: { defaultDigitalPhotoPrice: 100 } }, actor);
    expect(r).toMatchObject({ ok: false });
    expect(r.message).toContain("5000");
    expect(m.update).not.toHaveBeenCalled();
  });
  it("el esquema no acepta otras claves", () => {
    expect(tool("actualizar_precios_por_defecto").input.safeParse({ cambios: { mpUserId: "1" } }).success).toBe(false);
  });
  it("describe en pesos", async () => {
    const d = await tool("actualizar_precios_por_defecto").describe!({ cambios: { defaultDigitalPhotoPrice: 7000, digitalDiscount5Plus: 10 } }, actor);
    expect(d).toContain("7.000");
    expect(d).toContain("10% desde 5 fotos");
  });
  it("deshacer tras ida y vuelta por JSON restaura los valores", async () => {
    m.user.mockResolvedValue({ defaultDigitalPhotoPrice: 6000, digitalDiscount5Plus: null, digitalDiscountsEnabled: false });
    m.update.mockResolvedValue({});
    const r = await tool("actualizar_precios_por_defecto").run({ cambios: { defaultDigitalPhotoPrice: 7000, digitalDiscount5Plus: 10, digitalDiscountsEnabled: true } }, actor);
    if (!r.ok) throw new Error("debía andar");
    expect(m.update.mock.calls[0]![0]).toEqual({ where: { id: 7 }, data: { defaultDigitalPhotoPrice: 7000, digitalDiscount5Plus: 10, digitalDiscountsEnabled: true } });
    const before = JSON.parse(JSON.stringify(r.before));
    m.update.mockClear();
    await tool("actualizar_precios_por_defecto").undo!(before, actor);
    expect(m.update.mock.calls[0]![0]).toEqual({ where: { id: 7 }, data: { defaultDigitalPhotoPrice: 6000, digitalDiscount5Plus: null, digitalDiscountsEnabled: false } });
  });
});
