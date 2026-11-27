import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  reqUpdateMany: vi.fn(),
  reqFindMany: vi.fn(),
  blockFindMany: vi.fn(),
  settingsFindMany: vi.fn(),
  listingFindMany: vi.fn(),
  listingFindFirst: vi.fn(),
  itemFindMany: vi.fn(),
  noticeFindMany: vi.fn(),
  noticeGroupBy: vi.fn(),
  noticeCreate: vi.fn(),
  noticeDelete: vi.fn(),
  noticeUpdate: vi.fn(),
  tx: vi.fn(),
  email: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    purchaseRequest: { updateMany: m.reqUpdateMany, findMany: m.reqFindMany },
    portalAccountBlock: { findMany: m.blockFindMany },
    gearOwnerSettings: { findMany: m.settingsFindMany },
    gearListing: { findMany: m.listingFindMany, findFirst: m.listingFindFirst },
    gearItem: { findMany: m.itemFindMany },
    purchaseRequestNotice: {
      findMany: m.noticeFindMany,
      groupBy: m.noticeGroupBy,
      create: m.noticeCreate,
      delete: m.noticeDelete,
      update: m.noticeUpdate,
    },
    $transaction: m.tx,
  },
}));
vi.mock("@/lib/correo", () => ({ sendPortalEmail: m.email }));
vi.mock("@/lib/sesion", () => ({ urlBaseDeLaApp: () => "https://e.test" }));

import { notifyRequestBuyers, runPurchaseRequests } from "./cruce";

const HOY = new Date("2026-11-27T12:00:00Z");
const DIA = 24 * 60 * 60 * 1000;

type Notice = { id: number; requestId: number; ownerId: number; gearItemId: number; sentAt: Date };
type Item = { id: number; ownerId: number; kind: string; make: string; model: string; status: string };

let requests: Array<Record<string, any>>;
let items: Item[];
let listings: Array<{ sellerId: number; kind: string; make: string; model: string; status: string }>;
let notices: Notice[];
let bloqueados: number[];
let optOut: number[];

const pedido = (over: Record<string, unknown> = {}) => ({
  id: 1,
  buyerId: 7,
  kind: "LENS",
  make: "Sony",
  model: "FE 20mm F1.8 G",
  modelKey: "sony:fe20mmf18g",
  maxPriceArs: 900000,
  minCondition: "VERY_GOOD",
  province: "Córdoba",
  status: "ACTIVE",
  expiresAt: new Date(HOY.getTime() + 10 * DIA),
  ...over,
});

const equipo = (over: Partial<Item>): Item => ({
  id: 30,
  ownerId: 8,
  kind: "LENS",
  make: "SONY",
  model: "Sony FE 20mm f/1.8 G",
  status: "IN_USE",
  ...over,
});

function marcaCoincide(make: string, or: Array<{ make: { startsWith: string } }> | undefined): boolean {
  if (!or) return true;
  return or.some((c) => make.toLowerCase().startsWith(c.make.startsWith.toLowerCase()));
}

beforeEach(() => {
  vi.clearAllMocks();
  requests = [pedido()];
  items = [equipo({})];
  listings = [];
  notices = [];
  bloqueados = [];
  optOut = [];

  m.reqUpdateMany.mockImplementation(async ({ where, data }) => {
    let count = 0;
    for (const r of requests) {
      if (r.status === where.status && r.expiresAt <= where.expiresAt.lte) {
        Object.assign(r, data);
        count += 1;
      }
    }
    return { count };
  });
  m.reqFindMany.mockImplementation(async ({ where }) =>
    requests.filter(
      (r) =>
        r.status === where.status &&
        r.expiresAt > where.expiresAt.gt &&
        !where.buyerId?.notIn?.includes(r.buyerId),
    ),
  );
  m.blockFindMany.mockImplementation(async () => bloqueados.map((userId) => ({ userId })));
  m.settingsFindMany.mockImplementation(async () => optOut.map((userId) => ({ userId })));
  m.listingFindMany.mockImplementation(async ({ where }) =>
    listings.filter(
      (l) =>
        l.status === where.status &&
        l.kind === where.kind &&
        !where.sellerId?.notIn?.includes(l.sellerId) &&
        marcaCoincide(l.make, where.OR),
    ),
  );
  m.itemFindMany.mockImplementation(async ({ where }) =>
    items
      .filter(
        (i) =>
          i.kind === where.kind &&
          where.status.in.includes(i.status) &&
          !where.ownerId?.notIn?.includes(i.ownerId) &&
          marcaCoincide(i.make, where.OR),
      )
      .map((i) => ({ ...i, owner: { email: `dueno${i.ownerId}@e.test`, name: "Pedro Pérez" } })),
  );
  m.noticeFindMany.mockImplementation(async ({ where }) =>
    notices.filter((n) => where.requestId.in.includes(n.requestId)),
  );
  m.noticeGroupBy.mockImplementation(async ({ where }) => {
    const porDueno = new Map<number, number>();
    for (const n of notices) {
      if (n.sentAt > where.sentAt.gt) porDueno.set(n.ownerId, (porDueno.get(n.ownerId) ?? 0) + 1);
    }
    return [...porDueno].map(([ownerId, c]) => ({ ownerId, _count: { _all: c } }));
  });
  m.noticeCreate.mockImplementation(async ({ data }) => {
    if (notices.some((n) => n.requestId === data.requestId && n.ownerId === data.ownerId)) {
      throw { code: "P2002" };
    }
    const n = { id: 500 + notices.length, sentAt: HOY, ...data };
    notices.push(n);
    return { id: n.id };
  });
  m.noticeDelete.mockImplementation(async ({ where }) => {
    notices = notices.filter((n) => n.id !== where.id);
    return {};
  });
  m.email.mockResolvedValue({ success: true });
});

