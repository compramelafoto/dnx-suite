import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  branding: vi.fn(),
  crear: vi.fn(),
  notificar: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  Prisma: { JsonNull: null },
  prisma: {
    fotofficeWorkspaceBranding: { findUnique: H.branding },
    serviceSalesLead: { create: H.crear },
  },
}));
vi.mock("@/lib/circuitos/eventos", () => ({ notificarEvento: H.notificar }));

const { createServiceLead } = await import("./service-lead");

const ENTRADA = { workspaceSlug: "dnx-estudio", name: "Laura Pérez", email: "laura@example.com", eventType: "BODA" };

beforeEach(() => {
  vi.clearAllMocks();
  H.branding.mockResolvedValue({ workspaceId: "ws-1", publicSlug: "dnx-estudio" });
  H.crear.mockResolvedValue({ id: "lead-9" });
  H.notificar.mockResolvedValue({ movido: true });
});

describe("createServiceLead", () => {
  it("crea la consulta y avisa CONSULTA_RECIBIDA al motor con el workspace del slug", async () => {
    expect(await createServiceLead(ENTRADA)).toEqual({ success: true });
    expect(H.crear).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ workspaceId: "ws-1", status: "NEW" }) }));
    expect(H.notificar).toHaveBeenCalledWith("ws-1", { tipo: "CAPTACION", id: "lead-9" }, "CONSULTA_RECIBIDA", "lead-9");
  });

  it("una falla del motor no hace fallar el alta", async () => {
    const errores = vi.spyOn(console, "error").mockImplementation(() => {});
    H.notificar.mockRejectedValue(new Error("motor caído"));
    expect(await createServiceLead(ENTRADA)).toEqual({ success: true });
    H.notificar.mockResolvedValue({ movido: false });
    expect(await createServiceLead(ENTRADA)).toEqual({ success: true });
    expect(JSON.stringify(errores.mock.calls)).not.toContain("Laura");
    errores.mockRestore();
  });

  it("sin workspace no crea ni avisa", async () => {
    H.branding.mockResolvedValue(null);
    expect(await createServiceLead(ENTRADA)).toEqual({ success: false, error: "Workspace no encontrado." });
    expect(H.crear).not.toHaveBeenCalled();
    expect(H.notificar).not.toHaveBeenCalled();
  });

  it("si falla el alta, no registra los datos de la persona", async () => {
    const errores = vi.spyOn(console, "error").mockImplementation(() => {});
    H.crear.mockRejectedValue(Object.assign(new Error("Invalid value laura@example.com Laura Pérez"), { code: "P2000" }));
    expect(await createServiceLead(ENTRADA)).toEqual({ success: false, error: "No se pudo registrar el lead." });
    const registrado = JSON.stringify(errores.mock.calls);
    expect(registrado).not.toContain("laura@example.com");
    expect(registrado).toContain("P2000");
    expect(H.notificar).not.toHaveBeenCalled();
    errores.mockRestore();
  });

  it("no quedan console.log en el archivo", () => {
    const fuente = readFileSync(path.join(__dirname, "service-lead.ts"), "utf8");
    expect(fuente).not.toMatch(/console\.log/);
  });
});
