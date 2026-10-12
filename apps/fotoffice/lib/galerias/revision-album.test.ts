import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("./almacen", () => ({
  urlsDeLecturaPorLote: async (fotos: { id: string; thumbKey: string | null }[]) =>
    new Map(fotos.map((f) => [f.id, { thumbUrl: f.thumbKey ? `https://r2.test/${f.thumbKey}?firma` : null, viewUrl: null }])),
}));

const R = await import("./revision-album");
const Vieja = await import("./revision");
const { MAX_COMENTARIOS_POR_RONDA, MAX_COMENTARIO } = await import("./constantes");
const { MENSAJES_GALERIA: M } = await import("./acceso");
const { MENSAJES_REVISION_ALBUM: MA } = R;

type Nivel = "NONE" | "VIEW" | "MANAGE";
const ctx = (gallery: Nivel, workspaceId = "ws-1") => ({ workspaceId, userId: 7, userLabel: "Ana Estudio", role: "STAFF", acceso: { role: "STAFF", levels: { gallery } } as never });
const GESTIONA = ctx("MANAGE");
const SOLO_VER = ctx("VIEW");
const SIN_ACCESO = ctx("NONE");
const OTRO_WS = ctx("MANAGE", "ws-2");
const AHORA = new Date("2026-10-11T15:00:00.000Z");

const cliente = (id = "gc1") => B.datos.fotofficeGaleriaCliente.find((c) => c.id === id)!;
const eventos = () => B.datos.fotofficeGaleriaEvento.map((e) => e.type);
const decisiones = () => B.datos.fotofficeGaleriaDecision;
const comentarios = () => B.datos.fotofficeGaleriaComentario;

function lamina(id: string, rondaId: string | null, extra: Record<string, unknown> = {}, galeriaId = "ga", workspaceId = "ws-1") {
  B.agregar("fotofficeGaleriaFoto", { id, workspaceId, galeriaId, rondaId, fileName: `${id}.jpg`, originalKey: `o/${id}`, viewKey: `v/${id}`, thumbKey: `t/${id}`, status: "LISTA", width: 3000, height: 2000, order: 0, ...extra });
}
function comentar(fotoId: string, author: string, body: string, extra: Record<string, unknown> = {}) {
  B.agregar("fotofficeGaleriaComentario", { workspaceId: "ws-1", galeriaClienteId: "gc1", fotoId, rondaId: "r2", author, body, ...extra });
}
const pin = (n: number, x: number, y: number) => ({ pinNumber: n, pinX: x, pinY: y });
function decidir(galeriaClienteId: string, rondaId: string, decision: string, message: string | null = null) {
  B.agregar("fotofficeGaleriaDecision", { workspaceId: "ws-1", galeriaClienteId, rondaId, decision, message, createdAt: AHORA });
}