describe("runPurchaseRequests", () => {
  it("avisa al dueño con el modelo, el precio y la zona, nunca el nombre del comprador", async () => {
    expect(await runPurchaseRequests(HOY)).toEqual({ notices: 1, expired: 0 });
    expect(notices).toEqual([
      expect.objectContaining({ requestId: 1, ownerId: 8, gearItemId: 30 }),
    ]);
    const [to, template, data] = m.email.mock.calls[0];
    expect(to).toBe("dueno8@e.test");
    expect(template).toBe("pedido_dueno");
    expect(data).toEqual({
      nombre: "Pedro",
      equipo: "SONY Sony FE 20mm f/1.8 G",
      precio: "$ 900.000",
      zona: "Córdoba",
      estado: "Muy bueno",
      url: "https://e.test/busco/avisos/500",
    });
    // Ni el nombre ni el correo del comprador se piden.
    expect(JSON.stringify(m.reqFindMany.mock.calls[0][0].select)).not.toContain("buyer:");
  });

  it("dos corridas seguidas -> los mismos avisos, ninguno repetido", async () => {
    await runPurchaseRequests(HOY);
    expect(await runPurchaseRequests(HOY)).toEqual({ notices: 0, expired: 0 });
    expect(notices).toHaveLength(1);
    expect(m.email).toHaveBeenCalledOnce();
  });

  it("si otra corrida ya creó el aviso (@@unique), no manda otro correo", async () => {
    m.noticeFindMany.mockResolvedValue([]);
    notices.push({ id: 9, requestId: 1, ownerId: 8, gearItemId: 30, sentAt: new Date(0) });
    expect(await runPurchaseRequests(HOY)).toEqual({ notices: 0, expired: 0 });
    expect(m.email).not.toHaveBeenCalled();
  });

  it.each(["STOLEN", "LOST", "SOLD", "FOR_SALE"])("equipo %s -> sin aviso", async (status) => {
    items = [equipo({ status })];
    expect((await runPurchaseRequests(HOY)).notices).toBe(0);
    expect(m.email).not.toHaveBeenCalled();
  });

  it("un equipo recuperado sí cuenta", async () => {
    items = [equipo({ status: "RECOVERED" })];
    expect((await runPurchaseRequests(HOY)).notices).toBe(1);
  });

  it("el equipo del propio comprador -> sin aviso", async () => {
    items = [equipo({ ownerId: 7 })];
    expect((await runPurchaseRequests(HOY)).notices).toBe(0);
  });

  it("dueño bloqueado -> sin aviso", async () => {
    bloqueados = [8];
    expect((await runPurchaseRequests(HOY)).notices).toBe(0);
    expect(m.blockFindMany).toHaveBeenCalledWith({ where: { liftedAt: null }, select: { userId: true } });
  });

  it("comprador bloqueado -> su pedido no corre", async () => {
    bloqueados = [7];
    expect((await runPurchaseRequests(HOY)).notices).toBe(0);
  });

  it("dueño con los avisos apagados -> sin aviso", async () => {
    optOut = [8];
    expect((await runPurchaseRequests(HOY)).notices).toBe(0);
    expect(m.settingsFindMany).toHaveBeenCalledWith({
      where: { purchaseRequestOptOut: true },
      select: { userId: true },
    });
  });

  it("otro modelo de la misma marca -> sin aviso", async () => {
    items = [equipo({ model: "FE 24mm F1.4 GM" })];
    expect((await runPurchaseRequests(HOY)).notices).toBe(0);
  });

  it("dueño con 2 avisos en los últimos 7 días espera; el aviso viejo no cuenta", async () => {
    notices.push(
      { id: 1, requestId: 90, ownerId: 8, gearItemId: 31, sentAt: new Date(HOY.getTime() - DIA) },
      { id: 2, requestId: 91, ownerId: 8, gearItemId: 31, sentAt: new Date(HOY.getTime() - 2 * DIA) },
    );
    expect((await runPurchaseRequests(HOY)).notices).toBe(0);
    notices[0].sentAt = new Date(HOY.getTime() - 8 * DIA);
    expect((await runPurchaseRequests(HOY)).notices).toBe(1);
  });

  it("el tope semanal vale también dentro de la misma corrida", async () => {
    requests = [pedido({ id: 1 }), pedido({ id: 2, buyerId: 9 }), pedido({ id: 3, buyerId: 10 })];
    expect((await runPurchaseRequests(HOY)).notices).toBe(2);
  });

  it("un dueño con dos equipos iguales recibe un solo aviso por pedido", async () => {
    items = [equipo({ id: 30 }), equipo({ id: 31 })];
    expect((await runPurchaseRequests(HOY)).notices).toBe(1);
  });

  it("si ya hay una publicación de ese modelo, no avisa a nadie", async () => {
    listings = [{ sellerId: 50, kind: "LENS", make: "Sony", model: "FE 20mm F1.8 G", status: "PUBLISHED" }];
    expect((await runPurchaseRequests(HOY)).notices).toBe(0);
    expect(m.email).not.toHaveBeenCalled();
    expect(m.listingFindMany.mock.calls[0][0].where.seller).toBeDefined();
  });

  it("la publicación del propio comprador no cuenta como existente", async () => {
    listings = [{ sellerId: 7, kind: "LENS", make: "Sony", model: "FE 20mm F1.8 G", status: "PUBLISHED" }];
    expect((await runPurchaseRequests(HOY)).notices).toBe(1);
  });

  it("vence los pedidos activos pasados de fecha y no los cruza", async () => {
    requests = [pedido({ expiresAt: new Date(HOY.getTime() - 1000) })];
    expect(await runPurchaseRequests(HOY)).toEqual({ notices: 0, expired: 1 });
    expect(requests[0].status).toBe("EXPIRED");
  });

  it("si el correo no sale, borra el aviso para reintentar en la próxima corrida", async () => {
    m.email.mockResolvedValueOnce({ success: false });
    expect((await runPurchaseRequests(HOY)).notices).toBe(0);
    expect(notices).toHaveLength(0);
    expect((await runPurchaseRequests(HOY)).notices).toBe(1);
  });

  it("si un pedido falla, los demás corren", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    requests = [pedido({ id: 1 }), pedido({ id: 2, buyerId: 9 })];
    m.noticeCreate.mockRejectedValueOnce(new Error("caído"));
    expect((await runPurchaseRequests(HOY)).notices).toBe(1);
  });

  it("sin pedidos activos no consulta inventarios", async () => {
    requests = [];
    expect(await runPurchaseRequests(HOY)).toEqual({ notices: 0, expired: 0 });
    expect(m.itemFindMany).not.toHaveBeenCalled();
  });
});

