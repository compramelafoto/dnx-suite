import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../lib/circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

const H = vi.hoisted(() => ({
  alta: vi.fn(),
  cabeceras: vi.fn(async () => new Headers()),
  modulos: vi.fn(async () => new Set(["service-leads", "website"])),
}));

vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
// El alta única se prueba en lib/consultas/alta.test.ts; acá, lo propio del formulario del sitio.
vi.mock("@/lib/consultas/alta", () => ({
  altaDeConsulta: H.alta,
  altaDelSistema: (workspaceId: string) => ({ workspaceId, userId: null, userLabel: "Sistema", role: null }),
  MENSAJES_ALTA: { fallo: "No se pudo registrar la consulta.", categoria: "Elegí una categoría.", origen: "Elegí un origen válido." },
  MAX_TEXTO_CONSULTA: 200,
  MAX_MENSAJE_CONSULTA: 4000,
}));
vi.mock("next/headers", () => ({ headers: H.cabeceras }));
vi.mock("@/lib/modules/gating", () => ({ getEnabledModuleKeysForWorkspace: H.modulos }));

const { createSiteInquiry } = await import("./site-inquiry");
const { resetRateLimit } = await import("@/lib/geocode/rate-limit");

const ERROR_COMUN = "No pudimos enviar tu consulta. Probá de nuevo en unos minutos.";

function form(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ workspaceSlug: "dnx-estudio", name: "Laura Pérez", email: "laura@example.com", ...campos })) {
    fd.set(k, v);
  }
  return fd;
}

const enviar = (campos: Record<string, string> = {}) => createSiteInquiry({ status: "idle" }, form(campos));

beforeEach(() => {
  B.vaciar();
  vi.clearAllMocks();
  resetRateLimit();
  H.alta.mockResolvedValue({ ok: true, leadId: "l-1", consultaId: "q-1", clientId: "c-1", avisos: {} });
  H.cabeceras.mockImplementation(async () => new Headers());
  H.modulos.mockResolvedValue(new Set(["service-leads", "website"]));
  B.agregar("fotofficeWorkspaceBranding", { workspaceId: "ws-1", publicSlug: "dnx-estudio" });
  B.agregar("fotofficeConsultaCategoria", { id: "c-boda", workspaceId: "ws-1", name: "Boda", group: "BODA", legacyEventType: "BODA", order: 0, archivedAt: null });
  B.agregar("fotofficeConsultaCategoria", { id: "c-otro", workspaceId: "ws-1", name: "Otro evento", group: "EVENTO", legacyEventType: "OTRO_EVENTO", order: 1, archivedAt: null });
  B.agregar("fotofficeOrigen", { id: "o-ig", workspaceId: "ws-1", name: "Instagram", order: 0, archivedAt: null });
  B.agregar("fotofficeOrigen", { id: "o-ajeno", workspaceId: "ws-2", name: "Google", order: 0, archivedAt: null });
});

