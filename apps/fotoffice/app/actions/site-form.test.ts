import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  branding: vi.fn(),
  website: vi.fn(),
  guardarEnvio: vi.fn(),
  suscribir: vi.fn(),
  vincularConsulta: vi.fn(),
  alta: vi.fn(),
  cabeceras: vi.fn(async () => new Headers({ "x-forwarded-for": "203.0.113.7" })),
  modulos: vi.fn(async () => new Set(["service-leads", "website"])),
}));

vi.mock("@repo/db", () => ({
  prisma: { fotofficeWorkspaceBranding: { findUnique: H.branding }, fotofficeWorkspaceWebsite: { findUnique: H.website } },
}));
vi.mock("@/lib/website/formularios.server", () => ({
  guardarEnvio: H.guardarEnvio,
  suscribir: H.suscribir,
  vincularConsulta: H.vincularConsulta,
  huellaIp: (ip: string | null) => (ip ? `huella-de-${ip.length}` : null),
  esTablaFaltante: (e: unknown) => (e as { code?: string })?.code === "P2021",
}));
vi.mock("@/lib/consultas/alta", () => ({
  altaDeConsulta: H.alta,
  altaDelSistema: (workspaceId: string) => ({ workspaceId }),
  MENSAJES_ALTA: { fallo: "x", categoria: "Elegí una categoría.", origen: "Elegí un origen válido." },
  MAX_MENSAJE_CONSULTA: 4000,
}));
vi.mock("@/lib/consultas/formulario-publico", () => ({ origenDelFormulario: async (_db: unknown, _ws: string, id: string) => (id === "o-ig" ? "o-ig" : null) }));
vi.mock("@/lib/website/inquiry", () => ({ resolverCategoriaDelSitio: async () => ({ id: "c-otro", legacyEventType: "OTRO_EVENTO" }) }));
vi.mock("next/headers", () => ({ headers: H.cabeceras }));
vi.mock("@/lib/modules/gating", () => ({ getEnabledModuleKeysForWorkspace: H.modulos }));

const { submitSiteForm, subscribeNewsletter } = await import("./site-form");
const { resetRateLimit } = await import("@/lib/geocode/rate-limit");

const FORM = {
  id: "f-videos",
  type: "FORM",
  visible: true,
  order: 0,
  config: {
    title: "Videos de la fiesta",
    fields: [
      { id: "nombre", type: "text", label: "Nombre", required: true, help: "", options: [] },
      { id: "mail", type: "email", label: "Correo", required: true, help: "", options: [] },
    ],
    afterSubmit: "reveal",
    revealText: "Gracias por tus datos",
    revealLinkLabel: "Mirá los videos acá",
    revealLinkUrl: "/videos-privados",
    createInquiry: true,
    categoryId: "c-boda",
    origenId: "o-ig",
  },
};

function sitioPublicado(blocks: unknown[]) {
  return {
    publishedVersion: {
      sectionsJson: {
        pages: { home: [], p_1: blocks, p_2: [] },
        pageMeta: { p_1: { slug: "fiesta", title: "Fiesta" }, p_2: { slug: "videos-privados", title: "Videos" } },
      },
    },
  };
}

function form(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ workspaceSlug: "dnx-estudio", blockId: "f-videos", ...campos })) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  H.branding.mockResolvedValue({ workspaceId: "ws-1" });
  H.website.mockResolvedValue(sitioPublicado([FORM, { id: "n-1", type: "NEWSLETTER", visible: true, order: 1, config: { askName: true } }]));
  H.guardarEnvio.mockResolvedValue("envio-1");
  H.alta.mockResolvedValue({ ok: true, consultaId: "q-1" });
  H.modulos.mockResolvedValue(new Set(["service-leads", "website"]));
  H.cabeceras.mockImplementation(async () => new Headers({ "x-forwarded-for": "203.0.113.7" }));
});

