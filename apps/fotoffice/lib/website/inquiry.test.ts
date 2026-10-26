import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const { resolverCategoriaDelSitio, opcionesDelFormulario } = await import("./inquiry");
const { origenDelFormulario } = await import("@/lib/consultas/formulario-publico");
const { categoriasDelBloque, CATEGORIAS_DE_EJEMPLO } = await import("./inquiry-form");
const { createEmptyBlock, parseWebsiteSections, websiteBlockSchema, WEBSITE_BLOCK_DEFINITIONS } = await import("./blocks");
const { hasVisibleInquiryForm } = await import("./dynamic-data");

/** Categorías de prueba: orden, archivada y tipo viejo como las siembra la semilla. */
function categoria(id: string, name: string, extra: Record<string, unknown> = {}, ws = "ws-1") {
  B.agregar("fotofficeConsultaCategoria", { id, workspaceId: ws, name, group: "EVENTO", legacyEventType: null, archivedAt: null, order: 0, ...extra });
}

beforeEach(() => {
  B.vaciar();
});

describe("resolverCategoriaDelSitio: el formulario nunca pierde una consulta por la categoría", () => {
  it("categoría elegida activa → esa", async () => {
    categoria("c-boda", "Boda", { legacyEventType: "BODA", order: 0 });
    categoria("c-xv", "XV", { legacyEventType: "XV", order: 1 });
    expect(await resolverCategoriaDelSitio(B.prisma as never, "ws-1", "c-xv", null)).toMatchObject({ id: "c-xv", name: "XV" });
  });

  it("archivada después de publicar → la activa equivalente por su tipo viejo", async () => {
    categoria("c-otro", "Otro evento", { order: 0 });
    categoria("c-boda-vieja", "Boda (vieja)", { legacyEventType: "BODA", archivedAt: new Date("2026-10-01"), order: 1 });
    categoria("c-boda", "Boda", { legacyEventType: "BODA", order: 2 });
    expect(await resolverCategoriaDelSitio(B.prisma as never, "ws-1", "c-boda-vieja", null)).toMatchObject({ id: "c-boda" });
  });

  it("archivada sin equivalente → por el eventType que se pase", async () => {
    categoria("c-otro", "Otro evento", { order: 0 });
    categoria("c-archivada", "Vieja", { archivedAt: new Date("2026-10-01"), order: 1 });
    categoria("c-xv", "XV", { legacyEventType: "XV", order: 2 });
    expect(await resolverCategoriaDelSitio(B.prisma as never, "ws-1", "c-archivada", "XV")).toMatchObject({ id: "c-xv" });
  });

  it("sin nada elegido → «Otro evento»", async () => {
    categoria("c-boda", "Boda", { legacyEventType: "BODA", order: 0 });
    categoria("c-otro", "Otro evento", { order: 5 });
    expect(await resolverCategoriaDelSitio(B.prisma as never, "ws-1", null, null)).toMatchObject({ id: "c-otro" });
  });

  it("una categoría de OTRO workspace no vale: cae a «Otros»", async () => {
    categoria("c-ajena", "Ajena", {}, "ws-2");
    categoria("c-boda", "Boda", { order: 0 });
    categoria("c-otros", "Otros", { order: 1 });
    expect(await resolverCategoriaDelSitio(B.prisma as never, "ws-1", "c-ajena", null)).toMatchObject({ id: "c-otros" });
  });

  it("sin «otro» → la primera activa (por orden)", async () => {
    categoria("c-segunda", "Segunda", { order: 2 });
    categoria("c-primera", "Primera", { order: 1 });
    categoria("c-archivada", "Archivada", { order: 0, archivedAt: new Date("2026-10-01") });
    expect(await resolverCategoriaDelSitio(B.prisma as never, "ws-1", "c-archivada", null)).toMatchObject({ id: "c-primera" });
  });

  it("nunca devuelve una archivada: el alta sólo acepta categorías activas", async () => {
    categoria("c-archivada", "Otro evento", { archivedAt: new Date("2026-10-01") });
    expect(await resolverCategoriaDelSitio(B.prisma as never, "ws-1", "c-archivada", null)).toBeNull();
  });

  it("workspace sin categorías → null", async () => {
    categoria("c-ajena", "Otro evento", {}, "ws-2");
    expect(await resolverCategoriaDelSitio(B.prisma as never, "ws-1", null, null)).toBeNull();
  });
});

