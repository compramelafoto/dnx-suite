import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  update: vi.fn(), album: vi.fn(), albumUpd: vi.fn(), photo: vi.fn(), photoUpd: vi.fn(), ext: vi.fn(), job: vi.fn(), reset: vi.fn(), lock: vi.fn(), surcharge: vi.fn(),
}));
vi.mock("@/lib/pricing/album-extension-surcharge", () => ({ loadAlbumExtensionSurchargeModeForPhotographer: (...a: unknown[]) => m.surcharge(...a) }));
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
import { runBotTurn } from "@repo/dnx-bot";
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
  it("actualizar_album: álbum ajeno → describe lanza 'no encontré' (sin tarjeta, no llama a update)", async () => {
    m.album.mockResolvedValue(null);
    await expect(tool("actualizar_album").describe!({ albumId: 3, cambios: { isPublic: true } }, actor)).rejects.toThrow("No encontré ese álbum en tu cuenta.");
    expect(m.album).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 3, userId: 7, deletedAt: null } }));
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
  it("actualizar_album: undo de fecha/hora vuelve al formato de parche (ida y vuelta por JSON)", async () => {
    const original = {
      eventDate: new Date("2026-11-02T03:00:00Z"),
      startsAt: new Date("2026-11-02T22:00:00Z"), // 19:00 ART
      endsAt: new Date("2026-11-03T01:30:00Z"), // 22:30 ART
    };
    m.update.mockResolvedValueOnce({ ok: true, before: { ...original }, after: {} });
    const r = (await tool("actualizar_album").run({ albumId: 3, cambios: { eventDate: "2026-12-01", eventStartTime: "10:00" } }, actor)) as { before: unknown };
    const guardado = JSON.parse(JSON.stringify(r.before));
    m.update.mockResolvedValueOnce({ ok: true, before: {}, after: {} });
    await tool("actualizar_album").undo!(guardado, actor);
    expect(m.update).toHaveBeenLastCalledWith({
      actorUserId: 7,
      albumId: 3,
      patch: { eventDate: "2026-11-02", eventStartTime: "19:00", eventEndTime: "22:30" },
    });
  });
  it("actualizar_album: describe de selfies sin días dice 'el tiempo por defecto'", async () => {
    m.album.mockResolvedValue({ id: 3, title: "A", eventId: null });
    const d = await tool("actualizar_album").describe!({ albumId: 3, cambios: { hiddenSelfieRetentionDays: null } }, actor);
    expect(d).toContain("el tiempo por defecto");
    expect(d).not.toContain("días");
  });
  it("configurar_venta_por_reconocimiento: describe sin precio dice que falta", async () => {
    m.album.mockResolvedValue({ id: 3, title: "A" });
    const d = await tool("configurar_venta_por_reconocimiento").describe!({ albumId: 3, habilitar: true }, actor);
    expect(d).toContain("falta el precio");
    expect(d).not.toContain("$0");
  });
  it("extender_vencimiento: si falla la extensión devuelve mensaje claro", async () => {
    m.album.mockResolvedValue({ id: 3, title: "A" });
    m.ext.mockRejectedValue(new Error("boom"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await tool("extender_vencimiento").run({ albumId: 3, dias: 30 }, actor);
    spy.mockRestore();
    expect(r).toMatchObject({ ok: false, message: "No pude extender el álbum. Probá de nuevo o abrí un pedido de soporte." });
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
  it("configurar_venta_por_reconocimiento: describe de álbum ajeno lanza", async () => {
    m.album.mockResolvedValue(null);
    await expect(tool("configurar_venta_por_reconocimiento").describe!({ albumId: 3, habilitar: false }, actor)).rejects.toThrow("No encontré ese álbum");
  });
  it("cambiar_venta_de_foto: describe verifica dueño (foto ajena o inexistente lanza)", async () => {
    m.photo.mockResolvedValue(null);
    await expect(tool("cambiar_venta_de_foto").describe!({ albumId: 3, photoId: 1, sellPrint: false }, actor)).rejects.toThrow("No encontré esa foto");
    expect(m.photo).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 1, albumId: 3, album: { userId: 7, deletedAt: null } }) }));
    m.photo.mockResolvedValue({ id: 1 });
    expect(await tool("cambiar_venta_de_foto").describe!({ albumId: 3, photoId: 1, sellPrint: false }, actor)).toContain("no vender impresa");
  });
  it("reintentar_subida: describe verifica dueño (subida ajena lanza)", async () => {
    m.job.mockResolvedValue(null);
    await expect(tool("reintentar_subida").describe!({ albumId: 3, jobId: "j" }, actor)).rejects.toThrow("No encontré esa subida");
    expect(m.job).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "j", albumId: 3, album: { userId: 7, deletedAt: null } } }));
    m.job.mockResolvedValue({ id: "j" });
    expect(await tool("reintentar_subida").describe!({ albumId: 3, jobId: "j" }, actor)).toContain("j");
  });
  it("extender_vencimiento: describe de álbum ajeno lanza", async () => {
    m.album.mockResolvedValue(null);
    await expect(tool("extender_vencimiento").describe!({ albumId: 3, dias: 30 }, actor)).rejects.toThrow("No encontré ese álbum");
  });
  it("extender_vencimiento: describe avisa el recargo para compradores (porcentaje o monto fijo)", async () => {
    m.album.mockResolvedValue({ id: 3, title: "A", cleanupStatus: "NONE" });
    m.surcharge.mockResolvedValue({ kind: "PERCENT_OF_SUBTOTAL", percent: 15 });
    const d = await tool("extender_vencimiento").describe!({ albumId: 3, dias: 30 }, actor);
    expect(d).toContain("Mientras dure la extensión, los compradores pagan un recargo");
    expect(d).toContain("15%");
    expect(m.surcharge).toHaveBeenCalledWith(expect.anything(), 7);
    m.surcharge.mockResolvedValue({ kind: "FIXED_PER_30_DAYS", priceArs: 3000 });
    expect(await tool("extender_vencimiento").describe!({ albumId: 3, dias: 30 }, actor)).toContain("3.000");
  });
  it.each(["PENDING", "PROCESSING", "COMPLETED", "COMPLETED_WITH_REFERENCES"])(
    "extender_vencimiento: con limpieza %s no se propone ni se extiende",
    async (cleanupStatus) => {
      m.album.mockResolvedValue({ id: 3, title: "A", cleanupStatus });
      await expect(tool("extender_vencimiento").describe!({ albumId: 3, dias: 30 }, actor)).rejects.toThrow("ya se eliminaron o se están eliminando");
      expect(await tool("extender_vencimiento").run({ albumId: 3, dias: 30 }, actor)).toEqual({
        ok: false,
        message: "Las fotos de este álbum ya se eliminaron o se están eliminando; no se puede extender.",
      });
      expect(m.ext).not.toHaveBeenCalled();
    },
  );
  it("con el motor real: álbum ajeno → no se crea propuesta y el modelo recibe el error", async () => {
    m.album.mockResolvedValue(null);
    const responses = [
      { stop_reason: "tool_use", usage: {}, content: [{ type: "tool_use", id: "t1", name: "actualizar_album", input: { albumId: 99, cambios: { isPublic: true } } }] },
      { stop_reason: "end_turn", usage: {}, content: [{ type: "text", text: "No lo encontré." }] },
    ];
    const client = { beta: { messages: { stream: () => { const msg = responses.shift(); return { on: () => {}, finalMessage: async () => msg }; } } } };
    const proposeWrite = vi.fn();
    const onProposal = vi.fn();
    const r = await runBotTurn({
      client, model: "m", effort: "medium", systemGuide: "G", situation: "S", tools: albumTools, actor, history: [],
      userText: "publicá el 99", maxIterations: 3, onText: () => {}, proposeWrite, onProposal,
    });
    expect(proposeWrite).not.toHaveBeenCalled();
    expect(onProposal).not.toHaveBeenCalled();
    expect((r.appended[2]!.content as { is_error?: boolean }[])[0]).toMatchObject({ is_error: true });
    expect(JSON.stringify(r.appended[2]!.content)).toContain("No encontré ese álbum en tu cuenta.");
  });
});
