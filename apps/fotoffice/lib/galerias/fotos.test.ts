import { beforeEach, describe, expect, it, vi } from "vitest";

type Foto = {
  id: string; workspaceId: string; galeriaId: string; fileName: string; originalKey: string;
  viewKey: string | null; thumbKey: string | null; status: string; errorReason: string | null;
  sizeBytes: bigint | null; width: number | null; height: number | null; order: number; attempts: number;
  uploadedByUserId: number | null; createdAt: Date;
};
type Galeria = { id: string; workspaceId: string; status: string; orderMode: string; coverFotoId: string | null };

const H = vi.hoisted(() => ({
  fotos: [] as Foto[],
  galerias: [] as Galeria[],
  tamano: vi.fn(), leer: vi.fn(), guardar: vi.fn(), borrar: vi.fn(), subida: vi.fn(), urls: vi.fn(), variantes: vi.fn(),
}));

function cumple(f: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([k, c]) => {
    if (k === "galeria") return true;
    if (k === "NOT") return !cumple(f, c as Record<string, unknown>);
    const v = f[k];
    if (c && typeof c === "object" && !(c instanceof Date)) {
      const o = c as { in?: unknown[]; lt?: number; gte?: number };
      if (o.in) return o.in.includes(v);
      if (o.gte !== undefined) return (v as number) >= o.gte;
      if (o.lt !== undefined) return (v as number) < o.lt;
    }
    return v === c;
  });
}
const aplicar = (f: Record<string, unknown>, data: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(data)) {
    f[k] = v && typeof v === "object" && "increment" in (v as object) ? (f[k] as number) + (v as { increment: number }).increment : v;
  }
};

vi.mock("server-only", () => ({}));
vi.mock("./almacen", () => ({
  tamanoDeObjeto: H.tamano, leerObjeto: H.leer, guardarObjeto: H.guardar, borrarObjetoFoto: H.borrar,
  urlDeSubidaFoto: H.subida, urlsDeLecturaPorLote: H.urls,
}));
vi.mock("./procesar", async () => {
  class FotoNoProcesable extends Error {
    constructor(m: string, readonly definitivo: boolean) { super(m); }
  }
  return { FotoNoProcesable, generarVariantes: H.variantes };
});
vi.mock("@repo/db", () => {
  const foto = {
    findFirst: async ({ where }: { where: Record<string, unknown> }) => H.fotos.find((f) => cumple(f, where)) ?? null,
    findMany: async ({ where, take }: { where: Record<string, unknown>; take?: number }) =>
      H.fotos.filter((f) => cumple(f, where)).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).slice(0, take ?? Infinity),
    count: async ({ where }: { where: Record<string, unknown> }) => H.fotos.filter((f) => cumple(f, where)).length,
    aggregate: async ({ where }: { where: Record<string, unknown> }) => {
      const o = H.fotos.filter((f) => cumple(f, where)).map((f) => f.order);
      return { _max: { order: o.length ? Math.max(...o) : null } };
    },
    create: async ({ data }: { data: Partial<Foto> }) => {
      const f = { viewKey: null, thumbKey: null, errorReason: null, width: null, height: null, attempts: 0, createdAt: new Date(), ...data } as Foto;
      H.fotos.push(f);
      return { id: f.id };
    },
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const hits = H.fotos.filter((f) => cumple(f, where));
      hits.forEach((h) => aplicar(h as unknown as Record<string, unknown>, data));
      return { count: hits.length };
    },
    deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
      const n = H.fotos.length;
      H.fotos = H.fotos.filter((f) => !cumple(f, where));
      return { count: n - H.fotos.length };
    },
  };
  const galeria = {
    findFirst: async ({ where }: { where: Record<string, unknown> }) => H.galerias.find((g) => cumple(g, where)) ?? null,
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const hits = H.galerias.filter((g) => cumple(g, where));
      hits.forEach((h) => aplicar(h as unknown as Record<string, unknown>, data));
      return { count: hits.length };
    },
  };
  return {
    prisma: {
      fotofficeGaleriaFoto: foto,
      fotofficeGaleria: galeria,
      $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
    },
  };
});