describe("origenDelFormulario: «¿Cómo nos conociste?» sólo vale con un origen activo del workspace", () => {
  beforeEach(() => {
    B.agregar("fotofficeOrigen", { id: "o-ig", workspaceId: "ws-1", name: "Instagram", order: 0, archivedAt: null });
    B.agregar("fotofficeOrigen", { id: "o-viejo", workspaceId: "ws-1", name: "Diario", order: 1, archivedAt: new Date("2026-01-01") });
    B.agregar("fotofficeOrigen", { id: "o-ajeno", workspaceId: "ws-2", name: "Google", order: 0, archivedAt: null });
  });

  it("activo y del workspace → su id", async () => {
    expect(await origenDelFormulario(B.prisma as never, "ws-1", "o-ig")).toBe("o-ig");
  });

  it("de otro workspace, archivado, vacío o basura → se ignora (null), la consulta entra igual", async () => {
    expect(await origenDelFormulario(B.prisma as never, "ws-1", "o-ajeno")).toBeNull();
    expect(await origenDelFormulario(B.prisma as never, "ws-1", "o-viejo")).toBeNull();
    expect(await origenDelFormulario(B.prisma as never, "ws-1", "")).toBeNull();
    expect(await origenDelFormulario(B.prisma as never, "ws-1", undefined)).toBeNull();
    expect(await origenDelFormulario(B.prisma as never, "ws-1", "x".repeat(500))).toBeNull();
  });
});

describe("opcionesDelFormulario", () => {
  it("sólo las categorías y orígenes activos del workspace, en su orden, con id y nombre", async () => {
    categoria("c-2", "Segunda", { order: 2 });
    categoria("c-1", "Primera", { order: 1 });
    categoria("c-arch", "Archivada", { order: 0, archivedAt: new Date("2026-01-01") });
    categoria("c-ajena", "Ajena", {}, "ws-2");
    B.agregar("fotofficeOrigen", { id: "o-2", workspaceId: "ws-1", name: "Google", order: 1, archivedAt: null });
    B.agregar("fotofficeOrigen", { id: "o-1", workspaceId: "ws-1", name: "Instagram", order: 0, archivedAt: null });
    B.agregar("fotofficeOrigen", { id: "o-x", workspaceId: "ws-1", name: "Viejo", order: 2, archivedAt: new Date("2026-01-01") });
    expect(await opcionesDelFormulario("ws-1")).toEqual({
      categorias: [{ id: "c-1", nombre: "Primera" }, { id: "c-2", nombre: "Segunda" }],
      origenes: [{ id: "o-1", nombre: "Instagram" }, { id: "o-2", nombre: "Google" }],
    });
  });
});

describe("categoriasDelBloque", () => {
  const todas = [{ id: "a", nombre: "A" }, { id: "b", nombre: "B" }, { id: "c", nombre: "C" }];

  it("lista vacía = todas las activas", () => {
    expect(categoriasDelBloque([], todas)).toEqual(todas);
  });

  it("filtra a las elegidas, en el orden del workspace", () => {
    expect(categoriasDelBloque(["c", "a"], todas)).toEqual([{ id: "a", nombre: "A" }, { id: "c", nombre: "C" }]);
  });

  it("si todas las elegidas se archivaron, ofrece todas (nunca un formulario sin opciones)", () => {
    expect(categoriasDelBloque(["z"], todas)).toEqual(todas);
  });

  it("la vista previa tiene categorías de ejemplo", () => {
    expect(CATEGORIAS_DE_EJEMPLO.length).toBeGreaterThan(1);
  });
});

describe("bloque INQUIRY_FORM", () => {
  const wrap = (config: unknown) => ({ id: "i", type: "INQUIRY_FORM", visible: true, order: 0, config });

  it("por omisión: todas las categorías, pregunta origen, fecha y lugar, y los textos del brief", () => {
    const block = createEmptyBlock("INQUIRY_FORM", 0);
    expect(block.config).toEqual({
      title: "",
      intro: "",
      categoryIds: [],
      askOrigin: true,
      askEventDate: true,
      askEventLocation: true,
      buttonLabel: "Pedir presupuesto",
      thanksMessage: "¡Gracias! Te escribimos dentro de las 24 horas.",
    });
    expect(WEBSITE_BLOCK_DEFINITIONS.INQUIRY_FORM).toMatchObject({ label: "Formulario de presupuesto", category: "COMERCIAL", source: "dynamic" });
  });

  it("valores fuera de lo permitido caen a los de omisión en vez de tirar el bloque", () => {
    const parsed = websiteBlockSchema.safeParse(wrap({ categoryIds: "x", askOrigin: "si", buttonLabel: 3, thanksMessage: null }));
    expect(parsed.success).toBe(true);
    if (!parsed.success || parsed.data.type !== "INQUIRY_FORM") return;
    expect(parsed.data.config).toMatchObject({
      categoryIds: [],
      askOrigin: true,
      buttonLabel: "Pedir presupuesto",
      thanksMessage: "¡Gracias! Te escribimos dentro de las 24 horas.",
    });
  });

  it("sobrevive al parseo de `sectionsJson`", () => {
    const sections = parseWebsiteSections({ pages: { home: [wrap({ categoryIds: ["c1"] })] } });
    expect(sections.pages.home).toHaveLength(1);
  });

  it("hasVisibleInquiryForm: sólo con un bloque visible", () => {
    const visible = createEmptyBlock("INQUIRY_FORM", 0);
    expect(hasVisibleInquiryForm([visible])).toBe(true);
    expect(hasVisibleInquiryForm([{ ...visible, visible: false }])).toBe(false);
    expect(hasVisibleInquiryForm([createEmptyBlock("TEXT", 0)])).toBe(false);
  });
});
