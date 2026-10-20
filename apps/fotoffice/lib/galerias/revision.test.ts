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

const R = await import("./revision");
const { cargarHistorial, TAMANO_PAGINA_HISTORIAL } = await import("./historial");
const { MAX_COMENTARIO, MAX_COMENTARIOS_POR_CLIENTE } = await import("./constantes");
const { MENSAJES_GALERIA: M } = await import("./acceso");

type Nivel = "NONE" | "VIEW" | "MANAGE";
const ctx = (gallery: Nivel, workspaceId = "ws-1") => ({ workspaceId, userId: 7, userLabel: "Ana Estudio", role: "STAFF", acceso: { role: "STAFF", levels: { gallery } } as never });
const GESTIONA = ctx("MANAGE");
const SOLO_VER = ctx("VIEW");
const SIN_ACCESO = ctx("NONE");
const OTRO_WS = ctx("MANAGE", "ws-2");
const AHORA = new Date("2026-10-10T15:00:00.000Z");

const cliente = (id = "gc1") => B.datos.fotofficeGaleriaCliente.find((c) => c.id === id)!;
const eventos = () => B.datos.fotofficeGaleriaEvento.map((e) => e.type);

function foto(id: string, fileName: string, galeriaId = "g1", workspaceId = "ws-1") {
  B.agregar("fotofficeGaleriaFoto", { id, workspaceId, galeriaId, fileName, originalKey: `o/${id}`, viewKey: `v/${id}`, thumbKey: `t/${id}`, status: "LISTA" });
}
function eligir(galeriaClienteId: string, fotoId: string, workspaceId = "ws-1") {
  B.agregar("fotofficeGaleriaSeleccion", { workspaceId, galeriaClienteId, fotoId });
}
function comentar(galeriaClienteId: string, fotoId: string, author: string, body: string, extra: Record<string, unknown> = {}) {
  B.agregar("fotofficeGaleriaComentario", { workspaceId: "ws-1", galeriaClienteId, fotoId, author, body, ...extra });
}

beforeEach(() => {
  vi.clearAllMocks();
  B.vaciar();
  B.agregar("user", { id: 7, name: "Ana Estudio", email: "ana@estudio.com" });
  B.agregar("fotofficeGaleria", { id: "g1", workspaceId: "ws-1", proyectoId: "pr1", number: "G-1", name: "Boda", status: "PUBLICADA" });
  B.agregar("fotofficeGaleria", { id: "g2", workspaceId: "ws-1", proyectoId: "pr1", number: "G-2", name: "Otra", status: "PUBLICADA" });
  B.agregar("fotofficeGaleria", { id: "g-arch", workspaceId: "ws-1", proyectoId: "pr1", number: "G-3", name: "Archivada", status: "ARCHIVADA" });
  B.agregar("fotofficeGaleria", { id: "g-ajena", workspaceId: "ws-2", proyectoId: "pr9", number: "G-1", name: "Ajena", status: "PUBLICADA" });
  B.agregar("fotofficeGaleriaCliente", { id: "gc1", workspaceId: "ws-1", galeriaId: "g1", name: "Lucía Pérez", tokenHash: "h1", tokenIssuedAt: AHORA, status: "EN_REVISION", submittedAt: AHORA, submitMessage: "Gracias" });
  B.agregar("fotofficeGaleriaCliente", { id: "gc-otra", workspaceId: "ws-1", galeriaId: "g2", name: "Otra persona", tokenHash: "h2", tokenIssuedAt: AHORA, status: "EN_REVISION" });
  B.agregar("fotofficeGaleriaCliente", { id: "gc-ajeno", workspaceId: "ws-2", galeriaId: "g-ajena", name: "Ajeno", tokenHash: "h3", tokenIssuedAt: AHORA, status: "EN_REVISION" });
  foto("f1", "IMG_10.jpg");
  foto("f2", "IMG_2.CR2");
  foto("f3", "IMG_3.jpg");
  foto("f-g2", "IMG_9.jpg", "g2");
  foto("f-ajena", "IMG_1.jpg", "g-ajena", "ws-2");
  eligir("gc1", "f1");
  eligir("gc1", "f2");
  comentar("gc1", "f2", "CLIENTE", "Más luz");
  comentar("gc1", "f3", "CLIENTE", "La saqué, no me gusta");
  comentar("gc1", "f2", "ESTUDIO", "Listo, la aclaramos", { authorUserId: 7 });
});

