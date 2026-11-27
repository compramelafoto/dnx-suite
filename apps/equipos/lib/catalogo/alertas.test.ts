import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  alertCount: vi.fn(),
  alertCreate: vi.fn(),
  alertDeleteMany: vi.fn(),
  alertFindMany: vi.fn(),
  listingFindMany: vi.fn(),
  hitCreate: vi.fn(),
  hitDeleteMany: vi.fn(),
  blockFindMany: vi.fn(),
  email: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    gearSearchAlert: {
      count: m.alertCount,
      create: m.alertCreate,
      deleteMany: m.alertDeleteMany,
      findMany: m.alertFindMany,
    },
    gearListing: { findMany: m.listingFindMany },
    gearSearchAlertHit: { create: m.hitCreate, deleteMany: m.hitDeleteMany },
    portalAccountBlock: { findMany: m.blockFindMany },
  },
}));
vi.mock("@/lib/correo", () => ({ sendPortalEmail: m.email }));
vi.mock("@/lib/sesion", () => ({ urlBaseDeLaApp: () => "https://e.test" }));

import {
  MAX_ALERTS,
  createAlert,
  deleteAlert,
  describeAlert,
  listAlerts,
  runSearchAlerts,
} from "./alertas";

const AYER = new Date("2026-11-26T12:00:00Z");
const HOY = new Date("2026-11-27T12:00:00Z");

type FakeListing = {
  id: number;
  sellerId: number;
  status: string;
  kind: string;
  make: string;
  model: string;
  mount: string | null;
  priceArs: number;
  province: string;
  city: string;
  publishedAt: Date;
};

let listings: FakeListing[];
let alerts: Array<Record<string, unknown>>;
let hits: Map<number, string>;
let nextHitId: number;
const hitKeys = () => new Set(hits.values());
let bloqueados: number[];

const pub = (over: Partial<FakeListing>): FakeListing => ({
  id: 1,
  sellerId: 50,
  status: "PUBLISHED",
  kind: "LENS",
  make: "Sony",
  model: "FE 24-70 GM",
  mount: "Sony E",
  priceArs: 800000,
  province: "Córdoba",
  city: "Córdoba",
  publishedAt: HOY,
  ...over,
});

/** Evalúa la parte del `where` de Prisma que usa `runSearchAlerts`. */
function cumple(l: FakeListing, w: Record<string, any>): boolean {
  if (w.status && l.status !== w.status) return false;
  if (w.sellerId?.notIn?.includes(l.sellerId)) return false;
  if (w.publishedAt?.gte && l.publishedAt < w.publishedAt.gte) return false;
  if (w.kind && l.kind !== w.kind) return false;
  if (w.make?.contains && !l.make.toLowerCase().includes(w.make.contains.toLowerCase())) return false;
  if (w.mount && l.mount !== w.mount) return false;
  if (w.province && l.province !== w.province) return false;
  if (w.priceArs?.lte !== undefined && l.priceArs > w.priceArs.lte) return false;
  const alertId = w.alertHits?.none?.alertId;
  if (alertId !== undefined && hitKeys().has(`${alertId}:${l.id}`)) return false;
  return true;
}

beforeEach(() => {
  vi.clearAllMocks();
  listings = [];
  hits = new Map();
  nextHitId = 1;
  bloqueados = [];
  alerts = [
    {
      id: 1,
      userId: 7,
      kind: "LENS",
      make: "Sony",
      mount: null,
      maxPriceArs: 900000,
      province: null,
      createdAt: AYER,
      user: { email: "comprador@e.test", name: "Juan Gómez" },
    },
  ];
  m.blockFindMany.mockImplementation(async () => bloqueados.map((userId) => ({ userId })));
  m.alertFindMany.mockImplementation(async ({ where }) =>
    alerts.filter((a) => !where?.userId?.notIn?.includes(a.userId)),
  );
  m.listingFindMany.mockImplementation(async ({ where, take, orderBy }) => {
    const found = listings.filter((l) => cumple(l, where));
    const asc = orderBy?.[0]?.publishedAt === "asc";
    found.sort((a, b) => (asc ? 1 : -1) * (a.publishedAt.getTime() - b.publishedAt.getTime() || a.id - b.id));
    return found.slice(0, take);
  });
  m.hitCreate.mockImplementation(async ({ data }) => {
    const k = `${data.alertId}:${data.listingId}`;
    if (hitKeys().has(k)) throw { code: "P2002" };
    const id = nextHitId++;
    hits.set(id, k);
    return { id };
  });
  m.hitDeleteMany.mockImplementation(async ({ where }) => {
    let count = 0;
    for (const id of where.id.in) if (hits.delete(id)) count += 1;
    return { count };
  });
  m.email.mockResolvedValue({ success: true });
});

