import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  contactFindFirst: vi.fn(),
  saleFindFirst: vi.fn(),
  reportFindUnique: vi.fn(),
  reportCreate: vi.fn(),
  reportUpdate: vi.fn(),
  reportUpdateMany: vi.fn(),
  reportFindMany: vi.fn(),
  avisar: vi.fn(),
  listingFindFirst: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    gearListingContact: { findFirst: m.contactFindFirst },
    gearSale: { findFirst: m.saleFindFirst },
    gearListing: { findFirst: m.listingFindFirst },
    portalUserReport: {
      findUnique: m.reportFindUnique,
      create: m.reportCreate,
      update: m.reportUpdate,
      updateMany: m.reportUpdateMany,
      findMany: m.reportFindMany,
    },
  },
}));
vi.mock("@/lib/aviso-admin", () => ({ avisarAlAdmin: m.avisar }));
vi.mock("@/lib/sesion", () => ({ urlBaseDeLaApp: () => "https://e.test" }));

import { reportTarget, reportUser, resolveUserReport } from "./reportes";

const MOTIVO = "Me pidió que pague por fuera y no apareció.";

beforeEach(() => {
  vi.clearAllMocks();
  m.contactFindFirst.mockResolvedValue({ id: 1 });
  m.saleFindFirst.mockResolvedValue(null);
  m.reportFindUnique.mockResolvedValue(null);
  m.reportCreate.mockResolvedValue({ id: 30 });
  m.reportUpdate.mockResolvedValue({ id: 30 });
  m.reportUpdateMany.mockResolvedValue({ count: 1 });
  m.avisar.mockResolvedValue(true);
});

describe("reportUser", () => {
  it("con una consulta previa entre los dos: guarda y avisa al admin", async () => {
    expect(await reportUser(2, 7, `  ${MOTIVO} `, "Publicación #12")).toEqual({ created: true });
    expect(m.reportCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { reporterId: 2, reportedId: 7, reason: MOTIVO, context: "Publicación #12" },
      }),
    );
    // La consulta puede ser en cualquier sentido: comprador -> vendedor o al revés.
    expect(m.contactFindFirst.mock.calls[0][0].where).toEqual({
      OR: [
        { buyerId: 2, listing: { sellerId: 7 } },
        { buyerId: 7, listing: { sellerId: 2 } },
      ],
    });
    expect(m.avisar).toHaveBeenCalledTimes(1);
    const [, template, data] = m.avisar.mock.calls[0];
    expect(template).toBe("reporte_usuario_admin");
    expect(data.url).toBe("https://e.test/admin/usuarios");
    expect(JSON.stringify(data)).not.toContain("pague por fuera");
  });

  it("sin consulta pero con una venta entre los dos -> se puede", async () => {
    m.contactFindFirst.mockResolvedValue(null);
    m.saleFindFirst.mockResolvedValue({ id: 5 });
    expect(await reportUser(2, 7, MOTIVO)).toEqual({ created: true });
    expect(m.saleFindFirst.mock.calls[0][0].where).toEqual({
      OR: [
        { buyerId: 2, sellerId: 7 },
        { buyerId: 7, sellerId: 2 },
      ],
    });
  });

  it("sin contacto ni venta previa -> error y no guarda", async () => {
    m.contactFindFirst.mockResolvedValue(null);
    await expect(reportUser(2, 7, MOTIVO)).rejects.toThrow(
      "Sólo podés reportar a alguien con quien tuviste una consulta o una venta.",
    );
    expect(m.reportCreate).not.toHaveBeenCalled();
    expect(m.avisar).not.toHaveBeenCalled();
  });

  it("no se puede reportar a uno mismo", async () => {
    await expect(reportUser(2, 2, MOTIVO)).rejects.toThrow("No podés reportarte a vos mismo.");
  });

  it("motivo fuera de 10–500 -> error", async () => {
    await expect(reportUser(2, 7, "malo")).rejects.toThrow(
      "El motivo tiene que tener entre 10 y 500 caracteres.",
    );
    await expect(reportUser(2, 7, "x".repeat(501))).rejects.toThrow(/entre 10 y 500/);
    expect(m.reportCreate).not.toHaveBeenCalled();
  });

  it("repetido con uno sin resolver: no duplica ni reavisa", async () => {
    m.reportFindUnique.mockResolvedValue({ id: 30, resolvedAt: null });
    expect(await reportUser(2, 7, MOTIVO)).toEqual({ created: false });
    expect(m.reportCreate).not.toHaveBeenCalled();
    expect(m.reportUpdate).not.toHaveBeenCalled();
    expect(m.avisar).not.toHaveBeenCalled();
  });

  it("dos envíos a la vez: el segundo choca con el único y no reavisa", async () => {
    m.reportCreate.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    expect(await reportUser(2, 7, MOTIVO)).toEqual({ created: false });
    expect(m.avisar).not.toHaveBeenCalled();
  });

  it("si el anterior ya se resolvió, lo reabre con el motivo nuevo y avisa", async () => {
    m.reportFindUnique.mockResolvedValue({ id: 30, resolvedAt: new Date("2026-11-01") });
    expect(await reportUser(2, 7, MOTIVO, "Venta #5")).toEqual({ created: true });
    const args = m.reportUpdate.mock.calls[0][0];
    expect(args.where).toEqual({ id: 30 });
    expect(args.data).toMatchObject({
      reason: MOTIVO,
      context: "Venta #5",
      resolvedAt: null,
      resolution: null,
    });
    expect(m.avisar).toHaveBeenCalledTimes(1);
  });
});

