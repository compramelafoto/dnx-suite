import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tabla en memoria que entiende los filtros que usa adjuntos.ts (igualdad, lte, gt, OR, AND),
 * así las pruebas de fechas y de pertenencia miran el resultado real y no sólo el where.
 */
type Fila = {
  id: string; workspaceId: string; clientId: string | null; memberId: string | null;
  storageKey: string; fileName: string; contentType: string; sizeBytes: number; status: string;
  uploadedByUserId: number | null; uploadedByLabel: string;
  deletedAt: Date | null; purgeAfter: Date | null; createdAt: Date;
};

const H = vi.hoisted(() => ({
  filas: [] as Fila[],
  evento: vi.fn(),
  subida: vi.fn(), descarga: vi.fn(), tamano: vi.fn(), borrarObj: vi.fn(),
  uuid: 0,
}));

function cumple(f: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([k, cond]) => {
    if (k === "OR") return (cond as Record<string, unknown>[]).some((w) => cumple(f, w));
    if (k === "AND") return (cond as Record<string, unknown>[]).every((w) => cumple(f, w));
    const v = f[k];
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as { lte?: Date; gt?: Date };
      if (!(v instanceof Date)) return false;
      if (c.lte && !(v.getTime() <= c.lte.getTime())) return false;
      if (c.gt && !(v.getTime() > c.gt.getTime())) return false;
      return true;
    }
    return v === cond;
  });
}

function pick(f: Fila, select?: Record<string, boolean>) {
  if (!select) return { ...f };
  return Object.fromEntries(Object.keys(select).map((k) => [k, f[k as keyof Fila]]));
}

vi.mock("server-only", () => ({}));
vi.mock("./eventos", () => ({ registrarEventoPersona: H.evento }));
vi.mock("./adjuntos-r2", () => ({
  urlDeSubida: H.subida, urlDeDescarga: H.descarga, tamanoReal: H.tamano, borrarObjeto: H.borrarObj,
}));
vi.mock("@repo/db", () => {
  const tabla = {
    findFirst: async ({ where, select }: { where: Record<string, unknown>; select?: Record<string, boolean> }) => {
      const f = H.filas.find((x) => cumple(x, where));
      return f ? pick(f, select) : null;
    },
    findMany: async ({ where, select, take }: { where: Record<string, unknown>; select?: Record<string, boolean>; take?: number }) =>
      H.filas.filter((x) => cumple(x, where)).slice(0, take ?? Infinity).map((x) => pick(x, select)),
    create: async ({ data }: { data: Partial<Fila> }) => {
      const f = { id: `a${H.filas.length + 1}`, clientId: null, memberId: null, deletedAt: null, purgeAfter: null, createdAt: new Date(), ...data } as Fila;
      H.filas.push(f);
      return { id: f.id };
    },
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Fila> }) => {
      const hits = H.filas.filter((x) => cumple(x, where));
      for (const h of hits) Object.assign(h, data);
      return { count: hits.length };
    },
    deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
      const antes = H.filas.length;
      H.filas = H.filas.filter((x) => !cumple(x, where));
      return { count: antes - H.filas.length };
    },
  };
  const prisma = { fotofficeAttachment: tabla, $transaction: async (fn: (tx: unknown) => unknown) => fn(prisma) };
  return { prisma };
});

const A = await import("./adjuntos");

const PERSONA = { clientId: "c1", memberId: "m1" };
const EQUIPO = { workspaceId: "ws-1", userId: 7, userLabel: "Ana", role: "STAFF", persona: PERSONA };
const ADMIN = { ...EQUIPO, role: "WORKSPACE_ADMIN" };
const OTRO_WS = { ...ADMIN, workspaceId: "ws-2", persona: { clientId: "cX", memberId: null } };
const DIA = 24 * 60 * 60 * 1000;
const AHORA = new Date("2026-10-15T12:00:00Z");
const UUID = "123e4567-e89b-12d3-a456-426614174000";

function fila(p: Partial<Fila>): Fila {
  const f: Fila = {
    id: `f${H.filas.length + 1}`, workspaceId: "ws-1", clientId: "c1", memberId: null,
    storageKey: `adjuntos/ws-1/${UUID}`, fileName: "dni.pdf", contentType: "application/pdf", sizeBytes: 500,
    status: "LISTO", uploadedByUserId: 7, uploadedByLabel: "Ana", deletedAt: null, purgeAfter: null,
    createdAt: new Date(AHORA.getTime() - DIA), ...p,
  };
  H.filas.push(f);
  return f;
}

