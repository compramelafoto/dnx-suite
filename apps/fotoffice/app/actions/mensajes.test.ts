import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  ctx: vi.fn(), modulo: vi.fn(), revalidate: vi.fn(), registro: vi.fn(),
  preparar: vi.fn(), correo: vi.fn(), whatsapp: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: H.revalidate }));
vi.mock("@repo/db", () => ({ prisma: {} }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: H.modulo }));
vi.mock("@/lib/plantillas/acceso", () => ({ contextoDePlantillas: H.ctx }));
vi.mock("@/lib/campos/valores", () => ({ registroDelWorkspace: H.registro }));
vi.mock("@/lib/plantillas/envio", () => ({
  MENSAJES_ENVIO: { sinPermiso: "No tenés permiso para enviar mensajes.", noEncontrado: "No encontramos ese registro.", datosInvalidos: "Los datos no son válidos." },
  prepararMensaje: H.preparar,
  enviarCorreo: H.correo,
  abrirWhatsapp: H.whatsapp,
}));

const A = await import("./mensajes");

const CTX = { workspaceId: "ws-1", workspaceSlug: "", userId: 7, userLabel: "Ana", userName: "Ana", userEmail: "a@x.test", role: "STAFF" };
const INVALIDOS = { ok: false, error: "Los datos no son válidos." };
const SIN_ACCESO = { ok: false, error: "No tenés permiso para enviar mensajes." };
const NO_ENCONTRADO = { ok: false, error: "No encontramos ese registro." };
const APAGADO = { ok: false, error: "Ese módulo no está activo." };

const PREPARAR = { canal: "EMAIL", entityType: "CLIENTE", entityId: "c1", templateId: "t1" };
const CORREO = { entityType: "CLIENTE", entityId: "c1", templateId: "t1", asunto: "Hola", cuerpo: "Texto" };
const WSP = { entityType: "CONSULTA", entityId: "l1", templateId: null, cuerpo: "Hola" };

const llamar = {
  preparar: (d: unknown) => A.prepararMensajeAction(d as never),
  correo: (d: unknown) => A.enviarCorreoAction(d as never),
  whatsapp: (d: unknown) => A.abrirWhatsappAction(d as never),
};
const CASOS = [
  ["preparar", PREPARAR, H.preparar],
  ["correo", CORREO, H.correo],
  ["whatsapp", WSP, H.whatsapp],
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  H.ctx.mockResolvedValue(CTX);
  H.modulo.mockResolvedValue(true);
  H.registro.mockResolvedValue(true);
  H.preparar.mockResolvedValue({ ok: true, asunto: "a", cuerpo: "b", vacias: [], pendientes: false, destino: { email: null, telefono: null } });
  H.correo.mockResolvedValue({ ok: true, mensajeId: "m1" });
  H.whatsapp.mockResolvedValue({ ok: true, url: "https://wa.me/1", mensajeId: "m2" });
});

