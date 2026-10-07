import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/service-leads/numero", () => ({
  tituloDeConsulta: (nombre: string, numero: string | null | undefined) => (numero ? `Consulta N° ${numero} · ${nombre}` : nombre),
}));
const nivel = vi.fn(async (..._a: unknown[]) => true);
vi.mock("@/lib/permissions/module-access", () => ({ hasModuleLevel: nivel }));

const F = await import("./ficha");

beforeEach(() => {
  B.vaciar();
  nivel.mockReset();
  nivel.mockResolvedValue(true);
  const cli = (id: string, ws: string, n: number, extra: Record<string, unknown>) =>
    B.agregar("client", { id, workspaceId: ws, clientNumber: n, kind: "PERSONA", firstName: null, lastName: null, businessName: null, email: null, phone: null, ...extra });
  cli("c1", "ws-1", 1, { firstName: "Laura", lastName: "Pérez", email: "laura@persona.test", phone: "3415550000" });
  cli("c2", "ws-1", 2, { firstName: "Laura", lastName: "Gómez", email: "LAURA@persona.test" });
  cli("c3", "ws-1", 3, { kind: "EMPRESA", businessName: "Salón Real" });
  cli("c9", "ws-2", 1, { firstName: "Laura", lastName: "Ajena", email: "laura@persona.test" });
});

describe("buscador de contactos", () => {
  it("busca por nombre, correo o teléfono, sólo en el workspace", async () => {
    expect((await F.buscarContactos("ws-1", "laura")).map((c) => c.id).sort()).toEqual(["c1", "c2"]);
    expect((await F.buscarContactos("ws-1", "laura pérez")).map((c) => c.id)).toEqual(["c1"]);
    expect((await F.buscarContactos("ws-1", "341 555")).map((c) => c.id)).toEqual(["c1"]);
    expect((await F.buscarContactos("ws-1", "salón")).map((c) => c.nombre)).toEqual(["Salón Real"]);
    expect((await F.buscarContactos("ws-2", "laura")).map((c) => c.id)).toEqual(["c9"]);
  });

  it("menos de 2 caracteres no busca y nunca devuelve más de 20", async () => {
    expect(await F.buscarContactos("ws-1", "l")).toEqual([]);
    expect(await F.buscarContactos("ws-1", 42)).toEqual([]);
    for (let i = 0; i < 30; i++) B.agregar("client", { workspaceId: "ws-1", clientNumber: 10 + i, kind: "PERSONA", firstName: "Lau", lastName: `N${i}` });
    expect(await F.buscarContactos("ws-1", "lau")).toHaveLength(F.MAX_RESULTADOS_CONTACTO);
  });

  it("un contacto de otro workspace no se encuentra por id", async () => {
    expect(await F.contactoDelWorkspace("ws-1", "c9")).toBeNull();
    expect((await F.contactoDelWorkspace("ws-1", "c1"))?.nombre).toBe("Pérez, Laura");
  });
});

describe("posible duplicado", () => {
  it("otros contactos del workspace con el mismo correo o teléfono", async () => {
    expect(await F.posiblesDuplicadosDe("ws-1", { id: "c1", email: "laura@persona.test", telefono: "341 555-0000" })).toEqual([{ id: "c2", nombre: "Gómez, Laura" }]);
    expect(await F.posiblesDuplicadosDe("ws-1", { id: "c3", email: null, telefono: null })).toEqual([]);
  });
});

describe("responsables de Consultas", () => {
  it("sólo los del equipo con «Gestionar»", async () => {
    B.agregar("workspaceMembership", { workspaceId: "ws-1", userId: 7 });
    B.agregar("workspaceMembership", { workspaceId: "ws-1", userId: 8 });
    B.agregar("workspaceMembership", { workspaceId: "ws-2", userId: 9 });
    B.agregar("user", { id: 7, name: "Ana", email: null });
    B.agregar("user", { id: 8, name: "Beto", email: null });
    const r = await F.responsablesDeConsultas("ws-1", { tieneGestionar: async (u) => u === 7 });
    expect(r.map((x) => x.id)).toEqual([7]);
  });
});

describe("datos de la ficha", () => {
  it("de otro workspace no se leen", async () => {
    B.agregar("fotofficeConsultaCategoria", { id: "cat", workspaceId: "ws-1", name: "Boda", group: "BODA" });
    B.agregar("serviceSalesLead", { id: "lead", workspaceId: "ws-1", name: "Laura" });
    B.agregar("fotofficeConsulta", { workspaceId: "ws-1", leadId: "lead", clientId: "c1", categoryId: "cat", estimatedValue: 1500 });
    expect(await F.cargarDatosConsulta("ws-2", "lead")).toBeNull();
    const d = await F.cargarDatosConsulta("ws-1", "lead");
    expect(d).toMatchObject({
      contacto: { id: "c1" }, categoria: { id: "cat", grupo: "BODA", archivada: false }, valorEstimado: 1500,
      posiblesDuplicados: [{ id: "c2" }], superpuestas: [], participantes: [],
    });
  });
});

describe("sin «Ver» en Clientes (R10)", () => {
  it("la ficha pierde los datos de otros contactos pero conserva los ids", () => {
    const datos = {
      consultaId: "k1",
      contacto: { id: "c1", nombre: "Laura Pérez", email: "laura@persona.test", telefono: "3415550000" },
      referente: { id: "c2", nombre: "Laura Gómez" },
      participantes: [{ id: "p1", contacto: { id: "c3", nombre: "Salón Real" }, rol: { id: "r1", nombre: "Salón" }, nota: "nota" }],
      posiblesDuplicados: [{ id: "c2", nombre: "Laura Gómez" }],
      superpuestas: [],
    } as unknown as import("./ficha").DatosConsultaFicha;
    const r = F.sinDatosDeOtrosContactos(datos);
    expect(JSON.stringify([r.referente, r.participantes, r.posiblesDuplicados])).not.toMatch(/Gómez|Salón Real/);
    expect(r.referente).toEqual({ id: "c2", nombre: F.CONTACTO_RESERVADO });
    expect(r.participantes[0]).toEqual({ id: "p1", contacto: { id: "c3", nombre: F.CONTACTO_RESERVADO }, rol: { id: "r1", nombre: "Salón" }, nota: "nota" });
    expect(r.posiblesDuplicados).toEqual([]);
    expect(r.contacto).toEqual(datos.contacto);
    // No toca el original.
    expect(datos.posiblesDuplicados).toHaveLength(1);
  });

  it("la página la aplica en el servidor antes de pasar las props", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const pagina = readFileSync(join(process.cwd(), "app/(shell)/consultas/[id]/page.tsx"), "utf8");
    expect(pagina).toMatch(/datosCompletos && !veContacto \? sinDatosDeOtrosContactos\(datosCompletos\) : datosCompletos/);
    // Sólo se usa en esa línea, al cargarla y para saber si hay duplicado: ningún componente la recibe.
    expect(pagina.match(/datosCompletos/g)!.length).toBe(5);
  });
});
