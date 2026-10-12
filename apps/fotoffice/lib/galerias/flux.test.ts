import { beforeEach, describe, expect, it, vi } from "vitest";

type Fila = Record<string, unknown>;

const H = vi.hoisted(() => ({
  dispositivos: [] as Record<string, unknown>[],
  proyectos: [] as Record<string, unknown>[],
  pedidos: [] as Record<string, unknown>[],
  galerias: [] as Record<string, unknown>[],
  fotos: [] as Record<string, unknown>[],
  eventos: [] as Record<string, unknown>[],
  modulo: { encendido: true },
  seq: 0,
  tamano: vi.fn(), leer: vi.fn(), guardar: vi.fn(), borrar: vi.fn(), subida: vi.fn(), variantes: vi.fn(),
}));

function cumple(f: Fila, where: Fila): boolean {
  return Object.entries(where).every(([k, c]) => {
    if (k === "NOT") return !cumple(f, c as Fila);
    if (k === "OR") return (c as Fila[]).some((w) => cumple(f, w));
    if (k === "galeria") return true;
    if (k === "pedido") {
      const p = H.pedidos.find((x) => x.id === f.pedidoId);
      return !!p && cumple(p, c as Fila);
    }
    const v = f[k];
    if (c === null) return v === null || v === undefined;
    if (c instanceof Date) return v === c;
    if (c && typeof c === "object") {
      const o = c as { in?: unknown[]; lt?: Date; gte?: number; contains?: string; mode?: string };
      if (o.in) return o.in.includes(v);
      if (o.contains !== undefined) return String(v).toLowerCase().includes(o.contains.toLowerCase());
      if (o.lt !== undefined) return v instanceof Date && v.getTime() < o.lt.getTime();
      if (o.gte !== undefined) return (v as number) >= o.gte;
    }
    return v === c;
  });
}
const filtrar = (arr: Fila[], where: Fila = {}) => arr.filter((f) => cumple(f, where));
const aplicar = (f: Fila, data: Fila) => {
  for (const [k, v] of Object.entries(data)) f[k] = v && typeof v === "object" && "increment" in (v as object) ? (f[k] as number) + (v as { increment: number }).increment : v;
};

