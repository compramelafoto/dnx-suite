import { beforeEach, describe, expect, it, vi } from "vitest";

const findAgencyAlbumGate = vi.fn();
const findMembership = vi.fn();
vi.mock("./queries", () => ({
  findAgencyAlbumGate: (...a: unknown[]) => findAgencyAlbumGate(...a),
  findMembership: (...a: unknown[]) => findMembership(...a),
}));

import { AGENCY_UPLOAD_DENIED, checkAgencyAlbumUpload } from "./access";

beforeEach(() => {
  findAgencyAlbumGate.mockReset();
  findMembership.mockReset();
});

describe("checkAgencyAlbumUpload", () => {
  it("álbum común: no es de agencia", async () => {
    findAgencyAlbumGate.mockResolvedValue(null);
    expect(await checkAgencyAlbumUpload(1, 9)).toEqual({ agencyAlbum: false });
    expect(findMembership).not.toHaveBeenCalled();
  });
  it("el dueño siempre puede", async () => {
    findAgencyAlbumGate.mockResolvedValue({ agencyId: 3, ownerUserId: 9, termsVersion: 1 });
    expect(await checkAgencyAlbumUpload(1, 9)).toEqual({ agencyAlbum: true, allowed: true });
  });
  it("miembro activo con condiciones vigentes puede", async () => {
    findAgencyAlbumGate.mockResolvedValue({ agencyId: 3, ownerUserId: 9, termsVersion: 2 });
    findMembership.mockResolvedValue({ id: 1, status: "ACTIVE", termsVersionAccepted: 2, commissionBps: null });
    expect(await checkAgencyAlbumUpload(1, 20)).toEqual({ agencyAlbum: true, allowed: true });
    expect(findMembership).toHaveBeenCalledWith(3, 20);
  });
  it("activo con condiciones viejas: tiene que aceptarlas", async () => {
    findAgencyAlbumGate.mockResolvedValue({ agencyId: 3, ownerUserId: 9, termsVersion: 2 });
    findMembership.mockResolvedValue({ id: 1, status: "ACTIVE", termsVersionAccepted: 1, commissionBps: null });
    expect(await checkAgencyAlbumUpload(1, 20)).toEqual({
      agencyAlbum: true,
      allowed: false,
      error: "La agencia cambió sus condiciones: aceptalas en Agencias → Mis agencias para seguir subiendo.",
    });
  });
  it("cualquier otro: no", async () => {
    findAgencyAlbumGate.mockResolvedValue({ agencyId: 3, ownerUserId: 9, termsVersion: 1 });
    for (const m of [null, { id: 1, status: "REQUESTED", termsVersionAccepted: 1, commissionBps: null }, { id: 1, status: "REMOVED", termsVersionAccepted: 1, commissionBps: null }]) {
      findMembership.mockResolvedValue(m);
      expect(await checkAgencyAlbumUpload(1, 20)).toEqual({ agencyAlbum: true, allowed: false, error: AGENCY_UPLOAD_DENIED });
    }
  });
});
