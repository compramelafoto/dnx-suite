import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("@repo/db", () => ({
  prisma: B.prisma,
  Prisma: { PrismaClientKnownRequestError: class extends Error { code = ""; } },
}));

const I = await import("./importar");

type Ctx = Parameters<typeof I.importarClientes>[0];
const GESTIONA: Ctx = { workspaceId: "ws-1", userId: 7, userLabel: "Ana", role: "STAFF", acceso: { role: "STAFF", levels: { clients: "MANAGE" } } };
const SOLO_VER: Ctx = { ...GESTIONA, acceso: { role: "STAFF", levels: { clients: "VIEW", "service-leads": "MANAGE" } } };

const CSV = [
  "Nombre,Apellido,Correo,Teléfono,Categoría,Celular,Email2,Cumpleaños,Web,Provincia,País,Código postal,Sobre",
  "Laura,Pérez,laura@x.test,341 555-1111,Proveedor,341 15 222333,laura2@x.test,20/03/1990,laura.com.ar,Santa Fe,Argentina,2000,Florista",
  "Martín,Gómez,martin@x.test,,,,,1985-12-01,,,,,",
  "Sin,Datos,,,,,,,,,,,",
  "Mala,Fecha,mala@x.test,,Socio,,no-es-correo,31/02/1990,,,,,",
  "Repetida,Pérez,LAURA@x.test,,,,,,,,,,",
  "Existente,Ya,vieja@x.test,,,,,,,,,,",
].join("\n");

beforeEach(() => {
  B.vaciar();
  B.agregar("client", { id: "viejo", workspaceId: "ws-1", clientNumber: 41, kind: "PERSONA", firstName: "Vieja", email: "vieja@x.test", phone: null, docNumber: null });
  B.agregar("client", { id: "ajeno", workspaceId: "ws-2", clientNumber: 99, kind: "PERSONA", firstName: "Ajena", email: "martin@x.test", phone: null, docNumber: null });
});

describe("analizarCsvClientes", () => {
  it("reconoce encabezados en español con tildes y valida cada fila", () => {
    const r = I.analizarCsvClientes(CSV, []);
    if (!r.ok) throw new Error(r.error);
    expect(r.filas.map((f) => f.estado)).toEqual(["VALIDA", "VALIDA", "VALIDA", "ERROR", "DUPLICADA", "VALIDA"]);
    const laura = r.filas[0]!;
    expect(laura.categoria).toBe("PROVEEDOR");
    expect(laura.perfil).toEqual({
      category: "PROVEEDOR", mobile: "34115222333", email2: "laura2@x.test", birthday: "1990-03-20",
      website: "https://laura.com.ar", province: "Santa Fe", country: "Argentina", postalCode: "2000", about: "Florista",
    });
    expect(laura.cliente).toMatchObject({ firstName: "Laura", lastName: "Pérez", email: "laura@x.test", phone: "3415551111" });
    expect(r.filas[1]!.perfil).toEqual({ birthday: "1985-12-01" });
    expect(r.filas[2]!.perfil).toBeNull(); // sin datos ampliados: no crea perfil (cuenta como CLIENTE)
    expect(r.filas[3]!.errores.join(" ")).toMatch(/Categoría/);
    expect(r.filas[3]!.errores.join(" ")).toMatch(/Segundo correo/);
    expect(r.filas[3]!.errores.join(" ")).toMatch(/Cumpleaños/);
  });

  it("fechaDeImportacion: dd/mm/aaaa y aaaa-mm-dd", () => {
    expect(I.fechaDeImportacion("5/3/1990")).toBe("1990-03-05");
    expect(I.fechaDeImportacion("1990-03-05")).toBe("1990-03-05");
  });

  it("sin columna de nombre, vacío o demasiadas filas: error general", () => {
    expect(I.analizarCsvClientes("correo\na@x.test", [])).toEqual({ ok: false, error: I.MENSAJES_IMPORTACION.sinNombre });
    expect(I.analizarCsvClientes("  ", [])).toEqual({ ok: false, error: I.MENSAJES_IMPORTACION.vacio });
    const muchas = ["nombre", ...Array.from({ length: I.MAX_FILAS_IMPORTACION_CLIENTES + 1 }, (_, i) => `N${i}`)].join("\n");
    expect(I.analizarCsvClientes(muchas, [])).toEqual({ ok: false, error: I.MENSAJES_IMPORTACION.demasiadas });
  });
});