beforeEach(() => {
  vi.clearAllMocks();
  B.vaciar();
  B.agregar("user", { id: 7, name: "Ana Estudio", email: "ana@estudio.com" });
  B.agregar("fotofficeGaleria", { id: "ga", workspaceId: "ws-1", proyectoId: "pr1", number: "G-1", name: "Álbum boda", kind: "ALBUM", status: "PUBLICADA", orderMode: "NOMBRE" });
  B.agregar("fotofficeGaleria", { id: "gs", workspaceId: "ws-1", proyectoId: "pr1", number: "G-2", name: "Selección", kind: "SELECCION", status: "PUBLICADA" });
  B.agregar("fotofficeGaleria", { id: "gb", workspaceId: "ws-1", proyectoId: "pr1", number: "G-3", name: "Otro álbum", kind: "ALBUM", status: "PUBLICADA" });
  B.agregar("fotofficeGaleria", { id: "g-ajena", workspaceId: "ws-2", proyectoId: "pr9", number: "G-1", name: "Ajena", kind: "ALBUM", status: "PUBLICADA" });
  B.agregar("fotofficeGaleriaRonda", { id: "r1", workspaceId: "ws-1", galeriaId: "ga", number: 1, status: "CERRADA", note: null, closedAt: new Date("2026-10-05") });
  B.agregar("fotofficeGaleriaRonda", { id: "r2", workspaceId: "ws-1", galeriaId: "ga", number: 2, status: "ABIERTA", note: "Corregimos la tapa." });
  B.agregar("fotofficeGaleriaRonda", { id: "rb", workspaceId: "ws-1", galeriaId: "gb", number: 1, status: "ABIERTA" });
  B.agregar("fotofficeGaleriaRonda", { id: "r-ajena", workspaceId: "ws-2", galeriaId: "g-ajena", number: 1, status: "ABIERTA" });
  B.agregar("fotofficeGaleriaCliente", { id: "gc1", workspaceId: "ws-1", galeriaId: "ga", name: "Lucía Pérez", tokenHash: "h1", tokenIssuedAt: AHORA, status: "EN_REVISION", submittedAt: AHORA });
  B.agregar("fotofficeGaleriaCliente", { id: "gc2", workspaceId: "ws-1", galeriaId: "ga", name: "Mario Díaz", tokenHash: "h2", tokenIssuedAt: AHORA, status: "EN_PROGRESO", createdAt: new Date("2026-10-01") });
  B.agregar("fotofficeGaleriaCliente", { id: "gc-b", workspaceId: "ws-1", galeriaId: "gb", name: "De otro álbum", tokenHash: "h3", tokenIssuedAt: AHORA, status: "EN_REVISION" });
  B.agregar("fotofficeGaleriaCliente", { id: "gc-s", workspaceId: "ws-1", galeriaId: "gs", name: "De selección", tokenHash: "h4", tokenIssuedAt: AHORA, status: "EN_REVISION" });
  B.agregar("fotofficeGaleriaCliente", { id: "gc-ajeno", workspaceId: "ws-2", galeriaId: "g-ajena", name: "Ajeno", tokenHash: "h5", tokenIssuedAt: AHORA, status: "EN_REVISION" });
  lamina("l10", "r2", { fileName: "IMG_10.jpg" });
  lamina("l2", "r2", { fileName: "IMG_2.jpg" });
  lamina("l-vieja", "r1", { fileName: "IMG_1.jpg" });
  lamina("l-b", "rb", {}, "gb");
  lamina("l-ajena", "r-ajena", {}, "g-ajena", "ws-2");
  comentar("l2", "CLIENTE", "Subí la luz", pin(1, 0.25, 0.5));
  comentar("l2", "CLIENTE", "Y acá también", pin(2, 0.75, 0.1));
  comentar("l2", "CLIENTE", "En general, más cálida");
  comentar("l10", "CLIENTE", "Cambiar el fondo", pin(1, 0.5, 0.5));
  decidir("gc1", "r1", "CAMBIOS", "Faltan cosas");
  decidir("gc1", "r2", "APROBADO", "Ahora sí");
});

