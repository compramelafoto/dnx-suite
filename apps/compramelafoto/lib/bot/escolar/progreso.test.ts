import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  albumFindFirst: vi.fn(),
  schoolFindFirst: vi.fn(),
  courseCount: vi.fn(),
  enrollmentFindFirst: vi.fn(),
  invitationFindFirst: vi.fn(),
  organizerFindFirst: vi.fn(),
  rosterCount: vi.fn(),
  packFindMany: vi.fn(),
  photoCount: vi.fn(),
  orderFindFirst: vi.fn(),
  itemGroupBy: vi.fn(),
  catalog: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  Prisma: { AnyNull: "AnyNull" },
  prisma: {
    album: { findFirst: (...a: unknown[]) => m.albumFindFirst(...a) },
    school: { findFirst: (...a: unknown[]) => m.schoolFindFirst(...a) },
    schoolCourse: { count: (...a: unknown[]) => m.courseCount(...a) },
    studentEnrollment: { findFirst: (...a: unknown[]) => m.enrollmentFindFirst(...a) },
    schoolOrganizerInvitation: { findFirst: (...a: unknown[]) => m.invitationFindFirst(...a) },
    schoolOrganizer: { findFirst: (...a: unknown[]) => m.organizerFindFirst(...a) },
    albumStudentRosterEntry: { count: (...a: unknown[]) => m.rosterCount(...a) },
    packDefinition: { findMany: (...a: unknown[]) => m.packFindMany(...a) },
    photo: { count: (...a: unknown[]) => m.photoCount(...a) },
    order: { findFirst: (...a: unknown[]) => m.orderFindFirst(...a) },
    preCompraOrderItem: { groupBy: (...a: unknown[]) => m.itemGroupBy(...a) },
  },
}));
vi.mock("@/lib/preventa-canjeable/pack-service", () => ({
  listActivePacksForPublicCatalog: (...a: unknown[]) => m.catalog(...a),
}));

import { armarPasos, computeSchoolSetupProgress, type DatosEscolares } from "./progreso";

const NOW = new Date("2026-10-12T15:00:00.000Z");

const albumBase = {
  id: 40,
  title: "Egresados 2026",
  mode: "SCHOOL" as const,
  schoolId: 9,
  studentIdentificationMode: "MANUAL" as const,
  organizerCommissionEnabled: true,
  organizerCommissionPercentage: 10,
};

function datosCompletos(): DatosEscolares {
  return {
    escuela: { id: 9, name: "Colegio Sur" },
    tieneCursos: true,
    admin: "activo",
    album: { ...albumBase },
    rosterActivos: 0,
    packsConBeneficios: 2,
    plantillasRequeridas: 1,
    plantillasRequeridasCargadas: 1,
    packsPublicados: 2,
    fotos: 120,
    avisoEnviado: true,
    itemsPreventa: 5,
    itemsSinEntregar: 0,
  };
}

function datosVacios(): DatosEscolares {
  return {
    escuela: null,
    tieneCursos: false,
    admin: null,
    album: null,
    rosterActivos: 0,
    packsConBeneficios: 0,
    plantillasRequeridas: 0,
    plantillasRequeridasCargadas: 0,
    packsPublicados: 0,
    fotos: 0,
    avisoEnviado: false,
    itemsPreventa: 0,
    itemsSinEntregar: 0,
  };
}

const paso = (p: ReturnType<typeof armarPasos>, id: string) => p.pasos.find((x) => x.id === id)!;