vi.mock("server-only", () => ({}));
vi.mock("./almacen", () => ({
  tamanoDeObjeto: H.tamano, leerObjeto: H.leer, guardarObjeto: H.guardar, borrarObjetoFoto: H.borrar, urlDeSubidaFoto: H.subida,
}));
vi.mock("./procesar", async () => {
  class FotoNoProcesable extends Error {
    constructor(m: string, readonly definitivo: boolean) { super(m); }
  }
  return { FotoNoProcesable, generarVariantes: H.variantes };
});
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: async () => H.modulo.encendido }));
vi.mock("@/lib/numeracion/asignar", () => ({ asignarNumero: async () => ({ display: `GAL-${++H.seq}` }) }));
vi.mock("@repo/db", () => {
  const nuevo = (arr: Fila[], data: Fila) => {
    const fila = { id: `id${++H.seq}`, createdAt: new Date(Date.now() + H.seq), attempts: 0, errorReason: null, ...data };
    arr.push(fila);
    return fila;
  };
  const prisma = {
    fotofficeDispositivo: {
      findUnique: async ({ where }: { where: Fila }) => H.dispositivos.find((d) => d.keyHash === where.keyHash) ?? null,
      updateMany: async ({ where, data }: { where: Fila; data: Fila }) => {
        const m = filtrar(H.dispositivos, where);
        m.forEach((d) => aplicar(d, data));
        return { count: m.length };
      },
      count: async ({ where }: { where: Fila }) => filtrar(H.dispositivos, where).length,
      create: async ({ data }: { data: Fila }) => nuevo(H.dispositivos, data),
      findMany: async ({ where }: { where: Fila }) => filtrar(H.dispositivos, where).map((d) => ({ ...d, name: d.name, keyPrefix: d.keyPrefix })),
    },
    fotofficeProyecto: {
      findMany: async ({ where, take }: { where: Fila; take?: number }) =>
        filtrar(H.proyectos, where).slice(0, take ?? Infinity).map((p) => ({ ...p, client: { firstName: "Ana", lastName: "Pérez", businessName: null } })),
      findFirst: async ({ where }: { where: Fila }) => filtrar(H.proyectos, where)[0] ?? null,
    },
    fotofficeGaleria: {
      findFirst: async ({ where }: { where: Fila }) => filtrar(H.galerias, where)[0] ?? null,
      create: async ({ data }: { data: Fila }) => nuevo(H.galerias, data),
    },
    fotofficeGaleriaEvento: { create: async ({ data }: { data: Fila }) => nuevo(H.eventos, data) },
    fotofficeGaleriaFoto: {
      findFirst: async ({ where }: { where: Fila }) => filtrar(H.fotos, where)[0] ?? null,
      findMany: async ({ where }: { where: Fila }) => filtrar(H.fotos, where),
      count: async ({ where }: { where: Fila }) => filtrar(H.fotos, where).length,
      aggregate: async ({ where }: { where: Fila }) => {
        const o = filtrar(H.fotos, where).map((f) => f.order as number);
        return { _max: { order: o.length ? Math.max(...o) : null } };
      },
      create: async ({ data }: { data: Fila }) => { const d = { ...data }; const f = { createdAt: new Date(Date.now() + ++H.seq), attempts: 0, errorReason: null, ...d }; H.fotos.push(f); return f; },
      updateMany: async ({ where, data }: { where: Fila; data: Fila }) => {
        const m = filtrar(H.fotos, where);
        m.forEach((f) => aplicar(f, data));
        return { count: m.length };
      },
      deleteMany: async ({ where }: { where: Fila }) => {
        const m = filtrar(H.fotos, where);
        H.fotos = H.fotos.filter((f) => !m.includes(f));
        return { count: m.length };
      },
      groupBy: async ({ where }: { where: Fila }) => {
        const c = new Map<string, number>();
        for (const f of filtrar(H.fotos, where)) c.set(f.status as string, (c.get(f.status as string) ?? 0) + 1);
        return [...c].map(([status, n]) => ({ status, _count: { _all: n } }));
      },
    },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(prisma),
  };
  return { prisma };
});

import { resetRateLimit } from "@/lib/geocode/rate-limit";
import { generarClaveDispositivo } from "./dispositivos";
import { GET as getProyectos } from "@/app/api/flux/v1/proyectos/route";
import { POST as postGalerias } from "@/app/api/flux/v1/galerias/route";
import { GET as getGaleria } from "@/app/api/flux/v1/galerias/[id]/route";
import { POST as postArchivos } from "@/app/api/flux/v1/galerias/[id]/archivos/route";
import { POST as postConfirmar } from "@/app/api/flux/v1/galerias/[id]/archivos/[fotoId]/confirmar/route";

const WS = "ws1";
const URL_BASE = "https://fotoffice.test/api/flux/v1";
let clave: string;
let dispositivoId: string;

