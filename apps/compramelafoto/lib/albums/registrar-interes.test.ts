import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ interest: vi.fn(), notif: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    albumInterest: { upsert: (...a: unknown[]) => m.interest(...a) },
    albumNotification: { upsert: (...a: unknown[]) => m.notif(...a) },
  },
}));
import { guardarInteresEnAlbum } from "./registrar-interes";

const expiresAt = new Date("2027-01-10T00:00:00Z");
const base = { albumId: 10, email: "juana@mail.com", name: "Juana", expiresAt, biometrico: null };

beforeEach(() => {
  m.interest.mockReset();
  m.notif.mockReset();
  m.interest.mockResolvedValue({ id: 55 });
  m.notif.mockResolvedValue({});
});

describe("guardarInteresEnAlbum", () => {
  it("whatsapp y apellido sin informar (bot) → no los toca en update y los crea en null", async () => {
    expect(await guardarInteresEnAlbum(base)).toEqual({ id: 55 });
    const i = m.interest.mock.calls[0][0];
    expect(i.update).toEqual({ name: "Juana", firstName: "Juana" });
    expect(i.create).toMatchObject({ whatsapp: null, lastName: null });
    const n = m.notif.mock.calls[0][0];
    expect(n.update).toEqual({ name: "Juana" });
    expect(n.create).toMatchObject({ whatsapp: null, lastName: null });
  });
  it("whatsapp null explícito → no lo manda en el update de AlbumInterest pero sí null en create", async () => {
    await guardarInteresEnAlbum({ ...base, whatsapp: null, lastName: null });
    const i = m.interest.mock.calls[0][0];
    expect("whatsapp" in i.update).toBe(false);
    expect(i.update.lastName).toBeNull();
    expect(i.create.whatsapp).toBeNull();
    expect(m.notif.mock.calls[0][0].update).toEqual({ name: "Juana", lastName: null, whatsapp: null });
  });
  it("con whatsapp → lo setea en los dos modelos", async () => {
    await guardarInteresEnAlbum({ ...base, whatsapp: "341", lastName: "Pérez" });
    expect(m.interest.mock.calls[0][0].update).toEqual({
      name: "Juana",
      firstName: "Juana",
      lastName: "Pérez",
      whatsapp: "341",
    });
    expect(m.notif.mock.calls[0][0].update).toEqual({ name: "Juana", lastName: "Pérez", whatsapp: "341" });
  });
  it("con biometría → setea consentimiento, selfie y cara en update y create", async () => {
    const consentAt = new Date("2026-10-12T10:00:00Z");
    await guardarInteresEnAlbum({
      ...base,
      whatsapp: "341",
      biometrico: { selfieKey: "selfies/a.jpg", faceId: "f1", consentAt },
    });
    const i = m.interest.mock.calls[0][0];
    expect(i.update).toMatchObject({
      biometricConsent: true,
      biometricConsentAt: consentAt,
      biometricDeletedAt: null,
      selfieKey: "selfies/a.jpg",
      faceId: "f1",
      expiresAt,
    });
    expect(i.create).toMatchObject({
      biometricConsent: true,
      biometricConsentAt: consentAt,
      selfieKey: "selfies/a.jpg",
      faceId: "f1",
      expiresAt,
    });
  });
  it("si falla AlbumNotification igual devuelve el interés", async () => {
    m.notif.mockRejectedValue(new Error("x"));
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await guardarInteresEnAlbum(base)).toEqual({ id: 55 });
    expect(spy).toHaveBeenCalledWith("Error creando AlbumNotification:", expect.any(Error));
    spy.mockRestore();
  });
});
