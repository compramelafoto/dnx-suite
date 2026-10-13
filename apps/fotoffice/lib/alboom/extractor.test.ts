import { describe, expect, it } from "vitest";
import { avanceInicial, leerAvance, type Avance } from "./avance";
import { AlboomApiError, AlboomLoginError, esRutaDeLectura, type ClienteAlboom, type PedidoLectura } from "./client";
import { ENTIDADES, type Entidad } from "./entidades";
import { armarFilas, detectarId, ejecutarTanda, REINTENTOS_PARA_SALTEAR, type Almacen, type FilaCruda } from "./extractor";
import { huella } from "./huella";

const WS = "ws-1";

/** Almacén en memoria con la misma regla que el de Prisma: nuevo / cambió la huella / igual. */
function almacenEnMemoria() {
  const filas = new Map<string, FilaCruda & { entity: string; workspaceId: string }>();
  const clave = (ws: string, e: string, id: string) => `${ws}|${e}|${id}`;
  const almacen: Almacen = {
    async guardarFilas(workspaceId, entity, nuevas) {
      let nuevos = 0, cambiados = 0, iguales = 0;
      for (const f of nuevas) {
        const k = clave(workspaceId, entity, f.alboomId);
        const previa = filas.get(k);
        if (!previa) nuevos++;
        else if (previa.hash !== f.hash) cambiados++;
        else iguales++;
        filas.set(k, { ...f, entity, workspaceId });
      }
      return { nuevos, cambiados, iguales };
    },
    async leerLote(workspaceId, entity, despuesDe, limite) {
      return [...filas.values()]
        .filter((f) => f.workspaceId === workspaceId && f.entity === entity && (despuesDe === null || f.alboomId > despuesDe))
        .sort((a, b) => (a.alboomId < b.alboomId ? -1 : 1))
        .slice(0, limite)
        .map((f) => ({ alboomId: f.alboomId, payload: f.payload }));
    },
  };
  const de = (entity: string) => [...filas.values()].filter((f) => f.entity === entity);
  return { almacen, filas, de };
}

/** Cliente falso: responde por ruta, cuenta pedidos y verifica que todo esté en la lista blanca. */
function clienteFalso(responder: (p: PedidoLectura) => unknown) {
  const pedidos: PedidoLectura[] = [];
  const cliente: ClienteAlboom = {
    async leer(p) {
      if (!esRutaDeLectura(p.method, p.ruta)) throw new Error(`fuera de la lista blanca: ${p.method} ${p.ruta}`);
      pedidos.push(p);
      return responder(p);
    },
    pedidosHechos: () => pedidos.length,
  };
  return { cliente, pedidos };
}

/** Reloj que avanza 1 s por pedido. */
function reloj() {
  let t = 0;
  return { ahora: () => t, tick: () => (t += 1000) };
}

function tanda(o: {
  cliente: ClienteAlboom;
  almacen: Almacen;
  avance?: Avance;
  entidades?: readonly Entidad[];
  limite?: number;
  ahora?: () => number;
  guardar?: (a: Avance) => Promise<boolean>;
  tamanoPagina?: number;
}) {
  return ejecutarTanda({
    workspaceId: WS,
    cliente: o.cliente,
    almacen: o.almacen,
    avance: o.avance ?? avanceInicial(),
    ahora: o.ahora ?? (() => 0),
    limite: o.limite ?? Number.MAX_SAFE_INTEGER,
    margenMs: 0,
    guardar: o.guardar ?? (async () => true),
    entidades: o.entidades,
    tamanoPagina: o.tamanoPagina,
  });
}

const contactos = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i + 1), name: `Contacto ${i + 1}` }));
const ENT_CONTACTOS: Entidad = {
  clave: "contactos",
  nombre: "Contactos",
  fuente: { tipo: "paginada", ruta: "/contacts/paginate", body: (pagina, tamano) => ({ pageNumber: pagina, pageSize: tamano }) },
};