function sembrarDispositivo(workspaceId = WS, anulado = false) {
  const k = generarClaveDispositivo();
  const d = { id: `dev${++H.seq}`, workspaceId, name: "Mac", keyHash: k.hash, keyPrefix: k.prefijo, lastUsedAt: null, revokedAt: anulado ? new Date() : null };
  H.dispositivos.push(d);
  return { clave: k.clave, id: d.id as string };
}
const req = (path: string, init: { method?: string; body?: unknown; clave?: string | null } = {}) =>
  new Request(`${URL_BASE}${path}`, {
    method: init.method ?? "GET",
    headers: { ...(init.clave === null ? {} : { authorization: `Bearer ${init.clave ?? clave}` }), "content-type": "application/json" },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
const ctxId = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  H.dispositivos = []; H.proyectos = []; H.pedidos = []; H.galerias = []; H.fotos = []; H.eventos = [];
  H.modulo.encendido = true;
  for (const f of [H.tamano, H.leer, H.guardar, H.borrar, H.subida, H.variantes]) f.mockReset();
  H.subida.mockImplementation(async (k: string) => `https://r2.test/put/${k}`);
  H.borrar.mockResolvedValue(undefined);
  resetRateLimit();
  const d = sembrarDispositivo();
  clave = d.clave; dispositivoId = d.id;
  H.pedidos.push({ id: "ped1", workspaceId: WS, number: "2026-0001" }, { id: "pedOtro", workspaceId: "ws2", number: "2025093" });
  H.proyectos.push(
    { id: "p1", workspaceId: WS, name: "Boda Ana y Luis", pedidoId: "ped1", externalId: "2025093", eventDate: new Date("2026-03-14"), baseDate: new Date("2026-03-01"), product: { name: "Fotografía de boda" }, circuit: { name: "Bodas" } },
    { id: "p2", workspaceId: WS, name: "Álbum de boda", pedidoId: "ped1", externalId: null, eventDate: null, baseDate: new Date("2026-04-01"), product: null, circuit: { name: "Fotolibros" } },
    { id: "pAjeno", workspaceId: "ws2", name: "Ajeno", pedidoId: "pedOtro", externalId: "2025093", eventDate: null, baseDate: new Date("2026-01-01"), product: null, circuit: { name: "X" } },
  );
});

async function crearGaleria(proyectoId = "p1") {
  const r = await postGalerias(req("/galerias", { method: "POST", body: { proyectoId } }));
  return ((await r.json()) as { galeria: { id: string } }).galeria.id;
}

describe("autenticación, módulo y freno", () => {
  it("sin clave, con clave equivocada o con formato raro: 401", async () => {
    for (const c of [null, "fo_dev_" + "x".repeat(43), "cualquiera"]) {
      const r = await getProyectos(req("/proyectos?pedido=1", { clave: c }));
      expect(r.status).toBe(401);
      expect(await r.json()).toEqual({ error: "Clave inválida o anulada" });
    }
  });
  it("clave anulada: 401", async () => {
    const d = sembrarDispositivo(WS, true);
    expect((await getProyectos(req("/proyectos?pedido=1", { clave: d.clave }))).status).toBe(401);
  });
  it("la clave de otro workspace no ve los proyectos de este", async () => {
    const otro = sembrarDispositivo("ws2");
    const r = await getProyectos(req("/proyectos?pedido=2026-0001", { clave: otro.clave }));
    expect((await r.json())).toEqual({ proyectos: [] });
    const g = await postGalerias(req("/galerias", { method: "POST", body: { proyectoId: "p1" }, clave: otro.clave }));
    expect(g.status).toBe(404);
  });
  it("módulo apagado: 403 con mensaje", async () => {
    H.modulo.encendido = false;
    const r = await getProyectos(req("/proyectos?pedido=1"));
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: "El módulo Galería no está encendido" });
  });
  it("actualiza lastUsedAt una vez y no antes de 5 minutos", async () => {
    await getProyectos(req("/proyectos?pedido=0"));
    await new Promise((r) => setTimeout(r, 5));
    const primero = H.dispositivos.find((d) => d.id === dispositivoId)!.lastUsedAt as Date;
    expect(primero).toBeInstanceOf(Date);
    await getProyectos(req("/proyectos?pedido=0"));
    await new Promise((r) => setTimeout(r, 5));
    expect(H.dispositivos.find((d) => d.id === dispositivoId)!.lastUsedAt).toBe(primero);
  });
  it("freno: el pedido 121 en un minuto da 429 con Retry-After", async () => {
    for (let i = 0; i < 120; i++) expect((await getProyectos(req("/proyectos?pedido=0"))).status).toBe(200);
    const r = await getProyectos(req("/proyectos?pedido=0"));
    expect(r.status).toBe(429);
    expect(Number(r.headers.get("retry-after"))).toBeGreaterThanOrEqual(1);
    // Otro dispositivo no se ve afectado.
    const otro = sembrarDispositivo();
    expect((await getProyectos(req("/proyectos?pedido=0", { clave: otro.clave }))).status).toBe(200);
  });
});

