import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireAuth = vi.fn();
const memberFindUnique = vi.fn();
const agencyAlbumFindFirst = vi.fn();
const placeFindFirst = vi.fn();
const credFindFirst = vi.fn();
const credUpdateMany = vi.fn();
const presenceFindUnique = vi.fn();
const presenceUpsert = vi.fn();
const presenceDeleteMany = vi.fn();
const issue = vi.fn();
const revoke = vi.fn();
vi.mock("@/lib/auth", () => ({ requireAuth: (...a: unknown[]) => requireAuth(...a) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agencyMember: { findUnique: (...a: unknown[]) => memberFindUnique(...a) },
    agencyAlbum: { findFirst: (...a: unknown[]) => agencyAlbumFindFirst(...a) },
    agencyPlace: { findFirst: (...a: unknown[]) => placeFindFirst(...a) },
    agencyUploadCredential: {
      findFirst: (...a: unknown[]) => credFindFirst(...a),
      updateMany: (...a: unknown[]) => credUpdateMany(...a),
    },
    agencyMemberPresence: {
      findUnique: (...a: unknown[]) => presenceFindUnique(...a),
      upsert: (...a: unknown[]) => presenceUpsert(...a),
      deleteMany: (...a: unknown[]) => presenceDeleteMany(...a),
    },
  },
  Role: { PHOTOGRAPHER: "PHOTOGRAPHER", LAB_PHOTOGRAPHER: "LAB_PHOTOGRAPHER" },
}));
vi.mock("@/lib/agencies/ftp-credentials", () => ({
  AgencyMemberNotActiveError: class AgencyMemberNotActiveError extends Error {},
  issueAgencyFtpCredential: (...a: unknown[]) => issue(...a),
  revokeAgencyFtpCredentials: (...a: unknown[]) => revoke(...a),
}));
vi.mock("@/lib/camera-connection/camera-connection-api-helpers", () => ({
  getCameraConnectionFtpHost: () => "ftp.test",
  getCameraConnectionFtpPort: () => 21,
  isCameraConnectionFtpServerLive: () => false,
}));

import { GET as FTP_GET, POST as FTP_POST, PATCH as FTP_PATCH, DELETE as FTP_DELETE } from "./[agencyId]/ftp/route";
import { GET as AQUI_GET, POST as AQUI_POST, DELETE as AQUI_DELETE } from "./[agencyId]/estoy-aca/route";
import { endOfDayArgentina } from "@/lib/agencies/presence";

const ctx = (agencyId: string) => ({ params: Promise.resolve({ agencyId }) });
const req = (body: unknown) => ({ json: async () => body }) as any;

beforeEach(() => {
  for (const f of [requireAuth, memberFindUnique, agencyAlbumFindFirst, placeFindFirst, credFindFirst, credUpdateMany, presenceFindUnique, presenceUpsert, presenceDeleteMany, issue, revoke]) f.mockReset();
  requireAuth.mockResolvedValue({ error: null, user: { id: 20 } });
  memberFindUnique.mockResolvedValue({ id: 7, status: "ACTIVE" });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ftp del miembro", () => {
  it("POST con un álbum que no es de la agencia: 400 y no emite", async () => {
    agencyAlbumFindFirst.mockResolvedValue(null);
    const res = await FTP_POST(req({ albumId: 9 }), ctx("3"));
    expect(res.status).toBe(400);
    expect(issue).not.toHaveBeenCalled();
    expect(agencyAlbumFindFirst.mock.calls[0][0].where).toEqual({ agencyId: 3, albumId: 9 });
  });
  it("POST de miembro REQUESTED: 404", async () => {
    memberFindUnique.mockResolvedValue({ id: 7, status: "REQUESTED" });
    const res = await FTP_POST(req({ albumId: 9 }), ctx("3"));
    expect(res.status).toBe(404);
    expect(issue).not.toHaveBeenCalled();
  });
  it("POST válido devuelve usuario, contraseña, host y puerto", async () => {
    agencyAlbumFindFirst.mockResolvedValue({ albumId: 9 });
    issue.mockResolvedValue({ ftpUsername: "ag7", password: "abcd1234" });
    const res = await FTP_POST(req({ albumId: 9 }), ctx("3"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ftpUsername: "ag7", password: "abcd1234", host: "ftp.test", port: 21 });
    expect(issue).toHaveBeenCalledWith({ agencyId: 3, memberId: 7, albumId: 9 });
  });
  it("POST con choque de unicidad (P2002): 409", async () => {
    agencyAlbumFindFirst.mockResolvedValue({ albumId: 9 });
    issue.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    const res = await FTP_POST(req({ albumId: 9 }), ctx("3"));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/Ya se estaba creando/);
  });
  it("GET devuelve la credencial activa sin contraseña", async () => {
    credFindFirst.mockResolvedValue({ ftpUsername: "ag7", albumId: 9, lastUsedAt: null, album: { title: "Fiesta" } });
    agencyAlbumFindFirst.mockResolvedValue({ albumId: 9 });
    const body = await (await FTP_GET({} as any, ctx("3"))).json();
    expect(body).toEqual({ live: false, host: "ftp.test", port: 21, credential: { ftpUsername: "ag7", albumId: 9, albumTitle: "Fiesta", lastUsedAt: null, albumNotInAgency: false } });
    expect(credFindFirst.mock.calls[0][0].where).toEqual({ memberId: 7, revokedAt: null });
  });
  it("GET avisa si el álbum de la credencial ya no es de la agencia", async () => {
    credFindFirst.mockResolvedValue({ ftpUsername: "ag7", albumId: 9, lastUsedAt: null, album: { title: "Fiesta" } });
    agencyAlbumFindFirst.mockResolvedValue(null);
    const body = await (await FTP_GET({} as any, ctx("3"))).json();
    expect(body.credential.albumNotInAgency).toBe(true);
    expect(agencyAlbumFindFirst.mock.calls[0][0].where).toEqual({ agencyId: 3, albumId: 9 });
  });
  it("PATCH cambia el álbum de la credencial activa si es de la agencia", async () => {
    agencyAlbumFindFirst.mockResolvedValue({ albumId: 10 });
    credUpdateMany.mockResolvedValue({ count: 1 });
    const res = await FTP_PATCH(req({ albumId: 10 }), ctx("3"));
    expect(res.status).toBe(200);
    expect(credUpdateMany.mock.calls[0][0]).toEqual({ where: { memberId: 7, revokedAt: null }, data: { albumId: 10 } });
  });
  it("DELETE revoca", async () => {
    revoke.mockResolvedValue(1);
    const res = await FTP_DELETE({} as any, ctx("3"));
    expect(res.status).toBe(200);
    expect(revoke).toHaveBeenCalledWith(7);
  });
});