describe("armarPasos (lógica pura)", () => {
  it("sin escuela ni álbum: paso 1 pendiente y es el siguiente; álbum null; pasos 4–11 pendientes", () => {
    const p = armarPasos(datosVacios());
    expect(p.albumId).toBeNull();
    expect(p.schoolId).toBeNull();
    expect(p.total).toBe(11);
    expect(p.pasos).toHaveLength(11);
    expect(p.pasos.map((x) => x.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(paso(p, "escuela")).toMatchObject({ estado: "pendiente", enlace: "/fotografo/escuelas/nueva" });
    expect(p.siguiente?.id).toBe("escuela");
    for (const x of p.pasos.slice(3)) expect(x.estado).toBe("pendiente");
    expect(paso(p, "album_vinculado").enlace).toBe("/dashboard/albums/new");
    expect(p.hechos).toBe(0);
    expect(p.aMedias).toBe(false);
  });

  it("álbum SCHOOL sin escuela vinculada: aMedias y paso 4 pendiente", () => {
    const d = datosCompletos();
    d.album = { ...albumBase, schoolId: null };
    const p = armarPasos(d);
    expect(p.aMedias).toBe(true);
    expect(paso(p, "album_vinculado").estado).toBe("pendiente");
    expect(paso(p, "album_vinculado").enlace).toBe("/dashboard/albums/40?tab=configuracion");
    expect(p.siguiente?.id).toBe("album_vinculado");
  });

  it("álbum con escuela pero mode no SCHOOL: paso 4 pendiente, no aMedias", () => {
    const d = datosCompletos();
    d.album = { ...albumBase, mode: "SIMPLE" };
    const p = armarPasos(d);
    expect(p.aMedias).toBe(false);
    expect(paso(p, "album_vinculado").estado).toBe("pendiente");
  });

  it("álbum vinculado a otra escuela que la del fotógrafo: paso 4 pendiente", () => {
    const d = datosCompletos();
    d.escuela = { id: 10, name: "Otra" };
    expect(paso(armarPasos(d), "album_vinculado").estado).toBe("pendiente");
    d.escuela = null;
    expect(paso(armarPasos(d), "album_vinculado").estado).toBe("pendiente");
  });

  it("álbum nuevo vinculado: plantillas y entrega no inflan hechos", () => {
    const d = datosVacios();
    d.escuela = { id: 9, name: "Colegio Sur" };
    d.album = { ...albumBase, studentIdentificationMode: null, organizerCommissionEnabled: false };
    const p = armarPasos(d);
    expect(paso(p, "plantillas")).toMatchObject({ estado: "pendiente", detalle: "primero armá la preventa" });
    expect(paso(p, "entrega")).toMatchObject({ estado: "pendiente", detalle: "todavía sin pedidos" });
    expect(p.pasos.filter((x) => x.estado === "hecho").map((x) => x.id)).toEqual(["escuela", "album_vinculado"]);
    expect(p.hechos).toBe(2);
  });

  it("entrega sin pedidos con fotos subidas pero sin aviso → pendiente «todavía sin pedidos»", () => {
    const d = datosCompletos();
    d.itemsPreventa = 0;
    d.avisoEnviado = false;
    expect(paso(armarPasos(d), "entrega")).toMatchObject({ estado: "pendiente", detalle: "todavía sin pedidos" });
  });

  it("roster requerido sin entradas → paso 5 pendiente; con entradas → hecho", () => {
    const d = datosCompletos();
    d.album = { ...albumBase, studentIdentificationMode: "ROSTER_REQUIRED" };
    d.rosterActivos = 0;
    expect(paso(armarPasos(d), "identificacion").estado).toBe("pendiente");
    d.rosterActivos = 3;
    expect(paso(armarPasos(d), "identificacion").estado).toBe("hecho");
  });

  it("identificación MANUAL → hecho; sin definir → pendiente", () => {
    const d = datosCompletos();
    expect(paso(armarPasos(d), "identificacion")).toMatchObject({ estado: "hecho", enlace: "/dashboard/albums/40?tab=escuela" });
    d.album = { ...albumBase, studentIdentificationMode: null };
    expect(paso(armarPasos(d), "identificacion").estado).toBe("pendiente");
  });

  it("sin beneficios físicos con plantilla obligatoria → paso 7 no_aplica (y cuenta como hecho)", () => {
    const d = datosCompletos();
    d.plantillasRequeridas = 0;
    d.plantillasRequeridasCargadas = 0;
    const p = armarPasos(d);
    expect(paso(p, "plantillas").estado).toBe("no_aplica");
    expect(p.hechos).toBe(11);
  });

  it("plantilla obligatoria sin cargar → paso 7 pendiente", () => {
    const d = datosCompletos();
    d.plantillasRequeridas = 2;
    d.plantillasRequeridasCargadas = 1;
    expect(paso(armarPasos(d), "plantillas")).toMatchObject({ estado: "pendiente", enlace: "/dashboard/albums/40?tab=preventa" });
  });

  it("comisión y admin pendientes no son el siguiente si quedan obligatorios", () => {
    const d = datosCompletos();
    d.admin = null;
    d.album = { ...albumBase, organizerCommissionEnabled: false };
    d.packsConBeneficios = 0;
    const p = armarPasos(d);
    expect(paso(p, "admin_escuela")).toMatchObject({ estado: "pendiente", opcional: true });
    expect(paso(p, "comision")).toMatchObject({ estado: "pendiente", opcional: true });
    expect(p.siguiente?.id).toBe("preventa");
  });

  it("si sólo quedan opcionales, el siguiente es el primer opcional pendiente", () => {
    const d = datosCompletos();
    d.admin = null;
    d.album = { ...albumBase, organizerCommissionPercentage: 0 };
    const p = armarPasos(d);
    expect(p.siguiente?.id).toBe("admin_escuela");
    expect(p.hechos).toBe(9);
  });

  it("admin: invitación enviada / activo en el detalle", () => {
    const d = datosCompletos();
    d.admin = "invitacion";
    expect(paso(armarPasos(d), "admin_escuela")).toMatchObject({ estado: "hecho", detalle: "invitación enviada" });
    d.admin = "activo";
    expect(paso(armarPasos(d), "admin_escuela").detalle).toBe("activo");
  });

  it("fotos sin aviso → paso 10 pendiente con detalle", () => {
    const d = datosCompletos();
    d.avisoEnviado = false;
    expect(paso(armarPasos(d), "fotos_y_aviso")).toMatchObject({
      estado: "pendiente",
      detalle: "120 fotos · aviso no enviado",
      enlace: "/dashboard/albums/40?tab=fotos",
    });
  });

  it("entrega: con ítems sin entregar → pendiente «N por entregar»; sin ítems → no_aplica", () => {
    const d = datosCompletos();
    d.itemsSinEntregar = 3;
    expect(paso(armarPasos(d), "entrega")).toMatchObject({ estado: "pendiente", detalle: "3 por entregar", enlace: "/fotografo/escuelas/pedidos" });
    d.itemsPreventa = 0;
    d.itemsSinEntregar = 0;
    expect(paso(armarPasos(d), "entrega").estado).toBe("no_aplica");
  });

  it("todo completo → siguiente null y 11 hechos, con enlaces correctos", () => {
    const p = armarPasos(datosCompletos());
    expect(p.siguiente).toBeNull();
    expect(p.hechos).toBe(11);
    expect(p.albumId).toBe(40);
    expect(p.albumTitulo).toBe("Egresados 2026");
    expect(p.schoolId).toBe(9);
    expect(paso(p, "escuela").enlace).toBe("/fotografo/escuelas/9");
    expect(paso(p, "cursos").enlace).toBe("/fotografo/escuelas/9");
    expect(paso(p, "comision").enlace).toBe("/dashboard/albums/40?tab=comision-escolar");
    expect(paso(p, "preventa_publicada").enlace).toBe("/dashboard/albums/40?tab=publicacion&pub=compartir");
  });
});

describe("computeSchoolSetupProgress (consultas)", () => {
  beforeEach(() => {
    Object.values(m).forEach((f) => f.mockReset());
    m.courseCount.mockResolvedValue(0);
    m.enrollmentFindFirst.mockResolvedValue(null);
    m.invitationFindFirst.mockResolvedValue(null);
    m.organizerFindFirst.mockResolvedValue(null);
    m.rosterCount.mockResolvedValue(0);
    m.packFindMany.mockResolvedValue([]);
    m.photoCount.mockResolvedValue(0);
    m.orderFindFirst.mockResolvedValue(null);
    m.itemGroupBy.mockResolvedValue([]);
    m.catalog.mockResolvedValue([]);
  });

  it("sin escuela ni álbum: no consulta datos del álbum", async () => {
    m.albumFindFirst.mockResolvedValue(null);
    m.schoolFindFirst.mockResolvedValue(null);
    const p = await computeSchoolSetupProgress(7, undefined, NOW);
    expect(p.albumId).toBeNull();
    expect(p.siguiente?.id).toBe("escuela");
    expect(m.albumFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 7, deletedAt: null, OR: [{ schoolId: { not: null } }, { mode: "SCHOOL" }] },
        orderBy: { createdAt: "desc" },
      })
    );
    expect(m.schoolFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: 7 }, orderBy: { createdAt: "desc" } }));
    expect(m.packFindMany).not.toHaveBeenCalled();
    expect(m.catalog).not.toHaveBeenCalled();
  });

  it("álbum ajeno pasado por albumId: se ignora y se busca el escolar más reciente del usuario", async () => {
    m.albumFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    m.schoolFindFirst.mockResolvedValue(null);
    const p = await computeSchoolSetupProgress(7, 999, NOW);
    expect(m.albumFindFirst.mock.calls[0][0].where).toEqual({ id: 999, userId: 7, deletedAt: null });
    expect(m.albumFindFirst.mock.calls[1][0].where).toMatchObject({ userId: 7, deletedAt: null });
    expect(p.albumId).toBeNull();
  });

  it("escuela del álbum de otro dueño: no se usa (filtra ownerId)", async () => {
    m.albumFindFirst.mockResolvedValue({ ...albumBase });
    m.schoolFindFirst.mockResolvedValue(null);
    const p = await computeSchoolSetupProgress(7, 40, NOW);
    expect(m.schoolFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 9, ownerId: 7 } }));
    expect(p.schoolId).toBeNull();
    expect(paso(p, "escuela").estado).toBe("pendiente");
    expect(paso(p, "album_vinculado").estado).toBe("pendiente");
    expect(m.courseCount).not.toHaveBeenCalled();
  });

  it("todo completo con datos reales simulados → 11 hechos", async () => {
    m.albumFindFirst.mockResolvedValue({ ...albumBase, studentIdentificationMode: "ROSTER_OPTIONAL" });
    m.schoolFindFirst.mockResolvedValue({ id: 9, name: "Colegio Sur" });
    m.courseCount.mockResolvedValue(0);
    m.enrollmentFindFirst.mockResolvedValue({ id: 1 });
    m.invitationFindFirst.mockResolvedValue({ id: "inv" });
    m.rosterCount.mockResolvedValue(30);
    m.packFindMany.mockResolvedValue([
      { id: 1, benefits: [{ kind: "PHYSICAL", templatePolicy: "REQUIRED", templateV2Id: "t2", templateId: null }] },
      { id: 2, benefits: [{ kind: "DIGITAL", templatePolicy: "NONE", templateV2Id: null, templateId: null }] },
      { id: 3, benefits: [] },
    ]);
    m.catalog.mockResolvedValue([{ id: 1 }]);
    m.photoCount.mockResolvedValue(50);
    m.orderFindFirst.mockResolvedValue({ id: 77 });
    m.itemGroupBy.mockResolvedValue([{ status: "DELIVERED", _count: { _all: 4 } }]);

    const p = await computeSchoolSetupProgress(7, 40, NOW);
    expect(p.hechos).toBe(11);
    expect(p.siguiente).toBeNull();
    expect(paso(p, "admin_escuela").detalle).toBe("invitación enviada");

    expect(m.invitationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { schoolId: 9, status: "PENDING", expiresAt: { gt: NOW } } })
    );
    expect(m.organizerFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { schoolId: 9, status: "ACTIVE" } }));
    expect(m.rosterCount).toHaveBeenCalledWith({ where: { albumId: 40, isActive: true } });
    expect(m.packFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { albumId: 40, isActive: true } }));
    expect(m.catalog).toHaveBeenCalledWith(40, NOW, { hasPhotos: true });
    expect(m.photoCount).toHaveBeenCalledWith({ where: { albumId: 40, isRemoved: false } });
    expect(m.orderFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          albumId: 40,
          origin: "PREVENTA_PACK",
          status: "PAID",
          isTest: false,
          redemptionPaymentRefsJson: { path: ["fotosListasAvisoAt"], not: "AnyNull" },
        },
      })
    );
    expect(m.itemGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({ by: ["status"], where: { order: { albumId: 40, isTest: false, status: { not: "CANCELED" } } } })
    );
  });

  it("entrega: cuenta los no entregados desde el groupBy", async () => {
    m.albumFindFirst.mockResolvedValue({ ...albumBase });
    m.schoolFindFirst.mockResolvedValue({ id: 9, name: "Colegio Sur" });
    m.itemGroupBy.mockResolvedValue([
      { status: "DELIVERED", _count: { _all: 2 } },
      { status: "AT_SCHOOL", _count: { _all: 3 } },
      { status: "WAITING_SELFIE", _count: { _all: 1 } },
    ]);
    const p = await computeSchoolSetupProgress(7, 40, NOW);
    expect(paso(p, "entrega")).toMatchObject({ estado: "pendiente", detalle: "4 por entregar" });
  });

  it("modo MANUAL no consulta el roster", async () => {
    m.albumFindFirst.mockResolvedValue({ ...albumBase });
    m.schoolFindFirst.mockResolvedValue({ id: 9, name: "Colegio Sur" });
    await computeSchoolSetupProgress(7, 40, NOW);
    expect(m.rosterCount).not.toHaveBeenCalled();
  });
});
