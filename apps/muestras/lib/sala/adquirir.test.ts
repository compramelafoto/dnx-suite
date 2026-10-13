import { beforeEach, describe, expect, it, vi } from "vitest";

// Las páginas "Adquirir obra" (sala y pública) con el pase, la base, el modo y la navegación simulados.
const db = vi.hoisted(() => ({
  culturalActivity: { findUnique: vi.fn(), count: vi.fn() },
  culturalActivityWork: { findMany: vi.fn() },
  culturalExhibitorWork: { findFirst: vi.fn() },
  culturalContestWork: { findFirst: vi.fn() },
  culturalWorkOffer: { count: vi.fn() },
  culturalSaleSetup: { findUnique: vi.fn() },
  culturalActivityRoomKey: { findUnique: vi.fn() },
}));
const galletas = vi.hoisted(() => ({ valor: new Map<string, string>() }));
const estado = vi.hoisted(() => ({
  usuario: null as null | { id: number; esSuperAdmin: boolean },
  modo: "OFF" as "OFF" | "TEST" | "LIVE",
  marcada: true,
  aprobadas: 1,
  ofertas: [] as unknown[],
  publica: null as unknown,
}));
const comprable = vi.hoisted(() => ({ ofertasDeLaObra: vi.fn() }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => estado.usuario }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (galletas.valor.has(n) ? { value: galletas.valor.get(n) } : undefined) }),
  headers: async () => new Headers({ "x-forwarded-for": "1.1.1.1" }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); },
  notFound: () => { throw new Error("NOT_FOUND"); },
}));
vi.mock("@/lib/ventas/config", async () => {
  const real = await vi.importActual<typeof import("@/lib/ventas/config")>("@/lib/ventas/config");
  const config = () => ({ modo: estado.modo, motivo: null, faltan: [], mpEnv: "sandbox", ambienteCuenta: "SANDBOX", probadores: new Set([60]) });
  return {
    puedeComprar: real.puedeComprar,
    leerConfigDeVentas: config,
    credencialesDeVentas: () => ({ publicKey: "TEST-public-key" }),
  };
});
vi.mock("@/lib/ventas/modo", () => ({ configVerificada: async () => ({ modo: estado.modo, motivo: null, faltan: [], ambienteCuenta: "SANDBOX", probadores: new Set([60]) }) }));
vi.mock("@/lib/ventas/comprable", () => comprable);
vi.mock("@/lib/actividades/consultas", () => ({ buscarPorSlug: async () => estado.publica }));

const { default: AdquirirObra } = await import("@/app/m/[slug]/sala/o/[workId]/adquirir/page");
const { default: AdquirirObraPublica } = await import("@/app/m/[slug]/o/[workId]/adquirir/page");
const { firmarPase } = await import("./llave");
const { SALE_ASK_TEXT, SALE_UNAVAILABLE_TEXT, visibilityFromPreset } = await import("@repo/muestras");
const { resetRateLimit } = await import("@/lib/limite");

const LLAVE = "9".repeat(64);
const muestra = {
  id: "a1", slug: "silos", title: "Silos", type: "MUESTRA", reviewStatus: "APPROVED", galleryMode: "HIGHLIGHTS_UNTIL_CLOSED",
  visibility: visibilityFromPreset("SURPRISE", "s"), startsAt: new Date(Date.now() - 86_400_000), endsAt: new Date(Date.now() + 86_400_000),
};
const SERVIDOR = new Set(["Compra"]);
/** Todo texto y número del árbol, incluidas las props (objetos) que van a los componentes de cliente. */
function todoDe(n: unknown, vistos = new Set<unknown>()): string {
  if (n == null || typeof n === "boolean" || typeof n === "function") return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (typeof n !== "object" || vistos.has(n)) return "";
  vistos.add(n);
  if (Array.isArray(n)) return n.map((x) => todoDe(x, vistos)).join(" ");
  if ("props" in (n as object)) {
    // Los componentes de servidor se "renderizan" (son funciones sin hooks); los de cliente quedan con sus props.
    const el = n as { type: unknown; props: unknown };
    if (typeof el.type === "function" && SERVIDOR.has(el.type.name)) return todoDe((el.type as (p: unknown) => unknown)(el.props), vistos);
    return todoDe(el.props, vistos);
  }
  return Object.entries(n as Record<string, unknown>).filter(([k]) => k !== "_owner").map(([, v]) => todoDe(v, vistos)).join(" ");
}
const abrir = () => AdquirirObra({ params: Promise.resolve({ slug: "silos", workId: "w1" }) });
const abrirPublica = () => AdquirirObraPublica({ params: Promise.resolve({ slug: "silos", workId: "w1" }) });

