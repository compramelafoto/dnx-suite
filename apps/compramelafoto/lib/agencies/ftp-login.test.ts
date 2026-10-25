import { beforeEach, describe, expect, it, vi } from "vitest";

const credFindUnique = vi.fn();
const credUpdateMany = vi.fn();
const presenceFindUnique = vi.fn();
const verifyFtpPassword = vi.fn();
const validateAlbum = vi.fn();
const findGate = vi.fn();
const awaitsFilterMock = vi.fn();
vi.mock("@/lib/agencies/publish-mode", () => ({ agencyAwaitsFilter: (...a: unknown[]) => awaitsFilterMock(...a) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agencyUploadCredential: { findUnique: (...a: unknown[]) => credFindUnique(...a), updateMany: (...a: unknown[]) => credUpdateMany(...a) },
    agencyMemberPresence: { findUnique: (...a: unknown[]) => presenceFindUnique(...a) },
  },
}));
vi.mock("@/lib/agencies/queries", () => ({ findAgencyAlbumGate: (...a: unknown[]) => findGate(...a) }));
vi.mock("@/lib/camera-connection/camera-connection-service", () => ({ validateActiveAlbumForCameraConnection: (...a: unknown[]) => validateAlbum(...a), verifyFtpPassword: (...a: unknown[]) => verifyFtpPassword(...a) }));

import { loginAgencyFtp, resolveAgencyFtpUpload } from "./ftp-login";

const cred = { id: 4, agencyId: 3, memberId: 7, albumId: 50, ftpUsername: "ag7", ftpPasswordHash: "h", revokedAt: null, member: { userId: 20 } };

beforeEach(() => {
  for (const f of [credFindUnique, credUpdateMany, presenceFindUnique, verifyFtpPassword, validateAlbum, findGate, awaitsFilterMock]) f.mockReset();
  awaitsFilterMock.mockResolvedValue(false);
  credUpdateMany.mockResolvedValue({ count: 1 });
  credFindUnique.mockResolvedValue({ albumId: 50, revokedAt: null });
  findGate.mockResolvedValue({ agencyId: 3, ownerUserId: 9, termsVersion: 1 });
});

describe("loginAgencyFtp", () => {
  it("usuario viejo (no está en la tabla de agencia): null para seguir el camino de siempre", async () => {
    credFindUnique.mockResolvedValue(null);
    expect(await loginAgencyFtp("u20", "x")).toBe(null);
  });
  it("credencial válida", async () => {
    credFindUnique.mockResolvedValue(cred);
    verifyFtpPassword.mockResolvedValue(true);
    validateAlbum.mockResolvedValue({ ok: true, album: { id: 50 } });
    expect(await loginAgencyFtp("ag7", "pw")).toEqual({
      ok: true,
      login: { agencyId: 3, userId: 20, ftpUsername: "ag7", albumId: 50, agencyCredentialId: 4, memberId: 7 },
    });
    expect(validateAlbum).toHaveBeenCalledWith(20, 50);
  });
  it("revocada, contraseña mala o sin acceso: falla", async () => {
    credFindUnique.mockResolvedValue({ ...cred, revokedAt: new Date() });
    expect(await loginAgencyFtp("ag7", "pw")).toMatchObject({ ok: false, code: 530 });
    credFindUnique.mockResolvedValue(cred);
    verifyFtpPassword.mockResolvedValue(false);
    expect(await loginAgencyFtp("ag7", "pw")).toMatchObject({ ok: false, code: 530 });
    verifyFtpPassword.mockResolvedValue(true);
    validateAlbum.mockResolvedValue({ ok: false, error: "no", status: 403 });
    expect(await loginAgencyFtp("ag7", "pw")).toMatchObject({ ok: false, code: 550 });
    validateAlbum.mockResolvedValue({ ok: true, album: { id: 50 } });
    findGate.mockResolvedValue(null);
    expect(await loginAgencyFtp("ag7", "pw")).toMatchObject({ ok: false, code: 550 });
    findGate.mockResolvedValue({ agencyId: 99, ownerUserId: 9, termsVersion: 1 });
    expect(await loginAgencyFtp("ag7", "pw")).toMatchObject({ ok: false, code: 550 });
  });
});