describe("GET proyectos", () => {
  it("por número de pedido de FOTOFFICE, con la forma del contrato", async () => {
    const r = await getProyectos(req("/proyectos?pedido=2026-0001"));
    expect(r.status).toBe(200);
    const cuerpo = (await r.json()) as { proyectos: Record<string, unknown>[] };
    expect(Object.keys(cuerpo)).toEqual(["proyectos"]);
    expect(cuerpo.proyectos).toHaveLength(2);
    for (const p of cuerpo.proyectos) expect(Object.keys(p).sort()).toEqual(["cliente", "fecha", "id", "nombre", "tipo"]);
    expect(cuerpo.proyectos[0]).toEqual({ id: "p1", nombre: "Boda Ana y Luis", cliente: "Ana Pérez", fecha: "2026-03-14", tipo: "Fotografía de boda" });
    // Sin producto: el nombre del circuito.
    expect(cuerpo.proyectos[1].tipo).toBe("Fotolibros");
    expect(cuerpo.proyectos[1].fecha).toBe("2026-04-01");
  });
  it("si el número no es de un pedido, busca por código externo (el del CRM) y sólo en este workspace", async () => {
    const cuerpo = (await (await getProyectos(req("/proyectos?pedido=2025093"))).json()) as { proyectos: { id: string }[] };
    expect(cuerpo.proyectos.map((p) => p.id)).toEqual(["p1"]);
  });
  it("si tampoco, busca el número dentro del nombre (4+ caracteres)", async () => {
    H.proyectos.push({ id: "p3", workspaceId: WS, name: "Pedido 2025777 - Quinceañera", pedidoId: null, externalId: null, eventDate: null, baseDate: new Date("2026-05-01"), product: null, circuit: { name: "Fotos" } });
    expect(((await (await getProyectos(req("/proyectos?pedido=2025777"))).json()) as { proyectos: { id: string }[] }).proyectos.map((p) => p.id)).toEqual(["p3"]);
    expect(((await (await getProyectos(req("/proyectos?pedido=777"))).json()) as { proyectos: unknown[] }).proyectos).toEqual([]);
  });
  it("pedido=0, vacío, ausente o sin coincidencias: lista vacía", async () => {
    for (const q of ["?pedido=0", "?pedido=", "", "?pedido=9999999"]) {
      const r = await getProyectos(req(`/proyectos${q}`));
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({ proyectos: [] });
    }
  });
});

describe("POST galerias", () => {
  it("crea una galería de entrega en borrador, sin usuario, y devuelve el enlace absoluto", async () => {
    const r = await postGalerias(req("/galerias", { method: "POST", body: { proyectoId: "p1", nombre: "Entrega boda" } }));
    expect(r.status).toBe(200);
    const cuerpo = (await r.json()) as { galeria: { id: string; enlaceEstudio: string } };
    expect(Object.keys(cuerpo)).toEqual(["galeria"]);
    expect(Object.keys(cuerpo.galeria).sort()).toEqual(["enlaceEstudio", "id"]);
    expect(cuerpo.galeria.enlaceEstudio).toMatch(/^https?:\/\/[^/]+\/galerias\/./);
    expect(cuerpo.galeria.enlaceEstudio.endsWith(`/galerias/${cuerpo.galeria.id}`)).toBe(true);
    const g = H.galerias[0];
    expect(g).toMatchObject({ kind: "ENTREGA", status: "BORRADOR", name: "Entrega boda", workspaceId: WS, proyectoId: "p1", createdByUserId: null });
    expect(H.eventos[0]).toMatchObject({ type: "GALERIA_CREADA", actorUserId: null, data: { tipo: "ENTREGA", dispositivoId } });
  });
  it("es idempotente: la segunda vez devuelve la misma y usa el nombre del proyecto si no hay nombre", async () => {
    const a = await crearGaleria();
    const b = await crearGaleria();
    expect(b).toBe(a);
    expect(H.galerias).toHaveLength(1);
    expect(H.galerias[0].name).toBe("Boda Ana y Luis");
  });
  it("una galería archivada no cuenta: se crea otra", async () => {
    const a = await crearGaleria();
    H.galerias[0].status = "ARCHIVADA";
    expect(await crearGaleria()).not.toBe(a);
  });
  it("proyecto ajeno o inexistente 404; datos inválidos 400", async () => {
    expect((await postGalerias(req("/galerias", { method: "POST", body: { proyectoId: "pAjeno" } }))).status).toBe(404);
    expect((await postGalerias(req("/galerias", { method: "POST", body: { proyectoId: 5 } }))).status).toBe(400);
    expect((await postGalerias(req("/galerias", { method: "POST", body: {} }))).status).toBe(400);
  });
});

