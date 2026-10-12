import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Persistencia y corrida de la extracción contra la base en memoria: almacén idempotente por huella, una sola
 * extracción activa por workspace, cancelar, borrar lo extraído, credencial cifrada y la tanda del cron (401,
 * 429 con espera, presupuesto y reanudación).
 */
const B = await vi.hoisted(async () => {
  const { crearBaseAlboom } = await import("./base-en-memoria");
  return crearBaseAlboom();
});
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
vi.mock("@/lib/payments/connect/log", () => ({ sanitizeError: (e: unknown) => String(e) }));

const { almacenPrisma } = await import("./almacen");
const X = await import("./extracciones");
const C = await import("./credenciales");
const { correrExtraccionesAlboom, MAX_REINTENTOS } = await import("./correr");
const { leerAvance } = await import("./avance");
const { ALBOOM_INTEGRATION_KEY } = await import("@/lib/integrations/registry");

const PASS = "contraseña-de-prueba-123";
const CRED = { subdomain: "estudio-prueba", username: "dueno@estudio.test", password: PASS };
const claveAnterior = process.env.DNX_INTEGRATIONS_VAULT_MASTER_KEY;

beforeAll(() => {
  process.env.DNX_INTEGRATIONS_VAULT_MASTER_KEY = randomBytes(32).toString("base64");
});
afterAll(() => {
  if (claveAnterior === undefined) delete process.env.DNX_INTEGRATIONS_VAULT_MASTER_KEY;
  else process.env.DNX_INTEGRATIONS_VAULT_MASTER_KEY = claveAnterior;
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** Alboom falso a nivel `fetch`: 450 contactos y todo lo demás vacío. */
function alboomFetch(opciones: { login?: () => Response; contactos?: (pagina: number) => Response | null } = {}) {
  const llamadas: { url: string; method: string }[] = [];
  const todos = Array.from({ length: 450 }, (_, i) => ({ id: String(i + 1), name: `C${i + 1}` }));
  const impl = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const ruta = url.replace(/^https:\/\/[^/]+\/api/, "");
    llamadas.push({ url, method: String(init.method) });
    if (ruta === "/users/login") return opciones.login?.() ?? json(200, { status: "ok", token: "t" });
    const body = init.body ? (JSON.parse(String(init.body)) as { pageNumber?: number; pageSize?: number }) : {};
    if (ruta === "/contacts/paginate") {
      const pagina = body.pageNumber ?? 1;
      const especial = opciones.contactos?.(pagina);
      if (especial) return especial;
      const tam = body.pageSize ?? 100;
      return json(200, { rows: todos.slice((pagina - 1) * tam, pagina * tam), count: todos.length });
    }
    if (ruta === "/settings/") return json(200, { company: "Estudio" });
    if (ruta.startsWith("/stages/list")) return json(200, { stage_list: [], stages: {} });
    if (ruta.endsWith("/paginate") || ruta.endsWith("/paginate_apr")) return json(200, { rows: [], count: 0 });
    return json(200, []);
  });
  return { impl: impl as unknown as typeof fetch, llamadas };
}

function relojFalso(inicio = 1_000_000) {
  let t = inicio;
  return {
    ahora: () => t,
    esperar: async (ms: number) => {
      t += ms;
    },
    avanzar: (ms: number) => {
      t += ms;
    },
  };
}

