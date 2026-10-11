import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  update: vi.fn(), album: vi.fn(), albumUpd: vi.fn(), photo: vi.fn(), photoUpd: vi.fn(), ext: vi.fn(), job: vi.fn(), reset: vi.fn(), lock: vi.fn(),
}));
vi.mock("@/lib/albums/album-settings-update", () => ({ updateAlbumSettingsForOwner: (...a: unknown[]) => m.update(...a) }));
vi.mock("@/lib/album-extensions/request-album-extension", () => ({ requestAlbumExtension: (...a: unknown[]) => m.ext(...a) }));
vi.mock("@/lib/camera-connection/camera-ingest-job", () => ({ resetCameraIngestJobForRetry: (...a: unknown[]) => m.reset(...a) }));
vi.mock("@/lib/events/collaborative-event-pricing-lock", () => ({ loadCollaborativeEventPricingSnapshot: (...a: unknown[]) => m.lock(...a) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    album: { findFirst: (...a: unknown[]) => m.album(...a), update: (...a: unknown[]) => m.albumUpd(...a) },
    photo: { findFirst: (...a: unknown[]) => m.photo(...a), update: (...a: unknown[]) => m.photoUpd(...a) },
    cameraIngestJob: { findFirst: (...a: unknown[]) => m.job(...a) },
  },
}));
import { albumTools } from "./album";

const actor = { userId: 7, role: "PHOTOGRAPHER", email: "f@x.com", name: "F" };
const tool = (n: string) => albumTools.find((t) => t.name === n)!;
beforeEach(() => Object.values(m).forEach((f) => f.mockReset()));