describe("cargarRevisionCliente", () => {
  it("trae lo elegido y lo comentado en orden natural, con la conversación y el nombre de cada autor", async () => {
    const r = (await R.cargarRevisionCliente(SOLO_VER, "g1", "gc1"))!;
    expect(r.cliente).toMatchObject({ nombre: "Lucía Pérez", estado: "EN_REVISION", anulado: false, mensaje: "Gracias" });
    expect(r.fotos.map((f) => [f.fileName, f.seleccionada])).toEqual([["IMG_2.CR2", true], ["IMG_3.jpg", false], ["IMG_10.jpg", true]]);
    expect(r.seleccionadas).toBe(2);
    expect(r.conComentarios).toBe(2);
    const conv = r.fotos[0]!.comentarios;
    expect(conv.map((c) => [c.autor, c.nombreAutor, c.texto])).toEqual([["CLIENTE", "Lucía Pérez", "Más luz"], ["ESTUDIO", "Ana Estudio", "Listo, la aclaramos"]]);
    expect(r.fotos[0]!.thumbUrl).toBe("https://r2.test/t/f2?firma");
  });

  it("la exportación sale sólo de las elegidas (no de las comentadas y desmarcadas), sin extensión", async () => {
    const r = (await R.cargarRevisionCliente(SOLO_VER, "g1", "gc1"))!;
    expect(r.exportacion.nombres).toEqual(["IMG_2", "IMG_10"]);
    expect(r.exportacion.lightroom).toEqual(["IMG_2, IMG_10"]);
    expect(r.exportacion.windows).toEqual(["IMG_2 OR IMG_10"]);
  });

  it("no filtra nada: sin Ver, otro workspace, galería equivocada o ids inválidos dan null", async () => {
    expect(await R.cargarRevisionCliente(SIN_ACCESO, "g1", "gc1")).toBeNull();
    expect(await R.cargarRevisionCliente(OTRO_WS, "g1", "gc1")).toBeNull();
    expect(await R.cargarRevisionCliente(GESTIONA, "g2", "gc1")).toBeNull();
    expect(await R.cargarRevisionCliente(GESTIONA, "g1", "gc-ajeno")).toBeNull();
    expect(await R.cargarRevisionCliente(GESTIONA, "g-ajena", "gc-ajeno")).toBeNull();
    expect(await R.cargarRevisionCliente(GESTIONA, "../x", "gc1")).toBeNull();
    expect(await R.cargarRevisionCliente(GESTIONA, "g1", { $ne: "x" })).toBeNull();
  });

  it("nunca devuelve el token, su hash ni las claves de los originales", async () => {
    const r = await R.cargarRevisionCliente(SOLO_VER, "g1", "gc1");
    const texto = JSON.stringify(r);
    expect(texto).not.toContain("h1");
    expect(texto).not.toContain("o/f1");
    expect(texto).not.toContain("tokenHash");
  });
});

describe("filasParaCsv", () => {
  it("una fila por foto elegida con SÓLO los comentarios del cliente", async () => {
    const r = (await R.filasParaCsv(SOLO_VER, "g1", "gc1"))!;
    expect(r.filas).toEqual(expect.arrayContaining([{ fileName: "IMG_2.CR2", comentarios: ["Más luz"] }, { fileName: "IMG_10.jpg", comentarios: [] }]));
    expect(r.filas).toHaveLength(2);
    expect(r.galeriaNumero).toBe("G-1");
  });
  it("respeta el aislamiento", async () => {
    expect(await R.filasParaCsv(SIN_ACCESO, "g1", "gc1")).toBeNull();
    expect(await R.filasParaCsv(OTRO_WS, "g1", "gc1")).toBeNull();
    expect(await R.filasParaCsv(GESTIONA, "g2", "gc1")).toBeNull();
  });
});

