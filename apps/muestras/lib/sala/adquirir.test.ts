import { beforeEach, describe, expect, it, vi } from "vitest";

// La página `/m/[slug]/sala/o/[workId]/adquirir` con el pase, la base y la navegación simulados.
const db = vi.hoisted(() => ({
  culturalActivity: { findUnique: vi.fn(), count: vi.fn() },
  culturalActivityWork: { findMany: vi.fn() },
  culturalExhibitorWork: { findFirst: vi.fn() },
  culturalActivityRoomKey: { findUnique: vi.fn() },
}));
const galletas = vi.hoisted(() => ({ valor: new Map<string, string>() }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => null }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (galletas.valor.has(n) ? { value: galletas.valor.get(n) } : undefined) }),
  headers: async () => new Headers({ "x-forwarded-for": "1.1.1.1" }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); },
  notFound: () => { throw new Error("NOT_FOUND"); },
}));

const { default: AdquirirObra } = await import("@/app/m/[slug]/sala/o/[workId]/adquirir/page");
const { firmarPase } = await import("./llave");
const { SALE_ASK_TEXT, SALE_UNAVAILABLE_TEXT, visibilityFromPreset } = await import("@repo/muestras");
const { resetRateLimit } = await import("@/lib/limite");

const LLAVE = "9".repeat(64);
const muestra = {
  id: "a1", slug: "silos", title: "Silos", type: "MUESTRA", reviewStatus: "APPROVED", galleryMode: "HIGHLIGHTS_UNTIL_CLOSED",
  visibility: visibilityFromPreset("SURPRISE", "s"), startsAt: new Date(Date.now() - 86_400_000), endsAt: new Date(Date.now() + 86_400_000),
};
/** Todo el texto y los atributos de texto del árbol de React (sin recorrer `_owner` ni funciones). */
function textoDe(n: unknown): string {
  if (n == null || typeof n === "boolean") return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(textoDe).join(" ");
  if (typeof n === "object" && "props" in (n as object)) {
    const props = (n as { props: Record<string, unknown> }).props;
    return Object.values(props).map((v) => (typeof v === "string" ? v : textoDe(v))).join(" ");
  }
  return "";
}
const abrir = () => AdquirirObra({ params: Promise.resolve({ slug: "silos", workId: "w1" }) });

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  galletas.valor = new Map([["mf_sala_a1", firmarPase({ v: 1, a: "a1", exp: Date.now() + 3600_000, w: ["w1"] }, LLAVE)]]);
  db.culturalActivity.findUnique.mockResolvedValue(muestra);
  db.culturalActivity.count.mockResolvedValue(0);
  db.culturalActivityWork.findMany.mockResolvedValue([
    { id: "w1", title: "Silos", authorName: "Ema", authorProfileId: "p1", year: 2024, technique: null, isHighlight: false, sortOrder: 0 },
  ]);
  // Aunque la base tuviera el precio a mano, la página no lo pide ni lo muestra.
  db.culturalExhibitorWork.findFirst.mockResolvedValue({ forSale: true, priceArs: 987654 });
  db.culturalActivityRoomKey.findUnique.mockResolvedValue({ secret: LLAVE });
});

describe("Adquirir obra", () => {
  it("con pase y obra a la venta: la venta todavía no está disponible, sin precio", async () => {
    const arbol = textoDe(await abrir());
    expect(arbol).toContain(SALE_UNAVAILABLE_TEXT);
    expect(arbol).toContain(SALE_ASK_TEXT);
    expect(arbol).toContain("Volver a la obra");
    expect(arbol).not.toContain("987654");
    expect(arbol).not.toMatch(/987[.]654/);
    expect(db.culturalExhibitorWork.findFirst.mock.calls[0]![0].select).toEqual({ forSale: true });
  });
  it("sin pase: a la página pública de la obra", async () => {
    galletas.valor = new Map();
    await expect(abrir()).rejects.toThrow("REDIRECT /m/silos/o/w1");
  });
  it("una obra que no se vende no tiene página de venta", async () => {
    db.culturalExhibitorWork.findFirst.mockResolvedValue({ forSale: false });
    await expect(abrir()).rejects.toThrow("NOT_FOUND");
  });
});