describe("cargarRevisionAlbum", () => {
  it("lee la ronda abierta con las láminas en orden natural, los pines, la decisión y el historial", async () => {
    const r = (await R.cargarRevisionAlbum(GESTIONA, "ga", "gc1"))!;
    expect(r.ronda).toMatchObject({ id: "r2", numero: 2, estado: "ABIERTA", nota: "Corregimos la tapa." });
    expect(r.rondas.map((x) => x.numero)).toEqual([1, 2]);
    expect(r.laminas.map((l) => l.fileName)).toEqual(["IMG_2.jpg", "IMG_10.jpg"]);
    expect(r.laminas[0]!.thumbUrl).toBe("https://r2.test/t/l2?firma");
    expect(r.laminas[0]!.comentarios.map((c) => [c.pinNumber, c.pinX, c.pinY])).toEqual([[1, 0.25, 0.5], [2, 0.75, 0.1], [null, null, null]]);
    expect(r.laminas[0]!.comentarios[0]!.nombreAutor).toBe("Lucía Pérez");
    expect(r.decision).toMatchObject({ rondaNumero: 2, decision: "APROBADO", mensaje: "Ahora sí" });
    expect(r.historial.map((h) => [h.rondaNumero, h.decision])).toEqual([[1, "CAMBIOS"], [2, "APROBADO"]]);
  });

  it("con ?ronda=1 muestra la ronda cerrada con sus láminas y su decisión; una ronda inexistente cae a la abierta", async () => {
    const r1 = (await R.cargarRevisionAlbum(GESTIONA, "ga", "gc1", 1))!;
    expect(r1.ronda).toMatchObject({ numero: 1, estado: "CERRADA" });
    expect(r1.laminas.map((l) => l.id)).toEqual(["l-vieja"]);
    expect(r1.decision).toMatchObject({ decision: "CAMBIOS" });
    expect((await R.cargarRevisionAlbum(GESTIONA, "ga", "gc1", 99))!.ronda.numero).toBe(2);
    expect((await R.cargarRevisionAlbum(GESTIONA, "ga", "gc1", "basura"))!.ronda.numero).toBe(2);
  });

  it("no mezcla comentarios de otra ronda ni de otro cliente, y trae el nombre del estudio en las respuestas", async () => {
    comentar("l2", "CLIENTE", "De la ronda 1", { rondaId: "r1" });
    comentar("l2", "CLIENTE", "De otro cliente", { galeriaClienteId: "gc2", ...pin(3, 0.1, 0.1) });
    comentar("l2", "ESTUDIO", "Ya lo corregimos", { authorUserId: 7, ...pin(1, 0.25, 0.5) });
    const r = (await R.cargarRevisionAlbum(GESTIONA, "ga", "gc1"))!;
    const textos = r.laminas.find((l) => l.id === "l2")!.comentarios.map((c) => c.texto);
    expect(textos).not.toContain("De la ronda 1");
    expect(textos).not.toContain("De otro cliente");
    expect(r.laminas.find((l) => l.id === "l2")!.comentarios.find((c) => c.autor === "ESTUDIO")).toMatchObject({ nombreAutor: "Ana Estudio", pinNumber: 1 });
    expect(r.respuestasDelEstudio).toBe(1);
  });

  it("devuelve null con otro workspace, otra galería, una galería que no es álbum o sin permiso", async () => {
    expect(await R.cargarRevisionAlbum(OTRO_WS, "ga", "gc1")).toBeNull();
    expect(await R.cargarRevisionAlbum(GESTIONA, "ga", "gc-ajeno")).toBeNull();
    expect(await R.cargarRevisionAlbum(GESTIONA, "ga", "gc-b")).toBeNull();
    expect(await R.cargarRevisionAlbum(GESTIONA, "g-ajena", "gc-ajeno")).toBeNull();
    expect(await R.cargarRevisionAlbum(GESTIONA, "gs", "gc-s")).toBeNull();
    expect(await R.cargarRevisionAlbum(SIN_ACCESO, "ga", "gc1")).toBeNull();
    expect(await R.cargarRevisionAlbum(GESTIONA, "ga", { $ne: 1 })).toBeNull();
    expect((await R.cargarRevisionAlbum(SOLO_VER, "ga", "gc1"))!.cliente.nombre).toBe("Lucía Pérez");
  });

  it("esGaleriaAlbum distingue álbumes de selecciones y de galerías ajenas", async () => {
    expect(await R.esGaleriaAlbum(GESTIONA, "ga")).toBe(true);
    expect(await R.esGaleriaAlbum(GESTIONA, "gs")).toBe(false);
    expect(await R.esGaleriaAlbum(OTRO_WS, "ga")).toBe(false);
  });
});