describe("responderComentario", () => {
  const comentariosDe = (cl = "gc1") => B.datos.fotofficeGaleriaComentario.filter((c) => c.galeriaClienteId === cl);

  it("guarda la respuesta como ESTUDIO con el usuario y la devuelve", async () => {
    const r = await R.responderComentario(GESTIONA, "g1", "gc1", "f1", "  Gracias, la dejamos así  ");
    expect(r.ok).toBe(true);
    const guardado = comentariosDe().find((c) => c.body === "Gracias, la dejamos así")!;
    expect(guardado).toMatchObject({ author: "ESTUDIO", authorUserId: 7, workspaceId: "ws-1", fotoId: "f1" });
    if (r.ok) expect(r.comentario).toMatchObject({ autor: "ESTUDIO", nombreAutor: "Ana Estudio", fotoId: "f1" });
  });
  it("también en una foto que el cliente comentó pero desmarcó", async () => {
    expect((await R.responderComentario(GESTIONA, "g1", "gc1", "f3", "Ok")).ok).toBe(true);
  });
  it("exige Gestionar", async () => {
    expect(await R.responderComentario(SOLO_VER, "g1", "gc1", "f1", "Hola")).toEqual({ ok: false, error: M.sinPermiso });
    expect(await R.responderComentario(SIN_ACCESO, "g1", "gc1", "f1", "Hola")).toEqual({ ok: false, error: M.sinPermiso });
    expect(comentariosDe()).toHaveLength(3);
  });
  it("no deja mezclar workspaces, galerías ni fotos ajenas (IDOR)", async () => {
    expect((await R.responderComentario(OTRO_WS, "g1", "gc1", "f1", "x")).ok).toBe(false);
    expect((await R.responderComentario(GESTIONA, "g2", "gc1", "f1", "x")).ok).toBe(false);
    expect((await R.responderComentario(GESTIONA, "g1", "gc-ajeno", "f1", "x")).ok).toBe(false);
    expect((await R.responderComentario(GESTIONA, "g1", "gc1", "f-g2", "x")).ok).toBe(false);
    expect((await R.responderComentario(GESTIONA, "g1", "gc1", "f-ajena", "x")).ok).toBe(false);
    expect(comentariosDe()).toHaveLength(3);
  });
  it("una foto de la galería que el cliente ni eligió ni comentó se rechaza", async () => {
    foto("f4", "IMG_4.jpg");
    const r = await R.responderComentario(GESTIONA, "g1", "gc1", "f4", "x");
    expect(r).toEqual({ ok: false, error: R.MENSAJES_REVISION.fotoSinRelacion });
  });
  it("texto vacío o de más de 2.000 caracteres", async () => {
    expect((await R.responderComentario(GESTIONA, "g1", "gc1", "f1", "   ")).ok).toBe(false);
    expect((await R.responderComentario(GESTIONA, "g1", "gc1", "f1", 42)).ok).toBe(false);
    expect((await R.responderComentario(GESTIONA, "g1", "gc1", "f1", "a".repeat(MAX_COMENTARIO + 1))).ok).toBe(false);
    expect((await R.responderComentario(GESTIONA, "g1", "gc1", "f1", "a".repeat(MAX_COMENTARIO))).ok).toBe(true);
  });
  it("tope de respuestas del estudio por cliente (no cuentan las del cliente)", async () => {
    for (let i = 0; i < MAX_COMENTARIOS_POR_CLIENTE - 2; i++) comentar("gc1", "f1", "ESTUDIO", `r${i}`, { authorUserId: 7 });
    expect((await R.responderComentario(GESTIONA, "g1", "gc1", "f1", "la última")).ok).toBe(true);
    expect(await R.responderComentario(GESTIONA, "g1", "gc1", "f1", "una más")).toEqual({ ok: false, error: R.MENSAJES_REVISION.topeRespuestas });
  });
});