describe("resolveAgencyFtpUpload", () => {
  const login = { agencyId: 3, userId: 20, ftpUsername: "ag7", albumId: 50, agencyCredentialId: 4, memberId: 7 };
  it("usa el Estoy acá vigente y marca lastUsedAt", async () => {
    validateAlbum.mockResolvedValue({ ok: true, album: { id: 50 } });
    presenceFindUnique.mockResolvedValue({ lat: -38, lng: -57.5, validUntil: new Date("2027-01-19T02:59:59.999Z") });
    const r = await resolveAgencyFtpUpload(login, new Date("2027-01-18T20:00:00Z"));
    expect(r).toEqual({ ok: true, albumId: 50, declaredPoint: { lat: -38, lng: -57.5 }, awaitFilter: false });
    expect(credUpdateMany.mock.calls[0][0].where).toEqual({ id: 4, revokedAt: null });
  });
  it("agencia que espera al filtro: lo avisa para encolar en espera", async () => {
    validateAlbum.mockResolvedValue({ ok: true, album: { id: 50 } });
    presenceFindUnique.mockResolvedValue(null);
    awaitsFilterMock.mockResolvedValue(true);
    expect(await resolveAgencyFtpUpload(login, new Date())).toMatchObject({ ok: true, awaitFilter: true });
    expect(awaitsFilterMock).toHaveBeenCalledWith(3);
  });
  it("Estoy acá vencido: sin punto", async () => {
    validateAlbum.mockResolvedValue({ ok: true, album: { id: 50 } });
    presenceFindUnique.mockResolvedValue({ lat: -38, lng: -57.5, validUntil: new Date("2027-01-18T02:59:59.999Z") });
    expect(await resolveAgencyFtpUpload(login, new Date("2027-01-18T20:00:00Z"))).toMatchObject({ ok: true, declaredPoint: null });
  });
  it("álbum borrado: falla en el login y en la subida", async () => {
    credFindUnique.mockResolvedValue(cred);
    verifyFtpPassword.mockResolvedValue(true);
    validateAlbum.mockResolvedValue({ ok: false, error: "Álbum no encontrado", status: 404 });
    expect(await loginAgencyFtp("ag7", "pw")).toMatchObject({ ok: false, code: 550, message: "Álbum no encontrado" });
    expect(await resolveAgencyFtpUpload(login, new Date())).toEqual({ ok: false, message: "Álbum no encontrado" });
  });
  it("álbum pasado a otra agencia: falla", async () => {
    validateAlbum.mockResolvedValue({ ok: true, album: { id: 50 } });
    findGate.mockResolvedValue({ agencyId: 99, ownerUserId: 9, termsVersion: 1 });
    expect(await resolveAgencyFtpUpload(login, new Date())).toMatchObject({ ok: false });
  });
  it("revocada entre el login y la subida: falla", async () => {
    validateAlbum.mockResolvedValue({ ok: true, album: { id: 50 } });
    credUpdateMany.mockResolvedValue({ count: 0 });
    expect(await resolveAgencyFtpUpload(login, new Date())).toEqual({ ok: false, message: "Este usuario de FTP fue desactivado." });
    expect(presenceFindUnique).not.toHaveBeenCalled();
    credFindUnique.mockResolvedValue({ albumId: 50, revokedAt: new Date() });
    expect(await resolveAgencyFtpUpload(login, new Date())).toEqual({ ok: false, message: "Este usuario de FTP fue desactivado." });
  });
  it("cambiaron el álbum entre el login y la subida", async () => {
    credFindUnique.mockResolvedValue({ albumId: 51, revokedAt: null });
    validateAlbum.mockResolvedValue({ ok: true, album: { id: 51 } });
    presenceFindUnique.mockResolvedValue(null);
    const r = await resolveAgencyFtpUpload(login, new Date());
    expect(r).toEqual({ ok: true, albumId: 51, declaredPoint: null, awaitFilter: false });
    expect(validateAlbum).toHaveBeenCalledWith(20, 51);
    expect(findGate).toHaveBeenCalledWith(51);
  });
  it("si lo dieron de baja entre el login y la subida: falla", async () => {
    validateAlbum.mockResolvedValue({ ok: false, error: "Este álbum es de una agencia: sólo su equipo puede subir fotos.", status: 403 });
    expect(await resolveAgencyFtpUpload(login, new Date())).toEqual({ ok: false, message: "Este álbum es de una agencia: sólo su equipo puede subir fotos." });
  });
});