describe("resolveUserReport", () => {
  it("marca resuelto con la resolución", async () => {
    await resolveUserReport(1, 30, "  Hablamos con las dos partes. ");
    const args = m.reportUpdateMany.mock.calls[0][0];
    expect(args.where).toEqual({ id: 30, resolvedAt: null });
    expect(args.data.resolution).toBe("Hablamos con las dos partes.");
    expect(args.data.resolvedAt).toBeInstanceOf(Date);
  });

  it("sin resolución -> error", async () => {
    await expect(resolveUserReport(1, 30, "  ")).rejects.toThrow("Indicá cómo se resolvió el reporte.");
    expect(m.reportUpdateMany).not.toHaveBeenCalled();
  });

  it("ya resuelto -> error; inexistente -> NO_ENCONTRADO", async () => {
    m.reportUpdateMany.mockResolvedValue({ count: 0 });
    m.reportFindUnique.mockResolvedValue({ id: 30 });
    await expect(resolveUserReport(1, 30, "Listo")).rejects.toThrow("Este reporte ya está resuelto.");
    m.reportFindUnique.mockResolvedValue(null);
    await expect(resolveUserReport(1, 30, "Listo")).rejects.toMatchObject({ code: "NO_ENCONTRADO" });
  });
});

describe("reportTarget", () => {
  it("venta: la otra parte, con la pantalla de quien reporta", async () => {
    m.saleFindFirst.mockResolvedValue({ buyerId: 2, sellerId: 7 });
    expect(await reportTarget(2, "venta", 5)).toEqual({
      reportedId: 7,
      context: "Venta #5",
      volver: "/compras/5",
    });
    expect(m.saleFindFirst.mock.calls[0][0].where).toEqual({
      id: 5,
      OR: [{ buyerId: 2 }, { sellerId: 2 }],
    });
    expect(await reportTarget(7, "venta", 5)).toEqual({
      reportedId: 2,
      context: "Venta #5",
      volver: "/ventas/5",
    });
  });

  it("venta ajena -> null", async () => {
    m.saleFindFirst.mockResolvedValue(null);
    expect(await reportTarget(9, "venta", 5)).toBeNull();
  });

  it("interesado: sólo el vendedor de esa publicación", async () => {
    m.listingFindFirst.mockResolvedValue({ id: 12 });
    expect(await reportTarget(7, "interesado", 12, 2)).toEqual({
      reportedId: 2,
      context: "Publicación #12",
      volver: "/mis-publicaciones/12",
    });
    expect(m.listingFindFirst.mock.calls[0][0].where).toEqual({ id: 12, sellerId: 7 });
    m.listingFindFirst.mockResolvedValue(null);
    expect(await reportTarget(9, "interesado", 12, 2)).toBeNull();
    expect(await reportTarget(7, "interesado", 12)).toBeNull();
  });

  it("publicación: el vendedor, nunca uno mismo", async () => {
    m.listingFindFirst.mockResolvedValue({ sellerId: 7 });
    expect(await reportTarget(2, "publicacion", 12)).toEqual({
      reportedId: 7,
      context: "Publicación #12",
      volver: "/equipos/12",
    });
    expect(await reportTarget(7, "publicacion", 12)).toBeNull();
  });

  it("origen desconocido -> null", async () => {
    expect(await reportTarget(2, "otro", 12)).toBeNull();
  });
});
