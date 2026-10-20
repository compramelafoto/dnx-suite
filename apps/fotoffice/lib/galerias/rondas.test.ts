import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
const A = vi.hoisted(() => ({ copiar: vi.fn(), borrar: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("./almacen", () => ({ copiarObjeto: A.copiar, borrarObjetoFoto: A.borrar }));

const R = await import("./rondas");
const { MENSAJES_GALERIA: M } = await import("./acceso");
const { MENSAJES_RONDA } = R;

type Nivel = "NONE" | "VIEW" | "MANAGE";
const ctx = (gallery: Nivel, workspaceId = "ws-1") => ({
  workspaceId, userId: 7, userLabel: "Ana", role: "STAFF", acceso: { role: "STAFF", levels: { gallery } } as never,
});
const GESTIONA = ctx("MANAGE");
const SOLO_VER = ctx("VIEW");
const OTRO_WS = ctx("MANAGE", "ws-2");
const AHORA = new Date("2026-10-11T15:00:00.000Z");

const rondas = () => B.datos.fotofficeGaleriaRonda;
const fotos = () => B.datos.fotofficeGaleriaFoto;
const eventos = () => B.datos.fotofficeGaleriaEvento;

function lamina(id: string, rondaId: string | null, extra: Record<string, unknown> = {}, galeriaId = "g1") {
  B.agregar("fotofficeGaleriaFoto", {
    id, workspaceId: "ws-1", galeriaId, rondaId, fileName: `${id}.jpg`, originalKey: `galerias/ws-1/${galeriaId}/${id}/original`, viewKey: `galerias/ws-1/${galeriaId}/${id}/vista.jpg`,
    thumbKey: `galerias/ws-1/${galeriaId}/${id}/mini.jpg`, status: "LISTA", sizeBytes: 1000n, width: 800, height: 600, contentType: "image/jpeg", mediaType: "FOTO", ...extra,
  });
}
function decision(clienteId: string, rondaId: string, d = "CAMBIOS") {
  B.agregar("fotofficeGaleriaDecision", { workspaceId: "ws-1", galeriaClienteId: clienteId, rondaId, decision: d });
}

beforeEach(() => {
  vi.clearAllMocks();
  B.vaciar();
  A.copiar.mockResolvedValue(true);
  A.borrar.mockResolvedValue(undefined);
  B.agregar("fotofficeGaleria", { id: "g1", workspaceId: "ws-1", proyectoId: "pr1", number: "G-1", name: "Álbum", kind: "ALBUM", status: "PUBLICADA", downloadMode: "NINGUNA" });
  B.agregar("fotofficeGaleriaRonda", { id: "r1", workspaceId: "ws-1", galeriaId: "g1", number: 1, status: "ABIERTA" });
  B.agregar("fotofficeGaleriaCliente", { id: "c1", workspaceId: "ws-1", galeriaId: "g1", name: "Ana", email: "ana@x.com", tokenHash: "h1", tokenIssuedAt: AHORA, status: "EN_REVISION" });
  B.agregar("fotofficeGaleriaCliente", { id: "c2", workspaceId: "ws-1", galeriaId: "g1", name: "Luis", email: "luis@x.com", tokenHash: "h2", tokenIssuedAt: AHORA, status: "FINALIZADO", finalizedAt: AHORA });
  B.agregar("fotofficeGaleriaCliente", { id: "c3", workspaceId: "ws-1", galeriaId: "g1", name: "Anulado", email: "a@x.com", tokenHash: "h3", tokenIssuedAt: AHORA, status: "EN_REVISION", revokedAt: AHORA });
});

describe("abrirRondaNueva · cuándo se puede", () => {
  it("si ningún cliente decidió, avisa con el código SIN_DECISION y no cambia nada", async () => {
    const r = await R.abrirRondaNueva(GESTIONA, "g1", {}, AHORA);
    expect(r).toEqual({ ok: false, error: MENSAJES_RONDA.sinDecision, codigo: "SIN_DECISION" });
    expect(rondas()).toHaveLength(1);
    expect(rondas()[0]).toMatchObject({ id: "r1", status: "ABIERTA", closedAt: null });
    expect(B.datos.fotofficeGaleriaCliente.map((c) => c.status)).toEqual(["EN_REVISION", "FINALIZADO", "EN_REVISION"]);
  });
  it("con una decisión (o forzando) cierra la anterior y abre la número + 1 con la nota", async () => {
    decision("c1", "r1");
    const r = await R.abrirRondaNueva(GESTIONA, "g1", { nota: "  Cambiamos la tapa.  " }, AHORA);
    expect(r).toMatchObject({ ok: true, numero: 2, nota: "Cambiamos la tapa.", copiadas: 0, noCopiadas: 0 });
    expect(rondas().map((x) => [x.number, x.status, x.closedAt, x.note, x.createdByUserId])).toEqual([[1, "CERRADA", AHORA, null, null], [2, "ABIERTA", null, "Cambiamos la tapa.", 7]]);
    expect(eventos().map((e) => [e.type, e.data])).toEqual([["RONDA_ABIERTA", { numero: 2, copiar: false, forzada: false }]]);
  });
  it("forzar permite abrirla sin decisiones y queda anotado", async () => {
    const r = await R.abrirRondaNueva(GESTIONA, "g1", { forzar: true }, AHORA);
    expect(r).toMatchObject({ ok: true, numero: 2, nota: null });
    expect(eventos()[0]!.data).toMatchObject({ forzada: true });
  });
  it("una tercera ronda: las rondas se van numerando y siempre queda una sola abierta", async () => {
    await R.abrirRondaNueva(GESTIONA, "g1", { forzar: true }, AHORA);
    await R.abrirRondaNueva(GESTIONA, "g1", { forzar: true }, AHORA);
    expect(rondas().map((x) => [x.number, x.status])).toEqual([[1, "CERRADA"], [2, "CERRADA"], [3, "ABIERTA"]]);
  });
  it("los clientes vuelven a EN_PROGRESO salvo el del enlace anulado, y conservan lo que ya hicieron", async () => {
    B.datos.fotofficeGaleriaCliente[0]!.submittedAt = AHORA;
    await R.abrirRondaNueva(GESTIONA, "g1", { forzar: true }, AHORA);
    const [c1, c2, c3] = B.datos.fotofficeGaleriaCliente;
    expect(c1).toMatchObject({ status: "EN_PROGRESO", reopenedAt: AHORA, finalizedAt: null, submittedAt: AHORA });
    expect(c2).toMatchObject({ status: "EN_PROGRESO", reopenedAt: AHORA, finalizedAt: null });
    expect(c3).toMatchObject({ status: "EN_REVISION", revokedAt: AHORA });
  });
  it("las decisiones de la ronda cerrada se conservan", async () => {
    decision("c1", "r1", "APROBADO");
    await R.abrirRondaNueva(GESTIONA, "g1", {}, AHORA);
    expect(B.datos.fotofficeGaleriaDecision).toHaveLength(1);
    expect(B.datos.fotofficeGaleriaDecision[0]).toMatchObject({ rondaId: "r1", decision: "APROBADO" });
  });
});

describe("abrirRondaNueva · copiar las láminas", () => {
  it("copia original, vista y miniatura de cada lámina lista a claves nuevas y deja las filas LISTA en el mismo orden", async () => {
    lamina("f1", "r1", { order: 1, fileName: "b.jpg" });
    lamina("f2", "r1", { order: 0, fileName: "a.jpg" });
    lamina("f3", "r1", { order: 2, status: "PENDIENTE", viewKey: null, thumbKey: null });
    lamina("f4", "r1", { order: 3, status: "ERROR", viewKey: null, thumbKey: null });
    decision("c1", "r1");
    const r = await R.abrirRondaNueva(GESTIONA, "g1", { copiar: true }, AHORA);
    expect(r).toMatchObject({ ok: true, numero: 2, copiadas: 2, noCopiadas: 0 });
    const nuevas = fotos().filter((f) => f.rondaId === (r as { rondaId: string }).rondaId);
    expect(nuevas).toHaveLength(2);
    expect(nuevas.map((f) => [f.fileName, f.status, f.mediaType])).toEqual([["a.jpg", "LISTA", "FOTO"], ["b.jpg", "LISTA", "FOTO"]]);
    expect(nuevas[0]!.order).toBeLessThan(nuevas[1]!.order as number);
    expect(nuevas.every((f) => f.id !== "f1" && f.id !== "f2")).toBe(true);
    expect(nuevas[0]).toMatchObject({ workspaceId: "ws-1", galeriaId: "g1", width: 800, height: 600, sizeBytes: 1000n, contentType: "image/jpeg", uploadedByUserId: 7 });
    for (const f of nuevas) {
      expect(f.originalKey).toBe(`galerias/ws-1/g1/${f.id}/original`);
      expect(f.viewKey).toBe(`galerias/ws-1/g1/${f.id}/vista.jpg`);
      expect(f.thumbKey).toBe(`galerias/ws-1/g1/${f.id}/mini.jpg`);
    }
    expect(A.copiar).toHaveBeenCalledTimes(6);
    expect(A.copiar).toHaveBeenCalledWith("galerias/ws-1/g1/f2/original", `galerias/ws-1/g1/${nuevas[0]!.id}/original`);
    expect(A.copiar).toHaveBeenCalledWith("galerias/ws-1/g1/f1/vista.jpg", `galerias/ws-1/g1/${nuevas[1]!.id}/vista.jpg`);
    // La ronda anterior queda intacta.
    expect(fotos().filter((f) => f.rondaId === "r1").map((f) => f.id).sort()).toEqual(["f1", "f2", "f3", "f4"]);
  });
  it("sin copiar, la ronda nueva nace vacía y no se toca el almacenamiento", async () => {
    lamina("f1", "r1");
    await R.abrirRondaNueva(GESTIONA, "g1", { forzar: true, copiar: false }, AHORA);
    expect(fotos()).toHaveLength(1);
    expect(A.copiar).not.toHaveBeenCalled();
  });
  it("una lámina que no se pudo copiar se cuenta aparte, limpia lo copiado y no frena a las demás", async () => {
    lamina("f1", "r1", { order: 0 });
    lamina("f2", "r1", { order: 1 });
    A.copiar.mockImplementation(async (origen: string) => !origen.includes("/f1/vista.jpg"));
    const r = await R.abrirRondaNueva(GESTIONA, "g1", { forzar: true, copiar: true }, AHORA);
    expect(r).toMatchObject({ ok: true, copiadas: 1, noCopiadas: 1 });
    expect(fotos().filter((f) => f.rondaId !== "r1")).toHaveLength(1);
    expect(A.borrar).toHaveBeenCalledTimes(3);
  });
  it("si copiar lanza, la lámina se da por no copiada (sin romper la ronda)", async () => {
    lamina("f1", "r1");
    A.copiar.mockRejectedValue(new Error("boom"));
    const r = await R.abrirRondaNueva(GESTIONA, "g1", { forzar: true, copiar: true }, AHORA);
    expect(r).toMatchObject({ ok: true, copiadas: 0, noCopiadas: 1 });
    expect(rondas().map((x) => x.status)).toEqual(["CERRADA", "ABIERTA"]);
  });
  it("nunca copia claves que no son de la galería", async () => {
    lamina("f1", "r1", { originalKey: "galerias/ws-2/g9/f1/original" });
    const r = await R.abrirRondaNueva(GESTIONA, "g1", { forzar: true, copiar: true }, AHORA);
    expect(r).toMatchObject({ ok: true, copiadas: 0, noCopiadas: 1 });
    expect(A.copiar).not.toHaveBeenCalled();
  });
});

describe("abrirRondaNueva · permisos, aislamiento y errores", () => {
  it("sin Gestionar, sin usuario, de otro workspace o con datos mal formados no hace nada", async () => {
    expect(await R.abrirRondaNueva(SOLO_VER, "g1", { forzar: true })).toMatchObject({ ok: false, error: M.sinPermiso });
    expect(await R.abrirRondaNueva({ ...GESTIONA, userId: null } as never, "g1", { forzar: true })).toMatchObject({ ok: false, error: M.sinPermiso });
    expect(await R.abrirRondaNueva(OTRO_WS, "g1", { forzar: true })).toMatchObject({ ok: false, error: M.noExiste });
    expect(await R.abrirRondaNueva(GESTIONA, "../x", { forzar: true })).toMatchObject({ ok: false, error: M.datosInvalidos });
    expect(await R.abrirRondaNueva(GESTIONA, "g1", "texto")).toMatchObject({ ok: false, error: M.datosInvalidos });
    expect(await R.abrirRondaNueva(GESTIONA, "g1", { forzar: "si" })).toMatchObject({ ok: false, error: M.datosInvalidos });
    expect(await R.abrirRondaNueva(GESTIONA, "g1", { copiar: 1, forzar: true })).toMatchObject({ ok: false, error: M.datosInvalidos });
    expect(await R.abrirRondaNueva(GESTIONA, "g1", { nota: "x".repeat(2001), forzar: true })).toMatchObject({ ok: false, error: MENSAJES_RONDA.nota });
    expect(await R.abrirRondaNueva(GESTIONA, "g1", { nota: 5, forzar: true })).toMatchObject({ ok: false, error: MENSAJES_RONDA.nota });
    expect(rondas()).toHaveLength(1);
    expect(rondas()[0]!.status).toBe("ABIERTA");
  });
  it("sólo los álbumes tienen rondas; uno archivado no abre ronda", async () => {
    B.datos.fotofficeGaleria[0]!.kind = "SELECCION";
    expect(await R.abrirRondaNueva(GESTIONA, "g1", { forzar: true })).toMatchObject({ ok: false, error: MENSAJES_RONDA.soloAlbum });
    B.datos.fotofficeGaleria[0]!.kind = "ALBUM";
    B.datos.fotofficeGaleria[0]!.status = "ARCHIVADA";
    expect(await R.abrirRondaNueva(GESTIONA, "g1", { forzar: true })).toMatchObject({ ok: false, error: MENSAJES_RONDA.archivada });
    expect(rondas()).toHaveLength(1);
  });
  it("un álbum sin ronda abierta no se inventa una", async () => {
    B.datos.fotofficeGaleriaRonda.length = 0;
    expect(await R.abrirRondaNueva(GESTIONA, "g1", { forzar: true })).toMatchObject({ ok: false, error: MENSAJES_RONDA.sinRonda });
  });
  it("si otra persona la cerró al mismo tiempo, falla sin dejar nada a medias", async () => {
    const cierre = B.tablas.fotofficeGaleriaRonda.updateMany;
    B.tablas.fotofficeGaleriaRonda.updateMany = async () => ({ count: 0 });
    expect(await R.abrirRondaNueva(GESTIONA, "g1", { forzar: true })).toMatchObject({ ok: false, error: MENSAJES_RONDA.carrera });
    B.tablas.fotofficeGaleriaRonda.updateMany = cierre;
    expect(rondas()).toHaveLength(1);
    expect(eventos()).toHaveLength(0);
    expect(B.datos.fotofficeGaleriaCliente[0]!.status).toBe("EN_REVISION");
  });
  it("si dos pedidos chocan en el número (único), también es una carrera", async () => {
    const crear = B.tablas.fotofficeGaleriaRonda.create;
    B.tablas.fotofficeGaleriaRonda.create = async () => {
      throw Object.assign(new Error("Unique"), { code: "P2002" });
    };
    expect(await R.abrirRondaNueva(GESTIONA, "g1", { forzar: true })).toMatchObject({ ok: false, error: MENSAJES_RONDA.carrera });
    B.tablas.fotofficeGaleriaRonda.create = crear;
    expect(rondas()[0]!.status).toBe("ABIERTA");
  });
  it("no toca las rondas ni los clientes de otra galería", async () => {
    B.agregar("fotofficeGaleria", { id: "g2", workspaceId: "ws-1", proyectoId: "pr1", number: "G-2", name: "Otro", kind: "ALBUM", status: "PUBLICADA" });
    B.agregar("fotofficeGaleriaRonda", { id: "r-g2", workspaceId: "ws-1", galeriaId: "g2", number: 1, status: "ABIERTA" });
    B.agregar("fotofficeGaleriaCliente", { id: "c-g2", workspaceId: "ws-1", galeriaId: "g2", name: "Z", tokenHash: "h9", tokenIssuedAt: AHORA, status: "EN_REVISION" });
    await R.abrirRondaNueva(GESTIONA, "g1", { forzar: true }, AHORA);
    expect(rondas().find((x) => x.id === "r-g2")).toMatchObject({ status: "ABIERTA", closedAt: null });
    expect(B.datos.fotofficeGaleriaCliente.find((c) => c.id === "c-g2")!.status).toBe("EN_REVISION");
  });
});

describe("listarRondas y rondaAbiertaDe", () => {
  it("lista las rondas en orden con sus láminas listas y sus decisiones", async () => {
    lamina("f1", "r1");
    lamina("f2", "r1");
    lamina("f3", "r1", { status: "PENDIENTE" });
    decision("c1", "r1", "APROBADO");
    decision("c2", "r1", "CAMBIOS");
    await R.abrirRondaNueva(GESTIONA, "g1", { nota: "Hola" }, AHORA);
    lamina("f4", (await R.rondaAbiertaDe("ws-1", "g1"))!.id);
    const lista = await R.listarRondas(SOLO_VER, "g1");
    expect(lista.map((r) => [r.numero, r.estado, r.nota, r.laminas, r.aprobados, r.conCambios])).toEqual([[1, "CERRADA", null, 2, 1, 1], [2, "ABIERTA", "Hola", 1, 0, 0]]);
    expect(lista[0]!.cerradaEn).toEqual(AHORA);
  });
  it("sin Ver o de otro workspace no devuelve nada", async () => {
    expect(await R.listarRondas(ctx("NONE"), "g1")).toEqual([]);
    expect(await R.listarRondas(OTRO_WS, "g1")).toEqual([]);
    expect(await R.rondaAbiertaDe("ws-2", "g1")).toBeNull();
    expect(await R.rondaAbiertaDe("ws-1", "g1")).toEqual({ id: "r1", numero: 1 });
  });
  it("laminasAbiertasPorGaleria cuenta sólo las láminas listas de la ronda abierta", async () => {
    lamina("f1", "r1");
    lamina("f2", "r1", { status: "ERROR" });
    B.agregar("fotofficeGaleriaRonda", { id: "r0", workspaceId: "ws-1", galeriaId: "g0", number: 1, status: "CERRADA", closedAt: AHORA });
    lamina("f9", "r0", {}, "g0");
    expect(await R.laminasAbiertasPorGaleria("ws-1", ["g1", "g0"])).toEqual(new Map([["g1", 1]]));
    expect(await R.laminasAbiertasPorGaleria("ws-1", [])).toEqual(new Map());
  });
});