describe("estoy acá", () => {
  it("POST con placeId de otra agencia: 400", async () => {
    placeFindFirst.mockResolvedValue(null);
    const res = await AQUI_POST(req({ placeId: 55 }), ctx("3"));
    expect(res.status).toBe(400);
    expect(placeFindFirst.mock.calls[0][0].where).toEqual({ id: 55, agencyId: 3 });
    expect(presenceUpsert).not.toHaveBeenCalled();
  });
  it("POST con lat/lng inválidos: 400", async () => {
    const res = await AQUI_POST(req({ lat: 200, lng: 0 }), ctx("3"));
    expect(res.status).toBe(400);
    expect(presenceUpsert).not.toHaveBeenCalled();
  });
  it("POST con placeId válido hace upsert con validUntil = fin del día argentino", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-10-20T15:00:00Z");
    vi.setSystemTime(now);
    placeFindFirst.mockResolvedValue({ id: 5, lat: -38.02, lng: -57.53 });
    presenceUpsert.mockImplementation(async (a: any) => ({ ...a.create }));
    const res = await AQUI_POST(req({ placeId: 5 }), ctx("3"));
    expect(res.status).toBe(200);
    const args = presenceUpsert.mock.calls[0][0];
    expect(args.where).toEqual({ memberId: 7 });
    expect(args.create).toMatchObject({ memberId: 7, lat: -38.02, lng: -57.53, placeId: 5, validUntil: endOfDayArgentina(now) });
    expect(args.update).toMatchObject({ lat: -38.02, lng: -57.53, placeId: 5, validUntil: endOfDayArgentina(now) });
  });
  it("POST con lat/lng válidos guarda sin placeId", async () => {
    presenceUpsert.mockImplementation(async (a: any) => ({ ...a.create }));
    const res = await AQUI_POST(req({ lat: -34.6, lng: -58.4 }), ctx("3"));
    expect(res.status).toBe(200);
    expect(presenceUpsert.mock.calls[0][0].create).toMatchObject({ lat: -34.6, lng: -58.4, placeId: null });
  });
  it("GET con presencia vencida devuelve null", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-21T12:00:00Z"));
    presenceFindUnique.mockResolvedValue({ lat: 1, lng: 2, placeId: null, validUntil: new Date("2026-10-21T02:59:59Z") });
    expect(await (await AQUI_GET({} as any, ctx("3"))).json()).toEqual({ presence: null });
  });
  it("GET con presencia vigente la devuelve", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T12:00:00Z"));
    const validUntil = new Date("2026-10-21T02:59:59.999Z");
    presenceFindUnique.mockResolvedValue({ lat: 1, lng: 2, placeId: 5, validUntil });
    const body = await (await AQUI_GET({} as any, ctx("3"))).json();
    expect(body.presence).toMatchObject({ lat: 1, lng: 2, placeId: 5 });
  });
  it("DELETE borra la presencia", async () => {
    presenceDeleteMany.mockResolvedValue({ count: 1 });
    expect((await AQUI_DELETE({} as any, ctx("3"))).status).toBe(200);
    expect(presenceDeleteMany.mock.calls[0][0].where).toEqual({ memberId: 7 });
  });
});