describe("responderLamina", () => {
  it("responde a un pin con el mismo número y posición, en la ronda abierta", async () => {
    const r = await R.responderLamina(GESTIONA, "ga", "gc1", "l2", 2, "  Listo, ya está  ");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.comentario).toMatchObject({ autor: "ESTUDIO", texto: "Listo, ya está", pinNumber: 2, pinX: 0.75, pinY: 0.1, laminaId: "l2" });
    const guardado = comentarios().find((c) => c.author === "ESTUDIO")!;
    expect(guardado).toMatchObject({ workspaceId: "ws-1", galeriaClienteId: "gc1", fotoId: "l2", rondaId: "r2", authorUserId: 7, pinNumber: 2, pinX: 0.75, pinY: 0.1 });
  });

  it("responde a un comentario general con pin, x e y nulos", async () => {
    const r = await R.responderLamina(GESTIONA, "ga", "gc1", "l2", null, "Gracias");
    expect(r.ok).toBe(true);
    expect(comentarios().find((c) => c.author === "ESTUDIO")).toMatchObject({ pinNumber: null, pinX: null, pinY: null, rondaId: "r2" });
  });

  it("rechaza un pin que el cliente no marcó, un general sin comentario general y un número inválido", async () => {
    expect(await R.responderLamina(GESTIONA, "ga", "gc1", "l2", 9, "x")).toEqual({ ok: false, error: MA.pinNoExiste });
    expect(await R.responderLamina(GESTIONA, "ga", "gc1", "l10", null, "x")).toEqual({ ok: false, error: MA.sinComentarioGeneral });
    for (const malo of [0, -1, 1.5, "1", NaN]) expect(await R.responderLamina(GESTIONA, "ga", "gc1", "l2", malo, "x")).toEqual({ ok: false, error: M.datosInvalidos });
    expect(comentarios().filter((c) => c.author === "ESTUDIO")).toHaveLength(0);
  });

  it("no responde en el pin de otro cliente", async () => {
    comentar("l2", "CLIENTE", "Del otro", { galeriaClienteId: "gc2", ...pin(7, 0.3, 0.3) });
    expect(await R.responderLamina(GESTIONA, "ga", "gc1", "l2", 7, "x")).toEqual({ ok: false, error: MA.pinNoExiste });
  });

  it("valida el texto: vacío, de más de 2.000 caracteres o que no es texto", async () => {
    expect((await R.responderLamina(GESTIONA, "ga", "gc1", "l2", 1, "   ")).ok).toBe(false);
    expect((await R.responderLamina(GESTIONA, "ga", "gc1", "l2", 1, "a".repeat(MAX_COMENTARIO + 1))).ok).toBe(false);
    expect((await R.responderLamina(GESTIONA, "ga", "gc1", "l2", 1, { texto: "x" })).ok).toBe(false);
    expect((await R.responderLamina(GESTIONA, "ga", "gc1", "l2", 1, "a".repeat(MAX_COMENTARIO))).ok).toBe(true);
  });

  it("sólo con permiso de gestionar", async () => {
    expect(await R.responderLamina(SOLO_VER, "ga", "gc1", "l2", 1, "x")).toEqual({ ok: false, error: M.sinPermiso });
    expect(await R.responderLamina(SIN_ACCESO, "ga", "gc1", "l2", 1, "x")).toEqual({ ok: false, error: M.sinPermiso });
  });

  it("no cruza workspaces, galerías ni rondas: cliente, lámina o galería ajenos no encuentran nada", async () => {
    expect((await R.responderLamina(OTRO_WS, "ga", "gc1", "l2", 1, "x")).ok).toBe(false);
    expect(await R.responderLamina(GESTIONA, "ga", "gc-ajeno", "l2", 1, "x")).toEqual({ ok: false, error: M.clienteNoExiste });
    expect(await R.responderLamina(GESTIONA, "ga", "gc-b", "l2", 1, "x")).toEqual({ ok: false, error: M.clienteNoExiste });
    expect(await R.responderLamina(GESTIONA, "ga", "gc1", "l-b", 1, "x")).toEqual({ ok: false, error: MA.laminaNoExiste });
    expect(await R.responderLamina(GESTIONA, "ga", "gc1", "l-ajena", 1, "x")).toEqual({ ok: false, error: MA.laminaNoExiste });
    expect(await R.responderLamina(GESTIONA, "ga", "gc1", "l-vieja", 1, "x")).toEqual({ ok: false, error: MA.laminaNoExiste });
    expect(await R.responderLamina(GESTIONA, "gs", "gc-s", "l2", 1, "x")).toEqual({ ok: false, error: MA.noEsAlbum });
    expect(await R.responderLamina(GESTIONA, "g-ajena", "gc-ajeno", "l-ajena", 1, "x")).toEqual({ ok: false, error: MA.noEsAlbum });
    expect(comentarios().filter((c) => c.author === "ESTUDIO")).toHaveLength(0);
  });

  it("no responde si la lámina no está lista ni sin ronda abierta", async () => {
    B.datos.fotofficeGaleriaFoto.find((f) => f.id === "l2")!.status = "PENDIENTE";
    expect(await R.responderLamina(GESTIONA, "ga", "gc1", "l2", 1, "x")).toEqual({ ok: false, error: MA.laminaNoExiste });
    B.datos.fotofficeGaleriaFoto.find((f) => f.id === "l2")!.status = "LISTA";
    const r2 = B.datos.fotofficeGaleriaRonda.find((r) => r.id === "r2")!;
    r2.status = "CERRADA";
    r2.closedAt = AHORA;
    expect(await R.responderLamina(GESTIONA, "ga", "gc1", "l2", 1, "x")).toEqual({ ok: false, error: MA.sinRonda });
  });

  it("tope: 300 respuestas del estudio por cliente y ronda (las de otra ronda o de otro cliente no cuentan)", async () => {
    for (let i = 0; i < MAX_COMENTARIOS_POR_RONDA; i++) comentar("l2", "ESTUDIO", `r${i}`, pin(1, 0.25, 0.5));
    expect(await R.responderLamina(GESTIONA, "ga", "gc1", "l2", 1, "una más")).toEqual({ ok: false, error: MA.topeRespuestas });
    expect(comentarios().filter((c) => c.author === "ESTUDIO")).toHaveLength(MAX_COMENTARIOS_POR_RONDA);
    // Otro cliente de la misma ronda tiene su propio tope.
    comentar("l2", "CLIENTE", "Suyo", { galeriaClienteId: "gc2", ...pin(1, 0.2, 0.2) });
    expect((await R.responderLamina(GESTIONA, "ga", "gc2", "l2", 1, "ok")).ok).toBe(true);
  });

  it("las respuestas de una ronda anterior no gastan el tope de la actual", async () => {
    for (let i = 0; i < MAX_COMENTARIOS_POR_RONDA; i++) comentar("l-vieja", "ESTUDIO", `v${i}`, { rondaId: "r1" });
    expect((await R.responderLamina(GESTIONA, "ga", "gc1", "l2", 1, "ok")).ok).toBe(true);
  });
});