describe("createSiteInquiry", () => {
  it("da de alta como WEB con la categoría elegida, el origen del workspace y los datos del evento", async () => {
    const r = await enviar({
      categoriaId: "c-boda", origenId: "o-ig", phone: " 341 555 ", eventDate: "2026-12-20", eventLocation: " Salón Real ", message: "Hola",
    });
    expect(r).toEqual({ status: "ok" });
    expect(H.alta).toHaveBeenCalledTimes(1);
    const [quien, datos, opciones] = H.alta.mock.calls[0]!;
    expect(quien).toEqual({ workspaceId: "ws-1", userId: null, userLabel: "Sistema", role: null });
    expect(opciones).toEqual({ origenDelAlta: "WEB" });
    expect(datos).toMatchObject({
      contacto: { nombre: "Laura Pérez", email: "laura@example.com", telefono: "341 555" },
      categoriaId: "c-boda",
      eventType: "BODA",
      origenId: "o-ig",
      eventDate: new Date("2026-12-20"),
      eventLocation: "Salón Real",
      message: "Hola",
      formSlug: "sitio",
    });
  });

  it("las horas que dura el evento viajan en metaJson.porHoras (acepta '4,5'; vacío o inválido: sin horas)", async () => {
    await enviar({ categoriaId: "c-otro", horas: "4" });
    expect(H.alta.mock.calls[0]![1]).toMatchObject({ metaJson: { porHoras: { horas: 4 } } });
    await enviar({ categoriaId: "c-otro", horas: "4,5" });
    expect(H.alta.mock.calls[1]![1]).toMatchObject({ metaJson: { porHoras: { horas: 4.5 } } });
    await enviar({ categoriaId: "c-otro", horas: "" });
    await enviar({ categoriaId: "c-otro", horas: "muchas" });
    expect(H.alta.mock.calls[2]![1].metaJson ?? null).toBeNull();
    expect(H.alta.mock.calls[3]![1].metaJson ?? null).toBeNull();
  });

  it("un origen de OTRO workspace se ignora: la consulta entra igual, sin origen", async () => {
    expect(await enviar({ categoriaId: "c-boda", origenId: "o-ajeno" })).toEqual({ status: "ok" });
    expect(H.alta.mock.calls[0]![1]).toMatchObject({ origenId: null });
  });

  it("una categoría archivada después de publicar → la consulta entra igual con la de reemplazo", async () => {
    B.datos.fotofficeConsultaCategoria.find((c) => c.id === "c-boda")!.archivedAt = new Date("2026-10-20");
    expect(await enviar({ categoriaId: "c-boda" })).toEqual({ status: "ok" });
    expect(H.alta.mock.calls[0]![1]).toMatchObject({ categoriaId: "c-otro" });
  });

  it("workspace sin categorías: no lanza; el alta va sin categoría (su red de seguridad) y si falla, el mensaje común", async () => {
    B.datos.fotofficeConsultaCategoria.length = 0;
    expect(await enviar({ categoriaId: "c-boda" })).toEqual({ status: "ok" });
    expect(H.alta.mock.calls[0]![1]).toMatchObject({ categoriaId: null });
    H.alta.mockResolvedValue({ ok: false, error: "No se pudo registrar la consulta." });
    expect(await enviar({ categoriaId: "c-boda" })).toEqual({ status: "error", error: ERROR_COMUN });
  });

  it("si la categoría se archiva justo entre la elección y el alta, reintenta sin categoría", async () => {
    H.alta.mockResolvedValueOnce({ ok: false, error: "Elegí una categoría." });
    expect(await enviar({ categoriaId: "c-boda" })).toEqual({ status: "ok" });
    expect(H.alta).toHaveBeenCalledTimes(2);
    expect(H.alta.mock.calls[1]![1]).toMatchObject({ categoriaId: null, eventType: "BODA" });
  });

  it("si el origen se archiva justo entre la elección y el alta, reintenta sin origen y conserva la categoría", async () => {
    H.alta.mockResolvedValueOnce({ ok: false, error: "Elegí un origen válido." });
    expect(await enviar({ categoriaId: "c-boda", origenId: "o-ig" })).toEqual({ status: "ok" });
    expect(H.alta).toHaveBeenCalledTimes(2);
    expect(H.alta.mock.calls[0]![1]).toMatchObject({ origenId: "o-ig" });
    expect(H.alta.mock.calls[1]![1]).toMatchObject({ origenId: null, categoriaId: "c-boda" });
  });

  it("si el alta explota, mensaje común y no registra datos de la persona", async () => {
    const errores = vi.spyOn(console, "error").mockImplementation(() => {});
    H.alta.mockRejectedValue(Object.assign(new Error("laura@example.com"), { code: "P2000" }));
    expect(await enviar({ categoriaId: "c-boda" })).toEqual({ status: "error", error: ERROR_COMUN });
    expect(JSON.stringify(errores.mock.calls)).not.toContain("laura");
    errores.mockRestore();
  });

  it("pide correo o teléfono", async () => {
    const r = await enviar({ categoriaId: "c-boda", email: "", phone: "" });
    expect(r).toEqual({ status: "error", error: "Dejanos un correo o un teléfono para poder responderte." });
    expect(H.alta).not.toHaveBeenCalled();
    expect(await enviar({ categoriaId: "c-boda", email: "", phone: "341 555" })).toEqual({ status: "ok" });
  });

  it("datos inválidos (nombre vacío, correo mal escrito) no llegan al alta", async () => {
    expect((await enviar({ name: "" })).status).toBe("error");
    expect((await enviar({ email: "no-es-correo" })).status).toBe("error");
    expect(H.alta).not.toHaveBeenCalled();
  });

  it("campo trampa lleno: responde como éxito y no crea nada", async () => {
    const avisos = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await enviar({ fo_hp_x: "http://spam.test" })).toEqual({ status: "ok" });
    expect(H.alta).not.toHaveBeenCalled();
    avisos.mockRestore();
  });

  it("workspace inexistente o con Consultas apagado: no da de alta", async () => {
    expect((await enviar({ workspaceSlug: "no-existe" })).status).toBe("error");
    H.modulos.mockResolvedValue(new Set(["website"]));
    expect(await enviar()).toEqual({ status: "error", error: "Este formulario no está disponible." });
    expect(H.alta).not.toHaveBeenCalled();
  });

  it("comparte el freno por IP con el formulario general: 10 cada 10 minutos", async () => {
    H.cabeceras.mockImplementation(async () => new Headers({ "x-forwarded-for": "200.1.1.1" }));
    for (let i = 0; i < 10; i++) expect(await enviar()).toEqual({ status: "ok" });
    expect((await enviar()).status).toBe("error");
    expect(H.alta).toHaveBeenCalledTimes(10);
  });
});