const F = await import("./fotos");
const ctx = (over: Record<string, unknown> = {}) => ({ workspaceId: "ws1", userId: 1, userLabel: "Ana", role: "WORKSPACE_ADMIN", ...over }) as never;
const archivo = { nombre: "IMG_1.jpg", tipo: "image/jpeg", tamano: 1000 };

function foto(id: string, over: Partial<Foto> = {}): Foto {
  return {
    id, workspaceId: "ws1", galeriaId: "g1", fileName: `${id}.jpg`, originalKey: `galerias/ws1/g1/${id}/original`,
    viewKey: null, thumbKey: null, status: "PENDIENTE", errorReason: null, sizeBytes: 1000n, width: null, height: null,
    order: 0, attempts: 0, uploadedByUserId: 1, createdAt: new Date("2026-10-01T10:00:00Z"), ...over,
  };
}

beforeEach(() => {
  H.fotos = [];
  H.galerias = [{ id: "g1", workspaceId: "ws1", status: "BORRADOR", orderMode: "NOMBRE", coverFotoId: null }, { id: "g2", workspaceId: "ws2", status: "BORRADOR", orderMode: "NOMBRE", coverFotoId: null }];
  for (const m of [H.tamano, H.leer, H.guardar, H.borrar, H.subida, H.urls, H.variantes]) m.mockReset();
  H.subida.mockResolvedValue("https://put");
  H.borrar.mockResolvedValue(undefined);
  H.guardar.mockResolvedValue(undefined);
  H.leer.mockResolvedValue(Buffer.from("x"));
  H.variantes.mockResolvedValue({ vista: Buffer.from("v"), mini: Buffer.from("m"), width: 400, height: 600 });
  H.urls.mockResolvedValue(new Map());
});

describe("pedirSubidaFoto", () => {
  it("crea la fila PENDIENTE con clave de galería, orden siguiente y devuelve el PUT sin la clave", async () => {
    H.fotos.push(foto("a", { order: 4 }));
    const r = await F.pedirSubidaFoto(ctx(), "g1", archivo);
    expect(r).toMatchObject({ ok: true, url: "https://put" });
    if (!r.ok) throw new Error();
    const f = H.fotos.find((x) => x.id === r.id)!;
    expect(f).toMatchObject({ status: "PENDIENTE", order: 5, fileName: "IMG_1.jpg", sizeBytes: 1000n, workspaceId: "ws1", galeriaId: "g1" });
    expect(f.originalKey).toBe(`galerias/ws1/g1/${r.id}/original`);
    expect(JSON.stringify(r)).not.toContain("galerias/");
    expect(H.subida).toHaveBeenCalledWith(f.originalKey, "image/jpeg", 1000);
  });
  it("valida permiso, tipo, tamaño, nombre, galería ajena, archivada y tope", async () => {
    expect((await F.pedirSubidaFoto(ctx({ userId: null }), "g1", archivo)).ok).toBe(false);
    expect(await F.pedirSubidaFoto(ctx(), "g1", { ...archivo, tipo: "image/gif" })).toMatchObject({ ok: false, error: expect.stringContaining("JPG") });
    expect(await F.pedirSubidaFoto(ctx(), "g1", { ...archivo, tamano: 52_428_801 })).toMatchObject({ ok: false, error: expect.stringContaining("50 MB") });
    expect((await F.pedirSubidaFoto(ctx(), "g1", { ...archivo, tamano: 1.5 })).ok).toBe(false);
    expect((await F.pedirSubidaFoto(ctx(), "g1", { ...archivo, nombre: "   " })).ok).toBe(false);
    expect((await F.pedirSubidaFoto(ctx(), "g2", archivo)).ok).toBe(false); // de otro workspace
    H.galerias[0].status = "ARCHIVADA";
    expect((await F.pedirSubidaFoto(ctx(), "g1", archivo)).ok).toBe(false);
    H.galerias[0].status = "BORRADOR";
    for (let i = 0; i < 3000; i++) H.fotos.push(foto(`t${i}`));
    expect(await F.pedirSubidaFoto(ctx(), "g1", archivo)).toMatchObject({ ok: false, error: expect.stringContaining("3.000") });
    expect(H.fotos).toHaveLength(3000);
    H.fotos[0].status = "ERROR";
    H.fotos[0].attempts = 3;
    expect((await F.pedirSubidaFoto(ctx(), "g1", archivo)).ok).toBe(true); // ERROR definitivo no cuenta
  });
  it("si no puede firmar, no deja la fila", async () => {
    H.subida.mockRejectedValue(new Error("r2"));
    expect((await F.pedirSubidaFoto(ctx(), "g1", archivo)).ok).toBe(false);
    expect(H.fotos).toHaveLength(0);
  });
  it("el nombre se limpia de rutas y caracteres de control", async () => {
    const r = await F.pedirSubidaFoto(ctx(), "g1", { ...archivo, nombre: "C:\\fotos\\../IMG_9\u0000.jpg" });
    if (!r.ok) throw new Error();
    expect(H.fotos[0].fileName).toBe("IMG_9.jpg");
  });
});