describe("finalizarAlbum", () => {
  it("finaliza si el cliente aprobó la ronda actual y está en revisión, y deja constancia", async () => {
    expect(await R.finalizarAlbum(GESTIONA, "ga", "gc1", AHORA)).toEqual({ ok: true });
    expect(cliente()).toMatchObject({ status: "FINALIZADO", finalizedAt: AHORA });
    expect(eventos()).toEqual(["ALBUM_FINALIZADO"]);
    expect(B.datos.fotofficeGaleriaEvento[0]).toMatchObject({ workspaceId: "ws-1", galeriaId: "ga", galeriaClienteId: "gc1", actorUserId: 7 });
  });

  it("no finaliza si pidió cambios en la ronda actual, aunque haya aprobado antes", async () => {
    decisiones().splice(0, decisiones().length);
    decidir("gc1", "r1", "APROBADO");
    decidir("gc1", "r2", "CAMBIOS", "Falta algo");
    expect(await R.finalizarAlbum(GESTIONA, "ga", "gc1")).toEqual({ ok: false, error: MA.sinAprobacion });
    expect(cliente().status).toBe("EN_REVISION");
    expect(eventos()).toEqual([]);
  });

  it("no finaliza si sólo aprobó una ronda anterior y todavía no decidió en la actual", async () => {
    decisiones().splice(0, decisiones().length);
    decidir("gc1", "r1", "APROBADO");
    expect(await R.finalizarAlbum(GESTIONA, "ga", "gc1")).toEqual({ ok: false, error: MA.sinAprobacion });
  });

  it("no finaliza a un cliente que no está en revisión ni dos veces (escritura condicional)", async () => {
    cliente().status = "EN_PROGRESO";
    expect((await R.finalizarAlbum(GESTIONA, "ga", "gc1")).ok).toBe(false);
    cliente().status = "EN_REVISION";
    expect((await R.finalizarAlbum(GESTIONA, "ga", "gc1")).ok).toBe(true);
    expect((await R.finalizarAlbum(GESTIONA, "ga", "gc1")).ok).toBe(false);
    expect(eventos()).toEqual(["ALBUM_FINALIZADO"]);
  });

  it("sólo con permiso y sin cruzar workspaces, galerías ni tipos", async () => {
    expect(await R.finalizarAlbum(SOLO_VER, "ga", "gc1")).toEqual({ ok: false, error: M.sinPermiso });
    expect((await R.finalizarAlbum(OTRO_WS, "ga", "gc1")).ok).toBe(false);
    expect((await R.finalizarAlbum(GESTIONA, "ga", "gc-ajeno")).ok).toBe(false);
    expect((await R.finalizarAlbum(GESTIONA, "ga", "gc-b")).ok).toBe(false);
    expect(await R.finalizarAlbum(GESTIONA, "gs", "gc-s")).toEqual({ ok: false, error: MA.noEsAlbum });
    expect(cliente("gc-ajeno").status).toBe("EN_REVISION");
    expect(cliente("gc-b").status).toBe("EN_REVISION");
    expect(cliente().status).toBe("EN_REVISION");
  });
});

