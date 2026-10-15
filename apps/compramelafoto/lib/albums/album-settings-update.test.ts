import { beforeEach, describe, expect, it, vi } from "vitest";

const albumFindUnique = vi.fn();
const albumUpdate = vi.fn();
const appConfigFindUnique = vi.fn();
const loadSnapshot = vi.fn();
const ensureQueued = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    album: {
      findUnique: (...a: unknown[]) => albumFindUnique(...a),
      update: (...a: unknown[]) => albumUpdate(...a),
    },
    appConfig: { findUnique: (...a: unknown[]) => appConfigFindUnique(...a) },
  },
}));
vi.mock("@/lib/events/collaborative-event-pricing-lock", () => ({
  loadCollaborativeEventPricingSnapshot: (...a: unknown[]) => loadSnapshot(...a),
  MSG_ORGANIZER_CONTROLS_EVENT_DIGITAL_PRICING: "El organizador controla el precio",
}));
vi.mock("@/lib/hidden-album/prepare-hidden-album-photos", () => ({
  ensureAlbumPhotosQueuedForHiddenMode: (...a: unknown[]) => ensureQueued(...a),
}));

import { buildAlbumSettingsUpdateData, updateAlbumSettingsForOwner } from "./album-settings-update";

const existing = { eventId: null, eventDate: null, startsAt: null, endsAt: null };
const deps = { minDigitalPhotoPrice: 5000, locksPhotographerDigitalPricing: false };

