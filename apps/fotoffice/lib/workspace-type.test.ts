import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock, updateMock, recordMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
  recordMock: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: { fotofficeWorkspaceBranding: { findUnique: findUniqueMock, update: updateMock } },
}));
vi.mock("@repo/db/fotoffice-team", () => ({ recordAdminEvent: recordMock }));

import { getOrganizationType, setOrganizationType } from "./workspace-type";
import { TIPOS } from "@/lib/landing/tipos";

beforeEach(() => vi.clearAllMocks());

describe("getOrganizationType", () => {
  it("devuelve el tipo guardado o null", async () => {
    findUniqueMock.mockResolvedValueOnce({ organizationType: "estudio" });
    expect(await getOrganizationType("w1")).toBe("estudio");
    findUniqueMock.mockResolvedValueOnce(null);
    expect(await getOrganizationType("w1")).toBeNull();
  });
});

describe("setOrganizationType", () => {
  it("rechaza un id inexistente", async () => {
    await expect(setOrganizationType("w1", "no-existe", 1)).rejects.toThrow("Tipo de organización desconocido.");
    expect(updateMock).not.toHaveBeenCalled();
  });
  it("pide completar los datos si no hay branding", async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    await expect(setOrganizationType("w1", TIPOS[0].id, 1)).rejects.toThrow("Completá primero los datos de la institución.");
    expect(updateMock).not.toHaveBeenCalled();
  });
  it("actualiza el branding y registra el evento", async () => {
    findUniqueMock.mockResolvedValueOnce({ organizationType: null });
    await setOrganizationType("w1", TIPOS[0].id, 7);
    expect(updateMock).toHaveBeenCalledWith({ where: { workspaceId: "w1" }, data: { organizationType: TIPOS[0].id } });
    expect(recordMock).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: "w1", actorUserId: 7, kind: "ORG_TYPE_SET" }));
  });
});