describe("createAlert", () => {
  beforeEach(() => {
    m.alertCount.mockResolvedValue(0);
    m.alertCreate.mockResolvedValue({ id: 99 });
  });

  it("guarda los filtros y devuelve el id", async () => {
    expect(await createAlert(7, { kind: "LENS", make: "Sony", maxPrice: 900000 })).toEqual({
      alertId: 99,
    });
    expect(m.alertCreate).toHaveBeenCalledWith({
      data: {
        userId: 7,
        kind: "LENS",
        make: "Sony",
        mount: null,
        maxPriceArs: 900000,
        province: null,
      },
      select: { id: true },
    });
  });

  it("sin ningún filtro -> error", async () => {
    await expect(createAlert(7, {})).rejects.toMatchObject({ code: "DATO_INVALIDO" });
    expect(m.alertCreate).not.toHaveBeenCalled();
  });

  it("la alerta 11 -> error con el tope", async () => {
    m.alertCount.mockResolvedValue(MAX_ALERTS);
    await expect(createAlert(7, { make: "Sony" })).rejects.toMatchObject({
      code: "DATO_INVALIDO",
      message: "Llegaste al máximo de 10 alertas activas.",
    });
    expect(m.alertCount).toHaveBeenCalledWith({ where: { userId: 7, active: true } });
    expect(m.alertCreate).not.toHaveBeenCalled();
  });
});

describe("avisos", () => {
  it("los errores de la librería tienen su código fijo para la URL", async () => {
    const { codigoDeError } = await import("@/lib/avisos");
    const { MENSAJE_FAVORITO_PROPIO } = await import("./favoritos");
    const { EquipoError } = await import("@/lib/inventario/equipos");
    expect(codigoDeError(new EquipoError("DATO_INVALIDO", MENSAJE_FAVORITO_PROPIO))).toBe("FAVORITO_PROPIO");
    await expect(createAlert(7, {})).rejects.toSatisfy((e) => codigoDeError(e) === "ALERTA_SIN_FILTROS");
    m.alertCount.mockResolvedValue(MAX_ALERTS);
    await expect(createAlert(7, { make: "x" })).rejects.toSatisfy(
      (e) => codigoDeError(e) === "MAXIMO_ALERTAS",
    );
  });
});

describe("deleteAlert y listAlerts", () => {
  it("sólo borra una alerta propia", async () => {
    m.alertDeleteMany.mockResolvedValue({ count: 0 });
    await expect(deleteAlert(7, 3)).rejects.toMatchObject({ code: "NO_ENCONTRADO" });
    expect(m.alertDeleteMany).toHaveBeenCalledWith({ where: { id: 3, userId: 7 } });
    m.alertDeleteMany.mockResolvedValue({ count: 1 });
    await expect(deleteAlert(7, 3)).resolves.toBeUndefined();
  });

  it("lista las activas, las más nuevas primero", async () => {
    m.alertFindMany.mockResolvedValue([{ id: 1 }]);
    expect(await listAlerts(7)).toEqual([{ id: 1 }]);
    expect(m.alertFindMany.mock.calls[0][0]).toMatchObject({
      where: { userId: 7, active: true },
      orderBy: { createdAt: "desc" },
    });
  });
});

describe("describeAlert", () => {
  it("arma la frase con todos los filtros", () => {
    expect(
      describeAlert({
        kind: "LENS",
        make: "Sony",
        mount: "Sony E",
        maxPriceArs: 900000,
        province: "Córdoba",
      }),
    ).toBe("Lentes Sony, montura Sony E, hasta $900.000, en Córdoba");
  });

  it("sin tipo dice «Equipos»", () => {
    expect(
      describeAlert({ kind: null, make: null, mount: null, maxPriceArs: null, province: "Salta" }),
    ).toBe("Equipos, en Salta");
    expect(
      describeAlert({ kind: null, make: "Nikon", mount: null, maxPriceArs: null, province: null }),
    ).toBe("Equipos Nikon");
  });
});