describe("buildAlbumSettingsUpdateData (comportamiento actual del PATCH)", () => {
  it("título vacío → 400", () => {
    expect(buildAlbumSettingsUpdateData({ title: "  " }, existing, deps)).toMatchObject({ ok: false, status: 400 });
  });
  it("título se recorta", () => {
    expect(buildAlbumSettingsUpdateData({ title: " Hola " }, existing, deps)).toEqual({ ok: true, data: { title: "Hola" } });
  });
  it("álbum de evento: título y lugar se ignoran", () => {
    expect(buildAlbumSettingsUpdateData({ title: "X", location: "Y" }, { ...existing, eventId: 4 }, deps)).toEqual({ ok: true, data: {} });
  });
  it("precio en pesos, redondeado", () => {
    expect(buildAlbumSettingsUpdateData({ digitalPhotoPriceCents: 5000.4 }, existing, deps)).toEqual({ ok: true, data: { digitalPhotoPriceCents: 5000 } });
  });
  it("precio debajo del mínimo → 400 con el mínimo en el texto", () => {
    const r = buildAlbumSettingsUpdateData({ digitalPhotoPriceCents: 100 }, existing, deps);
    expect(r).toMatchObject({ ok: false, status: 400 });
    expect((r as { error: string }).error).toContain("5000");
    expect((r as { error: string }).error).toBe(
      "El precio por foto digital no puede ser menor al mínimo del sistema (5000 pesos)"
    );
  });
  it("precio con evento que bloquea precios → 403", () => {
    expect(buildAlbumSettingsUpdateData({ digitalPhotoPriceCents: 6000 }, existing, { ...deps, locksPhotographerDigitalPricing: true })).toMatchObject({ ok: false, status: 403 });
  });
  it("descuentos se ignoran en silencio si el evento bloquea precios", () => {
    expect(buildAlbumSettingsUpdateData({ digitalDiscount5Plus: 10 }, existing, { ...deps, locksPhotographerDigitalPricing: true })).toEqual({ ok: true, data: {} });
  });
  it("isPublic y hiddenPhotosEnabled son booleanos; retención inválida → null", () => {
    expect(buildAlbumSettingsUpdateData({ isPublic: true, hiddenPhotosEnabled: false, hiddenSelfieRetentionDays: -3 }, existing, deps))
      .toEqual({ ok: true, data: { isPublic: true, hiddenPhotosEnabled: false, hiddenSelfieRetentionDays: null } });
  });

  // Casos adicionales tomados del código real de la ruta.
  it("precio null o vacío → null; negativo o no numérico → null sin error", () => {
    expect(buildAlbumSettingsUpdateData({ digitalPhotoPriceCents: null }, existing, deps)).toEqual({ ok: true, data: { digitalPhotoPriceCents: null } });
    expect(buildAlbumSettingsUpdateData({ digitalPhotoPriceCents: -10 }, existing, deps)).toEqual({ ok: true, data: { digitalPhotoPriceCents: null } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(buildAlbumSettingsUpdateData({ digitalPhotoPriceCents: "abc" as any }, existing, deps)).toEqual({ ok: true, data: { digitalPhotoPriceCents: null } });
  });
  it("precio null con bloqueo del evento también da 403 (basta con mandarlo)", () => {
    expect(buildAlbumSettingsUpdateData({ digitalPhotoPriceCents: null }, existing, { ...deps, locksPhotographerDigitalPricing: true })).toMatchObject({ ok: false, status: 403, error: "El organizador controla el precio" });
  });
  it("bloqueo del evento se evalúa antes que el título vacío", () => {
    expect(buildAlbumSettingsUpdateData({ title: "", digitalPhotoPriceCents: 6000 }, existing, { ...deps, locksPhotographerDigitalPricing: true })).toMatchObject({ ok: false, status: 403 });
  });
  it("descuentos: parseFloat sin rango; vacío → null", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(buildAlbumSettingsUpdateData({ digitalDiscount5Plus: "12.5" as any, digitalDiscount10Plus: null, digitalDiscount20Plus: 150 }, existing, deps))
      .toEqual({ ok: true, data: { digitalDiscount5Plus: 12.5, digitalDiscount10Plus: null, digitalDiscount20Plus: 150 } });
  });
  it("lugar vacío → null", () => {
    expect(buildAlbumSettingsUpdateData({ location: "   " }, existing, deps)).toEqual({ ok: true, data: { location: null } });
  });
  it("fecha del evento escribe eventDate/startsAt/endsAt; fecha inválida → 400", () => {
    const r = buildAlbumSettingsUpdateData({ eventDate: "2026-10-20" }, existing, deps);
    expect(r.ok).toBe(true);
    expect(Object.keys((r as { data: object }).data).sort()).toEqual(["endsAt", "eventDate", "startsAt"]);
    expect(buildAlbumSettingsUpdateData({ eventDate: "no-es-fecha" }, existing, deps)).toMatchObject({ ok: false, status: 400 });
  });
  it("álbum de evento: la fecha se ignora", () => {
    expect(buildAlbumSettingsUpdateData({ eventDate: "2026-10-20" }, { ...existing, eventId: 4 }, deps)).toEqual({ ok: true, data: {} });
  });
});

describe("updateAlbumSettingsForOwner", () => {
  const baseAlbum = {
    id: 7, userId: 10, deletedAt: null, eventId: null, eventDate: null, startsAt: null, endsAt: null,
    title: "Viejo", location: null, isPublic: false, digitalPhotoPriceCents: 6000,
    digitalDiscount5Plus: null, digitalDiscount10Plus: null, digitalDiscount20Plus: null,
    hiddenPhotosEnabled: false, hiddenSelfieRetentionDays: null,
  };
  beforeEach(() => {
    albumFindUnique.mockReset();
    albumUpdate.mockReset();
    appConfigFindUnique.mockReset().mockResolvedValue({ minDigitalPhotoPrice: 5000 });
    loadSnapshot.mockReset().mockResolvedValue({ locksPhotographerDigitalPricing: false });
    ensureQueued.mockReset().mockResolvedValue(0);
  });

  it("álbum de otro fotógrafo → 404 y no escribe", async () => {
    albumFindUnique.mockResolvedValue({ ...baseAlbum, userId: 99 });
    const r = await updateAlbumSettingsForOwner({ actorUserId: 10, albumId: 7, patch: { title: "X" } });
    expect(r).toEqual({ ok: false, status: 404, error: "Álbum no encontrado" });
    expect(albumUpdate).not.toHaveBeenCalled();
  });
  it("álbum inexistente o borrado → 404", async () => {
    albumFindUnique.mockResolvedValue(null);
    expect(await updateAlbumSettingsForOwner({ actorUserId: 10, albumId: 7, patch: { title: "X" } })).toMatchObject({ ok: false, status: 404 });
    albumFindUnique.mockResolvedValue({ ...baseAlbum, deletedAt: new Date() });
    expect(await updateAlbumSettingsForOwner({ actorUserId: 10, albumId: 7, patch: { title: "X" } })).toMatchObject({ ok: false, status: 404 });
  });
  it("precio debajo del mínimo configurado → 400 con el mínimo", async () => {
    albumFindUnique.mockResolvedValue(baseAlbum);
    appConfigFindUnique.mockResolvedValue({ minDigitalPhotoPrice: 7000 });
    const r = await updateAlbumSettingsForOwner({ actorUserId: 10, albumId: 7, patch: { digitalPhotoPriceCents: 6500 } });
    expect(r).toMatchObject({ ok: false, status: 400 });
    expect((r as { error: string }).error).toContain("7000 pesos");
    expect(albumUpdate).not.toHaveBeenCalled();
  });
  it("sin cambios → 400", async () => {
    albumFindUnique.mockResolvedValue(baseAlbum);
    expect(await updateAlbumSettingsForOwner({ actorUserId: 10, albumId: 7, patch: {} })).toMatchObject({ ok: false, status: 400 });
  });
  it("descuentos de un evento que bloquea precios no se aplican", async () => {
    albumFindUnique.mockResolvedValue({ ...baseAlbum, eventId: 3 });
    loadSnapshot.mockResolvedValue({ locksPhotographerDigitalPricing: true });
    const r = await updateAlbumSettingsForOwner({ actorUserId: 10, albumId: 7, patch: { digitalDiscount5Plus: 10 } });
    expect(r).toMatchObject({ ok: false, status: 400 });
    expect(albumUpdate).not.toHaveBeenCalled();
  });
  it("guarda y devuelve before/after sólo de las claves cambiadas", async () => {
    albumFindUnique.mockResolvedValue(baseAlbum);
    albumUpdate.mockResolvedValue({ ...baseAlbum, title: "Nuevo", digitalPhotoPriceCents: 8000 });
    const r = await updateAlbumSettingsForOwner({ actorUserId: 10, albumId: 7, patch: { title: " Nuevo ", digitalPhotoPriceCents: 8000 } });
    expect(r).toEqual({
      ok: true,
      before: { title: "Viejo", digitalPhotoPriceCents: 6000 },
      after: { title: "Nuevo", digitalPhotoPriceCents: 8000 },
    });
    expect(albumUpdate.mock.calls[0][0]).toMatchObject({ where: { id: 7 }, data: { title: "Nuevo", digitalPhotoPriceCents: 8000 } });
    expect(ensureQueued).not.toHaveBeenCalled();
  });
  it("con fotos ocultas encendidas encola el análisis", async () => {
    albumFindUnique.mockResolvedValue(baseAlbum);
    albumUpdate.mockResolvedValue({ ...baseAlbum, hiddenPhotosEnabled: true });
    const r = await updateAlbumSettingsForOwner({ actorUserId: 10, albumId: 7, patch: { hiddenPhotosEnabled: true } });
    expect(r).toMatchObject({ ok: true, before: { hiddenPhotosEnabled: false }, after: { hiddenPhotosEnabled: true } });
    expect(ensureQueued).toHaveBeenCalledWith(7);
  });
});