describe("submitSiteForm", () => {
  it("valida contra el bloque publicado, guarda los pares y recién ahí revela el contenido oculto", async () => {
    const r = await submitSiteForm({ status: "idle" }, form({ f_nombre: "Ana", f_mail: "ANA@b.com", f_inventado: "no", nombre: "x" }));
    expect(r).toEqual({
      status: "ok",
      revelado: { texto: "Gracias por tus datos", enlace: { etiqueta: "Mirá los videos acá", href: "/w/dnx-estudio/videos-privados" } },
    });
    expect(H.guardarEnvio).toHaveBeenCalledWith({
      workspaceId: "ws-1",
      clave: "f-videos",
      nombreFormulario: "Videos de la fiesta",
      pares: [
        { etiqueta: "Nombre", valor: "Ana" },
        { etiqueta: "Correo", valor: "ana@b.com" },
      ],
      contacto: { nombre: "Ana", email: "ana@b.com", telefono: null },
      paginaUrl: "/w/dnx-estudio/fiesta",
      // Nunca la IP cruda.
      ipHash: "huella-de-11",
    });
  });

  it("crea la consulta con la categoría y el origen del bloque y la vincula al envío", async () => {
    await submitSiteForm({ status: "idle" }, form({ f_nombre: "Ana", f_mail: "ana@b.com" }));
    expect(H.alta).toHaveBeenCalledTimes(1);
    expect(H.alta.mock.calls[0]![1]).toMatchObject({
      contacto: { nombre: "Ana", email: "ana@b.com", telefono: null },
      categoriaId: "c-otro",
      origenId: "o-ig",
      formSlug: "sitio-formulario",
      message: "Formulario del sitio «Videos de la fiesta»\nNombre: Ana\nCorreo: ana@b.com",
    });
    expect(H.vincularConsulta).toHaveBeenCalledWith("ws-1", "envio-1", "q-1");
  });

  it("sin Consultas encendido guarda el envío pero no crea consulta", async () => {
    H.modulos.mockResolvedValue(new Set(["website"]));
    expect((await submitSiteForm({ status: "idle" }, form({ f_nombre: "Ana", f_mail: "ana@b.com" }))).status).toBe("ok");
    expect(H.guardarEnvio).toHaveBeenCalled();
    expect(H.alta).not.toHaveBeenCalled();
  });

  it("si la consulta falla, el envío igual queda y la persona ve el éxito", async () => {
    H.alta.mockRejectedValue(new Error("boom"));
    const r = await submitSiteForm({ status: "idle" }, form({ f_nombre: "Ana", f_mail: "ana@b.com" }));
    expect(r.status).toBe("ok");
  });

  it("un campo obligatorio vacío no guarda ni revela nada", async () => {
    const r = await submitSiteForm({ status: "idle" }, form({ f_nombre: "Ana" }));
    expect(r).toEqual({ status: "error", error: "Completá «Correo»." });
    expect(H.guardarEnvio).not.toHaveBeenCalled();
  });

  it("el campo trampa responde éxito sin guardar ni revelar", async () => {
    const r = await submitSiteForm({ status: "idle" }, form({ f_nombre: "Ana", f_mail: "ana@b.com", fo_hp_x: "soy un robot" }));
    expect(r).toEqual({ status: "ok", revelado: null });
    expect(H.guardarEnvio).not.toHaveBeenCalled();
  });

  it.each([
    ["un bloque que no existe", { blockId: "otro" }],
    ["un bloque de otro tipo", { blockId: "n-1" }],
    ["otro sitio", { workspaceSlug: "nadie" }],
  ])("rechaza %s", async (_, cambio) => {
    H.branding.mockImplementation(async ({ where }: { where: { publicSlug: string } }) => (where.publicSlug === "dnx-estudio" ? { workspaceId: "ws-1" } : null));
    const r = await submitSiteForm({ status: "idle" }, form({ f_nombre: "Ana", f_mail: "ana@b.com", ...cambio }));
    expect(r).toEqual({ status: "error", error: "Este formulario no está disponible." });
  });

  it("un bloque que sólo está en el borrador (no publicado) no recibe envíos", async () => {
    H.website.mockResolvedValue(sitioPublicado([]));
    expect(await submitSiteForm({ status: "idle" }, form({ f_nombre: "Ana", f_mail: "ana@b.com" }))).toEqual({ status: "error", error: "Este formulario no está disponible." });
  });

  it("con el Sitio web apagado no recibe envíos", async () => {
    H.modulos.mockResolvedValue(new Set(["service-leads"]));
    expect((await submitSiteForm({ status: "idle" }, form({ f_nombre: "Ana", f_mail: "ana@b.com" }))).status).toBe("error");
  });

  it("frena muchos envíos seguidos desde la misma IP", async () => {
    for (let i = 0; i < 10; i++) await submitSiteForm({ status: "idle" }, form({ f_nombre: "Ana", f_mail: "ana@b.com" }));
    const r = await submitSiteForm({ status: "idle" }, form({ f_nombre: "Ana", f_mail: "ana@b.com" }));
    expect(r.status).toBe("error");
    expect(H.guardarEnvio).toHaveBeenCalledTimes(10);
  });

  it("sin las tablas, responde «no disponible»", async () => {
    H.guardarEnvio.mockRejectedValue({ code: "P2021" });
    expect(await submitSiteForm({ status: "idle" }, form({ f_nombre: "Ana", f_mail: "ana@b.com" }))).toEqual({ status: "error", error: "Este formulario no está disponible." });
  });
});

describe("subscribeNewsletter", () => {
  const nl = (campos: Record<string, string>) => subscribeNewsletter({ status: "idle" }, form({ blockId: "n-1", ...campos }));

  it("suscribe con el correo normalizado y el nombre que pide el bloque", async () => {
    expect(await nl({ email: " Ana@B.com ", name: " Ana  Pérez " })).toEqual({ status: "ok" });
    expect(H.suscribir).toHaveBeenCalledWith("ws-1", "ana@b.com", "Ana Pérez");
  });

  it("valida el correo y el nombre pedido", async () => {
    expect(await nl({ email: "nada", name: "Ana" })).toEqual({ status: "error", error: "Revisá el correo." });
    expect(await nl({ email: "a@b.com" })).toEqual({ status: "error", error: "Completá tu nombre." });
    expect(H.suscribir).not.toHaveBeenCalled();
  });

  it("no acepta el id de un formulario como boletín", async () => {
    expect((await nl({ blockId: "f-videos", email: "a@b.com", name: "A" })).status).toBe("error");
  });
});