describe("POST archivos", () => {
  const foto = (nombre: string, tamano = 1000, tipo = "image/jpeg") => ({ nombre, tipo, tamano });
  const pedir = (id: string, archivos: unknown) => postArchivos(req(`/galerias/${id}/archivos`, { method: "POST", body: { archivos } }), ctxId(id));

  it("devuelve un ítem por archivo en el mismo orden, con la forma del contrato", async () => {
    const id = await crearGaleria();
    const r = await pedir(id, [foto("b.jpg"), foto("a.jpg"), { nombre: "v.mp4", tipo: "video/mp4", tamano: 2_000_000_000 }]);
    expect(r.status).toBe(200);
    const cuerpo = (await r.json()) as { archivos: Record<string, unknown>[] };
    expect(Object.keys(cuerpo)).toEqual(["archivos"]);
    expect(cuerpo.archivos).toHaveLength(3);
    for (const a of cuerpo.archivos) expect(Object.keys(a).sort()).toEqual(["fotoId", "urlSubida"]);
    expect(H.fotos.map((f) => f.fileName)).toEqual(["b.jpg", "a.jpg", "v.mp4"]);
    expect(cuerpo.archivos.map((a) => a.fotoId)).toEqual(H.fotos.map((f) => f.id));
    expect(H.fotos[2]).toMatchObject({ mediaType: "VIDEO", contentType: "video/mp4", uploadedByUserId: null, status: "PENDIENTE" });
    expect(H.eventos.some((e) => e.type === "ARCHIVOS_PEDIDOS_DISPOSITIVO" && (e.data as { dispositivoId: string }).dispositivoId === dispositivoId)).toBe(true);
  });
  it("yaEstaba para los LISTA; URL nueva para la misma fila PENDIENTE o con ERROR reintentable; no duplica", async () => {
    const id = await crearGaleria();
    const primero = ((await (await pedir(id, [foto("a.jpg"), foto("b.jpg"), foto("c.jpg")])).json()) as { archivos: { fotoId: string }[] }).archivos;
    H.fotos[0].status = "LISTA";
    H.fotos[2].status = "ERROR"; H.fotos[2].attempts = 1;
    H.subida.mockClear();
    const r = ((await (await pedir(id, [foto("a.jpg"), foto("b.jpg"), foto("c.jpg"), foto("d.jpg")])).json()) as { archivos: Record<string, unknown>[] }).archivos;
    expect(r[0]).toEqual({ yaEstaba: true });
    expect(r[1]).toMatchObject({ fotoId: primero[1].fotoId });
    expect(r[2]).toMatchObject({ fotoId: primero[2].fotoId });
    expect(Object.keys(r[3]).sort()).toEqual(["fotoId", "urlSubida"]);
    expect(H.fotos).toHaveLength(4);
    expect(H.subida).toHaveBeenCalledTimes(3);
  });
  it("ERROR definitivo: se descarta la fila vieja y se crea una nueva", async () => {
    const id = await crearGaleria();
    const primero = ((await (await pedir(id, [foto("a.jpg")])).json()) as { archivos: { fotoId: string }[] }).archivos;
    H.fotos[0].status = "ERROR"; H.fotos[0].attempts = 3;
    const r = ((await (await pedir(id, [foto("a.jpg")])).json()) as { archivos: { fotoId: string }[] }).archivos;
    expect(r[0].fotoId).not.toBe(primero[0].fotoId);
    expect(H.fotos).toHaveLength(1);
  });
  it("el mismo nombre dos veces en el lote no duplica", async () => {
    const id = await crearGaleria();
    const r = ((await (await pedir(id, [foto("a.jpg"), foto("a.jpg")])).json()) as { archivos: { fotoId: string }[] }).archivos;
    expect(r[0].fotoId).toBe(r[1].fotoId);
    expect(H.fotos).toHaveLength(1);
  });
  it("valida todo antes de crear: más de 50, vacío, tipo, tamaño y nombre", async () => {
    const id = await crearGaleria();
    const casos: unknown[] = [
      Array.from({ length: 51 }, (_, i) => foto(`${i}.jpg`)),
      [],
      [foto("a.jpg"), foto("x.gif", 10, "image/gif")],
      [foto("a.jpg", 52_428_801)],
      [foto("a.jpg", 0)],
      [{ nombre: "", tipo: "image/jpeg", tamano: 10 }],
      [{ nombre: "v.mp4", tipo: "video/mp4", tamano: 5_000_000_001 }],
      "no es lista",
    ];
    for (const c of casos) expect((await pedir(id, c)).status).toBe(400);
    expect(H.fotos).toHaveLength(0);
  });
  it("hasta 50 está bien", async () => {
    const id = await crearGaleria();
    const r = await pedir(id, Array.from({ length: 50 }, (_, i) => foto(`${i}.jpg`)));
    expect(r.status).toBe(200);
    expect(H.fotos).toHaveLength(50);
  });
  it("tope de videos por galería (200): 409 sin duplicar", async () => {
    const id = await crearGaleria();
    for (let i = 0; i < 200; i++) H.fotos.push({ id: `v${i}`, workspaceId: WS, galeriaId: id, fileName: `v${i}.mp4`, status: "LISTA", attempts: 0, mediaType: "VIDEO", order: i, originalKey: `k${i}` });
    const r = await pedir(id, [{ nombre: "otro.mp4", tipo: "video/mp4", tamano: 100 }]);
    expect(r.status).toBe(409);
    expect(((await r.json()) as { error: string }).error).toMatch(/200 videos/);
  });
  it("tope de fotos por galería (3.000): 409", async () => {
    const id = await crearGaleria();
    for (let i = 0; i < 3000; i++) H.fotos.push({ id: `f${i}`, workspaceId: WS, galeriaId: id, fileName: `f${i}.jpg`, status: "LISTA", attempts: 0, mediaType: "FOTO", order: i, originalKey: `k${i}` });
    expect((await pedir(id, [foto("nueva.jpg")])).status).toBe(409);
  });
  it("galería ajena, de selección o archivada", async () => {
    const id = await crearGaleria();
    const otro = sembrarDispositivo("ws2");
    expect((await postArchivos(req(`/galerias/${id}/archivos`, { method: "POST", body: { archivos: [foto("a.jpg")] }, clave: otro.clave }), ctxId(id))).status).toBe(404);
    H.galerias[0].kind = "SELECCION";
    expect((await pedir(id, [foto("a.jpg")])).status).toBe(404);
    H.galerias[0].kind = "ENTREGA"; H.galerias[0].status = "ARCHIVADA";
    expect((await pedir(id, [foto("a.jpg")])).status).toBe(409);
  });
  it("si falla la firma: 503 (se reintenta)", async () => {
    const id = await crearGaleria();
    H.subida.mockRejectedValueOnce(new Error("r2"));
    expect((await pedir(id, [foto("a.jpg")])).status).toBe(503);
  });
});