const oferta = (extra: Record<string, unknown> = {}) => ({
  id: "of1", format: "DIGITAL", editionKind: "LIMITED", editionSize: 10, proofCount: 0, paper: null, widthCm: null, heightCm: null,
  priceArs: 80000, quedan: 7, comprable: { ok: true }, ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  estado.usuario = null;
  estado.modo = "OFF";
  estado.marcada = true;
  estado.aprobadas = 1;
  galletas.valor = new Map([["mf_sala_a1", firmarPase({ v: 1, a: "a1", exp: Date.now() + 3600_000, w: ["w1"] }, LLAVE)]]);
  db.culturalActivity.findUnique.mockResolvedValue(muestra);
  db.culturalActivity.count.mockResolvedValue(0);
  db.culturalActivityWork.findMany.mockResolvedValue([
    { id: "w1", title: "Silos", authorName: "Ema", authorProfileId: "p1", year: 2024, technique: null, isHighlight: false, sortOrder: 0 },
  ]);
  // Aunque la base tuviera el precio del expositor, la página no lo pide ni lo muestra.
  db.culturalExhibitorWork.findFirst.mockImplementation(async () => (estado.marcada ? { id: "e1", forSale: true, priceArs: 987654 } : null));
  db.culturalContestWork.findFirst.mockResolvedValue(null);
  db.culturalWorkOffer.count.mockImplementation(async () => estado.aprobadas);
  db.culturalSaleSetup.findUnique.mockResolvedValue({ shippingEnabled: true, shippingCostArs: 8000, pickupText: "Sede central", shippingText: "Correo", extraTerms: null });
  db.culturalActivityRoomKey.findUnique.mockResolvedValue({ secret: LLAVE });
  comprable.ofertasDeLaObra.mockResolvedValue([oferta(), oferta({ id: "of2", format: "PRINT", editionKind: "UNIQUE", editionSize: 1, paper: "Hahnemühle Photo Rag 308 g", widthCm: 40, heightCm: 60, priceArs: 350000, quedan: 1 })]);
  estado.publica = {
    id: "a1", slug: "silos", title: "Silos", type: "MUESTRA", galleryMode: "FULL", visibility: visibilityFromPreset("OPEN", "s"),
    startsAt: muestra.startsAt, endsAt: muestra.endsAt, isCancelled: false,
    works: [{ id: "w1", title: "Silos", authorName: "Ema", imageUrl: "https://pub-test.r2.dev/w1.webp", isHighlight: false, sortOrder: 0 }],
  };
});

describe("Adquirir obra en la sala", () => {
  it("con la venta apagada: lo de siempre, sin precio, y los formatos ni se consultan", async () => {
    const arbol = todoDe(await abrir());
    expect(arbol).toContain(SALE_UNAVAILABLE_TEXT);
    expect(arbol).toContain(SALE_ASK_TEXT);
    expect(arbol).toContain("Volver a la obra");
    expect(arbol).not.toMatch(/987[.]?654|80[.]?000|350[.]?000|\$/);
    expect(comprable.ofertasDeLaObra).not.toHaveBeenCalled();
  });
  it("en modo prueba, un visitante sin permiso tampoco ve precios", async () => {
    estado.modo = "TEST";
    estado.usuario = { id: 99, esSuperAdmin: false };
    const arbol = todoDe(await abrir());
    expect(arbol).toContain(SALE_UNAVAILABLE_TEXT);
    expect(arbol).not.toMatch(/80[.]?000|350[.]?000/);
    expect(comprable.ofertasDeLaObra).not.toHaveBeenCalled();
  });
  it("en modo prueba, un probador ve los formatos con precio, la entrega y el aviso de prueba", async () => {
    estado.modo = "TEST";
    estado.usuario = { id: 60, esSuperAdmin: false };
    const arbol = todoDe(await abrir());
    expect(arbol).not.toContain(SALE_UNAVAILABLE_TEXT);
    expect(arbol).toContain("Modo prueba: sólo vos ves esto.");
    expect(arbol).toContain("80000");
    expect(arbol).toContain("Edición de 10 · Quedan 7");
    expect(arbol).toContain("Hahnemühle Photo Rag 308 g · 40 × 60 cm · Copia única");
    expect(arbol).toContain("Envío: $8.000 — Correo");
    expect(arbol).toContain("Retiro en la sede: Sede central");
    expect(arbol).toContain("TEST-public-key");
  });
  it("con formatos aprobados pero todo vendido: 'Se vendieron todas'", async () => {
    estado.modo = "LIVE";
    comprable.ofertasDeLaObra.mockResolvedValue([oferta({ quedan: 0, comprable: { ok: false, reasons: ["Agotada"] } })]);
    const arbol = todoDe(await abrir());
    expect(arbol).toContain("Se vendieron todas las copias de esta obra.");
    expect(arbol).not.toContain("80000");
  });
  it("con formatos aprobados que no se pueden comprar por otra cosa: no disponible (no 'agotada')", async () => {
    estado.modo = "LIVE";
    comprable.ofertasDeLaObra.mockResolvedValue([oferta({ comprable: { ok: false, reasons: ["Falta el original"] } })]);
    const arbol = todoDe(await abrir());
    expect(arbol).toContain(SALE_UNAVAILABLE_TEXT);
  });
  it("sin pase: a la página pública de la obra", async () => {
    galletas.valor = new Map();
    await expect(abrir()).rejects.toThrow("REDIRECT /m/silos/o/w1");
  });
  it("una obra sin nada a la venta no tiene página de venta", async () => {
    estado.marcada = false;
    estado.aprobadas = 0;
    await expect(abrir()).rejects.toThrow("NOT_FOUND");
  });
  it("obra de concurso con un formato aprobado (sin fila de expositor): tiene página", async () => {
    estado.marcada = false;
    const arbol = todoDe(await abrir());
    expect(arbol).toContain(SALE_UNAVAILABLE_TEXT);
  });
});

describe("Adquirir obra desde la página pública", () => {
  it("una obra que se ve online: la misma página (con la venta apagada, sin precio)", async () => {
    const arbol = todoDe(await abrirPublica());
    expect(arbol).toContain(SALE_UNAVAILABLE_TEXT);
    expect(arbol).not.toContain("80000");
  });
  it("una obra que no se ve online completa: 404", async () => {
    estado.publica = { ...(estado.publica as object), galleryMode: "HIGHLIGHTS_UNTIL_CLOSED", visibility: visibilityFromPreset("SURPRISE", "s") };
    await expect(abrirPublica()).rejects.toThrow("NOT_FOUND");
  });
});
