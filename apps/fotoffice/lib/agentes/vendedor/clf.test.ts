import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const V = await import("./clf");
const { leerAjustesVendedor, guardarAjustesVendedor } = await import("./ajustes");

type Atribucion = { token: string; userId: number; rol: string; creadoEn: string };
type Coincidencia = { clave: string; userId: number; rol: string; creadoEn: string; baja: boolean };

/** CLF falso: responde según la ruta y la consulta, y anota cada pedido. */
function clfFalso(r: {
  atribuciones?: Atribucion[];
  coincidencias?: Coincidencia[];
  clubes?: number;
  conocimiento?: { texto: string; version: string };
  emails?: string[];
  ventas?: Array<{ userId: number; ventas: number; totalPesos: number }>;
  caido?: boolean;
} = {}) {
  const pedidos: Array<{ url: string; auth: string | null; redirect: RequestRedirect | undefined; body: Record<string, unknown> | null }> = [];
  const fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    pedidos.push({
      url: String(url),
      auth: new Headers(init?.headers).get("authorization"),
      redirect: init?.redirect,
      body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null,
    });
    if (r.caido) throw new Error("ECONNREFUSED");
    const u = String(url);
    const j = (x: unknown) => new Response(JSON.stringify(x), { status: 200 });
    if (u.endsWith("/clubes")) return new Response("", { status: r.clubes ?? 404 });
    if (u.endsWith("/api/internal/usuarios/existentes")) return j({ coincidencias: r.coincidencias ?? [] });
    const consulta = pedidos.at(-1)!.body?.consulta;
    if (consulta === "atribuciones") return j({ atribuciones: r.atribuciones ?? [] });
    if (consulta === "ventas") return j({ ventas: r.ventas ?? [] });
    if (consulta === "campana-escolar") return j({ emails: r.emails ?? [] });
    if (consulta === "conocimiento") return j(r.conocimiento ?? { texto: "# Cómo funciona CLF", version: "0123456789abcdef" });
    return new Response("{}", { status: 400 });
  }) as typeof globalThis.fetch;
  return { fetch, pedidos, deps: { fetch, url: "https://clf.test", secreto: "s3cr3t" } };
}

const ENVIADO = new Date("2026-11-10T13:00:00.000Z");
const AHORA = new Date("2026-11-20T15:00:00.000Z"); // 12:00 argentinas

const contacto = (extra: Record<string, unknown> = {}) =>
  B.agregar("dnxContacto", {
    tipo: "FOTOGRAFO", nombre: "Luz Estudio", region: "CENTRO", creadoPor: "BUSCADOR", estado: "CONTACTADO",
    email: null, telefono: null, whatsapp: null, ...extra,
  }) as { id: string };

const hilo = (contactoId: string, extra: Record<string, unknown> = {}) =>
  B.agregar("dnxVendedorHilo", {
    contactoId, grupo: "FOTOGRAFO:GENERAL", token: `tok_${contactoId}_abcdefghij`, estado: "ENVIADO", enviadoEn: ENVIADO, ...extra,
  }) as { id: string; token: string };

const filaHilo = (id: string) => B.datos.dnxVendedorHilo.find((h) => h.id === id)!;
const filaContacto = (id: string) => B.datos.dnxContacto.find((c) => c.id === id)!;

beforeEach(() => B.vaciar());