describe("acciones de álbum", () => {
  it("actualizar_album: describe en pesos y en castellano", async () => {
    m.album.mockResolvedValue({ id: 3, title: "Egresados", eventId: null });
    const d = await tool("actualizar_album").describe!({ albumId: 3, cambios: { digitalPhotoPriceCents: 5000, isPublic: true } }, actor);
    expect(d).toContain("Egresados");
    expect(d).toContain("$");
    expect(d).toContain("5.000");
    expect(d).toContain("Publicar");
    expect(m.lock).not.toHaveBeenCalled();
  });
  it("actualizar_album: álbum ajeno → no encontrado (no llama a update)", async () => {
    m.album.mockResolvedValue(null);
    const d = await tool("actualizar_album").describe!({ albumId: 3, cambios: { isPublic: true } }, actor);
    expect(d).toContain("no encontré");
    expect(m.update).not.toHaveBeenCalled();
  });
  it("actualizar_album: en un evento avisa que nombre, lugar y fecha los maneja el organizador", async () => {
    m.album.mockResolvedValue({ id: 3, title: "Gala", eventId: 9 });
    const d = await tool("actualizar_album").describe!({ albumId: 3, cambios: { title: "Otro", eventDate: "2026-11-02", isPublic: true } }, actor);
    expect(d).toContain("Este álbum es parte de un evento");
    expect(d).toContain("el nombre y la fecha y el horario");
    expect(d).not.toContain("cambiar el nombre a");
    expect(d).toContain("Publicar");
    expect(m.lock).not.toHaveBeenCalled();
  });
  it("actualizar_album: evento con precio bloqueado → avisa rechazo de precio y descuentos ignorados", async () => {
    m.album.mockResolvedValue({ id: 3, title: "Gala", eventId: 9 });
    m.lock.mockResolvedValue({ locksPhotographerDigitalPricing: true });
    const d = await tool("actualizar_album").describe!({ albumId: 3, cambios: { digitalPhotoPriceCents: 6000, digitalDiscount5Plus: 10 } }, actor);
    expect(d).toContain("fijó el precio digital");
    expect(d).toContain("descuentos");
    expect(d).not.toContain("6.000");
  });
  it("actualizar_album: evento sin bloqueo → precio normal", async () => {
    m.album.mockResolvedValue({ id: 3, title: "Gala", eventId: 9 });
    m.lock.mockResolvedValue({ locksPhotographerDigitalPricing: false });
    const d = await tool("actualizar_album").describe!({ albumId: 3, cambios: { digitalPhotoPriceCents: 6000 } }, actor);
    expect(d).toContain("6.000");
    expect(d).not.toContain("fijó");
  });
  it("actualizar_album: run delega con el dueño y devuelve before/after", async () => {
    m.update.mockResolvedValue({ ok: true, before: { isPublic: false }, after: { isPublic: true } });
    const r = await tool("actualizar_album").run({ albumId: 3, cambios: { isPublic: true } }, actor);
    expect(m.update).toHaveBeenCalledWith({ actorUserId: 7, albumId: 3, patch: { isPublic: true } });
    expect(r).toMatchObject({ ok: true, before: { albumId: 3, valores: { isPublic: false } } });
  });
  it("actualizar_album: 'No hay cambios para aplicar' en un evento dice qué controla el organizador", async () => {
    m.update.mockResolvedValue({ ok: false, status: 400, error: "No hay cambios para aplicar" });
    m.album.mockResolvedValue({ eventId: 9 });
    const r = (await tool("actualizar_album").run({ albumId: 3, cambios: { title: "X", location: "Y" } }, actor)) as { ok: boolean; message: string };
    expect(r.ok).toBe(false);
    expect(r.message).toContain("el nombre y el lugar");
    expect(r.message).toContain("organizador");
  });
  it("actualizar_album: 'No hay cambios' fuera de un evento queda con el mensaje original", async () => {
    m.update.mockResolvedValue({ ok: false, status: 400, error: "No hay cambios para aplicar" });
    m.album.mockResolvedValue({ eventId: null });
    const r = (await tool("actualizar_album").run({ albumId: 3, cambios: { title: "X" } }, actor)) as { message: string };
    expect(r.message).toBe("No hay cambios para aplicar");
  });
  it("actualizar_album: undo vuelve a los valores anteriores", async () => {
    m.update.mockResolvedValue({ ok: true, before: {}, after: {} });
    await tool("actualizar_album").undo!({ albumId: 3, valores: { isPublic: false } }, actor);
    expect(m.update).toHaveBeenCalledWith({ actorUserId: 7, albumId: 3, patch: { isPublic: false } });
  });
  it("descuentos fuera de 0-100 no pasan el esquema", () => {
    expect(tool("actualizar_album").input.safeParse({ albumId: 3, cambios: { digitalDiscount5Plus: 150 } }).success).toBe(false);
  });
  it("cambiar_venta_de_foto: no deja las dos opciones apagadas", async () => {
    m.photo.mockResolvedValue({ id: 1, sellDigital: true, sellPrint: false, album: { userId: 7 } });
    const r = await tool("cambiar_venta_de_foto").run({ albumId: 3, photoId: 1, sellDigital: false }, actor);
    expect(r).toMatchObject({ ok: false });
    expect(m.photoUpd).not.toHaveBeenCalled();
  });
  it("cambiar_venta_de_foto: foto de otro fotógrafo → no encontrada; undo también verifica dueño", async () => {
    m.photo.mockResolvedValue({ id: 1, sellDigital: true, sellPrint: true, album: { userId: 99 } });
    expect(await tool("cambiar_venta_de_foto").run({ albumId: 3, photoId: 1, sellPrint: false }, actor)).toMatchObject({ ok: false });
    m.photo.mockResolvedValue(null);
    expect(await tool("cambiar_venta_de_foto").undo!({ albumId: 3, photoId: 1, sellDigital: true, sellPrint: true }, actor)).toMatchObject({ ok: false });
    expect(m.photoUpd).not.toHaveBeenCalled();
  });
  it("configurar_venta_por_reconocimiento: guarda en el álbum, en pesos, con dueño", async () => {
    m.album.mockResolvedValue({ id: 3, enableFaceBulkPurchase: false, faceBulkPriceCents: null });
    const r = await tool("configurar_venta_por_reconocimiento").run({ albumId: 3, habilitar: true, precio: 12000 }, actor);
    expect(m.album).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 3, userId: 7, deletedAt: null } }));
    expect(m.albumUpd).toHaveBeenCalledWith({ where: { id: 3 }, data: { enableFaceBulkPurchase: true, faceBulkPriceCents: 12000 } });
    expect(r).toMatchObject({ ok: true, before: { enableFaceBulkPurchase: false, faceBulkPriceCents: null } });
  });
  it("configurar_venta_por_reconocimiento: álbum ajeno y undo ajeno no escriben", async () => {
    m.album.mockResolvedValue(null);
    expect(await tool("configurar_venta_por_reconocimiento").run({ albumId: 3, habilitar: false }, actor)).toMatchObject({ ok: false });
    expect(await tool("configurar_venta_por_reconocimiento").undo!({ albumId: 3, enableFaceBulkPurchase: false, faceBulkPriceCents: null }, actor)).toMatchObject({ ok: false });
    expect(m.albumUpd).not.toHaveBeenCalled();
  });
  it("configurar_venta_por_reconocimiento: habilitar sin precio se rechaza", async () => {
    expect(await tool("configurar_venta_por_reconocimiento").run({ albumId: 3, habilitar: true }, actor)).toMatchObject({ ok: false });
    expect(m.albumUpd).not.toHaveBeenCalled();
  });
  it("extender_vencimiento: verifica dueño antes de extender", async () => {
    m.album.mockResolvedValue(null);
    expect(await tool("extender_vencimiento").run({ albumId: 3, dias: 30 }, actor)).toMatchObject({ ok: false });
    expect(m.ext).not.toHaveBeenCalled();
  });
  it("extender_vencimiento: dueño → extiende y muestra la fecha argentina", async () => {
    m.album.mockResolvedValue({ id: 3, title: "A" });
    m.ext.mockResolvedValue({ visibleUntil: new Date("2026-11-11T01:00:00Z"), availableUntil: new Date() });
    const r = (await tool("extender_vencimiento").run({ albumId: 3, dias: 30 }, actor)) as { ok: boolean; message: string };
    expect(m.ext).toHaveBeenCalledWith({ albumId: 3, daysToAdd: 30, requestedByRole: "PHOTOGRAPHER", requestedByUserId: 7 });
    expect(r.message).toContain("10/11/2026");
  });
  it("reintentar_subida: sólo dueño y sólo FAILED", async () => {
    m.job.mockResolvedValue({ id: "j", status: "PENDING", album: { userId: 7 } });
    expect(await tool("reintentar_subida").run({ albumId: 3, jobId: "j" }, actor)).toMatchObject({ ok: false });
    m.job.mockResolvedValue({ id: "j", status: "FAILED", album: { userId: 99 } });
    expect(await tool("reintentar_subida").run({ albumId: 3, jobId: "j" }, actor)).toMatchObject({ ok: false });
    expect(m.reset).not.toHaveBeenCalled();
    m.job.mockResolvedValue({ id: "j", status: "FAILED", album: { userId: 7 } });
    expect(await tool("reintentar_subida").run({ albumId: 3, jobId: "j" }, actor)).toMatchObject({ ok: true });
    expect(m.reset).toHaveBeenCalledTimes(1);
  });
});
