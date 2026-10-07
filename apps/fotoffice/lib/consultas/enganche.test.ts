import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const E = await import("./enganche");
const F = await import("./fechas");
const K = await import("./constantes");

const consultas = () => B.datos.fotofficeConsulta;
const categoria = (id: unknown) => B.datos.fotofficeConsultaCategoria.find((c) => c.id === id)!;

function lead(id: string, datos: Record<string, unknown> = {}, ws = "ws-1") {
  return B.agregar("serviceSalesLead", { id, workspaceId: ws, name: `Persona ${id}`, eventType: "BODA", ...datos });
}

let errores: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  B.vaciar();
  B.agregar("fotofficeWorkspaceBranding", { workspaceId: "ws-1", publicSlug: K.SLUG_DNX });
  B.agregar("fotofficeWorkspaceBranding", { workspaceId: "ws-2", publicSlug: "otra" });
  errores = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  expect(JSON.stringify(errores.mock.calls)).not.toContain("@persona.test");
  errores.mockRestore();
});

describe("engancharConsultasExistentes", () => {
  it("ata contacto (por correo) y categoría equivalente, y copia la fecha y el lugar", async () => {
    B.agregar("client", { id: "c1", workspaceId: "ws-1", clientNumber: 1, email: "ana@persona.test" });
    lead("l1", { email: "ANA@persona.test", eventType: "XV", eventDate: new Date("2026-12-20"), eventLocation: " Salón Real " });
    lead("l2", { email: null, phone: "341 555-0000", eventType: "SHOW" });
    expect(await E.engancharConsultasExistentes("ws-1")).toEqual({ enganchadas: 2, completo: true });
    const q1 = consultas().find((c) => c.leadId === "l1")!;
    expect(q1).toMatchObject({
      workspaceId: "ws-1", clientId: "c1", eventStartsAt: new Date("2026-12-20"), eventTimeKnown: false, venue: "Salón Real",
    });
    expect(categoria(q1.categoryId).name).toBe(K.EQUIVALENCIA_EVENT_TYPE_DNX.XV);
    const q2 = consultas().find((c) => c.leadId === "l2")!;
    expect(categoria(q2.categoryId).name).toBe("Producción de contenido fotográfico y/o audiovisual");
    // Sin correo se crea un contacto nuevo con su teléfono, y perfil CONTACTO.
    expect(B.datos.client.find((c) => c.id === q2.clientId)).toMatchObject({ firstName: "Persona", lastName: "l2", phone: "3415550000" });
  });

  it("R3: no empareja por teléfono (son consultas que llegaron por el formulario público)", async () => {
    B.agregar("client", { id: "c1", workspaceId: "ws-1", clientNumber: 1, phone: "3415550000" });
    lead("l1", { phone: "3415550000" });
    await E.engancharConsultasExistentes("ws-1");
    expect(consultas()[0]!.clientId).not.toBe("c1");
  });

  it("corre una sola vez: la segunda llamada no toca nada", async () => {
    lead("l1", { email: "a@persona.test" });
    lead("l2", { email: "a@persona.test" });
    expect(await E.engancharConsultasExistentes("ws-1")).toEqual({ enganchadas: 2, completo: true });
    const antes = JSON.stringify([consultas(), B.datos.client]);
    expect(await E.engancharConsultasExistentes("ws-1")).toEqual({ enganchadas: 0, completo: true });
    expect(JSON.stringify([consultas(), B.datos.client])).toBe(antes);
    // Las dos del mismo correo comparten contacto.
    expect(new Set(consultas().map((c) => c.clientId)).size).toBe(1);
  });

  it("por lotes de 50, de la más vieja a la más nueva", async () => {
    for (let i = 0; i < 120; i++) lead(`l${String(i).padStart(3, "0")}`, { createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)) });
    expect(await E.engancharConsultasExistentes("ws-1")).toEqual({ enganchadas: K.LOTE_ENGANCHE, completo: false });
    expect(consultas().map((c) => c.leadId)).toEqual(Array.from({ length: 50 }, (_, i) => `l${String(i).padStart(3, "0")}`));
    expect(await E.contarSinFicha("ws-1")).toBe(70);
    expect(await E.engancharConsultasExistentes("ws-1")).toEqual({ enganchadas: 50, completo: false });
    expect(await E.engancharConsultasExistentes("ws-1")).toEqual({ enganchadas: 20, completo: true });
    expect(await E.contarSinFicha("ws-1")).toBe(0);
  });

  it("re-chequea adentro: si otra corrida la enganchó, no la duplica", async () => {
    lead("l1");
    B.ganchos.alEjecutarSql = (texto) => {
      if (texto.includes("pg_advisory_xact_lock") && consultas().length === 0) {
        B.agregar("fotofficeConsulta", { workspaceId: "ws-1", leadId: "l1", clientId: "x", categoryId: "y" });
      }
    };
    expect(await E.engancharConsultasExistentes("ws-1")).toEqual({ enganchadas: 0, completo: true });
    expect(consultas()).toHaveLength(1);
  });

  it("una que falla no frena a las demás ni deja nada a medias, y se reintenta", async () => {
    lead("l1", { email: "uno@persona.test", createdAt: new Date("2026-01-01") });
    lead("l2", { email: "dos@persona.test", createdAt: new Date("2026-01-02") });
    const original = B.tablas.fotofficeConsulta.create;
    B.tablas.fotofficeConsulta.create = async (a) => {
      if ((a as { data: { leadId: string } }).data.leadId === "l1") throw Object.assign(new Error("uno@persona.test"), { code: "P1001" });
      return original(a);
    };
    expect(await E.engancharConsultasExistentes("ws-1")).toEqual({ enganchadas: 1, completo: false });
    // El contacto de la que falló tampoco quedó.
    expect(B.datos.client.map((c) => c.email)).toEqual(["dos@persona.test"]);
    B.tablas.fotofficeConsulta.create = original;
    expect(await E.engancharConsultasExistentes("ws-1")).toEqual({ enganchadas: 1, completo: true });
  });

  it("las que fallan siempre al principio no traban al resto: cuentan sólo las enganchadas, con tope de intentos", async () => {
    // 5 que fallan siempre (las más viejas) y 12 sanas; tope 5 → hasta 10 intentos por llamada.
    for (let i = 0; i < 17; i++) lead(`l${String(i).padStart(2, "0")}`, { createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)) });
    const trabadas = new Set(["l00", "l01", "l02", "l03", "l04"]);
    const original = B.tablas.fotofficeConsulta.create;
    let intentos = 0;
    B.tablas.fotofficeConsulta.create = async (a) => {
      intentos++;
      if (trabadas.has((a as { data: { leadId: string } }).data.leadId)) throw Object.assign(new Error("x"), { code: "P1001" });
      return original(a);
    };
    expect(await E.engancharConsultasExistentes("ws-1", 5)).toEqual({ enganchadas: 5, completo: false });
    expect(intentos).toBe(10);
    expect(await E.engancharConsultasExistentes("ws-1", 5)).toEqual({ enganchadas: 5, completo: false });
    // Quedan las 5 trabadas y 2 sanas: se enganchan las sanas y la llamada termina (no hay más).
    intentos = 0;
    expect(await E.engancharConsultasExistentes("ws-1", 5)).toEqual({ enganchadas: 2, completo: false });
    expect(intentos).toBe(7);
    expect(await E.contarSinFicha("ws-1")).toBe(5);
    // Todas trabadas: el trabajo sigue acotado (2 × tope).
    intentos = 0;
    expect(await E.engancharConsultasExistentes("ws-1", 2)).toEqual({ enganchadas: 0, completo: false });
    expect(intentos).toBe(4);
    B.tablas.fotofficeConsulta.create = original;
    expect(await E.engancharConsultasExistentes("ws-1", 5)).toEqual({ enganchadas: 5, completo: true });
  });

  it("siembra los catálogos si faltan; una categoría archivada sigue valiendo para lo viejo", async () => {
    lead("l1", { eventType: "BODA" }, "ws-2");
    expect(await E.engancharConsultasExistentes("ws-2")).toEqual({ enganchadas: 1, completo: true });
    expect(B.datos.fotofficeConsultaCategoria.filter((c) => c.workspaceId === "ws-2")).toHaveLength(9);
    B.datos.fotofficeConsultaCategoria.find((c) => c.workspaceId === "ws-2" && c.name === "Boda")!.archivedAt = new Date();
    lead("l2", { eventType: "BODA" }, "ws-2");
    await E.engancharConsultasExistentes("ws-2");
    expect(categoria(consultas().find((c) => c.leadId === "l2")!.categoryId).name).toBe("Boda");
  });

  it("aislamiento: sólo las del workspace, con contactos del workspace", async () => {
    B.agregar("client", { id: "cx", workspaceId: "ws-2", clientNumber: 1, email: "ana@persona.test" });
    lead("l1", { email: "ana@persona.test" });
    lead("lx", { email: "ana@persona.test" }, "ws-2");
    await E.engancharConsultasExistentes("ws-1");
    expect(consultas()).toHaveLength(1);
    expect(consultas()[0]).toMatchObject({ leadId: "l1", workspaceId: "ws-1" });
    expect(consultas()[0]!.clientId).not.toBe("cx");
    expect(await E.contarSinFicha("ws-2")).toBe(1);
  });
});

describe("prepararCaptacion engancha las existentes", () => {
  it("al abrir Consultas: siembra catálogos y corre este enganche junto a los de 0.4 y 0.5, cada uno aislado", () => {
    const fuente = readFileSync(path.resolve(__dirname, "../service-leads/preparar.ts"), "utf8");
    expect(fuente).toContain("asegurarCatalogosIniciales(workspaceId, slug)");
    expect(fuente).toContain("engancharConsultas(workspaceId)");
    expect(fuente).toContain("engancharConsultasExistentes(workspaceId)");
    expect(fuente.match(/try \{/g)?.length).toBeGreaterThanOrEqual(4);
  });
});

describe("diaDeCalendario", () => {
  it("medianoche UTC exacta es fecha de calendario; otro instante, el día en Buenos Aires", () => {
    expect(F.diaDeCalendario(new Date("2026-12-20"))).toBe("2026-12-20");
    expect(F.diaDeCalendario(new Date("2026-12-21T02:30:00.000Z"))).toBe("2026-12-20");
    expect(F.diaDeCalendario(new Date("2026-12-21T03:00:00.000Z"))).toBe("2026-12-21");
  });
});
