import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
const H = vi.hoisted(() => ({ notificar: vi.fn(async () => ({ movido: true })) }));

vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/circuitos/eventos", () => ({ notificarEvento: H.notificar }));

const N = await import("./numero");
const { createServiceLead } = await import("@/app/actions/service-lead");

/** 1/10/2026 al mediodía de Buenos Aires. */
const AHORA = new Date("2026-10-01T15:00:00.000Z");
const ENTRADA = { workspaceSlug: "dnx-estudio", name: "Laura Pérez", email: "laura@example.com", eventType: "BODA" };

const numero = (id: string) => B.datos.fotofficeRecordNumber.find((r) => r.entityType === "CONSULTA" && r.entityId === id)?.display ?? null;
const consultas = () => B.datos.serviceSalesLead.filter((l) => l.workspaceId === "ws-1");

let errores: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  B.vaciar();
  // La base en memoria no tiene findUnique: el alta busca el branding por su slug público.
  (B.tablas.fotofficeWorkspaceBranding as unknown as Record<string, unknown>).findUnique = (a: never) => B.tablas.fotofficeWorkspaceBranding.findFirst(a);
  B.agregar("fotofficeWorkspaceBranding", { workspaceId: "ws-1", publicSlug: "dnx-estudio" });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AHORA);
  errores = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  errores.mockRestore();
});

describe("alta de consulta con número", () => {
  it("cada consulta nueva recibe el siguiente número del año", async () => {
    expect(await createServiceLead(ENTRADA)).toEqual({ success: true });
    expect(await createServiceLead({ ...ENTRADA, name: "Martín" })).toEqual({ success: true });
    expect(consultas().map((l) => numero(l.id as string))).toEqual(["2026-0001", "2026-0002"]);
  });

  it("si la numeración falla, la consulta queda creada sin número y sin datos personales en el registro", async () => {
    const original = B.tablas.fotofficeRecordNumber.create;
    B.tablas.fotofficeRecordNumber.create = (async () => {
      throw Object.assign(new Error("Unique constraint Laura Pérez"), { code: "P2002" });
    }) as never;
    try {
      expect(await createServiceLead(ENTRADA)).toEqual({ success: true });
    } finally {
      B.tablas.fotofficeRecordNumber.create = original;
    }
    expect(consultas()).toHaveLength(1);
    expect(numero(consultas()[0]!.id as string)).toBeNull();
    expect(B.datos.fotofficeRecordNumber).toHaveLength(0);
    // La transacción de la numeración se deshizo entera: no consumió el número.
    expect(B.datos.fotofficeSequence.find((s) => s.key === "CONSULTA")?.nextValue ?? 1).toBe(1);
    const registrado = JSON.stringify(errores.mock.calls);
    expect(registrado).not.toContain("Laura");
    expect(registrado).toContain("P2002");
    expect(H.notificar).toHaveBeenCalled();
  });

  it("si la base no contesta al numerar, el alta igual sale bien", async () => {
    const original = B.prisma.$queryRaw;
    B.prisma.$queryRaw = async () => {
      throw Object.assign(new Error("base caída"), { code: "P1001" });
    };
    try {
      expect(await createServiceLead(ENTRADA)).toEqual({ success: true });
    } finally {
      B.prisma.$queryRaw = original;
    }
    expect(consultas()).toHaveLength(1);
    expect(numero(consultas()[0]!.id as string)).toBeNull();
  });
});