describe("confirmarFoto", () => {
  it("verifica el tamaño, genera vista y mini, y deja LISTA con medidas", async () => {
    H.fotos.push(foto("a"));
    H.tamano.mockResolvedValue(1000);
    expect(await F.confirmarFoto(ctx(), "g1", "a")).toEqual({ ok: true });
    expect(H.guardar.mock.calls.map((c) => [c[0], c[2]])).toEqual([
      ["galerias/ws1/g1/a/vista.jpg", "image/jpeg"],
      ["galerias/ws1/g1/a/mini.jpg", "image/jpeg"],
    ]);
    expect(H.fotos[0]).toMatchObject({ status: "LISTA", viewKey: "galerias/ws1/g1/a/vista.jpg", thumbKey: "galerias/ws1/g1/a/mini.jpg", width: 400, height: 600, errorReason: null });
  });
  it("es idempotente: una foto LISTA no se vuelve a procesar", async () => {
    H.fotos.push(foto("a", { status: "LISTA" }));
    expect(await F.confirmarFoto(ctx(), "g1", "a")).toEqual({ ok: true });
    expect(H.tamano).not.toHaveBeenCalled();
    expect(H.variantes).not.toHaveBeenCalled();
  });
  it("sin objeto en el bucket sigue PENDIENTE y no cuenta intento", async () => {
    H.fotos.push(foto("a"));
    H.tamano.mockResolvedValue(null);
    expect(await F.confirmarFoto(ctx(), "g1", "a")).toMatchObject({ ok: false });
    expect(H.fotos[0]).toMatchObject({ status: "PENDIENTE", attempts: 0 });
  });
  it("tamaño distinto: ERROR definitivo y se borra el original", async () => {
    H.fotos.push(foto("a"));
    H.tamano.mockResolvedValue(999);
    const r = await F.confirmarFoto(ctx(), "g1", "a");
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("tamaño") });
    expect(H.fotos[0]).toMatchObject({ status: "ERROR", attempts: 3 });
    expect(H.borrar).toHaveBeenCalledWith("galerias/ws1/g1/a/original");
    expect(H.variantes).not.toHaveBeenCalled();
  });
  it("falla de procesamiento: ERROR con motivo y un intento más; al tercero ya no se reintenta", async () => {
    H.fotos.push(foto("a"));
    H.tamano.mockResolvedValue(1000);
    H.variantes.mockRejectedValue(new Error("sharp se cayó"));
    const r = await F.confirmarFoto(ctx(), "g1", "a");
    expect(r).toMatchObject({ ok: false });
    expect(JSON.stringify(r)).not.toContain("sharp se cayó");
    expect(H.fotos[0]).toMatchObject({ status: "ERROR", attempts: 1 });
    await F.confirmarFoto(ctx(), "g1", "a");
    await F.confirmarFoto(ctx(), "g1", "a");
    expect(H.fotos[0].attempts).toBe(3);
    H.variantes.mockClear();
    await F.confirmarFoto(ctx(), "g1", "a");
    expect(H.variantes).not.toHaveBeenCalled();
  });
  it("una foto en ERROR con intentos se recupera si ahora anda", async () => {
    H.fotos.push(foto("a", { status: "ERROR", attempts: 1, errorReason: "x" }));
    H.tamano.mockResolvedValue(1000);
    expect(await F.confirmarFoto(ctx(), "g1", "a")).toEqual({ ok: true });
    expect(H.fotos[0]).toMatchObject({ status: "LISTA", errorReason: null });
  });
  it("no toca fotos de otra galería ni de otro workspace, ni sin permiso", async () => {
    H.fotos.push(foto("a"));
    expect((await F.confirmarFoto(ctx({ workspaceId: "ws2" }), "g1", "a")).ok).toBe(false);
    expect((await F.confirmarFoto(ctx(), "g2", "a")).ok).toBe(false);
    expect((await F.confirmarFoto(ctx({ userId: null }), "g1", "a")).ok).toBe(false);
    expect((await F.confirmarFoto(ctx(), "g1", { $ne: 1 })).ok).toBe(false);
    expect(H.tamano).not.toHaveBeenCalled();
  });
});