beforeEach(() => {
  H.filas = [];
  for (const f of [H.evento, H.subida, H.descarga, H.tamano, H.borrarObj]) f.mockReset();
  H.subida.mockResolvedValue("https://r2/put-firmado");
  H.descarga.mockResolvedValue("https://r2/get-firmado");
  H.borrarObj.mockResolvedValue(undefined);
});

describe("pedirSubida", () => {
  it("crea PENDIENTE con clave adjuntos/<ws>/<uuid> y devuelve id + url, nunca la clave", async () => {
    const r = await A.pedirSubida(EQUIPO, PERSONA, { nombre: "../DNI Pérez.pdf", tipo: "application/pdf", tamano: 1234 });
    expect(r).toEqual({ ok: true, id: "a1", url: "https://r2/put-firmado" });
    expect(JSON.stringify(r)).not.toContain("adjuntos/");
    const f = H.filas[0];
    expect(f).toMatchObject({ workspaceId: "ws-1", clientId: "c1", status: "PENDIENTE", sizeBytes: 1234, fileName: "..DNI Pérez.pdf", uploadedByUserId: 7 });
    expect(f.memberId).toBeNull();
    expect(f.storageKey).toMatch(/^adjuntos\/ws-1\/[0-9a-f-]{36}$/);
    expect(f.storageKey).not.toContain("DNI");
    expect(H.subida).toHaveBeenCalledWith(f.storageKey, "application/pdf", 1234);
  });
  it("rechaza tipo y tamaño sin tocar base ni bucket", async () => {
    expect(await A.pedirSubida(EQUIPO, PERSONA, { nombre: "x.html", tipo: "text/html", tamano: 10 }))
      .toEqual({ ok: false, error: "Ese tipo de archivo no se puede adjuntar." });
    expect(await A.pedirSubida(EQUIPO, PERSONA, { nombre: "x.pdf", tipo: "application/pdf", tamano: 10_485_761 }))
      .toEqual({ ok: false, error: "El archivo supera los 10 MB." });
    expect(H.filas).toHaveLength(0);
    expect(H.subida).not.toHaveBeenCalled();
  });
  it("sin operar no firma", async () => {
    const r = await A.pedirSubida({ ...EQUIPO, role: null }, PERSONA, { nombre: "x.pdf", tipo: "application/pdf", tamano: 10 });
    expect(r.ok).toBe(false);
    expect(H.subida).not.toHaveBeenCalled();
  });
  it("si la firma falla, no queda la fila", async () => {
    H.subida.mockRejectedValue(new Error("r2"));
    const r = await A.pedirSubida(EQUIPO, PERSONA, { nombre: "x.pdf", tipo: "application/pdf", tamano: 10 });
    expect(r.ok).toBe(false);
    expect(H.filas).toHaveLength(0);
  });
});

describe("confirmarSubida", () => {
  it("tamaño igual → LISTO y evento ADJUNTO_SUBIDO", async () => {
    const f = fila({ status: "PENDIENTE", sizeBytes: 500 });
    H.tamano.mockResolvedValue(500);
    expect(await A.confirmarSubida(EQUIPO, f.id)).toEqual({ ok: true });
    expect(f.status).toBe("LISTO");
    expect(H.evento).toHaveBeenCalledTimes(1);
    expect(H.evento.mock.calls[0][1]).toMatchObject({ workspaceId: "ws-1", dueno: { clientId: "c1" }, kind: "ADJUNTO_SUBIDO" });
    expect(JSON.stringify(H.evento.mock.calls[0][1])).not.toContain("adjuntos/");
  });
  it("tamaño distinto → borra objeto y fila, error exacto", async () => {
    const f = fila({ status: "PENDIENTE", sizeBytes: 500 });
    H.tamano.mockResolvedValue(501);
    expect(await A.confirmarSubida(EQUIPO, f.id)).toEqual({ ok: false, error: "La subida no se completó. Probá de nuevo." });
    expect(H.borrarObj).toHaveBeenCalledWith(f.storageKey);
    expect(H.filas).toHaveLength(0);
    expect(H.evento).not.toHaveBeenCalled();
  });
  it("objeto inexistente → mismo error", async () => {
    const f = fila({ status: "PENDIENTE" });
    H.tamano.mockResolvedValue(null);
    expect(await A.confirmarSubida(EQUIPO, f.id)).toEqual({ ok: false, error: "La subida no se completó. Probá de nuevo." });
    expect(H.filas).toHaveLength(0);
  });
  it("ya LISTO u otro workspace → no encontrado, sin mirar el bucket", async () => {
    const listo = fila({ status: "LISTO" });
    const ajeno = fila({ status: "PENDIENTE", workspaceId: "ws-2", clientId: "c1" });
    for (const id of [listo.id, ajeno.id]) {
      expect(await A.confirmarSubida(EQUIPO, id)).toEqual({ ok: false, error: "No encontramos ese adjunto." });
    }
    expect(H.tamano).not.toHaveBeenCalled();
  });
});

