import { beforeEach, describe, expect, it, vi } from "vitest";

const credFindUnique = vi.fn();
const credUpdate = vi.fn();
const presenceFindUnique = vi.fn();
const verifyFtpPassword = vi.fn();
const checkAgencyAlbumUpload = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agencyUploadCredential: { findUnique: (...a: unknown[]) => credFindUnique(...a), update: (...a: unknown[]) => credUpdate(...a) },
    agencyMemberPresence: { findUnique: (...a: unknown[]) => presenceFindUnique(...a) },
  },
}));
vi.mock("@/lib/camera-connection/camera-connection-service", () => ({ verifyFtpPassword: (...a: unknown[]) => verifyFtpPassword(...a) }));
vi.mock("@/lib/agencies/access", () => ({ checkAgencyAlbumUpload: (...a: unknown[]) => checkAgencyAlbumUpload(...a) }));

import { loginAgencyFtp, resolveAgencyFtpUpload } from "./ftp-login";

const cred = { id: 4, agencyId: 3, memberId: 7, albumId: 50, ftpUsername: "ag7", ftpPasswordHash: "h", revokedAt: null, member: { userId: 20 } };

beforeEach(() => {
  for (const f of [credFindUnique, credUpdate, presenceFindUnique, verifyFtpPassword, checkAgencyAlbumUpload]) f.mockReset();
  credUpdate.mockResolvedValue({});
});

describe("loginAgencyFtp", () => {
  it("usuario viejo (no está en la tabla de agencia): null para seguir el camino de siempre", async () => {
    credFindUnique.mockResolvedValue(null);
    expect(await loginAgencyFtp("u20", "x")).toBe(null);
  });
  it("credencial válida", async () => {
    credFindUnique.mockResolvedValue(cred);
    verifyFtpPassword.mockResolvedValue(true);
    checkAgencyAlbumUpload.mockResolvedValue({ agencyAlbum: true, allowed: true });
    expect(await loginAgencyFtp("ag7", "pw")).toEqual({
      ok: true,
      login: { userId: 20, ftpUsername: "ag7", albumId: 50, agencyCredentialId: 4, memberId: 7 },
    });
    expect(checkAgencyAlbumUpload).toHaveBeenCalledWith(50, 20);
  });
  it("revocada, contraseña mala o sin acceso: falla", async () => {
    credFindUnique.mockResolvedValue({ ...cred, revokedAt: new Date() });
    expect(await loginAgencyFtp("ag7", "pw")).toMatchObject({ ok: false, code: 530 });
    credFindUnique.mockResolvedValue(cred);
    verifyFtpPassword.mockResolvedValue(false);
    expect(await loginAgencyFtp("ag7", "pw")).toMatchObject({ ok: false, code: 530 });
    verifyFtpPassword.mockResolvedValue(true);
    checkAgencyAlbumUpload.mockResolvedValue({ agencyAlbum: true, allowed: false, error: "no" });
    expect(await loginAgencyFtp("ag7", "pw")).toMatchObject({ ok: false, code: 550 });
    checkAgencyAlbumUpload.mockResolvedValue({ agencyAlbum: false });
    expect(await loginAgencyFtp("ag7", "pw")).toMatchObject({ ok: false, code: 550 });
  });
});

describe("resolveAgencyFtpUpload", () => {
  const login = { userId: 20, ftpUsername: "ag7", albumId: 50, agencyCredentialId: 4, memberId: 7 };
  it("usa el Estoy acá vigente y marca lastUsedAt", async () => {
    checkAgencyAlbumUpload.mockResolvedValue({ agencyAlbum: true, allowed: true });
    presenceFindUnique.mockResolvedValue({ lat: -38, lng: -57.5, validUntil: new Date("2027-01-19T02:59:59.999Z") });
    const r = await resolveAgencyFtpUpload(login, new Date("2027-01-18T20:00:00Z"));
    expect(r).toEqual({ ok: true, albumId: 50, declaredPoint: { lat: -38, lng: -57.5 } });
    expect(credUpdate.mock.calls[0][0].where).toEqual({ id: 4 });
  });
  it("Estoy acá vencido: sin punto", async () => {
    checkAgencyAlbumUpload.mockResolvedValue({ agencyAlbum: true, allowed: true });
    presenceFindUnique.mockResolvedValue({ lat: -38, lng: -57.5, validUntil: new Date("2027-01-18T02:59:59.999Z") });
    expect(await resolveAgencyFtpUpload(login, new Date("2027-01-18T20:00:00Z"))).toMatchObject({ ok: true, declaredPoint: null });
  });
  it("si lo dieron de baja entre el login y la subida: falla", async () => {
    checkAgencyAlbumUpload.mockResolvedValue({ agencyAlbum: true, allowed: false, error: "Este álbum es de una agencia: sólo su equipo puede subir fotos." });
    expect(await resolveAgencyFtpUpload(login, new Date())).toEqual({ ok: false, message: "Este álbum es de una agencia: sólo su equipo puede subir fotos." });
  });
});
