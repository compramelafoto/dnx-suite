import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const { vincularClf, ROLES_PLATAFORMA } = await import("./clf");

type Coincidencia = { clave: string; userId: number; rol: string };

/** CLF falso: anota lo que le pidieron y responde las coincidencias dadas. */
function clfFalso(coincidencias: Coincidencia[]) {
  const pedidos: Array<{ url: string; auth: string | null; body: { emails: string[]; telefonos: string[] } }> = [];
  const fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    pedidos.push({
      url: String(url),
      auth: new Headers(init?.headers).get("authorization"),
      body: JSON.parse(String(init?.body)) as { emails: string[]; telefonos: string[] },
    });
    return new Response(JSON.stringify({ coincidencias }), { status: 200 });
  }) as typeof globalThis.fetch;
  return { fetch, pedidos };
}

const contacto = (extra: Record<string, unknown> = {}) =>
  B.agregar("dnxContacto", { tipo: "FOTOGRAFO", nombre: "Luz Estudio", region: "CENTRO", creadoPor: "BUSCADOR", vinculo: null, vinculoId: null, compradorClf: false, ...extra }) as { id: string };

const fila = (id: string) => B.datos.dnxContacto.find((c) => c.id === id)!;
const eventosDe = (id: string) => B.datos.dnxContactoEvento.filter((e) => e.contactoId === id);

beforeEach(() => B.vaciar());

describe("vincularClf", () => {
  it("un fotógrafo de CLF queda USUARIO_CLF", async () => {
    const c = contacto({ email: "Luz@Estudio.com.ar", telefono: "0341 15 555-1234" });
    const clf = clfFalso([{ clave: "luz@estudio.com.ar", userId: 42, rol: "PHOTOGRAPHER" }]);
    const r = await vincularClf([c.id], { fetch: clf.fetch, url: "https://clf.test", secreto: "s3cr3t" });
    expect(r).toEqual({ vinculados: 1, compradores: 0 });
    expect(fila(c.id)).toMatchObject({ vinculo: "USUARIO_CLF", vinculoId: "42", compradorClf: false });
    expect(eventosDe(c.id)).toEqual([
      expect.objectContaining({ tipo: "VINCULADO", datos: { vinculo: "USUARIO_CLF", userId: 42, rol: "PHOTOGRAPHER" } }),
    ]);
    expect(clf.pedidos).toHaveLength(1);
    expect(clf.pedidos[0]).toMatchObject({
      url: "https://clf.test/api/internal/usuarios/existentes",
      auth: "Bearer s3cr3t",
      body: { emails: ["luz@estudio.com.ar"], telefonos: ["+543415551234"] },
    });
    expect(ROLES_PLATAFORMA).toEqual(["PHOTOGRAPHER", "LAB_PHOTOGRAPHER", "ORGANIZER", "SCHOOL_ORGANIZER"]);
  });

  it("un comprador queda compradorClf sin vínculo", async () => {
    const c = contacto({ telefono: "+54 9 341 555 1234" });
    const clf = clfFalso([{ clave: "+543415551234", userId: 7, rol: "CUSTOMER" }]);
    const r = await vincularClf([c.id], { fetch: clf.fetch, url: "https://clf.test", secreto: "s3cr3t" });
    expect(r).toEqual({ vinculados: 0, compradores: 1 });
    expect(fila(c.id)).toMatchObject({ vinculo: null, vinculoId: null, compradorClf: true });
    expect(eventosDe(c.id)).toEqual([expect.objectContaining({ tipo: "VINCULADO", datos: { comprador: true, userId: 7 } })]);
  });

  it("no pisa CONOCIDO_DNX_ESTUDIO", async () => {
    const c = contacto({ email: "luz@estudio.com.ar", vinculo: "CONOCIDO_DNX_ESTUDIO", vinculoId: "cli_1" });
    const clf = clfFalso([{ clave: "luz@estudio.com.ar", userId: 42, rol: "ORGANIZER" }]);
    const r = await vincularClf([c.id], { fetch: clf.fetch, url: "https://clf.test", secreto: "s3cr3t" });
    expect(r).toEqual({ vinculados: 1, compradores: 0 });
    expect(fila(c.id)).toMatchObject({ vinculo: "CONOCIDO_DNX_ESTUDIO", vinculoId: "cli_1" });
    expect(eventosDe(c.id)).toEqual([
      expect.objectContaining({ tipo: "VINCULADO", datos: { vinculo: "USUARIO_CLF", userId: 42, rol: "ORGANIZER" } }),
    ]);
    // Una segunda pasada no repite el evento.
    await vincularClf([c.id], { fetch: clf.fetch, url: "https://clf.test", secreto: "s3cr3t" });
    expect(eventosDe(c.id)).toHaveLength(1);
  });

  it("si CLF falla devuelve error y no lanza", async () => {
    const c = contacto({ email: "luz@estudio.com.ar" });
    const roto = (async () => new Response("caído", { status: 502 })) as typeof fetch;
    const r1 = await vincularClf([c.id], { fetch: roto, url: "https://clf.test", secreto: "s3cr3t" });
    expect(r1).toMatchObject({ vinculados: 0, compradores: 0, error: expect.any(String) });
    const explota = (async () => { throw new Error("ECONNREFUSED"); }) as typeof fetch;
    const r2 = await vincularClf([c.id], { fetch: explota, url: "https://clf.test", secreto: "s3cr3t" });
    expect(r2).toMatchObject({ vinculados: 0, compradores: 0, error: expect.any(String) });
    expect(fila(c.id)).toMatchObject({ vinculo: null, compradorClf: false });
    expect(eventosDe(c.id)).toHaveLength(0);
  });

  it("sin secreto no consulta y lo avisa", async () => {
    const c = contacto({ email: "luz@estudio.com.ar" });
    const clf = clfFalso([]);
    const r = await vincularClf([c.id], { fetch: clf.fetch, url: "https://clf.test", secreto: "" });
    expect(r).toMatchObject({ vinculados: 0, compradores: 0, error: expect.any(String) });
    expect(clf.pedidos).toHaveLength(0);
  });

  it("usa los datos guardados aparte y parte en lotes de 200 claves", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 150; i++) {
      const c = contacto({ email: `luz${i}@estudio.com.ar` });
      B.agregar("dnxContactoDato", { contactoId: c.id, campo: "telefono", valor: `341555${String(i).padStart(4, "0")}`, fuente: "SITIO_PROPIO" });
      ids.push(c.id);
    }
    const clf = clfFalso([]);
    await vincularClf(ids, { fetch: clf.fetch, url: "https://clf.test", secreto: "s3cr3t" });
    expect(clf.pedidos).toHaveLength(2);
    for (const p of clf.pedidos) expect(p.body.emails.length + p.body.telefonos.length).toBeLessThanOrEqual(200);
    expect(clf.pedidos.reduce((n, p) => n + p.body.emails.length + p.body.telefonos.length, 0)).toBe(300);
  });
});