describe("borrarFoto", () => {
  it("borra los tres objetos y la fila, y limpia la portada si era ella", async () => {
    H.fotos.push(foto("a", { status: "LISTA" }), foto("b"));
    H.galerias[0].coverFotoId = "a";
    expect(await F.borrarFoto(ctx(), "g1", "a")).toEqual({ ok: true });
    expect(H.borrar.mock.calls.map((c) => c[0]).sort()).toEqual(["galerias/ws1/g1/a/mini.jpg", "galerias/ws1/g1/a/original", "galerias/ws1/g1/a/vista.jpg"]);
    expect(H.fotos.map((f) => f.id)).toEqual(["b"]);
    expect(H.galerias[0].coverFotoId).toBeNull();
  });
  it("si el bucket falla, conserva la fila", async () => {
    H.fotos.push(foto("a"));
    H.borrar.mockRejectedValue(new Error("r2"));
    expect((await F.borrarFoto(ctx(), "g1", "a")).ok).toBe(false);
    expect(H.fotos).toHaveLength(1);
  });
  it("no borra una foto de otro workspace", async () => {
    H.fotos.push(foto("a"));
    expect((await F.borrarFoto(ctx({ workspaceId: "ws2" }), "g1", "a")).ok).toBe(false);
    expect(H.borrar).not.toHaveBeenCalled();
  });
});

describe("reordenarFotos y portada", () => {
  it("las indicadas van primero; las demás detrás; pasa a MANUAL", async () => {
    H.fotos.push(foto("a", { order: 0 }), foto("b", { order: 1 }), foto("c", { order: 2 }));
    expect(await F.reordenarFotos(ctx(), "g1", ["c", "a"])).toEqual({ ok: true });
    const por = (id: string) => H.fotos.find((f) => f.id === id)!.order;
    expect([por("c"), por("a"), por("b")]).toEqual([0, 1, 2]);
    expect(H.galerias[0].orderMode).toBe("MANUAL");
  });
  it("rechaza repetidos y fotos ajenas", async () => {
    H.fotos.push(foto("a"), foto("b", { galeriaId: "g2", workspaceId: "ws2" }));
    expect((await F.reordenarFotos(ctx(), "g1", ["a", "a"])).ok).toBe(false);
    expect((await F.reordenarFotos(ctx(), "g1", ["b"])).ok).toBe(false);
    expect(H.galerias[0].orderMode).toBe("NOMBRE");
  });
  it("portada: solo una foto LISTA de la galería; null la quita", async () => {
    H.fotos.push(foto("a", { status: "LISTA" }), foto("p"));
    expect(await F.establecerPortada(ctx(), "g1", "a")).toEqual({ ok: true });
    expect(H.galerias[0].coverFotoId).toBe("a");
    expect((await F.establecerPortada(ctx(), "g1", "p")).ok).toBe(false);
    expect(await F.establecerPortada(ctx(), "g1", null)).toEqual({ ok: true });
    expect(H.galerias[0].coverFotoId).toBeNull();
  });
});

