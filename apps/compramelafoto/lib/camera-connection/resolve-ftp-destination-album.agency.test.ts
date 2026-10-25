import { beforeEach, describe, expect, it, vi } from "vitest";

const albumFindMany = vi.fn();
const albumFindUnique = vi.fn();
const checkAgencyAlbumUpload = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    album: {
      findMany: (...a: unknown[]) => albumFindMany(...a),
      findUnique: (...a: unknown[]) => albumFindUnique(...a),
    },
  },
  CameraConnectionAssignmentMode: { MANUAL: "MANUAL", ALBUM_EVENT_TIME: "ALBUM_EVENT_TIME" },
}));
vi.mock("@/lib/agencies/access", () => ({
  checkAgencyAlbumUpload: (...a: unknown[]) => checkAgencyAlbumUpload(...a),
}));

import { validateActiveAlbumForCameraConnection } from "./camera-connection-service";
import { resolveFtpDestinationAlbum } from "./resolve-ftp-destination-album";

const receivedAt = new Date("2026-10-10T15:00:00Z");
const candidate = (id: number) => ({
  id,
  userId: 9,
  isPublic: true,
  isHidden: false,
  startsAt: new Date("2026-10-10T12:00:00Z"),
  endsAt: new Date("2026-10-10T20:00:00Z"),
  eventDate: null,
});
const run = () =>
  resolveFtpDestinationAlbum({
    userId: 20,
    receivedAt,
    assignmentMode: "ALBUM_EVENT_TIME" as never,
    activeAlbumId: null,
  });

beforeEach(() => {
  albumFindMany.mockReset();
  albumFindUnique.mockReset();
  checkAgencyAlbumUpload.mockReset();
});

describe("resolveFtpDestinationAlbum (horario) con agencias", () => {
  it("un extraño no recibe un álbum público de agencia como destino", async () => {
    albumFindMany.mockResolvedValue([candidate(1)]);
    checkAgencyAlbumUpload.mockResolvedValue({ agencyAlbum: true, allowed: false, error: "x" });
    const r = await run();
    expect(r.ok).toBe(false);
  });
  it("un miembro activo sí lo recibe", async () => {
    albumFindMany.mockResolvedValue([candidate(1)]);
    checkAgencyAlbumUpload.mockResolvedValue({ agencyAlbum: true, allowed: true });
    expect(await run()).toEqual({ ok: true, albumId: 1 });
  });
  it("álbum público común sigue siendo candidato", async () => {
    albumFindMany.mockResolvedValue([candidate(2)]);
    checkAgencyAlbumUpload.mockResolvedValue({ agencyAlbum: false });
    expect(await run()).toEqual({ ok: true, albumId: 2 });
  });
});

describe("validateActiveAlbumForCameraConnection con agencias", () => {
  const album = { id: 1, title: "A", eventId: null, userId: 9, isPublic: true, isHidden: false, deletedAt: null };
  it("rechaza al extraño en un álbum de agencia público", async () => {
    albumFindUnique.mockResolvedValue(album);
    checkAgencyAlbumUpload.mockResolvedValue({ agencyAlbum: true, allowed: false, error: "sólo equipo" });
    expect(await validateActiveAlbumForCameraConnection(20, 1)).toEqual({ ok: false, error: "sólo equipo", status: 403 });
  });
  it("acepta al miembro habilitado aunque el álbum esté oculto", async () => {
    albumFindUnique.mockResolvedValue({ ...album, isPublic: false, isHidden: true });
    checkAgencyAlbumUpload.mockResolvedValue({ agencyAlbum: true, allowed: true });
    expect((await validateActiveAlbumForCameraConnection(20, 1)).ok).toBe(true);
  });
});