describe("reactivarAlbum", () => {
  it("devuelve al cliente a EN_PROGRESO en la ronda abierta, borra su decisión de esa ronda y conserva sus comentarios", async () => {
    expect(await R.reactivarAlbum(GESTIONA, "ga", "gc1", AHORA)).toEqual({ ok: true });
    expect(cliente()).toMatchObject({ status: "EN_PROGRESO", reopenedAt: AHORA, finalizedAt: null });
    expect(decisiones().map((d) => d.rondaId)).toEqual(["r1"]);
    expect(comentarios().filter((c) => c.author === "CLIENTE")).toHaveLength(4);
    expect(eventos()).toEqual(["ALBUM_REACTIVADO"]);
    expect(B.datos.fotofficeGaleriaEvento[0]!.data).toEqual({ ronda: 2, decisionAnterior: "APROBADO" });
  });

  it("también reactiva una prueba finalizada", async () => {
    await R.finalizarAlbum(GESTIONA, "ga", "gc1", AHORA);
    expect((await R.reactivarAlbum(GESTIONA, "ga", "gc1", AHORA)).ok).toBe(true);
    expect(cliente()).toMatchObject({ status: "EN_PROGRESO", finalizedAt: null });
  });

  it("después de reactivar, el cliente puede volver a decidir en la ronda (no choca con la decisión anterior)", async () => {
    await R.reactivarAlbum(GESTIONA, "ga", "gc1", AHORA);
    expect(decisiones().some((d) => d.galeriaClienteId === "gc1" && d.rondaId === "r2")).toBe(false);
  });

  it("no reactiva a quien está en progreso, con enlace anulado, en galería archivada ni sin ronda abierta", async () => {
    cliente("gc2").status = "EN_PROGRESO";
    expect(await R.reactivarAlbum(GESTIONA, "ga", "gc2")).toEqual({ ok: false, error: MA.noReactivable });
    cliente().revokedAt = AHORA;
    expect(await R.reactivarAlbum(GESTIONA, "ga", "gc1")).toEqual({ ok: false, error: MA.clienteAnulado });
    cliente().revokedAt = null;
    B.datos.fotofficeGaleria.find((g) => g.id === "ga")!.status = "ARCHIVADA";
    expect(await R.reactivarAlbum(GESTIONA, "ga", "gc1")).toEqual({ ok: false, error: MA.galeriaArchivada });
    B.datos.fotofficeGaleria.find((g) => g.id === "ga")!.status = "PUBLICADA";
    const r2 = B.datos.fotofficeGaleriaRonda.find((r) => r.id === "r2")!;
    r2.status = "CERRADA";
    r2.closedAt = AHORA;
    expect(await R.reactivarAlbum(GESTIONA, "ga", "gc1")).toEqual({ ok: false, error: MA.sinRonda });
    expect(decisiones()).toHaveLength(2);
    expect(eventos()).toEqual([]);
  });

  it("sólo con permiso y sin cruzar workspaces, galerías ni tipos", async () => {
    expect(await R.reactivarAlbum(SOLO_VER, "ga", "gc1")).toEqual({ ok: false, error: M.sinPermiso });
    expect((await R.reactivarAlbum(OTRO_WS, "ga", "gc1")).ok).toBe(false);
    expect((await R.reactivarAlbum(GESTIONA, "ga", "gc-ajeno")).ok).toBe(false);
    expect((await R.reactivarAlbum(GESTIONA, "ga", "gc-b")).ok).toBe(false);
    expect(await R.reactivarAlbum(GESTIONA, "gs", "gc-s")).toEqual({ ok: false, error: MA.noEsAlbum });
    expect(decisiones()).toHaveLength(2);
  });
});