describe("numerarConsultaNueva", () => {
  it("con consultas viejas sin número no le gana el número a ninguna: espera al enganche", async () => {
    B.agregar("serviceSalesLead", { id: "vieja", workspaceId: "ws-1", name: "x", eventType: "XV", createdAt: new Date("2026-02-01T12:00:00Z") });
    B.agregar("serviceSalesLead", { id: "nueva", workspaceId: "ws-1", name: "x", eventType: "XV", createdAt: AHORA });
    expect(await N.numerarConsultaNueva("ws-1", "nueva", AHORA)).toBeNull();
    expect(B.datos.fotofficeRecordNumber).toHaveLength(0);
    // Las de otro workspace no cuentan.
    B.datos.serviceSalesLead = B.datos.serviceSalesLead.filter((l) => l.id !== "vieja");
    B.agregar("serviceSalesLead", { id: "ajena", workspaceId: "ws-2", name: "x", eventType: "XV" });
    expect(await N.numerarConsultaNueva("ws-1", "nueva", AHORA)).toMatchObject({ display: "2026-0001" });
  });

  it("dos altas simultáneas (cada una ve a la otra sin número): ninguna se numera al crearse y el enganche las numera por alta", async () => {
    // Las dos filas ya confirmaron antes de que cualquiera de las dos llegue a numerar. "b" se
    // insertó primero pero se dio de alta después: manda la fecha de alta, no el orden de inserción.
    const t1 = new Date("2026-10-01T15:00:00.000Z");
    const t2 = new Date("2026-10-01T15:00:00.500Z");
    B.agregar("serviceSalesLead", { id: "b", workspaceId: "ws-1", name: "x", eventType: "XV", createdAt: t2 });
    B.agregar("serviceSalesLead", { id: "a", workspaceId: "ws-1", name: "x", eventType: "XV", createdAt: t1 });
    expect(await Promise.all([N.numerarConsultaNueva("ws-1", "b", t2), N.numerarConsultaNueva("ws-1", "a", t1)])).toEqual([null, null]);
    expect(B.datos.fotofficeRecordNumber).toHaveLength(0);
    // La parte de numeración del enganche (la que corre `engancharConsultas`).
    expect(await N.numerarConsultasPendientes("ws-1", 150)).toEqual({ numeradas: 2, completo: true });
    expect([numero("a"), numero("b")]).toEqual(["2026-0001", "2026-0002"]);
  });

  it("dos altas simultáneas con una vieja sin número: tampoco se numeran al crearse; el enganche numera las tres por alta", async () => {
    B.agregar("serviceSalesLead", { id: "vieja", workspaceId: "ws-1", name: "x", eventType: "XV", createdAt: new Date("2025-12-20T12:00:00Z") });
    B.agregar("serviceSalesLead", { id: "n2", workspaceId: "ws-1", name: "x", eventType: "XV", createdAt: new Date("2026-10-01T15:00:01Z") });
    B.agregar("serviceSalesLead", { id: "n1", workspaceId: "ws-1", name: "x", eventType: "XV", createdAt: AHORA });
    expect(await Promise.all([N.numerarConsultaNueva("ws-1", "n1", AHORA), N.numerarConsultaNueva("ws-1", "n2", AHORA)])).toEqual([null, null]);
    expect(B.datos.fotofficeRecordNumber).toHaveLength(0);
    await N.numerarConsultasPendientes("ws-1", 150);
    expect([numero("vieja"), numero("n1"), numero("n2")]).toEqual(["2025-0001", "2026-0001", "2026-0002"]);
    // Una segunda corrida no cambia nada.
    expect(await N.numerarConsultasPendientes("ws-1", 150)).toEqual({ numeradas: 0, completo: true });
    expect(B.datos.fotofficeRecordNumber).toHaveLength(3);
  });

  it("es idempotente: numerar dos veces la misma consulta devuelve el mismo número", async () => {
    B.agregar("serviceSalesLead", { id: "c-1", workspaceId: "ws-1", name: "x", eventType: "XV", createdAt: AHORA });
    const primero = await N.numerarConsulta("ws-1", "c-1", AHORA);
    expect(await N.numerarConsulta("ws-1", "c-1", AHORA)).toEqual(primero);
    expect(B.datos.fotofficeRecordNumber).toHaveLength(1);
  });
});

describe("tituloDeConsulta", () => {
  it("con número: «Consulta N° … · Nombre»; sin número, sólo el nombre", () => {
    expect(N.tituloDeConsulta("Laura Pérez", "2026-0042")).toBe("Consulta N° 2026-0042 · Laura Pérez");
    expect(N.tituloDeConsulta("Laura Pérez", null)).toBe("Laura Pérez");
  });
});
