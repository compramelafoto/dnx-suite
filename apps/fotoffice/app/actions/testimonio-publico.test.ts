import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../lib/circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

const H = vi.hoisted(() => ({
  cabeceras: vi.fn(async () => new Headers()),
  modulos: vi.fn(async () => new Set(["website"])),
  aviso: vi.fn(async () => "ENVIADO"),
  subir: vi.fn(async (_b: Buffer, key: string, _t: string) => ({ key, url: `https://media.fotoffice.com/${key}` })),
  borrar: vi.fn(async (key: string) => ({ ok: true, key, existedBefore: true, deleted: true })),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("next/headers", () => ({ headers: H.cabeceras }));
vi.mock("@/lib/modules/gating", () => ({ getEnabledModuleKeysForWorkspace: H.modulos }));
// El aviso se prueba aparte; R2 se reemplaza por sus tres llamadas (la revisión de la foto es real).
vi.mock("@/lib/testimonios/aviso", () => ({ avisarTestimonioNuevo: H.aviso }));
vi.mock("@/lib/images/r2-client", () => ({
  isFotofficeR2Configured: () => true,
  uploadToFotofficeR2: H.subir,
  deleteFotofficeR2Object: H.borrar,
}));
vi.mock("@/lib/presupuestos/sitio", () => ({ sitioDelWorkspace: async () => ({ slug: "dnx-estudio", customDomain: null }) }));

const { enviarTestimonio } = await import("./testimonio-publico");
const { crearInvitacion } = await import("@/lib/testimonios/invitaciones");
const { resetRateLimit } = await import("@/lib/geocode/rate-limit");

const PERMISO = "Acepto que DNX Estudio publique mi testimonio con mi nombre y foto en su sitio web.";
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1]);
const fotoJpg = () => new File([JPG], "yo.jpg", { type: "image/jpeg" });
const KEY_DE_ESTE_WS = /^fotoffice\/site-testimonios\/ws-1\/[0-9a-f-]{36}\.jpg$/;

function form(campos: Record<string, string | File>): FormData {
  const fd = new FormData();
  const base = { workspaceSlug: "dnx-estudio", autorNombre: "Sofi Pérez", texto: "¡Las fotos quedaron hermosas!", consentimiento: "si" };
  for (const [k, v] of Object.entries({ ...base, ...campos })) fd.set(k, v);
  return fd;
}
const enviar = (campos: Record<string, string | File> = {}) => enviarTestimonio({ status: "idle" }, form(campos));
const tokenDe = (enlace: string) => new URL(enlace, "https://x.test").searchParams.get("t")!;

beforeEach(() => {
  B.vaciar();
  vi.clearAllMocks();
  resetRateLimit();
  H.cabeceras.mockImplementation(async () => new Headers());
  H.modulos.mockResolvedValue(new Set(["website"]));
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

  it("freno por IP: el sexto envío válido en 10 minutos se rechaza; los inválidos no cuentan", async () => {
    H.cabeceras.mockImplementation(async () => new Headers({ "x-forwarded-for": "200.1.2.3" }));
    for (let i = 0; i < 4; i++) expect(await enviar({ texto: "" })).toMatchObject({ status: "error", errores: { texto: expect.any(String) } });
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
  it("se sube con el envío, con una key que arma el servidor; la dirección sale de la key", async () => {
    expect(await enviar({ foto: fotoJpg(), autorFotoKey: "fotoffice/site-testimonios/ws-2/ajena.jpg", autorFotoUrl: "https://rastreador.com/x.gif" })).toEqual({ status: "ok" });
    expect(H.subir).toHaveBeenCalledTimes(1);
    const [bytes, key, tipo] = H.subir.mock.calls[0]!;
    expect(key).toMatch(KEY_DE_ESTE_WS);
    expect(tipo).toBe("image/jpeg");
    expect(bytes.length).toBe(JPG.length);
    expect(B.datos.fotofficeTestimonio[0]).toMatchObject({ autorFotoKey: key, autorFotoUrl: `https://media.fotoffice.com/${key}` });
  });

  it("tipo no admitido: no sube ni crea", async () => {
    const r = await enviar({ foto: new File(["GIF89a"], "x.gif", { type: "image/gif" }) });
    expect(r).toEqual({ status: "error", error: "La foto tiene que ser JPG, PNG o WebP." });
    expect(H.subir).not.toHaveBeenCalled();
    expect(B.datos.fotofficeTestimonio).toHaveLength(0);
  });

  it("muy pesada (más de 3,5 MB): no sube ni crea", async () => {
    const grande = new Uint8Array(3.5 * 1024 * 1024 + 1);
    grande.set(JPG);
    const r = await enviar({ foto: new File([grande], "x.jpg", { type: "image/jpeg" }) });
    expect(r).toEqual({ status: "error", error: "La foto es muy pesada; probá con otra o enviá sin foto." });
    expect(H.subir).not.toHaveBeenCalled();
    expect(B.datos.fotofficeTestimonio).toHaveLength(0);
  });

  it("un archivo que dice ser JPG y no lo es: no sube ni crea", async () => {
    const r = await enviar({ foto: new File(["<script>alert(1)</script>"], "x.jpg", { type: "image/jpeg" }) });
    expect(r).toEqual({ status: "error", error: "El archivo no es una imagen JPG, PNG o WebP válida." });
    expect(H.subir).not.toHaveBeenCalled();
    expect(B.datos.fotofficeTestimonio).toHaveLength(0);
  });

  it("si el guardado falla después de subir, la foto se borra", async () => {
    const crear = B.tablas.fotofficeTestimonio.create;
    B.tablas.fotofficeTestimonio.create = async () => {
      throw Object.assign(new Error("caída"), { code: "P1001" });
    };
    try {
      expect(await enviar({ foto: fotoJpg() })).toMatchObject({ status: "error" });
    } finally {
      B.tablas.fotofficeTestimonio.create = crear;
    }
    expect(H.borrar).toHaveBeenCalledWith(H.subir.mock.calls[0]![1]);
  });
});

describe("enviarTestimonio — invitación personal", () => {
  it("con token válido: origen INVITACION, atado al cliente; el segundo envío dice que ya se usó", async () => {
    const { enlace, invitacionId } = await crearInvitacion("ws-1", { clientId: "cli-1" });
    const t = tokenDe(enlace);
    expect(await enviar({ t })).toEqual({ status: "ok" });
    expect(B.datos.fotofficeTestimonio[0]).toMatchObject({ origen: "INVITACION", clientId: "cli-1", invitacionId, estado: "PENDIENTE" });
    // Enlace ya usado: se avisa antes de subir nada.
    expect(await enviar({ t, foto: fotoJpg() })).toEqual({ status: "enlace", estado: "USADA" });
    expect(H.subir).not.toHaveBeenCalled();
    expect(B.datos.fotofficeTestimonio).toHaveLength(1);
  });

  it("si otro envío gana el enlace mientras se sube la foto: USADA, sin segundo testimonio, y la foto de este envío se borra", async () => {
    const { enlace } = await crearInvitacion("ws-1", {});
    const t = tokenDe(enlace);
    H.subir.mockImplementationOnce(async (_b: Buffer, key: string) => {
      // El ganador usa el enlace justo ahora (entre la mirada previa y la transacción).
      expect(await enviar({ t })).toEqual({ status: "ok" });
      return { key, url: `https://media.fotoffice.com/${key}` };
    });
    expect(await enviar({ t, foto: fotoJpg() })).toEqual({ status: "enlace", estado: "USADA" });
    expect(B.datos.fotofficeTestimonio).toHaveLength(1);
    expect(B.datos.fotofficeTestimonio[0]).toMatchObject({ autorFotoKey: null });
    const keySubida = H.subir.mock.calls[0]![1];
    expect(keySubida).toMatch(KEY_DE_ESTE_WS);
    expect(H.borrar).toHaveBeenCalledWith(keySubida);
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