describe("registros en CLF", () => {
  it("registro por cookie: SE_SUMO y registradoEn", async () => {
    const c = contacto({ email: "luz@estudio.com.ar" });
    const h = hilo(c.id);
    const clf = clfFalso({ atribuciones: [{ token: h.token, userId: 42, rol: "PHOTOGRAPHER", creadoEn: "2026-11-12T10:00:00.000Z" }] });
    const r = await V.actualizarRegistros(AHORA, clf.deps);
    expect(r).toEqual({ nuevos: [{ hiloId: h.id, via: "COOKIE" }] });
    expect(filaHilo(h.id)).toMatchObject({
      registradoEn: new Date("2026-11-12T10:00:00.000Z"), usuarioClfId: 42, rolClf: "PHOTOGRAPHER", viaRegistro: "COOKIE",
    });
    expect(filaContacto(c.id)).toMatchObject({ estado: "SE_SUMO" });
    expect(B.datos.dnxContactoEvento).toEqual([expect.objectContaining({ contactoId: c.id, tipo: "ESTADO", autor: "VENDEDOR" })]);
    const atr = clf.pedidos.find((p) => p.body?.consulta === "atribuciones")!;
    expect(atr).toMatchObject({ url: "https://clf.test/api/internal/vendedor", auth: "Bearer s3cr3t", redirect: "error", body: { tokens: [h.token] } });
    // Una segunda corrida no lo vuelve a contar.
    expect(await V.actualizarRegistros(AHORA, clf.deps)).toEqual({ nuevos: [] });
  });

  it("registro por email con alta posterior al primer correo cuenta", async () => {
    const c = contacto({ email: "Luz@Estudio.com.ar" });
    const h = hilo(c.id);
    const clf = clfFalso({
      coincidencias: [{ clave: "luz@estudio.com.ar", userId: 43, rol: "ORGANIZER", creadoEn: "2026-11-11T10:00:00.000Z", baja: false }],
    });
    const r = await V.actualizarRegistros(AHORA, clf.deps);
    expect(r).toEqual({ nuevos: [{ hiloId: h.id, via: "EMAIL" }] });
    expect(filaHilo(h.id)).toMatchObject({
      registradoEn: new Date("2026-11-11T10:00:00.000Z"), usuarioClfId: 43, rolClf: "ORGANIZER", viaRegistro: "EMAIL",
    });
    expect(filaContacto(c.id)).toMatchObject({ estado: "SE_SUMO" });
  });

  it("usuario con alta anterior no cuenta y cierra el hilo YA_ERA_USUARIO", async () => {
    const c = contacto({ telefono: "0341 15 555-1234" });
    const h = hilo(c.id);
    const clf = clfFalso({
      coincidencias: [{ clave: "+543415551234", userId: 44, rol: "PHOTOGRAPHER", creadoEn: "2026-01-01T10:00:00.000Z", baja: false }],
    });
    const r = await V.actualizarRegistros(AHORA, clf.deps);
    expect(r).toEqual({ nuevos: [] });
    expect(filaHilo(h.id)).toMatchObject({ estado: "CERRADO", cierre: "YA_ERA_USUARIO", registradoEn: null });
    expect(filaContacto(c.id)).toMatchObject({ estado: "CONTACTADO" });
    // Un comprador (CUSTOMER) no es un registro de plataforma.
    const c2 = contacto({ email: "comprador@mail.com" });
    const h2 = hilo(c2.id);
    const clf2 = clfFalso({
      coincidencias: [{ clave: "comprador@mail.com", userId: 45, rol: "CUSTOMER", creadoEn: "2026-11-15T10:00:00.000Z", baja: false }],
    });
    expect(await V.actualizarRegistros(AHORA, clf2.deps)).toEqual({ nuevos: [] });
    expect(filaHilo(h2.id)).toMatchObject({ estado: "ENVIADO", cierre: null, registradoEn: null });
  });

  it("baja en CLF pasa a NO_CONTACTAR", async () => {
    const c = contacto({ email: "baja@mail.com" });
    const h = hilo(c.id);
    const clf = clfFalso({
      coincidencias: [{ clave: "baja@mail.com", userId: 46, rol: "CUSTOMER", creadoEn: "2026-01-01T10:00:00.000Z", baja: true }],
    });
    await V.actualizarRegistros(AHORA, clf.deps);
    expect(filaContacto(c.id)).toMatchObject({ estado: "NO_CONTACTAR" });
    expect(filaHilo(h.id)).toMatchObject({ estado: "BAJA", cierre: "BAJA_CLF" });
    expect(B.datos.dnxContactoEvento).toEqual([
      expect.objectContaining({ contactoId: c.id, tipo: "ESTADO", datos: { de: "CONTACTADO", a: "NO_CONTACTAR" }, autor: "VENDEDOR" }),
    ]);
  });

  it("un hilo esperando a Daniel con un usuario anterior sigue en ESPERA_DANIEL", async () => {
    const c = contacto({ email: "viejo@mail.com" });
    const h = hilo(c.id, { estado: "ESPERA_DANIEL" });
    const clf = clfFalso({
      coincidencias: [{ clave: "viejo@mail.com", userId: 50, rol: "PHOTOGRAPHER", creadoEn: "2026-01-01T10:00:00.000Z", baja: false }],
    });
    expect(await V.actualizarRegistros(AHORA, clf.deps)).toEqual({ nuevos: [] });
    expect(filaHilo(h.id)).toMatchObject({ estado: "ESPERA_DANIEL", cierre: null, registradoEn: null });
  });

  it("un registro nuevo en un hilo que respondió se anota sin cambiarle el estado", async () => {
    const c = contacto({ email: "nueva@mail.com" });
    const h = hilo(c.id, { estado: "RESPONDIO" });
    const clf = clfFalso({ atribuciones: [{ token: h.token, userId: 51, rol: "PHOTOGRAPHER", creadoEn: "2026-11-12T10:00:00.000Z" }] });
    expect(await V.actualizarRegistros(AHORA, clf.deps)).toEqual({ nuevos: [{ hiloId: h.id, via: "COOKIE" }] });
    expect(filaHilo(h.id)).toMatchObject({ estado: "RESPONDIO", cierre: null, viaRegistro: "COOKIE", usuarioClfId: 51 });
    expect(filaContacto(c.id)).toMatchObject({ estado: "SE_SUMO" });
  });

  it("un hilo cerrado NO_INTERESA conserva su cierre con una baja en CLF, y el contacto pasa a NO_CONTACTAR", async () => {
    const c = contacto({ email: "cerrado@mail.com" });
    const h = hilo(c.id, { estado: "CERRADO", cierre: "NO_INTERESA" });
    const clf = clfFalso({
      coincidencias: [{ clave: "cerrado@mail.com", userId: 52, rol: "PHOTOGRAPHER", creadoEn: "2026-11-15T10:00:00.000Z", baja: true }],
    });
    expect(await V.actualizarRegistros(AHORA, clf.deps)).toEqual({ nuevos: [] });
    expect(filaHilo(h.id)).toMatchObject({ estado: "CERRADO", cierre: "NO_INTERESA", registradoEn: null });
    expect(filaContacto(c.id)).toMatchObject({ estado: "NO_CONTACTAR" });
  });

  it("los hilos cerrados por CLF o por baja no se vuelven a consultar", async () => {
    for (const cierre of ["YA_ERA_USUARIO", "BAJA_CLF", "BAJA"]) hilo(contacto({ email: `${cierre}@mail.com` }).id, { estado: "CERRADO", cierre });
    const clf = clfFalso();
    expect(await V.actualizarRegistros(AHORA, clf.deps)).toEqual({ nuevos: [] });
    expect(clf.pedidos).toHaveLength(0);
  });

  it("si CLF falla devuelve error y no lanza", async () => {
    const c = contacto({ email: "luz@estudio.com.ar" });
    const h = hilo(c.id);
    const clf = clfFalso({ caido: true });
    const r = await V.actualizarRegistros(AHORA, clf.deps);
    expect(r).toMatchObject({ nuevos: [], error: expect.any(String) });
    expect(filaHilo(h.id)).toMatchObject({ estado: "ENVIADO", registradoEn: null });
    const roto = (async () => new Response("caído", { status: 502 })) as typeof fetch;
    expect(await V.traerVentas({ desde: ENVIADO, hasta: AHORA, usuarios: [{ userId: 1, registradoEn: ENVIADO }] }, { fetch: roto, url: "https://clf.test", secreto: "s" }))
      .toEqual({ error: expect.any(String) });
    expect(await V.bloqueadosEnClf([{ id: "x", email: "a@b.com", telefono: null }], { fetch: roto, url: "https://clf.test", secreto: "s" }))
      .toEqual({ error: expect.any(String) });
    const d = await V.consultaDiaria(AHORA, clf.deps);
    expect(d.hecha).toBe(true);
    expect(d.errores.length).toBeGreaterThan(0);
    expect((await leerAjustesVendedor()).consultaClfDia).toBe("2026-11-20");
  });

  it("sin secreto no consulta", async () => {
    const clf = clfFalso();
    expect(await V.traerConocimiento({ fetch: clf.fetch, url: "https://clf.test", secreto: "" })).toEqual({ error: expect.any(String) });
    expect(clf.pedidos).toHaveLength(0);
  });
});