describe("previsualizar e importar", () => {
  it("sin «Gestionar» en Clientes no lee ni escribe", async () => {
    expect(await I.previsualizarImportacionClientes(SOLO_VER, CSV)).toEqual({ ok: false, error: I.MENSAJES_IMPORTACION.sinPermiso });
    expect(await I.importarClientes(SOLO_VER, CSV)).toEqual({ ok: false, error: I.MENSAJES_IMPORTACION.sinPermiso });
    expect(B.datos.client).toHaveLength(2);
  });

  it("la vista previa marca como duplicado al cliente existente del workspace (no al de otro) y no escribe", async () => {
    const r = await I.previsualizarImportacionClientes(GESTIONA, CSV);
    if (!r.ok) throw new Error(r.error);
    expect(r.filas.map((f) => f.estado)).toEqual(["VALIDA", "VALIDA", "VALIDA", "ERROR", "DUPLICADA", "DUPLICADA"]);
    expect({ validas: r.validas, conError: r.conError, duplicadas: r.duplicadas }).toEqual({ validas: 3, conError: 1, duplicadas: 2 });
    expect(r.filas[0]).not.toHaveProperty("cliente");
    expect(B.datos.client).toHaveLength(2);
  });

  it("crea clientes numerados con su historial y el perfil en la misma transacción", async () => {
    const r = await I.importarClientes(GESTIONA, CSV);
    expect(r).toEqual({ ok: true, creados: 3, conError: 1, duplicadas: 2, fallidas: 0 });
    const nuevos = B.datos.client.filter((c) => c.workspaceId === "ws-1" && c.id !== "viejo");
    expect(nuevos.map((c) => c.clientNumber)).toEqual([42, 43, 44]);
    expect(nuevos.every((c) => c.createdByUserId === 7)).toBe(true);
    expect(B.datos.clientAudit.filter((a) => a.action === "CREATED")).toHaveLength(3);
    const perfiles = B.datos.fotofficeContactoPerfil;
    expect(perfiles).toHaveLength(2);
    const laura = nuevos.find((c) => c.firstName === "Laura")!;
    const p = perfiles.find((x) => x.clientId === laura.id)!;
    expect(p).toMatchObject({ workspaceId: "ws-1", category: "PROVEEDOR", mobile: "34115222333", province: "Santa Fe" });
    expect(p.birthday).toEqual(new Date("1990-03-20T00:00:00.000Z"));
    // Martín sólo trae cumpleaños: la categoría queda la de defecto (CLIENTE).
    const martin = nuevos.find((c) => c.firstName === "Martín")!;
    expect(perfiles.find((x) => x.clientId === martin.id)?.category).toBe("CLIENTE");
    expect(B.transacciones).toHaveLength(1);
  });

  it("repetir la importación no duplica", async () => {
    await I.importarClientes(GESTIONA, CSV);
    const r = await I.importarClientes(GESTIONA, CSV);
    expect(r).toMatchObject({ ok: true, creados: 1 }); // sólo "Sin Datos" (sin correo ni teléfono) no se reconoce
  });

  it("si falla el perfil, se deshace el lote entero (cliente, historial y perfil)", async () => {
    B.tablas.fotofficeContactoPerfil.create = async () => {
      throw new Error("falla");
    };
    const r = await I.importarClientes(GESTIONA, CSV);
    expect(r).toMatchObject({ ok: true, creados: 0, fallidas: 3 });
    expect(B.datos.client).toHaveLength(2);
    expect(B.datos.clientAudit).toHaveLength(0);
  });
});
