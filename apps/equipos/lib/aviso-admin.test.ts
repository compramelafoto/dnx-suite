import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ email: vi.fn() }));
vi.mock("@/lib/correo", () => ({ sendPortalEmail: m.email }));

import { avisarAlAdmin } from "./aviso-admin";

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  process.env.ADMIN_EMAIL = "admin@dnx.test";
});

describe("avisarAlAdmin", () => {
  it("manda al ADMIN_EMAIL y devuelve true si salió", async () => {
    m.email.mockResolvedValue({ success: true });
    expect(await avisarAlAdmin("x", "reporte_publicacion_admin", { detalle: "d" })).toBe(true);
    expect(m.email).toHaveBeenCalledWith("admin@dnx.test", "reporte_publicacion_admin", { detalle: "d" });
  });

  it("{ success: false } se registra con la plantilla y no rompe", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    m.email.mockResolvedValue({ success: false });
    expect(await avisarAlAdmin("publicaciones", "publicacion_en_revision_admin", {})).toBe(false);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("publicacion_en_revision_admin"));
  });

  it("un error del envío se registra y no rompe", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    m.email.mockRejectedValue(new Error("caído"));
    expect(await avisarAlAdmin("x", "cambio_serie_admin", {})).toBe(false);
    expect(error).toHaveBeenCalled();
  });

  it("sin ADMIN_EMAIL no intenta enviar", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    delete process.env.ADMIN_EMAIL;
    expect(await avisarAlAdmin("x", "cambio_serie_admin", {})).toBe(false);
    expect(m.email).not.toHaveBeenCalled();
  });
});