describe("runSearchAlerts", () => {
  it("dos corridas seguidas mandan un solo correo", async () => {
    listings = [pub({ id: 10 })];
    expect(await runSearchAlerts(HOY)).toEqual({ emails: 1 });
    expect(await runSearchAlerts(HOY)).toEqual({ emails: 0 });
    expect(m.email).toHaveBeenCalledOnce();
    const [to, template, data] = m.email.mock.calls[0];
    expect(to).toBe("comprador@e.test");
    expect(template).toBe("alerta_busqueda");
    expect(data).toMatchObject({
      nombre: "Juan",
      cantidad: "1",
      item1_titulo: "Sony FE 24-70 GM",
      item1_precio: "$ 800.000",
      item1_zona: "Córdoba, Córdoba",
      item1_url: "https://e.test/equipos/10",
      url: "https://e.test/alertas",
    });
  });

  it("no cuentan la propia, la de un vendedor bloqueado ni la que supera el precio máximo", async () => {
    bloqueados = [60];
    listings = [
      pub({ id: 11, sellerId: 7 }),
      pub({ id: 12, sellerId: 60 }),
      pub({ id: 13, priceArs: 950000 }),
      pub({ id: 14, publishedAt: new Date("2026-11-20T12:00:00Z") }),
    ];
    expect(await runSearchAlerts(HOY)).toEqual({ emails: 0 });
    expect(m.email).not.toHaveBeenCalled();
    expect(m.blockFindMany).toHaveBeenCalledWith({
      where: { liftedAt: null },
      select: { userId: true },
    });
    const where = m.listingFindMany.mock.calls[0][0].where;
    expect(where.sellerId.notIn).toEqual(expect.arrayContaining([7, 60]));
    expect(where.seller).toBeDefined();
  });

  it("si el dueño de la alerta está bloqueado, no se le busca nada", async () => {
    bloqueados = [7];
    listings = [pub({ id: 10 })];
    expect(await runSearchAlerts(HOY)).toEqual({ emails: 0 });
    expect(m.alertFindMany.mock.calls[0][0].where).toMatchObject({
      active: true,
      userId: { notIn: [7] },
    });
  });

  it("un correo por persona aunque coincidan varias alertas, con hasta 10 equipos", async () => {
    alerts.push({
      id: 2,
      userId: 7,
      kind: null,
      make: null,
      mount: null,
      maxPriceArs: null,
      province: "Córdoba",
      createdAt: AYER,
      user: { email: "comprador@e.test", name: "Juan Gómez" },
    });
    listings = Array.from({ length: 12 }, (_, i) => pub({ id: 100 + i }));
    expect(await runSearchAlerts(HOY)).toEqual({ emails: 1 });
    const data = m.email.mock.calls[0][2];
    expect(data.cantidad).toBe("10");
    expect(data.item10_url).toBeDefined();
    expect(data.item11_url).toBeUndefined();
  });

  it("si el correo no sale, no se cuenta", async () => {
    listings = [pub({ id: 10 })];
    m.email.mockResolvedValue({ success: false });
    expect(await runSearchAlerts(HOY)).toEqual({ emails: 0 });
  });

  it("si el correo no sale, borra los avisos de esta corrida y la próxima reintenta", async () => {
    listings = [pub({ id: 10 }), pub({ id: 11 })];
    // Uno ya avisado en otra corrida: ése no se borra ni se repite.
    hits.set(99, "1:11");
    m.email.mockResolvedValueOnce({ success: false });
    expect(await runSearchAlerts(HOY)).toEqual({ emails: 0 });
    expect([...hits.values()]).toEqual(["1:11"]);
    expect(await runSearchAlerts(HOY)).toEqual({ emails: 1 });
    expect(m.email.mock.calls[1][2]).toMatchObject({ cantidad: "1", item1_url: "https://e.test/equipos/10" });
    expect(await runSearchAlerts(HOY)).toEqual({ emails: 0 });
  });

  it("con más de 10 coincidencias van primero las más viejas, así ninguna queda postergada", async () => {
    listings = Array.from({ length: 12 }, (_, i) =>
      pub({ id: 100 + i, publishedAt: new Date(AYER.getTime() + (i + 1) * 60_000) }),
    );
    await runSearchAlerts(HOY);
    expect(m.listingFindMany.mock.calls[0][0].orderBy).toEqual([{ publishedAt: "asc" }, { id: "asc" }]);
    expect(m.email.mock.calls[0][2].item1_url).toBe("https://e.test/equipos/100");
    await runSearchAlerts(HOY);
    const segundo = m.email.mock.calls[1][2];
    expect(segundo.cantidad).toBe("2");
    expect(segundo.item1_url).toBe("https://e.test/equipos/110");
  });

  it("si falla una persona, las demás reciben su correo", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    alerts.push({
      id: 2,
      userId: 9,
      kind: "LENS",
      make: "Sony",
      mount: null,
      maxPriceArs: null,
      province: null,
      createdAt: AYER,
      user: { email: "otra@e.test", name: "Ana" },
    });
    listings = [pub({ id: 10 })];
    m.listingFindMany.mockRejectedValueOnce(new Error("caído"));
    expect(await runSearchAlerts(HOY)).toEqual({ emails: 1 });
    expect(m.email.mock.calls[0][0]).toBe("otra@e.test");
    expect(error).toHaveBeenCalled();
  });
});
