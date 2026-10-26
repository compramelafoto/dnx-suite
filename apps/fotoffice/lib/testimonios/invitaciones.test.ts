import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

const H = vi.hoisted(() => ({
  sitio: vi.fn(async (): Promise<{ slug: string | null; customDomain: string | null } | null> => ({ slug: "dnx-estudio", customDomain: null })),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
vi.mock("@/lib/presupuestos/sitio", () => ({ sitioDelWorkspace: H.sitio }));

const I = await import("./invitaciones");

const AHORA = new Date("2026-10-26T15:00:00Z");
const DIA = 24 * 60 * 60 * 1000;

const datos = {
  texto: "Nos encantaron las fotos.",
  extracto: null,
  autorNombre: "Sofi",
  autorDetalle: "XV de Sofi",
  autorEnlace: null,
  autorEmail: null,
  calificacion: 5,
};
const extras = { consentimiento: true, consentimientoTexto: "Acepto que DNX publique mi testimonio." };

/** El token en claro sale sólo en el enlace. */
function tokenDe(enlace: string): string {
  return new URL(enlace, "https://x.test").searchParams.get("t")!;
}

const transaccionOriginal = B.prisma.$transaction;

beforeEach(() => {
  B.vaciar();
  B.prisma.$transaction = transaccionOriginal;
  H.sitio.mockResolvedValue({ slug: "dnx-estudio", customDomain: null });
  B.agregar("client", { id: "cli-1", workspaceId: "ws-1" });
  B.agregar("client", { id: "cli-ajeno", workspaceId: "ws-2" });
  B.agregar("fotofficeProyecto", { id: "pro-1", workspaceId: "ws-1", clientId: "cli-1" });
});

describe("crearInvitacion", () => {
  it("guarda sólo el hash del token, vence a los 90 días y arma el enlace del sitio", async () => {
    const r = await I.crearInvitacion("ws-1", { clientId: "cli-1", proyectoId: "pro-1", nombreSugerido: " Sofi ", userId: 7, ahora: AHORA });
    const token = tokenDe(r.enlace);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(r.enlace).toContain("/w/dnx-estudio/testimonio?t=");
    const fila = B.datos.fotofficeTestimonioInvitacion[0]!;
    expect(fila.id).toBe(r.invitacionId);
    expect(fila.tokenHash).not.toBe(token);
    expect(fila.tokenHash).toBe(I.hashDeTokenDeInvitacion(token));
    expect(JSON.stringify(fila)).not.toContain(token);
    expect(fila).toMatchObject({ workspaceId: "ws-1", clientId: "cli-1", proyectoId: "pro-1", estado: "ENVIADA", nombreSugerido: "Sofi", createdByUserId: "7" });
    expect((fila.venceAt as Date).getTime()).toBe(AHORA.getTime() + 90 * DIA);
  });

  it("dos invitaciones nunca comparten token", async () => {
    const a = await I.crearInvitacion("ws-1", { ahora: AHORA });
    const b = await I.crearInvitacion("ws-1", { ahora: AHORA });
    expect(tokenDe(a.enlace)).not.toBe(tokenDe(b.enlace));
  });

  it("con dominio propio conectado, el enlace va al dominio", async () => {
    H.sitio.mockResolvedValue({ slug: "dnx-estudio", customDomain: "dnxfotografia.com" });
    const r = await I.crearInvitacion("ws-1", { ahora: AHORA });
    expect(r.enlace).toMatch(/^https:\/\/dnxfotografia\.com\/testimonio\?t=[A-Za-z0-9_-]{43}$/);
  });

  it("un cliente de otro workspace no se ata (y no se crea nada)", async () => {
    await expect(I.crearInvitacion("ws-1", { clientId: "cli-ajeno", ahora: AHORA })).rejects.toThrow(I.MENSAJE_FICHA_AJENA);
    expect(B.datos.fotofficeTestimonioInvitacion).toHaveLength(0);
  });

  it("sin dirección pública del sitio no hay enlace que mandar", async () => {
    H.sitio.mockResolvedValue({ slug: null, customDomain: null });
    await expect(I.crearInvitacion("ws-1", { ahora: AHORA })).rejects.toThrow(I.MENSAJE_SIN_SITIO);
  });
});

describe("crearInvitacion con reusarSinEnviar («Pedir testimonio» cancelado)", () => {
  const pedido = { clientId: "cli-1", proyectoId: "pro-1", reusarSinEnviar: true };

  it("reusa la que nunca salió del mismo cliente y proyecto: token nuevo y vencimiento nuevo, el viejo ya no sirve", async () => {
    const a = await I.crearInvitacion("ws-1", { ...pedido, ahora: AHORA });
    const despues = new Date(AHORA.getTime() + 2 * DIA);
    const b = await I.crearInvitacion("ws-1", { ...pedido, ahora: despues });
    expect(b.invitacionId).toBe(a.invitacionId);
    expect(B.datos.fotofficeTestimonioInvitacion).toHaveLength(1);
    expect(tokenDe(b.enlace)).not.toBe(tokenDe(a.enlace));
    const fila = B.datos.fotofficeTestimonioInvitacion[0]!;
    expect(fila.tokenHash).toBe(I.hashDeTokenDeInvitacion(tokenDe(b.enlace)));
    expect((fila.venceAt as Date).getTime()).toBe(despues.getTime() + 90 * DIA);
    expect(await I.leerInvitacion("ws-1", tokenDe(a.enlace), despues)).toEqual({ estado: "INEXISTENTE" });
    expect((await I.leerInvitacion("ws-1", tokenDe(b.enlace), despues)).estado).toBe("VALIDA");
  });

  it("no reusa una que ya salió (con canal), ni de otro proyecto, ni vencida", async () => {
    const salio = await I.crearInvitacion("ws-1", { ...pedido, ahora: AHORA });
    B.datos.fotofficeTestimonioInvitacion[0]!.canal = "EMAIL";
    const otra = await I.crearInvitacion("ws-1", { ...pedido, ahora: AHORA });
    expect(otra.invitacionId).not.toBe(salio.invitacionId);

    const sinProyecto = await I.crearInvitacion("ws-1", { clientId: "cli-1", reusarSinEnviar: true, ahora: AHORA });
    expect(sinProyecto.invitacionId).not.toBe(otra.invitacionId);

    const lejos = new Date(AHORA.getTime() + 91 * DIA);
    const nueva = await I.crearInvitacion("ws-1", { ...pedido, ahora: lejos });
    expect(nueva.invitacionId).not.toBe(otra.invitacionId);
    expect(B.datos.fotofficeTestimonioInvitacion).toHaveLength(4);
  });

  it("sin la opción (pedido automático) siempre crea una nueva", async () => {
    await I.crearInvitacion("ws-1", { clientId: "cli-1", proyectoId: "pro-1", ahora: AHORA });
    await I.crearInvitacion("ws-1", { clientId: "cli-1", proyectoId: "pro-1", ahora: AHORA });
    expect(B.datos.fotofficeTestimonioInvitacion).toHaveLength(2);
  });
});

describe("leerInvitacion", () => {
  it("válida: trae lo sugerido y la ficha", async () => {
    const r = await I.crearInvitacion("ws-1", { clientId: "cli-1", nombreSugerido: "Sofi", detalleSugerido: "XV de Sofi", ahora: AHORA });
    const l = await I.leerInvitacion("ws-1", tokenDe(r.enlace), AHORA);
    expect(l).toEqual({ estado: "VALIDA", inv: { id: r.invitacionId, clientId: "cli-1", proyectoId: null, nombreSugerido: "Sofi", detalleSugerido: "XV de Sofi" } });
  });

  it("vencida → VENCIDA", async () => {
    const r = await I.crearInvitacion("ws-1", { ahora: AHORA });
    expect(await I.leerInvitacion("ws-1", tokenDe(r.enlace), new Date(AHORA.getTime() + 90 * DIA))).toEqual({ estado: "VENCIDA" });
    expect(await I.leerInvitacion("ws-1", tokenDe(r.enlace), new Date(AHORA.getTime() + 89 * DIA))).toMatchObject({ estado: "VALIDA" });
  });

  it("token de otro workspace → INEXISTENTE", async () => {
    const r = await I.crearInvitacion("ws-1", { ahora: AHORA });
    expect(await I.leerInvitacion("ws-2", tokenDe(r.enlace), AHORA)).toEqual({ estado: "INEXISTENTE" });
  });

  it("basura o token desconocido → INEXISTENTE sin tocar la base", async () => {
    expect(await I.leerInvitacion("ws-1", "x' OR 1=1", AHORA)).toEqual({ estado: "INEXISTENTE" });
    expect(await I.leerInvitacion("ws-1", undefined, AHORA)).toEqual({ estado: "INEXISTENTE" });
    expect(await I.leerInvitacion("ws-1", I.nuevoTokenDeInvitacion(), AHORA)).toEqual({ estado: "INEXISTENTE" });
  });

  it("si las tablas no existen todavía, el enlace no existe (nunca un error)", async () => {
    const original = B.tablas.fotofficeTestimonioInvitacion.findFirst;
    B.tablas.fotofficeTestimonioInvitacion.findFirst = async () => {
      throw Object.assign(new Error("tabla"), { code: "P2021" });
    };
    try {
      expect(await I.leerInvitacion("ws-1", I.nuevoTokenDeInvitacion(), AHORA)).toEqual({ estado: "INEXISTENTE" });
    } finally {
      B.tablas.fotofficeTestimonioInvitacion.findFirst = original;
    }
  });
});

describe("responderInvitacion", () => {
  it("crea el testimonio PENDIENTE, origen INVITACION, atado a la ficha, y marca RESPONDIDA", async () => {
    const r = await I.crearInvitacion("ws-1", { clientId: "cli-1", proyectoId: "pro-1", ahora: AHORA });
    const res = await I.responderInvitacion("ws-1", tokenDe(r.enlace), datos, extras, AHORA);
    expect(res.ok).toBe(true);
    expect(B.datos.fotofficeTestimonio).toHaveLength(1);
    expect(B.datos.fotofficeTestimonio[0]).toMatchObject({
      workspaceId: "ws-1",
      estado: "PENDIENTE",
      origen: "INVITACION",
      clientId: "cli-1",
      proyectoId: "pro-1",
      invitacionId: r.invitacionId,
      consentimiento: true,
      consentimientoTexto: extras.consentimientoTexto,
    });
    expect(B.datos.fotofficeTestimonioInvitacion[0]).toMatchObject({ estado: "RESPONDIDA", respondidaAt: AHORA });
  });

  it("segundo uso → USADA y no crea un segundo testimonio", async () => {
    const r = await I.crearInvitacion("ws-1", { ahora: AHORA });
    const token = tokenDe(r.enlace);
    expect((await I.responderInvitacion("ws-1", token, datos, extras, AHORA)).ok).toBe(true);
    expect(await I.leerInvitacion("ws-1", token, AHORA)).toEqual({ estado: "USADA" });
    expect(await I.responderInvitacion("ws-1", token, datos, extras, AHORA)).toEqual({ ok: false, estado: "USADA" });
    expect(B.datos.fotofficeTestimonio).toHaveLength(1);
  });

  it("vencida → VENCIDA y no crea nada", async () => {
    const r = await I.crearInvitacion("ws-1", { ahora: AHORA });
    const tarde = new Date(AHORA.getTime() + 91 * DIA);
    expect(await I.responderInvitacion("ws-1", tokenDe(r.enlace), datos, extras, tarde)).toEqual({ ok: false, estado: "VENCIDA" });
    expect(B.datos.fotofficeTestimonio).toHaveLength(0);
    expect(B.datos.fotofficeTestimonioInvitacion[0]).toMatchObject({ estado: "ENVIADA" });
  });

  it("token de otro workspace → INEXISTENTE y no crea nada", async () => {
    const r = await I.crearInvitacion("ws-1", { ahora: AHORA });
    expect(await I.responderInvitacion("ws-2", tokenDe(r.enlace), datos, extras, AHORA)).toEqual({ ok: false, estado: "INEXISTENTE" });
    expect(B.datos.fotofficeTestimonio).toHaveLength(0);
  });

  it("dos envíos a la vez con el mismo enlace → uno solo crea", async () => {
    const r = await I.crearInvitacion("ws-1", { ahora: AHORA });
    const token = tokenDe(r.enlace);
    // Como en Postgres con dos conexiones: las dos transacciones avanzan intercaladas (las dos leen la
    // invitación todavía ENVIADA). Sólo el UPDATE condicionado decide quién gana.
    B.prisma.$transaction = (async (fn: (tx: unknown) => Promise<unknown>) => fn(B.prisma)) as typeof B.prisma.$transaction;
    const lecturas: string[] = [];
    const leerOriginal = B.tablas.fotofficeTestimonioInvitacion.findFirst;
    B.tablas.fotofficeTestimonioInvitacion.findFirst = async (a) => {
      const f = await leerOriginal(a);
      lecturas.push(String(f?.estado));
      await new Promise((ok) => setTimeout(ok, 5));
      return f;
    };
    try {
      const [a, b] = await Promise.all([
        I.responderInvitacion("ws-1", token, datos, extras, AHORA),
        I.responderInvitacion("ws-1", token, { ...datos, autorNombre: "Otra" }, extras, AHORA),
      ]);
      expect(lecturas).toEqual(["ENVIADA", "ENVIADA"]);
      expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
      expect([a, b].find((x) => !x.ok)).toEqual({ ok: false, estado: "USADA" });
      expect(B.datos.fotofficeTestimonio).toHaveLength(1);
    } finally {
      B.tablas.fotofficeTestimonioInvitacion.findFirst = leerOriginal;
    }
  });
});

describe("enlaceDeTestimonio", () => {
  it("abierto y personal, en FOTOFFICE o en el dominio propio", () => {
    expect(I.enlaceDeTestimonio("dnx-estudio", null, { appOrigin: "https://fotoffice.com/" })).toBe("https://fotoffice.com/w/dnx-estudio/testimonio");
    expect(I.enlaceDeTestimonio("dnx-estudio", "abc", { appOrigin: "https://fotoffice.com" })).toBe("https://fotoffice.com/w/dnx-estudio/testimonio?t=abc");
    expect(I.enlaceDeTestimonio("dnx-estudio", "abc", { customDomain: "dnx.com" })).toBe("https://dnx.com/testimonio?t=abc");
  });
});