describe("consultas a CLF", () => {
  it("la consulta diaria corre una sola vez por día argentino", async () => {
    const clf = clfFalso({ emails: ["Colegio@Mail.com"], clubes: 200 });
    // Antes de las 8 argentinas no corre.
    const temprano = await V.consultaDiaria(new Date("2026-11-20T10:30:00.000Z"), clf.deps);
    expect(temprano).toEqual({ hecha: false, registros: [], errores: [] });
    expect(clf.pedidos).toHaveLength(0);

    const primera = await V.consultaDiaria(AHORA, clf.deps);
    expect(primera).toEqual({ hecha: true, registros: [], errores: [] });
    expect(await V.leerConocimiento()).toEqual({ texto: "# Cómo funciona CLF", version: "0123456789abcdef" });
    expect(await V.leerCampanaEscolar()).toEqual(new Set(["colegio@mail.com"]));
    expect(await leerAjustesVendedor()).toMatchObject({ consultaClfDia: "2026-11-20", paginaClubesPublicada: true });
    const n = clf.pedidos.length;

    expect(await V.consultaDiaria(new Date("2026-11-20T22:00:00.000Z"), clf.deps)).toMatchObject({ hecha: false });
    expect(clf.pedidos).toHaveLength(n);
    // 01:00 del 21 en UTC sigue siendo el 20 en Argentina.
    expect(await V.consultaDiaria(new Date("2026-11-21T01:00:00.000Z"), clf.deps)).toMatchObject({ hecha: false });
    // El día siguiente sí.
    expect(await V.consultaDiaria(new Date("2026-11-21T12:00:00.000Z"), clf.deps)).toMatchObject({ hecha: true });
  });

  it("sin caché no hay conocimiento ni campaña", async () => {
    expect(await V.leerConocimiento()).toBeNull();
    expect(await V.leerCampanaEscolar()).toBeNull();
  });

  it("página de clubes: 404 es no publicada, 200 es publicada", async () => {
    const no = clfFalso({ clubes: 404 });
    expect(await V.paginaClubesPublicada(no.deps)).toBe(false);
    expect(no.pedidos[0]).toMatchObject({ url: "https://clf.test/clubes", redirect: "manual" });
    expect(await V.paginaClubesPublicada(clfFalso({ clubes: 200 }).deps)).toBe(true);
    expect(await V.paginaClubesPublicada(clfFalso({ clubes: 308 }).deps)).toBe(false);
    expect(await V.paginaClubesPublicada(clfFalso({ caido: true }).deps)).toBe(false);
  });

  it("bloqueados: usuarios de plataforma y bajas, no compradores", async () => {
    const clf = clfFalso({
      coincidencias: [
        { clave: "foto@mail.com", userId: 1, rol: "PHOTOGRAPHER", creadoEn: "2026-01-01T00:00:00.000Z", baja: false },
        { clave: "comprador@mail.com", userId: 2, rol: "CUSTOMER", creadoEn: "2026-01-01T00:00:00.000Z", baja: false },
        { clave: "+543415551234", userId: 3, rol: "CUSTOMER", creadoEn: "2026-01-01T00:00:00.000Z", baja: true },
      ],
    });
    const r = await V.bloqueadosEnClf(
      [
        { id: "a", email: "Foto@Mail.com", telefono: null },
        { id: "b", email: "comprador@mail.com", telefono: null },
        { id: "c", email: null, telefono: "+54 9 341 555 1234" },
        { id: "d", email: "nadie@mail.com", telefono: null },
      ],
      clf.deps,
    );
    expect(r).toEqual(new Set(["a", "c"]));
  });

  it("usuarios en lotes de 200 y ventas con fechas ISO", async () => {
    const clf = clfFalso({ ventas: [{ userId: 7, ventas: 2, totalPesos: 3000 }] });
    const emails = Array.from({ length: 250 }, (_, i) => `a${i}@mail.com`);
    await V.consultarUsuarios(emails, ["+543415551234"], clf.deps);
    const lotes = clf.pedidos.filter((p) => p.url.endsWith("/usuarios/existentes"));
    expect(lotes).toHaveLength(2);
    for (const l of lotes) expect((l.body!.emails as string[]).length + (l.body!.telefonos as string[]).length).toBeLessThanOrEqual(200);

    const v = await V.traerVentas({ desde: ENVIADO, hasta: AHORA, usuarios: [{ userId: 7, registradoEn: ENVIADO }] }, clf.deps);
    expect(v).toEqual([{ userId: 7, ventas: 2, totalPesos: 3000 }]);
    expect(clf.pedidos.at(-1)!.body).toEqual({
      consulta: "ventas", desde: ENVIADO.toISOString(), hasta: AHORA.toISOString(), usuarios: [{ userId: 7, registradoEn: ENVIADO.toISOString() }],
    });
  });

  it("la caché guarda traidoEn y no pisa ajustes", async () => {
    await guardarAjustesVendedor({ pausado: false });
    await V.consultaDiaria(AHORA, clfFalso().deps);
    const fila = B.datos.systemSettings.find((s) => s.key === "fotoffice_vendedor_conocimiento")!;
    expect(JSON.parse(String(fila.value))).toMatchObject({ traidoEn: AHORA.toISOString() });
    expect((await leerAjustesVendedor()).pausado).toBe(false);
  });
});