describe("listarFotos", () => {
  it("orden natural por nombre en modo NOMBRE y URLs por lote, sin claves", async () => {
    H.fotos.push(foto("a", { fileName: "IMG_10.jpg", status: "LISTA", viewKey: "k1", thumbKey: "k2" }), foto("b", { fileName: "IMG_2.jpg" }));
    H.urls.mockResolvedValue(new Map([["a", { thumbUrl: "t", viewUrl: "v" }]]));
    const r = await F.listarFotos(ctx(), "g1");
    expect(r.map((x) => x.fileName)).toEqual(["IMG_2.jpg", "IMG_10.jpg"]);
    expect(r[1]).toMatchObject({ thumbUrl: "t", viewUrl: "v", sizeBytes: 1000 });
    expect(JSON.stringify(r)).not.toContain("galerias/");
    expect(H.urls).toHaveBeenCalledTimes(1);
  });
  it("modo MANUAL usa order; galería ajena o sin permiso devuelve vacío", async () => {
    H.galerias[0].orderMode = "MANUAL";
    H.fotos.push(foto("a", { fileName: "A.jpg", order: 1 }), foto("b", { fileName: "B.jpg", order: 0 }));
    expect((await F.listarFotos(ctx(), "g1")).map((x) => x.id)).toEqual(["b", "a"]);
    expect(await F.listarFotos(ctx({ workspaceId: "ws2" }), "g1")).toEqual([]);
    expect(await F.listarFotos(ctx({ userId: null }), "g1")).toEqual([]);
  });
});

describe("reintentarYLimpiarFotos", () => {
  const ahora = new Date("2026-10-10T12:00:00Z");
  it("procesa PENDIENTE con objeto, borra PENDIENTE de 24 h sin objeto, deja las recientes", async () => {
    H.fotos.push(
      foto("ok", { createdAt: new Date("2026-10-10T08:00:00Z") }),
      foto("vieja", { createdAt: new Date("2026-10-09T08:00:00Z") }),
      foto("reciente", { createdAt: new Date("2026-10-10T11:00:00Z") }),
      foto("agotada", { status: "ERROR", attempts: 3 }),
    );
    H.tamano.mockImplementation(async (k: string) => (k.includes("/ok/") ? 1000 : null));
    const r = await F.reintentarYLimpiarFotos(ahora);
    expect(r).toMatchObject({ procesadas: 1, limpiadas: 1, fallidas: 0 });
    expect(H.fotos.map((f) => f.id).sort()).toEqual(["agotada", "ok", "reciente"]);
    expect(H.fotos.find((f) => f.id === "ok")!.status).toBe("LISTA");
    expect(H.borrar).toHaveBeenCalledTimes(3);
  });
  it("una falla en una foto no frena a las demás", async () => {
    H.fotos.push(foto("a", { createdAt: new Date("2026-10-10T01:00:00Z") }), foto("b", { createdAt: new Date("2026-10-10T02:00:00Z") }));
    H.tamano.mockRejectedValueOnce(new Error("r2")).mockResolvedValue(1000);
    expect(await F.reintentarYLimpiarFotos(ahora)).toMatchObject({ procesadas: 1, fallidas: 1 });
  });
});
