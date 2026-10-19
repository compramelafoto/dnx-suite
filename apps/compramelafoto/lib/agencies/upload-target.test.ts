import { beforeEach, describe, expect, it, vi } from "vitest";

const validateAlbum = vi.fn();
const findGate = vi.fn();
vi.mock("@/lib/camera-connection/camera-connection-service", () => ({
  validateActiveAlbumForCameraConnection: (...a: unknown[]) => validateAlbum(...a),
}));
vi.mock("@/lib/agencies/queries", () => ({ findAgencyAlbumGate: (...a: unknown[]) => findGate(...a) }));

import { AGENCY_TARGET_DENIED, checkAgencyUploadTarget } from "./upload-target";

beforeEach(() => {
  validateAlbum.mockReset();
  findGate.mockReset();
  validateAlbum.mockResolvedValue({ ok: true, album: { id: 50 } });
  findGate.mockResolvedValue({ agencyId: 3, ownerUserId: 9, termsVersion: 1 });
});

describe("checkAgencyUploadTarget", () => {
  it("álbum de esa agencia y miembro al día: ok", async () => {
    expect(await checkAgencyUploadTarget(3, 50, 20)).toEqual({ ok: true });
    expect(validateAlbum).toHaveBeenCalledWith(20, 50);
  });
  it("el álbum no deja subir (baja, condiciones, borrado): devuelve ese motivo", async () => {
    validateAlbum.mockResolvedValue({ ok: false, error: "La agencia cambió sus condiciones…", status: 403 });
    expect(await checkAgencyUploadTarget(3, 50, 20)).toEqual({ ok: false, message: "La agencia cambió sus condiciones…" });
  });
  it("álbum de otra agencia o que ya no es de agencia: no", async () => {
    findGate.mockResolvedValue({ agencyId: 4, ownerUserId: 9, termsVersion: 1 });
    expect(await checkAgencyUploadTarget(3, 50, 20)).toEqual({ ok: false, message: AGENCY_TARGET_DENIED });
    findGate.mockResolvedValue(null);
    expect(await checkAgencyUploadTarget(3, 50, 20, "otro")).toEqual({ ok: false, message: "otro" });
  });
});