beforeEach(() => {
  B.vaciar();
  vi.restoreAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("almacén de datos crudos", () => {
  it("es idempotente por huella y siempre va por workspace", async () => {
    const fila = (id: string, v: number) => ({ alboomId: id, payload: { id, v }, hash: String(v).padStart(64, "0") });
    expect(await almacenPrisma.guardarFilas("ws-1", "contactos", [fila("1", 1), fila("2", 1)])).toEqual({ nuevos: 2, cambiados: 0, iguales: 0 });
    expect(await almacenPrisma.guardarFilas("ws-1", "contactos", [fila("1", 1), fila("2", 2), fila("3", 1)])).toEqual({ nuevos: 1, cambiados: 1, iguales: 1 });
    expect(B.datos.crudos).toHaveLength(3);
    expect(B.datos.crudos.find((f) => f.alboomId === "2")!.payload).toEqual({ id: "2", v: 2 });
    // Mismo id en otro workspace: es otro registro.
    expect(await almacenPrisma.guardarFilas("ws-2", "contactos", [fila("1", 1)])).toEqual({ nuevos: 1, cambiados: 0, iguales: 0 });
    expect((await almacenPrisma.leerLote("ws-1", "contactos", "1", 10)).map((f) => f.alboomId)).toEqual(["2", "3"]);
    expect(await almacenPrisma.leerLote("ws-2", "contactos", null, 10)).toHaveLength(1);
  });
});

describe("ciclo de la extracción", () => {
  it("una sola activa por workspace (también si la base frena el alta), y otro workspace puede", async () => {
    expect(await X.iniciarExtraccion("ws-1", 7, "TODO")).toMatchObject({ ok: true });
    expect(await X.iniciarExtraccion("ws-1", 7, "INCREMENTAL")).toEqual({ ok: false, error: "Ya hay una extracción en curso." });
    expect(await X.iniciarExtraccion("ws-2", 8, "TODO")).toMatchObject({ ok: true });
    // Carrera: el chequeo no la ve pero el índice parcial sí.
    vi.spyOn(B.prisma.fotofficeAlboomExtraccion, "findFirst").mockResolvedValueOnce(null);
    expect(await X.iniciarExtraccion("ws-1", 7, "TODO")).toEqual({ ok: false, error: "Ya hay una extracción en curso." });
    expect(B.datos.extracciones.filter((e) => e.workspaceId === "ws-1")).toHaveLength(1);
  });

  it("dos tandas no corren la misma extracción: el turno se toma con una escritura condicional", async () => {
    const r = await X.iniciarExtraccion("ws-1", 7, "TODO");
    const id = (r as { id: string }).id;
    const t = new Date(1_000_000);
    expect(await X.reclamarExtraccion(id, "ws-1", t, 60_000)).toBe(true);
    expect(await X.reclamarExtraccion(id, "ws-1", new Date(1_030_000), 60_000)).toBe(false);
    expect(await X.extraccionesParaCorrer(new Date(1_030_000))).toEqual([]);
    // Vencido el turno (tanda muerta), otra la puede tomar.
    expect(await X.reclamarExtraccion(id, "ws-1", new Date(1_070_000), 60_000)).toBe(true);
    // Con el id de otro workspace no se toma nada.
    expect(await X.reclamarExtraccion(id, "ws-2", new Date(9_000_000), 60_000)).toBe(false);
  });

  it("cancelar frena la tanda en curso al guardar su avance", async () => {
    const r = await X.iniciarExtraccion("ws-1", 7, "TODO");
    const id = (r as { id: string }).id;
    await X.reclamarExtraccion(id, "ws-1", new Date(), 60_000);
    const avance = (await X.leerAvanceDe(id, "ws-1"))!;
    expect(await X.guardarAvance(id, "ws-1", avance)).toBe(true);
    expect(await X.cancelarExtraccion("ws-2")).toBe(false);
    expect(await X.cancelarExtraccion("ws-1")).toBe(true);
    expect(await X.guardarAvance(id, "ws-1", avance)).toBe(false);
    expect(B.datos.extracciones[0]).toMatchObject({ status: "CANCELADA", lockedUntil: null });
    expect(B.datos.extracciones[0]!.finishedAt).toBeInstanceOf(Date);
    // Cancelada, se puede volver a extraer.
    expect(await X.iniciarExtraccion("ws-1", 7, "INCREMENTAL")).toMatchObject({ ok: true });
  });

  it("borrar lo extraído: no con una en curso; borra sólo los datos de ese workspace", async () => {
    await almacenPrisma.guardarFilas("ws-1", "contactos", [{ alboomId: "1", payload: {}, hash: "a".repeat(64) }]);
    await almacenPrisma.guardarFilas("ws-2", "contactos", [{ alboomId: "1", payload: {}, hash: "a".repeat(64) }]);
    await X.iniciarExtraccion("ws-1", 7, "TODO");
    expect(await X.borrarLoExtraido("ws-1")).toEqual({ ok: false, error: "Hay una extracción en curso: cancelala antes de borrar." });
    await X.cancelarExtraccion("ws-1");
    expect(await X.borrarLoExtraido("ws-1")).toEqual({ ok: true, registros: 1 });
    expect(B.datos.crudos.map((f) => f.workspaceId)).toEqual(["ws-2"]);
    expect(B.datos.extracciones.filter((e) => e.workspaceId === "ws-1")).toHaveLength(0);
    expect(await X.ultimaExtraccion("ws-1")).toBeNull();
  });
});

describe("credencial de Alboom", () => {
  it("valida el inicio de sesión, guarda cifrado y nunca deja la contraseña en claro", async () => {
    const { impl } = alboomFetch();
    await C.conectarAlboom("ws-1", 7, { ...CRED, subdomain: "https://Estudio-Prueba.alboomcrm.com/" }, { fetchImpl: impl, ...relojFalso() });
    const fila = B.datos.integraciones[0]!;
    expect(fila).toMatchObject({ workspaceId: "ws-1", integrationKey: ALBOOM_INTEGRATION_KEY, provider: "ALBOOM", accountEmail: CRED.username, accountExternalId: "estudio-prueba", status: "ACTIVE" });
    expect(JSON.stringify(fila)).not.toContain(PASS);
    expect(await C.leerCredencialAlboom("ws-1")).toEqual({ ...CRED });
    expect(await C.leerCredencialAlboom("ws-2")).toBeNull();
    const resumen = await C.resumenConexionAlboom("ws-1");
    expect(resumen).toMatchObject({ usuario: CRED.username, subdomain: "estudio-prueba", estado: "ACTIVE" });
    expect(JSON.stringify(resumen)).not.toContain(PASS);
  });

  it("si Alboom rechaza el usuario no guarda nada", async () => {
    const { impl } = alboomFetch({ login: () => json(401, {}) });
    await expect(C.conectarAlboom("ws-1", 7, CRED, { fetchImpl: impl, ...relojFalso() })).rejects.toThrow();
    expect(B.datos.integraciones).toHaveLength(0);
  });
});

describe("tanda del cron", () => {
  async function preparar() {
    const { impl } = alboomFetch();
    await C.conectarAlboom("ws-1", 7, CRED, { fetchImpl: impl, ...relojFalso() });
    const r = await X.iniciarExtraccion("ws-1", 7, "TODO");
    return (r as { id: string }).id;
  }

  it("respeta el presupuesto, retoma en la tanda siguiente y termina LISTA sin escribir en Alboom", async () => {
    const id = await preparar();
    const reloj = relojFalso();
    const red = alboomFetch();
    // Presupuesto chico: 40 s mínimos para arrancar + margen de 25 s por pedido → pocas páginas por tanda.
    const deps = { ahora: reloj.ahora, presupuestoMs: 48_000, opcionesCliente: { fetchImpl: red.impl, esperar: reloj.esperar } };
    const r1 = await correrExtraccionesAlboom(deps);
    expect(r1).toEqual([{ extraccionId: id, workspaceId: "ws-1", resultado: "PAUSADA" }]);
    const a1 = leerAvance(B.datos.extracciones[0]!.progress);
    const hechas1 = a1.pedidos;
    expect(hechas1).toBeGreaterThan(0);
    expect(B.datos.extracciones[0]).toMatchObject({ status: "CORRIENDO", lockedUntil: null });

    for (let i = 0; i < 200 && B.datos.extracciones[0]!.status === "CORRIENDO"; i++) {
      reloj.avanzar(300_000);
      await correrExtraccionesAlboom({ ...deps, presupuestoMs: 270_000 });
    }
    expect(B.datos.extracciones[0]!.status).toBe("LISTA");
    expect(B.datos.extracciones[0]!.finishedAt).toBeInstanceOf(Date);
    expect(B.datos.crudos.filter((f) => f.entity === "contactos")).toHaveLength(450);
    // Las páginas de contactos se pidieron una sola vez cada una (retoma, no repite).
    const paginasContactos = red.llamadas.filter((l) => l.url.endsWith("/contacts/paginate")).length;
    expect(paginasContactos).toBe(5);
    expect(red.llamadas.every((l) => l.method === "GET" || l.method === "POST")).toBe(true);
    expect(red.llamadas.filter((l) => l.method === "POST").every((l) => /\/(users\/login|[a-z_]+\/paginate(_apr)?)$/.test(l.url))).toBe(true);
    // Nada de la contraseña en los logs.
    const logs = JSON.stringify([...vi.mocked(console.info).mock.calls, ...vi.mocked(console.error).mock.calls]);
    expect(logs).not.toContain(PASS);
    expect(logs).not.toContain("C17");
  });

  it("un 401 marca la conexión para volver a conectar y frena con ERROR", async () => {
    await preparar();
    const red = alboomFetch({ login: () => json(401, {}) });
    const r = await correrExtraccionesAlboom({ ahora: relojFalso().ahora, opcionesCliente: { fetchImpl: red.impl, esperar: async () => {} } });
    expect(r[0]!.resultado).toBe("CREDENCIAL");
    expect(B.datos.integraciones[0]!.status).toBe("NEEDS_RECONSENT");
    expect(B.datos.extracciones[0]).toMatchObject({ status: "ERROR" });
    expect(String(B.datos.extracciones[0]!.errorReason)).toMatch(/volver a conectar/);
    // Sin conexión activa, otra extracción termina en ERROR sin salir a la red.
    await X.iniciarExtraccion("ws-1", 7, "TODO");
    const antes = red.llamadas.length;
    await correrExtraccionesAlboom({ ahora: relojFalso().ahora, opcionesCliente: { fetchImpl: red.impl } });
    expect(red.llamadas.length).toBe(antes);
    expect(B.datos.extracciones.at(-1)).toMatchObject({ status: "ERROR" });
  });

  it("un 429 espera (cada vez más) y reintenta en una tanda posterior; tras muchos, ERROR", async () => {
    await preparar();
    const reloj = relojFalso();
    let limitar = true;
    const red = alboomFetch({ contactos: (p) => (limitar && p === 2 ? json(429, {}) : null) });
    const deps = { ahora: reloj.ahora, opcionesCliente: { fetchImpl: red.impl, esperar: reloj.esperar } };
    expect((await correrExtraccionesAlboom(deps))[0]!.resultado).toBe("REINTENTAR");
    const a = leerAvance(B.datos.extracciones[0]!.progress);
    expect(a.reintentos).toBe(1);
    expect(Date.parse(a.reintentarDesde!)).toBe(reloj.ahora() + 60_000);
    expect(a.entidades.contactos).toMatchObject({ pagina: 2 });

    // Antes de la hora, el cron la saltea sin pedir nada.
    const antes = red.llamadas.length;
    expect((await correrExtraccionesAlboom(deps))[0]!.resultado).toBe("ESPERANDO");
    expect(red.llamadas.length).toBe(antes);

    // Después, retoma desde la página 2.
    reloj.avanzar(61_000);
    limitar = false;
    await correrExtraccionesAlboom(deps);
    const b = leerAvance(B.datos.extracciones[0]!.progress);
    expect(b.reintentos).toBe(0);
    expect(b.entidades.contactos!.cantidad).toBeGreaterThanOrEqual(200);

    // Siempre 429: tras MAX_REINTENTOS tandas, ERROR.
    await X.cancelarExtraccion("ws-1");
    await X.iniciarExtraccion("ws-1", 7, "INCREMENTAL");
    const siempre = alboomFetch({ contactos: () => json(429, {}) });
    for (let i = 0; i <= MAX_REINTENTOS + 1; i++) {
      reloj.avanzar(2 * 60 * 60_000);
      await correrExtraccionesAlboom({ ahora: reloj.ahora, opcionesCliente: { fetchImpl: siempre.impl, esperar: reloj.esperar } });
    }
    expect(B.datos.extracciones.at(-1)).toMatchObject({ status: "ERROR" });
    expect(String(B.datos.extracciones.at(-1)!.errorReason)).toMatch(/varios intentos/);
  });
});
