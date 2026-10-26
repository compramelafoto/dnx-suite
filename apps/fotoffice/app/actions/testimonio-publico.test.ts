import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../lib/circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

const H = vi.hoisted(() => ({
  cabeceras: vi.fn(async () => new Headers()),
  modulos: vi.fn(async () => new Set(["website"])),
  aviso: vi.fn(async () => "ENVIADO"),
  confirmarFoto: vi.fn(),
  borrar: vi.fn(async (key: string) => ({ ok: true, key, existedBefore: true, deleted: true })),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("next/headers", () => ({ headers: H.cabeceras }));
vi.mock("@/lib/modules/gating", () => ({ getEnabledModuleKeysForWorkspace: H.modulos }));
// El aviso y la verificación de la foto en R2 se prueban aparte; acá, lo propio del formulario.
vi.mock("@/lib/testimonios/aviso", () => ({ avisarTestimonioNuevo: H.aviso }));
vi.mock("@/lib/testimonios/foto", () => ({ confirmarFotoAutor: H.confirmarFoto }));
vi.mock("@/lib/images/r2-client", () => ({ deleteFotofficeR2Object: H.borrar }));
vi.mock("@/lib/presupuestos/sitio", () => ({ sitioDelWorkspace: async () => ({ slug: "dnx-estudio", customDomain: null }) }));

const { enviarTestimonio } = await import("./testimonio-publico");
const { crearInvitacion } = await import("@/lib/testimonios/invitaciones");
const { resetRateLimit } = await import("@/lib/geocode/rate-limit");

const PERMISO = "Acepto que DNX Estudio publique mi testimonio con mi nombre y foto en su sitio web.";
const KEY = "fotoffice/site-testimonios/ws-1/0b6f-uuid.jpg";

function form(campos: Record<string, string>): FormData {
  const fd = new FormData();
  const base = { workspaceSlug: "dnx-estudio", autorNombre: "Sofi Pérez", texto: "¡Las fotos quedaron hermosas!", consentimiento: "si" };
  for (const [k, v] of Object.entries({ ...base, ...campos })) fd.set(k, v);
  return fd;
}
const enviar = (campos: Record<string, string> = {}) => enviarTestimonio({ status: "idle" }, form(campos));
const tokenDe = (enlace: string) => new URL(enlace, "https://x.test").searchParams.get("t")!;

beforeEach(() => {
  B.vaciar();
  vi.clearAllMocks();
  resetRateLimit();
  H.cabeceras.mockImplementation(async () => new Headers());
  H.modulos.mockResolvedValue(new Set(["website"]));
  H.confirmarFoto.mockResolvedValue({ ok: true, valor: { key: KEY, url: `https://media.fotoffice.com/${KEY}` } });
  B.agregar("fotofficeWorkspaceBranding", { workspaceId: "ws-1", publicSlug: "dnx-estudio", commercialName: "DNX Estudio" });
  B.agregar("client", { id: "cli-1", workspaceId: "ws-1" });
});

describe("enviarTestimonio — enlace abierto", () => {
  it("entra PENDIENTE, origen FORMULARIO, con el permiso armado por el servidor, y avisa al equipo", async () => {
    const r = await enviar({ autorDetalle: "XV de Sofi", calificacion: "5", consentimientoTexto: "texto del navegador" });
    expect(r).toEqual({ status: "ok" });
    expect(B.datos.fotofficeTestimonio).toHaveLength(1);
    expect(B.datos.fotofficeTestimonio[0]).toMatchObject({
      workspaceId: "ws-1",
      estado: "PENDIENTE",
      origen: "FORMULARIO",
      autorNombre: "Sofi Pérez",
      autorDetalle: "XV de Sofi",
      calificacion: 5,
      consentimiento: true,
      consentimientoTexto: PERMISO,
      invitacionId: null,
      clientId: null,
    });
    expect(H.aviso).toHaveBeenCalledWith("ws-1", { autorNombre: "Sofi Pérez", texto: "¡Las fotos quedaron hermosas!" });
  });

  it("sin la casilla de permiso no se crea nada", async () => {
    const r = await enviar({ consentimiento: "" });
    expect(r).toMatchObject({ status: "error" });
    expect(B.datos.fotofficeTestimonio).toHaveLength(0);
  });

  it("datos inválidos: un error por campo y nada creado", async () => {
    const r = await enviar({ texto: "", calificacion: "9" });
    expect(r).toMatchObject({ status: "error", errores: { texto: expect.any(String), calificacion: expect.any(String) } });
    expect(B.datos.fotofficeTestimonio).toHaveLength(0);
  });

  it("campo trampa lleno: responde como si nada y no crea", async () => {
    expect(await enviar({ fo_hp_x: "http://spam" })).toEqual({ status: "ok" });
    expect(B.datos.fotofficeTestimonio).toHaveLength(0);
    expect(H.aviso).not.toHaveBeenCalled();
  });

  it("freno por IP: el sexto envío en 10 minutos se rechaza", async () => {
    H.cabeceras.mockImplementation(async () => new Headers({ "x-forwarded-for": "200.1.2.3" }));
    for (let i = 0; i < 5; i++) expect(await enviar()).toEqual({ status: "ok" });
    expect(await enviar()).toMatchObject({ status: "error", error: expect.stringContaining("muchos envíos") });
    expect(B.datos.fotofficeTestimonio).toHaveLength(5);
  });

  it("con el Sitio web apagado o un slug desconocido, el formulario no existe", async () => {
    H.modulos.mockResolvedValue(new Set());
    expect(await enviar()).toEqual({ status: "error", error: "Este formulario no está disponible." });
    H.modulos.mockResolvedValue(new Set(["website"]));
    expect(await enviar({ workspaceSlug: "otro" })).toEqual({ status: "error", error: "Este formulario no está disponible." });
    expect(B.datos.fotofficeTestimonio).toHaveLength(0);
  });
});

describe("enviarTestimonio — foto del autor", () => {
  it("la dirección sale de la key verificada, nunca de lo que mande el navegador", async () => {
    await enviar({ autorFotoKey: KEY, autorFotoUrl: "https://rastreador.com/x.gif" });
    expect(H.confirmarFoto).toHaveBeenCalledWith("ws-1", KEY);
    expect(B.datos.fotofficeTestimonio[0]).toMatchObject({ autorFotoKey: KEY, autorFotoUrl: `https://media.fotoffice.com/${KEY}` });
  });

  it("si la foto no pasa la verificación, no se crea el testimonio", async () => {
    H.confirmarFoto.mockResolvedValue({ ok: false, error: "El archivo no es una imagen JPG, PNG o WebP válida." });
    expect(await enviar({ autorFotoKey: KEY })).toEqual({ status: "error", error: "El archivo no es una imagen JPG, PNG o WebP válida." });
    expect(B.datos.fotofficeTestimonio).toHaveLength(0);
  });
});

describe("enviarTestimonio — invitación personal", () => {
  it("con token válido: origen INVITACION, atado al cliente; el segundo envío dice que ya se usó", async () => {
    const { enlace, invitacionId } = await crearInvitacion("ws-1", { clientId: "cli-1" });
    const t = tokenDe(enlace);
    expect(await enviar({ t })).toEqual({ status: "ok" });
    expect(B.datos.fotofficeTestimonio[0]).toMatchObject({ origen: "INVITACION", clientId: "cli-1", invitacionId, estado: "PENDIENTE" });
    expect(await enviar({ t, autorFotoKey: KEY })).toEqual({ status: "enlace", estado: "USADA" });
    expect(B.datos.fotofficeTestimonio).toHaveLength(1);
    // La foto de un envío que no creó nada no queda en R2.
    expect(H.borrar).toHaveBeenCalledWith(KEY);
  });

  it("token vencido o de otro estudio: no crea nada", async () => {
    const { enlace } = await crearInvitacion("ws-1", { ahora: new Date("2025-01-01T00:00:00Z") });
    expect(await enviar({ t: tokenDe(enlace) })).toEqual({ status: "enlace", estado: "VENCIDA" });
    B.agregar("fotofficeWorkspaceBranding", { workspaceId: "ws-2", publicSlug: "otro", commercialName: "Otro" });
    const nueva = await crearInvitacion("ws-1", {});
    expect(await enviar({ workspaceSlug: "otro", t: tokenDe(nueva.enlace) })).toEqual({ status: "enlace", estado: "INEXISTENTE" });
    expect(B.datos.fotofficeTestimonio).toHaveLength(0);
  });
});