describe("finalizar", () => {
  it("de EN_REVISION a FINALIZADO, con fecha y evento del usuario", async () => {
    expect(await R.finalizarSeleccion(GESTIONA, "g1", "gc1", AHORA)).toEqual({ ok: true });
    expect(cliente()).toMatchObject({ status: "FINALIZADO", finalizedAt: AHORA });
    expect(B.datos.fotofficeGaleriaEvento[0]).toMatchObject({ type: "SELECCION_FINALIZADA", galeriaClienteId: "gc1", actorUserId: 7, workspaceId: "ws-1" });
  });
  it.each(["EN_PROGRESO", "FINALIZADO"])("desde %s no se puede y no escribe nada", async (estado) => {
    cliente().status = estado;
    const r = await R.finalizarSeleccion(GESTIONA, "g1", "gc1", AHORA);
    expect(r).toEqual({ ok: false, error: R.MENSAJES_REVISION.soloEnRevision });
    expect(cliente().status).toBe(estado);
    expect(eventos()).toEqual([]);
  });
  it("dos clics seguidos: el segundo ya no encuentra EN_REVISION", async () => {
    const [a, b] = await Promise.all([R.finalizarSeleccion(GESTIONA, "g1", "gc1", AHORA), R.finalizarSeleccion(GESTIONA, "g1", "gc1", AHORA)]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(eventos()).toEqual(["SELECCION_FINALIZADA"]);
  });
  it("exige Gestionar y respeta workspace y galería", async () => {
    expect((await R.finalizarSeleccion(SOLO_VER, "g1", "gc1")).ok).toBe(false);
    expect((await R.finalizarSeleccion(OTRO_WS, "g1", "gc1")).ok).toBe(false);
    expect((await R.finalizarSeleccion(GESTIONA, "g2", "gc1")).ok).toBe(false);
    expect((await R.finalizarSeleccion(OTRO_WS, "g-ajena", "gc-ajeno")).ok).toBe(true);
    expect(cliente().status).toBe("EN_REVISION");
    expect(cliente("gc-otra").status).toBe("EN_REVISION");
  });
});

describe("reactivar", () => {
  it.each(["EN_REVISION", "FINALIZADO"])("desde %s vuelve a EN_PROGRESO, conserva lo elegido y anota la fecha", async (estado) => {
    cliente().status = estado;
    cliente().finalizedAt = AHORA;
    expect(await R.reactivarSeleccion(GESTIONA, "g1", "gc1", AHORA)).toEqual({ ok: true });
    expect(cliente()).toMatchObject({ status: "EN_PROGRESO", reopenedAt: AHORA, finalizedAt: null, submittedAt: AHORA });
    expect(B.datos.fotofficeGaleriaSeleccion.filter((s) => s.galeriaClienteId === "gc1")).toHaveLength(2);
    expect(eventos()).toEqual(["SELECCION_REACTIVADA"]);
  });
  it("desde EN_PROGRESO no hace nada", async () => {
    cliente().status = "EN_PROGRESO";
    expect(await R.reactivarSeleccion(GESTIONA, "g1", "gc1", AHORA)).toEqual({ ok: false, error: R.MENSAJES_REVISION.noReactivable });
    expect(eventos()).toEqual([]);
  });
  it("no con la galería archivada ni con el enlace anulado", async () => {
    B.agregar("fotofficeGaleriaCliente", { id: "gc-arch", workspaceId: "ws-1", galeriaId: "g-arch", name: "X", tokenHash: "h9", tokenIssuedAt: AHORA, status: "EN_REVISION" });
    expect(await R.reactivarSeleccion(GESTIONA, "g-arch", "gc-arch", AHORA)).toEqual({ ok: false, error: R.MENSAJES_REVISION.galeriaArchivada });
    cliente().revokedAt = AHORA;
    expect(await R.reactivarSeleccion(GESTIONA, "g1", "gc1", AHORA)).toEqual({ ok: false, error: R.MENSAJES_REVISION.clienteAnulado });
    expect(cliente().status).toBe("EN_REVISION");
  });
  it("exige Gestionar y respeta workspace y galería", async () => {
    expect((await R.reactivarSeleccion(SOLO_VER, "g1", "gc1")).ok).toBe(false);
    expect((await R.reactivarSeleccion(OTRO_WS, "g1", "gc1")).ok).toBe(false);
    expect((await R.reactivarSeleccion(GESTIONA, "g2", "gc1")).ok).toBe(false);
    expect(cliente().status).toBe("EN_REVISION");
    expect(eventos()).toEqual([]);
  });
});

describe("historial paginado", () => {
  function evento(i: number, extra: Record<string, unknown> = {}) {
    B.agregar("fotofficeGaleriaEvento", { workspaceId: "ws-1", galeriaId: "g1", type: "GALERIA_EDITADA", createdAt: new Date(Date.UTC(2026, 9, 1, 0, 0, i)), ...extra });
  }
  it("de a 50, del más nuevo al más viejo, y avisa si hay más", async () => {
    for (let i = 0; i < 120; i++) evento(i);
    const p1 = await cargarHistorial(GESTIONA, "g1", 1);
    expect(p1.items).toHaveLength(TAMANO_PAGINA_HISTORIAL);
    expect(p1.hayMas).toBe(true);
    const p3 = await cargarHistorial(GESTIONA, "g1", 3);
    expect(p3.items).toHaveLength(20);
    expect(p3.hayMas).toBe(false);
    expect(new Date(p1.items[0]!.fecha).getUTCSeconds()).toBe(119 % 60);
    const todas = [...p1.items, ...(await cargarHistorial(GESTIONA, "g1", 2)).items, ...p3.items];
    expect(new Set(todas.map((e) => e.id)).size).toBe(120);
  });
  it("etiquetas en castellano y actor: el usuario del estudio o el cliente", async () => {
    evento(1, { type: "SELECCION_FINALIZADA", actorUserId: 7, galeriaClienteId: "gc1" });
    evento(2, { type: "SELECCION_ENVIADA", galeriaClienteId: "gc1", data: { cantidad: 2 } });
    evento(3, { type: "SELECCION_REACTIVADA", actorUserId: 7, galeriaClienteId: "gc1" });
    const { items } = await cargarHistorial(GESTIONA, "g1");
    expect(items.map((e) => [e.etiqueta, e.actor, e.cliente, e.detalle])).toEqual([
      ["Selección devuelta al cliente para que siga eligiendo", "Ana Estudio", "Lucía Pérez", null],
      ["El cliente envió su selección", "Lucía Pérez", null, "Eligió 2 fotos"],
      ["Selección finalizada por el estudio", "Ana Estudio", "Lucía Pérez", null],
    ]);
  });
  it("no mezcla workspaces ni páginas inválidas", async () => {
    evento(1);
    expect((await cargarHistorial(OTRO_WS, "g1")).items).toEqual([]);
    expect((await cargarHistorial(SIN_ACCESO, "g1")).items).toEqual([]);
    expect((await cargarHistorial(GESTIONA, "g1", -4)).pagina).toBe(1);
  });
});