describe("la revisión de la selección no toca los álbumes", () => {
  it("responder, finalizar y reactivar de la selección rechazan una galería de álbum", async () => {
    expect(await Vieja.responderComentario(GESTIONA, "ga", "gc1", "l2", "x")).toEqual({ ok: false, error: Vieja.MENSAJES_REVISION.esAlbum });
    expect(await Vieja.finalizarSeleccion(GESTIONA, "ga", "gc1")).toEqual({ ok: false, error: Vieja.MENSAJES_REVISION.esAlbum });
    expect(await Vieja.reactivarSeleccion(GESTIONA, "ga", "gc1")).toEqual({ ok: false, error: Vieja.MENSAJES_REVISION.esAlbum });
    expect(cliente().status).toBe("EN_REVISION");
    expect(comentarios().filter((c) => c.author === "ESTUDIO")).toHaveLength(0);
  });
});

describe("resumenDeAlbum", () => {
  it("cuenta por ronda quién aprobó, quién pidió cambios y quién no decidió, y lista las láminas con comentarios", async () => {
    comentar("l2", "CLIENTE", "Del otro cliente", { galeriaClienteId: "gc2", ...pin(1, 0.1, 0.1) });
    comentar("l2", "ESTUDIO", "Respuesta del estudio", pin(1, 0.25, 0.5));
    const s = await R.resumenDeAlbum(GESTIONA, "ga");
    expect(s.map((r) => r.numero)).toEqual([1, 2]);
    expect(s[0]).toMatchObject({ estado: "CERRADA", aprobaron: 0, pidieronCambios: 1, pendientes: 1, laminasConComentarios: [] });
    expect(s[1]).toMatchObject({ estado: "ABIERTA", aprobaron: 1, pidieronCambios: 0, pendientes: 1 });
    expect(s[1]!.laminasConComentarios.map((l) => [l.fileName, l.comentarios])).toEqual([["IMG_2.jpg", 4], ["IMG_10.jpg", 1]]);
    expect(s[1]!.laminasConComentarios[0]!.clientes).toEqual([{ id: "gc1", nombre: "Lucía Pérez", comentarios: 3 }, { id: "gc2", nombre: "Mario Díaz", comentarios: 1 }]);
  });

  it("no cuenta clientes con el enlace anulado ni de otro álbum o workspace, y no cuenta clientes nuevos en rondas cerradas", async () => {
    cliente("gc2").revokedAt = AHORA;
    B.agregar("fotofficeGaleriaCliente", { id: "gc3", workspaceId: "ws-1", galeriaId: "ga", name: "Nuevo", tokenHash: "h9", tokenIssuedAt: AHORA, status: "EN_PROGRESO", createdAt: new Date("2026-10-08") });
    const s = await R.resumenDeAlbum(GESTIONA, "ga");
    expect(s[0]!.pendientes).toBe(0);
    expect(s[1]!.pendientes).toBe(1);
  });

  it("vacío con otro workspace, sin permiso o para una galería que no es álbum", async () => {
    expect(await R.resumenDeAlbum(OTRO_WS, "ga")).toEqual([]);
    expect(await R.resumenDeAlbum(SIN_ACCESO, "ga")).toEqual([]);
    expect(await R.resumenDeAlbum(GESTIONA, "gs")).toEqual([]);
    expect(await R.resumenDeAlbum(GESTIONA, "g-ajena")).toEqual([]);
  });
});