describe("acciones de mensajes", () => {
  it("preparar usa el workspace de la sesión y no revalida", async () => {
    expect(await A.prepararMensajeAction(PREPARAR)).toMatchObject({ ok: true });
    expect(H.registro).toHaveBeenCalledWith("ws-1", "CLIENTE", "c1");
    expect(H.preparar).toHaveBeenCalledWith(CTX, { canal: "EMAIL", entityType: "CLIENTE", entityId: "c1", templateId: "t1" });
    expect(H.revalidate).not.toHaveBeenCalled();
  });

  it("correo: envía con el contexto de la sesión y revalida la ficha", async () => {
    expect(await A.enviarCorreoAction(CORREO)).toEqual({ ok: true, mensajeId: "m1" });
    expect(H.correo).toHaveBeenCalledWith(CTX, { entityType: "CLIENTE", entityId: "c1", templateId: "t1", asunto: "Hola", cuerpo: "Texto" });
    expect(H.correo.mock.calls[0]![1]).not.toHaveProperty("automatico");
    expect(H.revalidate).toHaveBeenCalledWith("/clientes/c1");
  });

  it("correo fallido y registrado también revalida; sin registrar, no", async () => {
    H.correo.mockResolvedValueOnce({ ok: false, error: "x", registrado: true });
    await A.enviarCorreoAction(CORREO);
    expect(H.revalidate).toHaveBeenCalledTimes(1);
    H.correo.mockResolvedValueOnce({ ok: false, error: "tope" });
    await A.enviarCorreoAction(CORREO);
    expect(H.revalidate).toHaveBeenCalledTimes(1);
  });

  it("WhatsApp: devuelve la URL y revalida la ficha de la consulta", async () => {
    expect(await A.abrirWhatsappAction(WSP)).toEqual({ ok: true, url: "https://wa.me/1", mensajeId: "m2" });
    expect(H.modulo).toHaveBeenCalledWith("ws-1", "service-leads");
    expect(H.revalidate).toHaveBeenCalledWith("/captacion/l1");
  });

  it.each([
    ["SOCIO", "members", "/members/m1"],
    ["CLIENTE", "clients", "/clientes/m1"],
  ])("%s mira el módulo %s y revalida %s", async (entityType, modulo, ruta) => {
    await A.enviarCorreoAction({ ...CORREO, entityType, entityId: "m1" });
    expect(H.modulo).toHaveBeenCalledWith("ws-1", modulo);
    expect(H.revalidate).toHaveBeenCalledWith(ruta);
  });

  it.each([
    ["preparar sin datos", "preparar", null],
    ["preparar canal inventado", "preparar", { ...PREPARAR, canal: "SMS" }],
    ["preparar tipo GENERAL", "preparar", { ...PREPARAR, entityType: "GENERAL" }],
    ["preparar plantilla no texto", "preparar", { ...PREPARAR, templateId: 5 }],
    ["correo tipo reservado", "correo", { ...CORREO, entityType: "PRESUPUESTO" }],
    ["correo id vacío", "correo", { ...CORREO, entityId: "" }],
    ["correo id largo", "correo", { ...CORREO, entityId: "x".repeat(101) }],
    ["correo asunto no texto", "correo", { ...CORREO, asunto: 1 }],
    ["correo cuerpo enorme", "correo", { ...CORREO, cuerpo: "x".repeat(20_000) }],
    ["whatsapp sin cuerpo", "whatsapp", { ...WSP, cuerpo: undefined }],
    ["whatsapp plantilla larga", "whatsapp", { ...WSP, templateId: "x".repeat(101) }],
  ] as const)("forma inválida (%s): ni siquiera arma el contexto", async (_n, cual, datos) => {
    expect(await llamar[cual](datos)).toEqual(INVALIDOS);
    expect(H.ctx).not.toHaveBeenCalled();
  });

  it.each(CASOS)("%s sin contexto (sin sesión o sin `operar`): sin permiso", async (cual, datos, interno) => {
    H.ctx.mockResolvedValue(null);
    expect(await llamar[cual](datos)).toEqual(SIN_ACCESO);
    expect(interno).not.toHaveBeenCalled();
  });

  it.each(CASOS)("%s con un rol sin `operar`: sin permiso, sin mirar el registro", async (cual, datos, interno) => {
    H.ctx.mockResolvedValue({ ...CTX, role: "COLLABORATOR" });
    expect(await llamar[cual](datos)).toEqual(SIN_ACCESO);
    expect(H.registro).not.toHaveBeenCalled();
    expect(interno).not.toHaveBeenCalled();
  });

  it.each(CASOS)("%s con el módulo apagado: no busca el registro", async (cual, datos, interno) => {
    H.modulo.mockResolvedValue(false);
    expect(await llamar[cual](datos)).toEqual(APAGADO);
    expect(H.registro).not.toHaveBeenCalled();
    expect(interno).not.toHaveBeenCalled();
  });

  it.each(CASOS)("%s con un registro de otro workspace: no encontrado", async (cual, datos, interno) => {
    H.registro.mockResolvedValue(false);
    expect(await llamar[cual](datos)).toEqual(NO_ENCONTRADO);
    expect(interno).not.toHaveBeenCalled();
    expect(H.revalidate).not.toHaveBeenCalled();
  });

  it("un `automatico: true` del cliente no sirve: sin `operar` se rechaza y nunca llega como automático", async () => {
    H.ctx.mockResolvedValue({ ...CTX, role: "COLLABORATOR" });
    expect(await llamar.correo({ ...CORREO, automatico: true })).toEqual(SIN_ACCESO);
    expect(H.correo).not.toHaveBeenCalled();
    H.ctx.mockResolvedValue(CTX);
    await llamar.correo({ ...CORREO, automatico: true });
    expect(H.correo).toHaveBeenCalledTimes(1);
    expect(H.correo.mock.calls[0]![1]).not.toHaveProperty("automatico");
  });

  it("el archivo \"use server\" sólo exporta funciones async", () => {
    const fuente = readFileSync(new URL("./mensajes.ts", import.meta.url), "utf8");
    expect(fuente.startsWith('"use server";')).toBe(true);
    const exports = [...fuente.matchAll(/^export\s+(?!async function|type\s)(\S+)/gm)].map((m) => m[1]);
    expect(exports).toEqual([]);
    for (const f of Object.values(A)) expect(f.constructor.name).toBe("AsyncFunction");
  });
});