describe("confirmar y estado", () => {
  const confirmar = (id: string, fotoId: string) => postConfirmar(req(`/galerias/${id}/archivos/${fotoId}/confirmar`, { method: "POST", body: {} }), { params: Promise.resolve({ id, fotoId }) });
  async function sembrar(archivo: { nombre: string; tipo: string; tamano: number }) {
    const id = await crearGaleria();
    const r = (await (await postArchivos(req(`/galerias/${id}/archivos`, { method: "POST", body: { archivos: [archivo] } }), ctxId(id))).json()) as { archivos: { fotoId: string }[] };
    return { id, fotoId: r.archivos[0].fotoId };
  }

  it("foto: la procesa y queda LISTA; repetir es idempotente", async () => {
    const { id, fotoId } = await sembrar({ nombre: "a.jpg", tipo: "image/jpeg", tamano: 1000 });
    H.tamano.mockResolvedValue(1000);
    H.leer.mockResolvedValue(Buffer.from("x"));
    H.variantes.mockResolvedValue({ vista: Buffer.from("v"), mini: Buffer.from("m"), width: 100, height: 50 });
    const r = await confirmar(id, fotoId);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, estado: "LISTA" });
    expect(H.fotos[0]).toMatchObject({ status: "LISTA", width: 100, height: 50 });
    expect((await confirmar(id, fotoId)).status).toBe(200);
  });
  it("video: sólo comprueba el tamaño, sin leer ni procesar", async () => {
    const { id, fotoId } = await sembrar({ nombre: "v.mp4", tipo: "video/mp4", tamano: 3_000_000_000 });
    H.tamano.mockResolvedValue(3_000_000_000);
    const r = await confirmar(id, fotoId);
    expect(await r.json()).toEqual({ ok: true, estado: "LISTA" });
    expect(H.leer).not.toHaveBeenCalled();
    expect(H.variantes).not.toHaveBeenCalled();
    expect(H.fotos[0]).toMatchObject({ status: "LISTA", viewKey: null, thumbKey: null });
  });
  it("video con otro tamaño: 422 en ERROR", async () => {
    const { id, fotoId } = await sembrar({ nombre: "v.mp4", tipo: "video/mp4", tamano: 3000 });
    H.tamano.mockResolvedValue(2999);
    const r = await confirmar(id, fotoId);
    expect(r.status).toBe(422);
    expect(((await r.json()) as { estado: string }).estado).toBe("ERROR");
  });
  it("subida que no llegó: 409 PENDIENTE", async () => {
    const { id, fotoId } = await sembrar({ nombre: "a.jpg", tipo: "image/jpeg", tamano: 10 });
    H.tamano.mockResolvedValue(null);
    const r = await confirmar(id, fotoId);
    expect(r.status).toBe(409);
    expect(((await r.json()) as { estado: string }).estado).toBe("PENDIENTE");
  });
  it("foto inexistente, de otra galería o de otro workspace: 404", async () => {
    const { id, fotoId } = await sembrar({ nombre: "a.jpg", tipo: "image/jpeg", tamano: 10 });
    expect((await confirmar(id, "noexiste")).status).toBe(404);
    const otro = sembrarDispositivo("ws2");
    const r = await postConfirmar(req(`/x`, { method: "POST", body: {}, clave: otro.clave }), { params: Promise.resolve({ id, fotoId }) });
    expect(r.status).toBe(404);
  });
  it("estado: conteos por estado con la forma del contrato", async () => {
    const id = await crearGaleria();
    await postArchivos(req(`/galerias/${id}/archivos`, { method: "POST", body: { archivos: ["a", "b", "c"].map((n) => ({ nombre: `${n}.jpg`, tipo: "image/jpeg", tamano: 5 })) } }), ctxId(id));
    H.fotos[0].status = "LISTA"; H.fotos[1].status = "ERROR";
    const r = await getGaleria(req(`/galerias/${id}`), ctxId(id));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ galeria: { id, estado: "BORRADOR", conteos: { LISTA: 1, PENDIENTE: 1, ERROR: 1 } } });
    const otro = sembrarDispositivo("ws2");
    expect((await getGaleria(req(`/galerias/${id}`, { clave: otro.clave }), ctxId(id))).status).toBe(404);
  });
});