describe("notifyRequestBuyers", () => {
  const tx = {
    purchaseRequest: { updateMany: vi.fn() },
    purchaseRequestNotice: { update: vi.fn() },
  };

  beforeEach(() => {
    m.tx.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));
    tx.purchaseRequest.updateMany.mockResolvedValue({ count: 1 });
    tx.purchaseRequestNotice.update.mockResolvedValue({});
    m.listingFindFirst.mockResolvedValue({
      id: 77,
      gearItemId: 30,
      sellerId: 8,
      make: "Sony",
      model: "FE 20mm F1.8 G",
      priceArs: 850000,
    });
    m.noticeFindMany.mockResolvedValue([
      { id: 500, requestId: 1, request: { buyerId: 7, buyer: { email: "comprador@e.test", name: "Juan Gómez" } } },
    ]);
  });

  it("con un aviso «me interesa» de un pedido activo: guarda la publicación, cumple el pedido y avisa", async () => {
    await notifyRequestBuyers(77);
    expect(m.listingFindFirst.mock.calls[0][0].where).toEqual({ id: 77, status: "PUBLISHED" });
    const where = m.noticeFindMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      gearItemId: 30,
      ownerId: 8,
      response: "INTERESTED",
      listingId: null,
      request: { status: "ACTIVE" },
    });
    expect(tx.purchaseRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 1, status: "ACTIVE" },
      data: { status: "FULFILLED" },
    });
    expect(tx.purchaseRequestNotice.update).toHaveBeenCalledWith({
      where: { id: 500 },
      data: { listingId: 77 },
    });
    expect(m.email).toHaveBeenCalledWith("comprador@e.test", "pedido_publicado", {
      nombre: "Juan",
      equipo: "Sony FE 20mm F1.8 G",
      precio: "$ 850.000",
      url: "https://e.test/equipos/77",
    });
  });

  it("si el pedido ya no está activo, no hace nada más", async () => {
    tx.purchaseRequest.updateMany.mockResolvedValue({ count: 0 });
    await notifyRequestBuyers(77);
    expect(tx.purchaseRequestNotice.update).not.toHaveBeenCalled();
    expect(m.email).not.toHaveBeenCalled();
  });

  it("publicación que no está publicada -> nada", async () => {
    m.listingFindFirst.mockResolvedValue(null);
    await notifyRequestBuyers(77);
    expect(m.noticeFindMany).not.toHaveBeenCalled();
    expect(m.email).not.toHaveBeenCalled();
  });

  it("nunca tira error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.listingFindFirst.mockRejectedValue(new Error("caído"));
    await expect(notifyRequestBuyers(77)).resolves.toBeUndefined();
  });
});