describe("enlaceDeDescarga", () => {
  it("LISTO de la persona → url firmada con clave y nombre", async () => {
    const f = fila({ memberId: "m1", clientId: null, fileName: "contrato.docx" });
    expect(await A.enlaceDeDescarga(EQUIPO, f.id)).toEqual({ ok: true, url: "https://r2/get-firmado" });
    expect(H.descarga).toHaveBeenCalledWith(f.storageKey, "contrato.docx");
  });
  it("BORRADO, PENDIENTE, otro workspace u otra persona → 'No encontramos ese adjunto.' sin firmar", async () => {
    const casos = [
      fila({ status: "BORRADO", purgeAfter: new Date(AHORA.getTime() + DIA) }),
      fila({ status: "PENDIENTE" }),
      fila({ workspaceId: "ws-2" }),
      fila({ clientId: "c-otra" }),
    ];
    for (const f of casos) {
      expect(await A.enlaceDeDescarga(EQUIPO, f.id)).toEqual({ ok: false, error: "No encontramos ese adjunto." });
    }
    const propio = fila({});
    expect(await A.enlaceDeDescarga(OTRO_WS, propio.id)).toEqual({ ok: false, error: "No encontramos ese adjunto." });
    expect(H.descarga).not.toHaveBeenCalled();
  });
  it("sin operar no firma", async () => {
    const f = fila({});
    expect((await A.enlaceDeDescarga({ ...EQUIPO, role: "SOCIO" }, f.id)).ok).toBe(false);
    expect(H.descarga).not.toHaveBeenCalled();
  });
});

describe("borrar y restaurar", () => {
  it("borrar deja BORRADO con purgeAfter a 30 días y evento", async () => {
    const f = fila({});
    expect(await A.borrarAdjunto(EQUIPO, f.id, AHORA)).toEqual({ ok: true });
    expect(f.status).toBe("BORRADO");
    expect(f.deletedAt).toEqual(AHORA);
    expect(f.purgeAfter).toEqual(new Date(AHORA.getTime() + 30 * DIA));
    expect(H.evento.mock.calls[0][1]).toMatchObject({ kind: "ADJUNTO_BORRADO" });
    expect(H.borrarObj).not.toHaveBeenCalled();
  });
  it("borrar de otro workspace → no encontrado", async () => {
    const f = fila({ workspaceId: "ws-2" });
    expect(await A.borrarAdjunto(EQUIPO, f.id, AHORA)).toEqual({ ok: false, error: "No encontramos ese adjunto." });
    expect(f.status).toBe("LISTO");
  });
  it("restaurar exige configurar", async () => {
    const f = fila({ status: "BORRADO", deletedAt: AHORA, purgeAfter: new Date(AHORA.getTime() + DIA) });
    expect(await A.restaurarAdjunto(EQUIPO, f.id, AHORA)).toEqual({ ok: false, error: "No tenés permiso para restaurar adjuntos." });
    expect(f.status).toBe("BORRADO");
  });
  it("restaurar dentro del plazo → LISTO y evento", async () => {
    const f = fila({ status: "BORRADO", deletedAt: AHORA, purgeAfter: new Date(AHORA.getTime() + 1000) });
    expect(await A.restaurarAdjunto(ADMIN, f.id, AHORA)).toEqual({ ok: true });
    expect(f).toMatchObject({ status: "LISTO", deletedAt: null, purgeAfter: null });
    expect(H.evento.mock.calls[0][1]).toMatchObject({ kind: "ADJUNTO_RESTAURADO" });
  });
  it("restaurar pasado el plazo (purgeAfter == ahora) → error", async () => {
    const f = fila({ status: "BORRADO", deletedAt: new Date(AHORA.getTime() - 30 * DIA), purgeAfter: AHORA });
    expect(await A.restaurarAdjunto(ADMIN, f.id, AHORA)).toEqual({ ok: false, error: A.ERROR_PLAZO_VENCIDO });
    expect(f.status).toBe("BORRADO");
    expect(H.evento).not.toHaveBeenCalled();
  });
});