function paginar(todos: unknown[], p: PedidoLectura) {
  const b = p.body as { pageNumber: number; pageSize: number };
  return { rows: todos.slice((b.pageNumber - 1) * b.pageSize, b.pageNumber * b.pageSize), count: String(todos.length) };
}

describe("identificadores y huellas", () => {
  it("usa `id`, después las claves de la entidad, y si no la huella (sumando una duda)", () => {
    expect(detectarId({ id: 7 })).toBe("7");
    expect(detectarId({ id: "", name: "Bodas" }, ["name"])).toBe("Bodas");
    expect(detectarId({ x: 1 })).toBeNull();
    const ent: Entidad = { clave: "x", nombre: "x", claves: ["name"], fuente: { tipo: "noDisponible", motivo: "" } };
    const r = armarFilas(ent, [{ id: 1 }, { name: "a" }, { otra: true }], null);
    expect(r.filas.map((f) => f.alboomId)).toEqual(["1", "a", `h${huella({ otra: true }).slice(0, 32)}`]);
    expect(r.dudas).toBe(1);
    // Con `idEsperado: false` (historiales) no es duda.
    expect(armarFilas({ ...ent, idEsperado: false }, [{ otra: true }], "5").dudas).toBe(0);
    // Hijos: con el padre adelante.
    expect(armarFilas(ent, [{ id: 9 }], "5").filas[0]!.alboomId).toBe("5/9");
    // Repetidos en la misma respuesta: queda uno y suma una duda.
    expect(armarFilas(ent, [{ id: 1, v: 1 }, { id: 1, v: 2 }], null)).toMatchObject({ dudas: 1, filas: [{ alboomId: "1", payload: { id: 1, v: 2 } }] });
  });

  it("la huella no depende del orden de las claves", () => {
    expect(huella({ a: 1, b: { c: [1, 2], d: null } })).toBe(huella({ b: { d: null, c: [1, 2] }, a: 1 }));
    expect(huella({ a: 1 })).not.toBe(huella({ a: 2 }));
    expect(huella({ a: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("extractor", () => {
  it("pagina hasta el final (por `count` y por página corta) y guarda crudo cada registro", async () => {
    const todos = contactos(250);
    const { cliente, pedidos } = clienteFalso((p) => paginar(todos, p));
    const m = almacenEnMemoria();
    const r = await tanda({ cliente, almacen: m.almacen, entidades: [ENT_CONTACTOS] });
    expect(r.resultado).toBe("COMPLETA");
    expect(pedidos.map((p) => (p.body as { pageNumber: number }).pageNumber)).toEqual([1, 2, 3]);
    expect(m.de("contactos")).toHaveLength(250);
    expect(m.de("contactos").find((f) => f.alboomId === "17")!.payload).toEqual({ id: "17", name: "Contacto 17" });
    expect(r.avance.entidades.contactos).toMatchObject({ estado: "LISTA", cantidad: 250, nuevos: 250, paginas: 3 });

    // Con count exacto múltiplo de la página, no pide una página vacía de más.
    const cien = contactos(200);
    const c2 = clienteFalso((p) => paginar(cien, p));
    await tanda({ cliente: c2.cliente, almacen: almacenEnMemoria().almacen, entidades: [ENT_CONTACTOS] });
    expect(c2.pedidos).toHaveLength(2);
  });

  it("con `count`, una página corta NO es el final: sigue hasta el total (Alboom puede limitar el tamaño)", async () => {
    const todos = contactos(130);
    // El servidor devuelve como mucho 50 por página, aunque se pidan 100 (desplazamiento por lo devuelto).
    let entregadas = 0;
    const { cliente, pedidos } = clienteFalso(() => {
      const filas = todos.slice(entregadas, entregadas + 50);
      entregadas += filas.length;
      return { rows: filas, count: 130 };
    });
    const m = almacenEnMemoria();
    const r = await tanda({ cliente, almacen: m.almacen, entidades: [ENT_CONTACTOS] });
    expect(r.resultado).toBe("COMPLETA");
    expect(pedidos).toHaveLength(3);
    expect(m.de("contactos")).toHaveLength(130);
    expect(r.avance.entidades.contactos).toMatchObject({ estado: "LISTA", dudas: 0 });

    // Si se acaba antes del total (página vacía), termina pero deja la duda a la vista.
    const corto = clienteFalso((p) => {
      const b = p.body as { pageNumber: number };
      return { rows: b.pageNumber === 1 ? contactos(40) : [], count: 90 };
    });
    const r2 = await tanda({ cliente: corto.cliente, almacen: almacenEnMemoria().almacen, entidades: [ENT_CONTACTOS] });
    expect(r2.avance.entidades.contactos).toMatchObject({ estado: "LISTA", dudas: 1, ultimoError: "Alboom informó 90 registros y llegaron 40" });
    expect(corto.pedidos).toHaveLength(2);
  });

  it("si Alboom ignora la página y repite la misma, frena con una duda en vez de dar vueltas", async () => {
    const todos = contactos(100);
    const sinCount = clienteFalso(() => ({ rows: todos }));
    const r = await tanda({ cliente: sinCount.cliente, almacen: almacenEnMemoria().almacen, entidades: [ENT_CONTACTOS] });
    expect(sinCount.pedidos).toHaveLength(2);
    expect(r.avance.entidades.contactos).toMatchObject({ estado: "LISTA", dudas: 1 });
    expect(r.avance.entidades.contactos!.ultimoError).toMatch(/misma página/);

    const conCount = clienteFalso(() => ({ rows: todos.slice(0, 50), count: 500 }));
    const r2 = await tanda({ cliente: conCount.cliente, almacen: almacenEnMemoria().almacen, entidades: [ENT_CONTACTOS] });
    expect(conCount.pedidos).toHaveLength(2);
    expect(r2.avance.entidades.contactos).toMatchObject({ estado: "LISTA", dudas: 1 });
  });

  it("un error que no es de Alboom (la base) corta la tanda en vez de dejar la entidad en ERROR", async () => {
    const { cliente } = clienteFalso((p) => paginar(contactos(10), p));
    const m = almacenEnMemoria();
    m.almacen.guardarFilas = async () => {
      throw new Error("conexión cortada");
    };
    const avance = avanceInicial();
    await expect(tanda({ cliente, almacen: m.almacen, entidades: [ENT_CONTACTOS], avance })).rejects.toThrow("conexión cortada");
    expect(avance.entidades.contactos!.estado).not.toBe("ERROR");
  });

  it("se frena por tiempo y la tanda siguiente retoma desde la página guardada, sin repetir", async () => {
    const todos = contactos(450);
    const r0 = reloj();
    const { cliente, pedidos } = clienteFalso((p) => {
      r0.tick();
      return paginar(todos, p);
    });
    const m = almacenEnMemoria();
    const guardados: Avance[] = [];
    const guardar = async (a: Avance) => {
      guardados.push(JSON.parse(JSON.stringify(a)) as Avance);
      return true;
    };
    // Presupuesto para 2 pedidos (1 s cada uno).
    const a = await tanda({ cliente, almacen: m.almacen, entidades: [ENT_CONTACTOS], ahora: r0.ahora, limite: 1500, guardar });
    expect(a.resultado).toBe("PAUSADA");
    expect(pedidos).toHaveLength(2);
    expect(a.avance.entidades.contactos).toMatchObject({ estado: "EN_CURSO", pagina: 3, cantidad: 200 });

    // Lo que retoma la próxima tanda es lo que quedó GUARDADO en la base (pasa por JSON).
    const avanceGuardado = leerAvance(JSON.parse(JSON.stringify(guardados.at(-1))));
    const b = await tanda({ cliente, almacen: m.almacen, entidades: [ENT_CONTACTOS], avance: avanceGuardado });
    expect(b.resultado).toBe("COMPLETA");
    expect(pedidos.map((p) => (p.body as { pageNumber: number }).pageNumber)).toEqual([1, 2, 3, 4, 5]);
    expect(m.de("contactos")).toHaveLength(450);
    expect(b.avance.entidades.contactos).toMatchObject({ estado: "LISTA", cantidad: 450, nuevos: 450, iguales: 0 });
  });

  it("volver a extraer es idempotente: lo igual no cambia, lo modificado se cuenta como cambiado", async () => {
    let todos = contactos(30);
    const { cliente } = clienteFalso((p) => paginar(todos, p));
    const m = almacenEnMemoria();
    await tanda({ cliente, almacen: m.almacen, entidades: [ENT_CONTACTOS] });
    todos = todos.map((c) => (c.id === "3" ? { ...c, name: "Cambiado" } : c));
    todos.push({ id: "31", name: "Nuevo" });
    const r = await tanda({ cliente, almacen: m.almacen, entidades: [ENT_CONTACTOS] });
    expect(r.avance.entidades.contactos).toMatchObject({ cantidad: 31, nuevos: 1, cambiados: 1, iguales: 29 });
    expect(m.de("contactos")).toHaveLength(31);
  });

  it("si la cancelan, frena al guardar el próximo avance", async () => {
    const todos = contactos(500);
    const { cliente, pedidos } = clienteFalso((p) => paginar(todos, p));
    let guardadas = 0;
    const r = await tanda({ cliente, almacen: almacenEnMemoria().almacen, entidades: [ENT_CONTACTOS], guardar: async () => ++guardadas < 2 });
    expect(r.resultado).toBe("CANCELADA");
    expect(pedidos).toHaveLength(2);
  });

  it("401 → CREDENCIAL; 429/5xx → REINTENTAR sin mover el cursor", async () => {
    const login = clienteFalso(() => {
      throw new AlboomLoginError();
    });
    expect((await tanda({ cliente: login.cliente, almacen: almacenEnMemoria().almacen, entidades: [ENT_CONTACTOS] })).resultado).toBe("CREDENCIAL");

    const todos = contactos(300);
    let n = 0;
    const lim = clienteFalso((p) => {
      if (++n === 2) throw new AlboomApiError("Alboom respondió 429", 429, true);
      return paginar(todos, p);
    });
    const m = almacenEnMemoria();
    const r = await tanda({ cliente: lim.cliente, almacen: m.almacen, entidades: [ENT_CONTACTOS] });
    expect(r.resultado).toBe("REINTENTAR");
    expect(r.avance.entidades.contactos).toMatchObject({ pagina: 2, cantidad: 100 });
    const r2 = await tanda({ cliente: lim.cliente, almacen: m.almacen, entidades: [ENT_CONTACTOS], avance: r.avance });
    expect(r2.resultado).toBe("COMPLETA");
    expect(m.de("contactos")).toHaveLength(300);
  });

  it("un 404 o una forma desconocida frenan sólo esa entidad (con duda) y sigue con la próxima", async () => {
    const otra: Entidad = { clave: "tipos_cita", nombre: "Tipos", fuente: { tipo: "simple", pedido: { method: "GET", ruta: "/eventtypes" }, filas: (j) => (Array.isArray(j) ? j : null) } };
    const forma = clienteFalso((p) => (p.ruta === "/eventtypes" ? [{ id: 1 }] : { algo: "raro" }));
    const r = await tanda({ cliente: forma.cliente, almacen: almacenEnMemoria().almacen, entidades: [ENT_CONTACTOS, otra] });
    expect(r.resultado).toBe("COMPLETA");
    expect(r.avance.entidades.contactos).toMatchObject({ estado: "ERROR", dudas: 1, errores: 1 });
    expect(r.avance.entidades.tipos_cita).toMatchObject({ estado: "LISTA", cantidad: 1 });

    const no = clienteFalso((p) => {
      if (p.ruta === "/contacts/paginate") throw new AlboomApiError("Alboom respondió 404 en /contacts/paginate", 404);
      return [{ id: 1 }];
    });
    const r2 = await tanda({ cliente: no.cliente, almacen: almacenEnMemoria().almacen, entidades: [ENT_CONTACTOS, otra] });
    expect(r2.avance.entidades.contactos).toMatchObject({ estado: "ERROR", ultimoError: "Alboom respondió 404 en /contacts/paginate" });
    expect(r2.avance.entidades.tipos_cita!.estado).toBe("LISTA");
  });

  it("hijos por padre: paginan por desplazamiento, filtran y retoman en el padre y el desplazamiento guardados", async () => {
    const padre: Entidad = { clave: "oportunidades", nombre: "Op", fuente: { tipo: "paginada", ruta: "/leads/paginate", body: (p, t) => ({ pageNumber: p, pageSize: t }) } };
    const notas: Entidad = {
      clave: "oportunidades_notas",
      nombre: "Notas",
      fuente: {
        tipo: "porPadre",
        padre: "oportunidades",
        paginaDe: 2,
        filtro: (p) => (p as { abierta: boolean }).abierta,
        pedido: (id, offset) => ({ method: "POST", ruta: "/notes/paginate", body: { type: "leads", id, offset, count: 2 } }),
        filas: (j) => (j as { rows: unknown[] }).rows,
      },
    };
    const leads = [
      { id: "1", abierta: true },
      { id: "2", abierta: false },
      { id: "3", abierta: true },
    ];
    const notasDe: Record<string, unknown[]> = { "1": [{ id: 10 }, { id: 11 }, { id: 12 }], "3": [{ id: 30 }] };
    const r0 = reloj();
    const { cliente, pedidos } = clienteFalso((p) => {
      r0.tick();
      if (p.ruta === "/leads/paginate") return paginar(leads, p);
      const b = p.body as { id: string; offset: number };
      return { rows: (notasDe[b.id] ?? []).slice(b.offset, b.offset + 2) };
    });
    const m = almacenEnMemoria();
    // 2 pedidos: leads + primera página de notas del lead 1.
    const a = await tanda({ cliente, almacen: m.almacen, entidades: [padre, notas], ahora: r0.ahora, limite: 1500 });
    expect(a.resultado).toBe("PAUSADA");
    expect(a.avance.entidades.oportunidades_notas).toMatchObject({ offset: 2 });
    const b = await tanda({ cliente, almacen: m.almacen, entidades: [padre, notas], avance: leerAvance(JSON.parse(JSON.stringify(a.avance))) });
    expect(b.resultado).toBe("COMPLETA");
    expect(m.de("oportunidades_notas").map((f) => f.alboomId).sort()).toEqual(["1/10", "1/11", "1/12", "3/30"]);
    // El lead 2 no cumple el filtro: nunca se pidió.
    expect(pedidos.filter((p) => (p.body as { id?: string }).id === "2")).toHaveLength(0);
    expect(pedidos.filter((p) => p.ruta === "/notes/paginate").map((p) => [(p.body as { id: string }).id, (p.body as { offset: number }).offset])).toEqual([
      ["1", 0],
      ["1", 2],
      ["3", 0],
    ]);
  });

  it("hijos con `count`: siguen aunque la página venga corta, y frenan si se repite", async () => {
    const padre: Entidad = { clave: "oportunidades", nombre: "Op", fuente: { tipo: "paginada", ruta: "/leads/paginate", body: (p, t) => ({ pageNumber: p, pageSize: t }) } };
    const notas: Entidad = {
      clave: "oportunidades_notas",
      nombre: "Notas",
      fuente: {
        tipo: "porPadre",
        padre: "oportunidades",
        paginaDe: 50,
        pedido: (id, offset) => ({ method: "POST", ruta: "/notes/paginate", body: { type: "leads", id, offset, count: 50 } }),
        filas: (j) => (j as { rows: unknown[] }).rows,
      },
    };
    const notasDe = Array.from({ length: 45 }, (_, i) => ({ id: 100 + i }));
    const { cliente, pedidos } = clienteFalso((p) => {
      if (p.ruta === "/leads/paginate") return paginar([{ id: "1" }, { id: "2" }], p);
      const b = p.body as { id: string; offset: number };
      // Lead 1: de a 20 con total 45. Lead 2: repite siempre la misma página con un total enorme.
      if (b.id === "1") return { rows: notasDe.slice(b.offset, b.offset + 20), count: 45 };
      return { rows: [{ id: 900 }], count: 1000 };
    });
    const m = almacenEnMemoria();
    const r = await tanda({ cliente, almacen: m.almacen, entidades: [padre, notas] });
    expect(r.resultado).toBe("COMPLETA");
    expect(m.de("oportunidades_notas").filter((f) => f.alboomId.startsWith("1/"))).toHaveLength(45);
    expect(pedidos.filter((p) => (p.body as { id?: string }).id === "1").map((p) => (p.body as { offset: number }).offset)).toEqual([0, 20, 40]);
    expect(pedidos.filter((p) => (p.body as { id?: string }).id === "2")).toHaveLength(2);
    expect(r.avance.entidades.oportunidades_notas).toMatchObject({ estado: "LISTA", dudas: 1 });
  });

  it("un 5xx que se repite en el mismo hijo varias tandas se saltea como error; un 429 nunca", async () => {
    const padre: Entidad = { clave: "pedidos", nombre: "P", fuente: { tipo: "paginada", ruta: "/orders/paginate", body: (p, t) => ({ pageNumber: p, pageSize: t }) } };
    const det: Entidad = { clave: "pedidos_detalle", nombre: "D", fuente: { tipo: "porPadre", padre: "pedidos", mismoId: true, pedido: (id) => ({ method: "GET", ruta: `/orders?id=${id}` }), filas: (j) => [j] } };
    const status = { valor: 500 };
    const { cliente } = clienteFalso((p) => {
      if (p.ruta === "/orders/paginate") return paginar([{ id: "1" }, { id: "2" }], p);
      if (p.ruta === "/orders?id=1") throw new AlboomApiError("Alboom respondió 5xx", status.valor, true);
      return { id: "2", total: 10 };
    });
    const m = almacenEnMemoria();
    let r = await tanda({ cliente, almacen: m.almacen, entidades: [padre, det] });
    expect(r.resultado).toBe("REINTENTAR");
    status.valor = 429;
    r.avance.reintentos = REINTENTOS_PARA_SALTEAR;
    expect((await tanda({ cliente, almacen: m.almacen, entidades: [padre, det], avance: r.avance })).resultado).toBe("REINTENTAR");
    status.valor = 503;
    r.avance.reintentos = REINTENTOS_PARA_SALTEAR;
    r = await tanda({ cliente, almacen: m.almacen, entidades: [padre, det], avance: r.avance });
    expect(r.resultado).toBe("COMPLETA");
    expect(r.avance.entidades.pedidos_detalle).toMatchObject({ estado: "LISTA", errores: 1, cantidad: 1 });
    expect(m.de("pedidos_detalle").map((f) => f.alboomId)).toEqual(["2"]);
  });

  it("por desplazamiento: frena con una página vacía o si Alboom repite la misma página", async () => {
    const ent: Entidad = { clave: "tareas", nombre: "Tareas", fuente: { tipo: "porDesplazamiento", ruta: (o) => `/tasks?offset=${o}&filteruser=all` } };
    const tareas = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));
    const ok = clienteFalso((p) => {
      const offset = Number(/offset=(\d+)/.exec(p.ruta)![1]);
      return tareas.slice(offset, offset + 10);
    });
    const m = almacenEnMemoria();
    expect((await tanda({ cliente: ok.cliente, almacen: m.almacen, entidades: [ent] })).resultado).toBe("COMPLETA");
    expect(m.de("tareas")).toHaveLength(25);
    expect(ok.pedidos.map((p) => p.ruta)).toEqual(["/tasks?offset=0&filteruser=all", "/tasks?offset=10&filteruser=all", "/tasks?offset=20&filteruser=all", "/tasks?offset=25&filteruser=all"]);

    const terca = clienteFalso(() => tareas.slice(0, 10));
    const r = await tanda({ cliente: terca.cliente, almacen: almacenEnMemoria().almacen, entidades: [ent] });
    expect(r.resultado).toBe("COMPLETA");
    expect(terca.pedidos).toHaveLength(2);
    expect(r.avance.entidades.tareas).toMatchObject({ estado: "LISTA", dudas: 1 });
  });

  it("una entidad sin endpoint queda NO_DISPONIBLE sin pedir nada", async () => {
    const ent: Entidad = { clave: "facturas", nombre: "Facturas", fuente: { tipo: "noDisponible", motivo: "Alboom no documenta un listado de lectura." } };
    const { cliente, pedidos } = clienteFalso(() => []);
    const r = await tanda({ cliente, almacen: almacenEnMemoria().almacen, entidades: [ent] });
    expect(r.resultado).toBe("COMPLETA");
    expect(r.avance.entidades.facturas).toMatchObject({ estado: "NO_DISPONIBLE", ultimoError: "Alboom no documenta un listado de lectura." });
    expect(pedidos).toHaveLength(0);
  });
});

/** Un Alboom falso que responde a todos los endpoints del catálogo real con la forma documentada. */
function alboomCompleto() {
  const leads = [{ id: "101", name: "Boda" }, { id: "102", name: "XV" }];
  const pedidos = [{ id: "201" }];
  const productos = [{ id: "1", pack: "1" }, { id: "2", pack: "0" }];
  return (p: PedidoLectura): unknown => {
    const r = p.ruta;
    const pag = (filas: unknown[]) => paginar(filas, p);
    if (r === "/settings/") return { lead_origin: "Instagram\nRecomendado\n", MailTemplates: { followup: { subject: "Hola", body: "..." } }, company: "Estudio" };
    if (r.startsWith("/settings/custom_")) return [{ id: 1, subject: "Plantilla" }];
    if (r.startsWith("/stages/list?type=order_stage")) return { stage_list: [{ id: "9", name: "Pedidos Simple" }], stages: { "9": [{ id: "91", stage: "1" }] } };
    if (r.startsWith("/stages/list")) return { stage_list: [{ id: "5", name: "Embudo" }], stages: { "5": [{ id: "51", stage: "1", name: "Recepción" }, { id: "52", stage: "2", name: "Contrato" }] } };
    if (r.startsWith("/categories")) return [{ id: 1, name: "Una" }];
    if (r.startsWith("/tags")) return [{ tag: "vip" }];
    if (r === "/eventtypes") return [{ id: 3, name: "Sesión" }];
    if (r.startsWith("/accounts")) return [{ id: r.slice(-1) === "R" ? "3.1" : "4.1", name: "Cuenta" }];
    if (r === "/products/all") return productos;
    if (r.startsWith("/products/pack/")) return [{ product_id: "2", qty: 1 }];
    if (r.startsWith("/products/costs/")) return [{ id: `c${r.split("/").pop()}`, cost: "10" }];
    if (r === "/agreement_templates") return [{ id: 1, name: "CONTRATO EVENTOS 2024" }];
    if (r === "/leads/paginate") return pag(leads);
    if (r.startsWith("/leads/progress/")) return [{ created: "2026-01-01", stage_id: "1" }];
    if (r === "/notes/paginate" || r === "/activities/paginate") return { rows: [{ id: `${r.length}${(p.body as { id: string }).id}`, text: "x" }] };
    if (r.startsWith("/mails/leads/")) return { rows: [] };
    if (r === "/quotes/paginate") return pag([{ id: "301" }]);
    if (r.startsWith("/quotes?id=")) return { id: "301", quote_items: [] };
    if (r === "/orders/paginate") return pag(pedidos);
    if (r.startsWith("/orders?id=")) return { id: "201", order_payments: [{ id: "7001", value: "100" }, { id: "7002", value: "200" }] };
    if (r.startsWith("/orders/items")) return [{ id: "8001", name: "Cobertura" }];
    if (r.startsWith("/costs/orders/")) return [];
    if (r === "/agreements/paginate") return pag([{ id: "401" }]);
    if (r.startsWith("/agreements/")) return { id: "401", text: "<p>contrato</p>" };
    if (r === "/projects/paginate") return pag([{ id: "501" }]);
    if (r.startsWith("/projects/progress/")) return [{ created: "2026-01-02", stage_id: "2" }];
    if (r === "/participants/paginate") return { rows: [{ id: "601", contact_id: "1" }] };
    if (r.startsWith("/tasks?offset=0")) return [{ id: "701" }];
    if (r.startsWith("/tasks?")) return [];
    if (r.endsWith("/paginate") || r.endsWith("/paginate_apr")) return pag([{ id: `${r.length}` }]);
    throw new AlboomApiError(`404 ${r}`, 404);
  };
}

describe("el catálogo real contra un Alboom falso", () => {
  it("extrae todas las entidades en orden, sin errores ni pedidos fuera de la lista blanca", async () => {
    const { cliente, pedidos } = clienteFalso(alboomCompleto());
    const m = almacenEnMemoria();
    const r = await tanda({ cliente, almacen: m.almacen });
    expect(r.resultado).toBe("COMPLETA");
    const conError = Object.entries(r.avance.entidades).filter(([, e]) => e.estado !== "LISTA");
    expect(conError).toEqual([]);
    expect(Object.keys(r.avance.entidades)).toEqual(ENTIDADES.map((e) => e.clave));
    expect(m.de("origenes").map((f) => f.alboomId).sort()).toEqual(["settings/Instagram", "settings/Recomendado"]);
    expect(m.de("plantillas_sistema").map((f) => f.alboomId)).toEqual(["settings/followup"]);
    expect(m.de("etapas_embudo").map((f) => f.alboomId).sort()).toEqual(["51", "52"]);
    expect(m.de("categorias").map((f) => f.alboomId)).toContain("contact/1");
    expect(m.de("combos").map((f) => f.alboomId)).toHaveLength(1);
    expect(m.de("combos")[0]!.alboomId.startsWith("1/")).toBe(true);
    expect(m.de("pedidos_detalle").map((f) => f.alboomId)).toEqual(["201"]);
    expect(m.de("pedidos_plan_pagos").map((f) => f.alboomId).sort()).toEqual(["201/7001", "201/7002"]);
    expect(m.de("oportunidades_historial")).toHaveLength(2);
    expect(r.avance.entidades.oportunidades_historial!.dudas).toBe(0);
    expect(m.de("configuracion").map((f) => f.alboomId)).toEqual(["settings"]);
    expect(pedidos.length).toBe(r.avance.pedidos);

    // Volver a extraer: nada nuevo ni cambiado.
    const r2 = await tanda({ cliente, almacen: m.almacen });
    const sumas = Object.values(r2.avance.entidades).reduce((s, e) => ({ n: s.n + e.nuevos, c: s.c + e.cambiados }), { n: 0, c: 0 });
    expect(sumas).toEqual({ n: 0, c: 0 });
  });
});
