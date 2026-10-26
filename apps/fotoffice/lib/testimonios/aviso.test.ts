import { beforeEach, describe, expect, it, vi } from "vitest";

const P = vi.hoisted(() => ({
  ajustes: vi.fn(),
  contar: vi.fn(),
  dueno: vi.fn(),
  workspace: vi.fn(),
  usuario: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({
  prisma: {
    fotofficeTestimonioAjustes: { findUnique: P.ajustes },
    fotofficeTestimonio: { count: P.contar },
    workspaceMembership: { findFirst: P.dueno },
    workspace: { findUnique: P.workspace },
    user: { findUnique: P.usuario },
  },
}));
vi.mock("@/lib/plantillas/envio", () => ({ inicioDelDiaAR: (d: Date) => d }));

const { avisarTestimonioNuevo, TOPE_AVISOS_TESTIMONIO_DIA } = await import("./aviso");

const enviar = vi.fn();
const deps = { enviar, appOrigin: "https://fotoffice.com", ahora: () => new Date("2026-10-26T15:00:00Z") };
const testimonio = { autorNombre: "Sofi <b>", texto: "Hermosas fotos" };

beforeEach(() => {
  for (const f of Object.values(P)) f.mockReset();
  enviar.mockReset();
  P.ajustes.mockResolvedValue(null);
  P.contar.mockResolvedValue(1);
  P.dueno.mockResolvedValue({ userId: 3 });
  P.workspace.mockResolvedValue({ name: "dnx", fotofficeBranding: { commercialName: "DNX Estudio" } });
  P.usuario.mockResolvedValue({ email: "dueno@dnx.com" });
  enviar.mockResolvedValue({ status: "SENT", providerId: "p1" });
});

describe("avisarTestimonioNuevo", () => {
  it("manda un correo interno al dueño con el enlace al panel (sin ajustes = encendido)", async () => {
    expect(await avisarTestimonioNuevo("ws-1", testimonio, deps)).toBe("ENVIADO");
    const m = enviar.mock.calls[0]![0];
    expect(m.to).toBe("dueno@dnx.com");
    expect(m.subject).toBe("Nuevo testimonio de Sofi <b>");
    expect(m.text).toContain("https://fotoffice.com/website/testimonios");
    expect(m.html).toContain("Sofi &lt;b&gt;");
    expect(m.html).not.toContain("<b>");
  });

  it("apagado en los ajustes: no manda nada", async () => {
    P.ajustes.mockResolvedValue({ avisarAlEquipo: false });
    expect(await avisarTestimonioNuevo("ws-1", testimonio, deps)).toBe("APAGADO");
    expect(enviar).not.toHaveBeenCalled();
  });

  it("pasado el tope del día no avisa más", async () => {
    P.contar.mockResolvedValue(TOPE_AVISOS_TESTIMONIO_DIA + 1);
    expect(await avisarTestimonioNuevo("ws-1", testimonio, deps)).toBe("TOPE");
    expect(enviar).not.toHaveBeenCalled();
  });

  it("nunca lanza: un error queda como ERROR", async () => {
    P.contar.mockRejectedValue(new Error("caída"));
    expect(await avisarTestimonioNuevo("ws-1", testimonio, deps)).toBe("ERROR");
  });

  it("sin dueño con correo: SIN_DESTINATARIO", async () => {
    P.usuario.mockResolvedValue({ email: null });
    expect(await avisarTestimonioNuevo("ws-1", testimonio, deps)).toBe("SIN_DESTINATARIO");
  });
});