describe("listarAdjuntos", () => {
  it("nunca trae storageKey; borrados sólo si se piden y si todavía se pueden restaurar", async () => {
    fila({ fileName: "a.pdf" });
    fila({ fileName: "b.pdf", status: "BORRADO", purgeAfter: new Date(AHORA.getTime() + DIA) });
    fila({ fileName: "c.pdf", status: "BORRADO", purgeAfter: AHORA });
    fila({ fileName: "d.pdf", status: "PENDIENTE" });
    fila({ fileName: "e.pdf", workspaceId: "ws-2" });
    const solo = await A.listarAdjuntos(EQUIPO, { ahora: AHORA });
    expect(solo.map((x) => x.fileName)).toEqual(["a.pdf"]);
    const todos = await A.listarAdjuntos(EQUIPO, { conBorrados: true, ahora: AHORA });
    expect(todos.map((x) => x.fileName).sort()).toEqual(["a.pdf", "b.pdf"]);
    for (const x of todos) expect(x).not.toHaveProperty("storageKey");
  });
});

describe("purgarAdjuntos", () => {
  it("borrado hace 29 días no se purga; hace 30 sí", async () => {
    const hace29 = new Date(AHORA.getTime() - 29 * DIA);
    const hace30 = new Date(AHORA.getTime() - 30 * DIA);
    const joven = fila({ status: "LISTO", storageKey: "k-joven" });
    const viejo = fila({ status: "LISTO", storageKey: "k-viejo" });
    await A.borrarAdjunto(EQUIPO, joven.id, hace29);
    await A.borrarAdjunto(EQUIPO, viejo.id, hace30);
    const r = await A.purgarAdjuntos(AHORA);
    expect(r).toEqual({ purgados: 1, pendientesLimpios: 0, fallidos: 0 });
    expect(H.borrarObj).toHaveBeenCalledTimes(1);
    expect(H.borrarObj).toHaveBeenCalledWith("k-viejo");
    expect(H.filas.map((f) => f.storageKey)).toEqual(["k-joven"]);
  });
  it("PENDIENTE de 24 h se limpia; de 23 h no; LISTO viejo nunca", async () => {
    fila({ status: "PENDIENTE", storageKey: "k-24", createdAt: new Date(AHORA.getTime() - DIA) });
    fila({ status: "PENDIENTE", storageKey: "k-23", createdAt: new Date(AHORA.getTime() - 23 * 60 * 60 * 1000) });
    fila({ status: "LISTO", storageKey: "k-listo", createdAt: new Date(AHORA.getTime() - 400 * DIA) });
    const r = await A.purgarAdjuntos(AHORA);
    expect(r).toEqual({ purgados: 0, pendientesLimpios: 1, fallidos: 0 });
    expect(H.filas.map((f) => f.storageKey).sort()).toEqual(["k-23", "k-listo"]);
  });
  it("si falla un objeto sigue con los demás, lo cuenta y deja su fila", async () => {
    fila({ status: "BORRADO", storageKey: "k-1", purgeAfter: AHORA });
    fila({ status: "BORRADO", storageKey: "k-2", purgeAfter: AHORA });
    fila({ status: "BORRADO", storageKey: "k-3", purgeAfter: AHORA });
    H.borrarObj.mockImplementation(async (k: string) => {
      if (k === "k-2") throw new Error("r2 caído");
    });
    const r = await A.purgarAdjuntos(AHORA);
    expect(r).toEqual({ purgados: 2, pendientesLimpios: 0, fallidos: 1 });
    expect(H.borrarObj).toHaveBeenCalledTimes(3);
    expect(H.filas.map((f) => f.storageKey)).toEqual(["k-2"]);
  });
});
