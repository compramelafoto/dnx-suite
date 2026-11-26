import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  userFind: vi.fn(),
  phoneFind: vi.fn(),
  idFind: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT:${to}`);
  }),
}));
vi.mock("@repo/auth-guards", () => ({ getCurrentUser: m.getCurrentUser }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("@repo/db", () => ({
  prisma: {
    user: { findUnique: m.userFind },
    phoneVerification: { findUnique: m.phoneFind },
    identityVerification: { findUnique: m.idFind },
  },
}));

import { getPortalUser, requireLevel } from "./guards";

const d = new Date("2026-01-01");

function estado(opts: { email?: boolean; phone?: boolean; identity?: object | null }) {
  m.userFind.mockResolvedValue({ emailVerifiedAt: opts.email === false ? null : d });
  m.phoneFind.mockResolvedValue(opts.phone ? { verifiedAt: d, phone: "+5493415551234" } : null);
  m.idFind.mockResolvedValue(opts.identity ?? null);
}

beforeEach(() => {
  vi.clearAllMocks();
  m.getCurrentUser.mockResolvedValue({ id: 5, name: "Nombre Cuenta", email: "a@b.com" });
});

describe("getPortalUser", () => {
  it("sin sesión devuelve null", async () => {
    m.getCurrentUser.mockResolvedValue(null);
    expect(await getPortalUser()).toBeNull();
  });

  it("calcula el nivel y usa el nombre legal cuando la identidad está aprobada", async () => {
    estado({
      phone: true,
      identity: { status: "APPROVED", reverifyRequiredAt: null, legalName: "PEREZ JUAN" },
    });
    const u = await getPortalUser();
    expect(u?.level).toBe("identidad");
    expect(u?.displayName).toBe("PEREZ JUAN");
  });

  it("sin identidad aprobada muestra el nombre de la cuenta", async () => {
    estado({ phone: true, identity: { status: "PENDING", reverifyRequiredAt: null, legalName: "X" } });
    const u = await getPortalUser();
    expect(u?.level).toBe("telefono");
    expect(u?.displayName).toBe("Nombre Cuenta");
  });

  it("sin correo verificado: sin_correo", async () => {
    estado({ email: false });
    expect((await getPortalUser())?.level).toBe("sin_correo");
  });
});

describe("requireLevel", () => {
  it("usuario telefono pidiendo identidad -> redirige a la verificación", async () => {
    estado({ phone: true });
    await expect(requireLevel("identidad")).rejects.toThrow("REDIRECT:/cuenta/verificacion");
  });

  it("usuario identidad pidiendo identidad -> pasa", async () => {
    estado({ phone: true, identity: { status: "APPROVED", reverifyRequiredAt: null, legalName: "A" } });
    const u = await requireLevel("identidad");
    expect(u.level).toBe("identidad");
    expect(m.redirect).not.toHaveBeenCalled();
  });

  it("nivel superior cumple uno menor", async () => {
    estado({ phone: true });
    expect((await requireLevel("registrado")).level).toBe("telefono");
  });

  it("sin_correo no cumple registrado", async () => {
    estado({ email: false });
    await expect(requireLevel("registrado")).rejects.toThrow("REDIRECT:/cuenta/verificacion");
  });

  it("sin sesión -> /login con returnTo saneado", async () => {
    m.getCurrentUser.mockResolvedValue(null);
    await expect(requireLevel("telefono", "/cuenta/telefono")).rejects.toThrow(
      "REDIRECT:/login?returnTo=%2Fcuenta%2Ftelefono",
    );
  });

  it("returnTo externo se descarta", async () => {
    m.getCurrentUser.mockResolvedValue(null);
    await expect(requireLevel("telefono", "https://malo.com")).rejects.toThrow(
      "REDIRECT:/login?returnTo=%2F",
    );
  });
});
