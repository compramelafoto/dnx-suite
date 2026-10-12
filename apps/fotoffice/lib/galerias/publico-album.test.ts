import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/presupuestos/sitio", () => ({
  sitioDelWorkspace: async (ws: string) => ({ workspaceId: ws, slug: "dnxestudio", customDomain: null, nombre: "DNX Estudio", logoUrl: null, whatsapp: null, email: null }),
  workspaceDelSlug: async () => "ws-1",
}));
vi.mock("./almacen", () => ({
  urlsDeLecturaPorLote: async (fotos: { id: string; viewKey: string | null; thumbKey: string | null }[]) =>
    new Map(fotos.map((f) => [f.id, { thumbUrl: f.thumbKey ? `https://r2.test/${f.thumbKey}?firma` : null, viewUrl: f.viewKey ? `https://r2.test/${f.viewKey}?firma` : null }])),
  urlDeLecturaFoto: async (k: string) => `https://r2.test/${k}`,
  urlDeDescargaFoto: async (k: string) => `https://r2.test/${k}`,
  urlDeDescargaOriginal: async (k: string) => `https://r2.test/${k}`,
  urlDeReproduccionVideo: async (k: string) => `https://r2.test/${k}`,
}));

const A = await import("./publico-album");
const P = await import("./publico");
const { tokenDeGaleriaCliente, hashDeToken } = await import("./enlace");
const { MENSAJES_ALBUM: M } = await import("./album-reglas");

const CLAVE = "clave-de-prueba";
const EMITIDO = new Date("2026-10-01T12:00:00.000Z");
const AHORA = new Date("2026-10-11T15:30:00.000Z");
const token = (id: string) => tokenDeGaleriaCliente(id, EMITIDO, CLAVE);
const T1 = token("gc1");

function cliente(id: string, galeriaId = "ga", extra: Record<string, unknown> = {}) {
  B.agregar("fotofficeGaleriaCliente", { id, workspaceId: "ws-1", galeriaId, clientId: null, name: "Ana Gómez", email: "ana@x.com", tokenHash: hashDeToken(token(id)), tokenIssuedAt: EMITIDO, ...extra });
}
function lamina(id: string, rondaId: string | null, galeriaId = "ga", extra: Record<string, unknown> = {}) {
  B.agregar("fotofficeGaleriaFoto", {
    id, workspaceId: galeriaId === "g-ajena" ? "ws-2" : "ws-1", galeriaId, rondaId, fileName: `${id}.jpg`, originalKey: `o/${id}`, viewKey: `v/${id}`, thumbKey: `t/${id}`,
    status: "LISTA", width: 3000, height: 2000, order: 0, mediaType: "FOTO", ...extra,
  });
}
const comentarios = () => B.datos.fotofficeGaleriaComentario;
const decisiones = () => B.datos.fotofficeGaleriaDecision;
const estado = (id = "gc1") => B.datos.fotofficeGaleriaCliente.find((c) => c.id === id)!;
const tipos = () => B.datos.fotofficeGaleriaEvento.map((e) => e.type);

beforeEach(() => {
  B.vaciar();
  B.agregar("fotofficeGaleria", { id: "ga", workspaceId: "ws-1", proyectoId: "pr1", number: "G-1", name: "Álbum boda", kind: "ALBUM", status: "PUBLICADA", orderMode: "NOMBRE", downloadMode: "NINGUNA", allowComments: true });
  B.agregar("fotofficeGaleria", { id: "gs", workspaceId: "ws-1", proyectoId: "pr1", number: "G-2", name: "Selección", kind: "SELECCION", status: "PUBLICADA", orderMode: "NOMBRE", downloadMode: "NINGUNA", allowComments: true });
  B.agregar("fotofficeGaleria", { id: "g-ajena", workspaceId: "ws-2", proyectoId: "pr9", number: "G-1", name: "Ajena", kind: "ALBUM", status: "PUBLICADA" });
  B.agregar("fotofficeGaleria", { id: "gb", workspaceId: "ws-1", proyectoId: "pr1", number: "G-3", name: "Otro álbum", kind: "ALBUM", status: "PUBLICADA", orderMode: "NOMBRE" });
  B.agregar("fotofficeGaleriaRonda", { id: "r1", workspaceId: "ws-1", galeriaId: "ga", number: 1, status: "CERRADA", note: null, closedAt: new Date("2026-10-05") });
  B.agregar("fotofficeGaleriaRonda", { id: "r2", workspaceId: "ws-1", galeriaId: "ga", number: 2, status: "ABIERTA", note: "Corregimos la tapa." });
  B.agregar("fotofficeGaleriaRonda", { id: "rb", workspaceId: "ws-1", galeriaId: "gb", number: 1, status: "ABIERTA", note: null });
  B.agregar("fotofficeGaleriaRonda", { id: "r-ajena", workspaceId: "ws-2", galeriaId: "g-ajena", number: 1, status: "ABIERTA", note: null });
  cliente("gc1");
  cliente("gc-b", "gb");
  cliente("gc-sel", "gs");
  lamina("l-vieja", "r1");
  lamina("l1", "r2");
  lamina("l2", "r2");
  lamina("l-pend", "r2", "ga", { status: "PENDIENTE" });
  lamina("l-b", "rb", "gb");
  lamina("l-ajena", "r-ajena", "g-ajena");
  lamina("f-sel", null, "gs");
});

describe("la vista del álbum", () => {
  it("muestra la ronda abierta con sus láminas listas, la nota del estudio y nada de otras galerías", async () => {
    const r = await P.resolverTokenGaleria("ws-1", T1);
    if (!r.ok) throw new Error();
    expect(r.galeria.kind).toBe("ALBUM");
    const v = await A.armarVistaAlbum(r);
    expect(v.ronda).toEqual({ numero: 2, estado: "ABIERTA", nota: "Corregimos la tapa." });
    expect(v.rondas).toEqual([{ numero: 1, estado: "CERRADA" }, { numero: 2, estado: "ABIERTA" }]);
    expect(v.laminas.map((l) => l.id)).toEqual(["l1", "l2"]);
    expect(v.laminas[0]!.thumbUrl).toBe("https://r2.test/t/l1?firma");
    expect(v.puedeComentar).toBe(true);
    expect(v.decision).toBeNull();
    expect(JSON.stringify(v)).not.toMatch(/o\/l1|v\/l1|viewKey|originalKey|Key/);
  });
  it("una ronda anterior se ve en sólo lectura, con sus láminas y comentarios", async () => {
    B.agregar("fotofficeGaleriaComentario", { id: "c-viejo", workspaceId: "ws-1", galeriaClienteId: "gc1", fotoId: "l-vieja", rondaId: "r1", author: "CLIENTE", body: "Más grande", pinX: 0.1, pinY: 0.2, pinNumber: 1 });
    const r = await P.resolverTokenGaleria("ws-1", T1);
    if (!r.ok) throw new Error();
    const v = await A.armarVistaAlbum(r, 1);
    expect(v.ronda.estado).toBe("CERRADA");
    expect(v.laminas.map((l) => l.id)).toEqual(["l-vieja"]);
    expect(v.comentarios.map((c) => [c.texto, c.pinNumber, c.pinX, c.pinY])).toEqual([["Más grande", 1, 0.1, 0.2]]);
    expect(v.puedeComentar).toBe(false);
  });
  it("una ronda que no existe cae en la abierta", async () => {
    const r = await P.resolverTokenGaleria("ws-1", T1);
    if (!r.ok) throw new Error();
    expect((await A.armarVistaAlbum(r, 99)).ronda.numero).toBe(2);
  });
  it("no mezcla los comentarios de otro cliente ni de otra ronda", async () => {
    cliente("gc2");
    B.agregar("fotofficeGaleriaComentario", { id: "ajeno", workspaceId: "ws-1", galeriaClienteId: "gc2", fotoId: "l1", rondaId: "r2", author: "CLIENTE", body: "de otra persona" });
    B.agregar("fotofficeGaleriaComentario", { id: "mio", workspaceId: "ws-1", galeriaClienteId: "gc1", fotoId: "l1", rondaId: "r2", author: "CLIENTE", body: "mío" });
    B.agregar("fotofficeGaleriaComentario", { id: "resp", workspaceId: "ws-1", galeriaClienteId: "gc1", fotoId: "l1", rondaId: "r2", author: "ESTUDIO", body: "Listo", pinX: 0.5, pinY: 0.5, pinNumber: 1 });
    const r = await P.resolverTokenGaleria("ws-1", T1);
    if (!r.ok) throw new Error();
    const v = await A.armarVistaAlbum(r);
    expect(v.comentarios.map((c) => [c.id, c.autor])).toEqual([["mio", "CLIENTE"], ["resp", "ESTUDIO"]]);
  });
  it("tras decidir, la ronda queda de sólo lectura y trae la decisión", async () => {
    B.agregar("fotofficeGaleriaDecision", { id: "d1", workspaceId: "ws-1", galeriaClienteId: "gc1", rondaId: "r2", decision: "APROBADO", message: "Perfecto", createdAt: AHORA });
    estado().status = "EN_REVISION";
    const r = await P.resolverTokenGaleria("ws-1", T1);
    if (!r.ok) throw new Error();
    const v = await A.armarVistaAlbum(r);
    expect(v.puedeComentar).toBe(false);
    expect(v.decision).toMatchObject({ decision: "APROBADO", mensaje: "Perfecto" });
  });
});

describe("comentarLamina · pines y comentarios generales", () => {
  it("un comentario con pin guarda la posición, la ronda y el número 1; el siguiente de la misma lámina es el 2", async () => {
    const a = await A.comentarLamina("ws-1", T1, "l1", "  Subir el logo ", { x: 0.25, y: 0.5 });
    expect(a).toMatchObject({ ok: true, comentario: { fotoId: "l1", autor: "CLIENTE", texto: "Subir el logo", pinNumber: 1, pinX: 0.25, pinY: 0.5 } });
    const b = await A.comentarLamina("ws-1", T1, "l1", "Y acá", { x: 1, y: 0 });
    expect(b).toMatchObject({ ok: true, comentario: { pinNumber: 2 } });
    expect(comentarios().map((c) => [c.rondaId, c.galeriaClienteId, c.pinNumber])).toEqual([["r2", "gc1", 1], ["r2", "gc1", 2]]);
  });
  it("el número de pin cuenta por lámina y por cliente", async () => {
    cliente("gc2");
    await A.comentarLamina("ws-1", T1, "l1", "a", { x: 0.1, y: 0.1 });
    const otraLamina = await A.comentarLamina("ws-1", T1, "l2", "b", { x: 0.1, y: 0.1 });
    const otroCliente = await A.comentarLamina("ws-1", token("gc2"), "l1", "c", { x: 0.1, y: 0.1 });
    expect(otraLamina).toMatchObject({ ok: true, comentario: { pinNumber: 1 } });
    expect(otroCliente).toMatchObject({ ok: true, comentario: { pinNumber: 1 } });
  });
  it("un comentario general no lleva pin", async () => {
    const r = await A.comentarLamina("ws-1", T1, "l1", "Me encanta", undefined);
    expect(r).toMatchObject({ ok: true, comentario: { pinNumber: null, pinX: null, pinY: null } });
    expect(comentarios()[0]).toMatchObject({ pinX: null, pinY: null, pinNumber: null, rondaId: "r2" });
  });
  it.each([
    [{ x: 1.5, y: 0.5 }],
    [{ x: -1, y: 0.5 }],
    [{ x: 0.5 }],
    [{ x: NaN, y: 0.5 }],
    [{ x: Infinity, y: 0 }],
    [{ x: "0.5", y: "0.5" }],
    [[0.5, 0.5]],
  ])("rechaza el pin %j sin guardar nada", async (pin) => {
    expect(await A.comentarLamina("ws-1", T1, "l1", "hola", pin)).toEqual({ ok: false, error: M.pinInvalido, codigo: "REGLA" });
    expect(comentarios()).toHaveLength(0);
  });
  it("rechaza el texto vacío o demasiado largo", async () => {
    expect(await A.comentarLamina("ws-1", T1, "l1", "   ")).toMatchObject({ ok: false });
    expect(await A.comentarLamina("ws-1", T1, "l1", "x".repeat(2001))).toMatchObject({ ok: false });
    expect(await A.comentarLamina("ws-1", T1, "l1", 42 as never)).toMatchObject({ ok: false });
    expect(comentarios()).toHaveLength(0);
  });
  it("sólo en láminas LISTAS de la ronda abierta de esta galería", async () => {
    for (const id of ["l-vieja", "l-pend", "l-b", "l-ajena", "f-sel", "no-existe", "", 7 as never, null as never]) {
      expect(await A.comentarLamina("ws-1", T1, id, "hola", { x: 0.5, y: 0.5 }), String(id)).toMatchObject({ ok: false });
    }
    expect(comentarios()).toHaveLength(0);
  });
  it("una ronda cerrada no admite comentarios (si no queda ronda abierta, sólo lectura)", async () => {
    B.datos.fotofficeGaleriaRonda.find((x) => x.id === "r2")!.status = "CERRADA";
    expect(await A.comentarLamina("ws-1", T1, "l1", "hola")).toEqual({ ok: false, error: M.rondaCerrada, codigo: "SOLO_LECTURA" });
  });
  it("comentar una lámina que era de la ronda anterior después de abrir otra se rechaza", async () => {
    expect(await A.comentarLamina("ws-1", T1, "l-vieja", "hola")).toEqual({ ok: false, error: M.laminaInvalida, codigo: "REGLA" });
  });
  it("después de decidir (EN_REVISION) es de sólo lectura", async () => {
    estado().status = "EN_REVISION";
    expect(await A.comentarLamina("ws-1", T1, "l1", "tarde")).toEqual({ ok: false, error: M.yaDecidiste, codigo: "SOLO_LECTURA" });
    expect(comentarios()).toHaveLength(0);
  });
  it("tope de 300 comentarios por cliente y ronda (los de otras rondas no cuentan)", async () => {
    for (let i = 0; i < 299; i++) B.agregar("fotofficeGaleriaComentario", { workspaceId: "ws-1", galeriaClienteId: "gc1", fotoId: "l-vieja", rondaId: "r1", author: "CLIENTE", body: "viejo" });
    expect(await A.comentarLamina("ws-1", T1, "l1", "cabe")).toMatchObject({ ok: true });
    for (let i = 0; i < 299; i++) B.agregar("fotofficeGaleriaComentario", { workspaceId: "ws-1", galeriaClienteId: "gc1", fotoId: "l1", rondaId: "r2", author: "CLIENTE", body: "nuevo" });
    expect(await A.comentarLamina("ws-1", T1, "l1", "no cabe")).toEqual({ ok: false, error: M.topeComentarios, codigo: "TOPE" });
  });
  it("las respuestas del estudio no cuentan para el tope", async () => {
    for (let i = 0; i < 300; i++) B.agregar("fotofficeGaleriaComentario", { workspaceId: "ws-1", galeriaClienteId: "gc1", fotoId: "l1", rondaId: "r2", author: "ESTUDIO", body: "resp" });
    expect(await A.comentarLamina("ws-1", T1, "l1", "cabe")).toMatchObject({ ok: true });
  });
});

describe("comentarLamina · el token manda", () => {
  it("token inválido, de otra organización, anulado o de una galería sin publicar: el mismo rechazo", async () => {
    const mudo = { ok: false, error: "Este enlace ya no es válido.", codigo: "INVALIDO" };
    expect(await A.comentarLamina("ws-1", "basura", "l1", "x")).toEqual(mudo);
    expect(await A.comentarLamina("ws-2", T1, "l1", "x")).toEqual(mudo);
    expect(await A.comentarLamina("ws-1", undefined, "l1", "x")).toEqual(mudo);
    estado().revokedAt = new Date();
    expect(await A.comentarLamina("ws-1", T1, "l1", "x")).toEqual(mudo);
    estado().revokedAt = null;
    B.datos.fotofficeGaleria.find((g) => g.id === "ga")!.status = "ARCHIVADA";
    expect(await A.comentarLamina("ws-1", T1, "l1", "x")).toEqual(mudo);
    expect(comentarios()).toHaveLength(0);
  });
  it("el token de OTRA galería no deja comentar láminas de ésta", async () => {
    expect(await A.comentarLamina("ws-1", token("gc-b"), "l1", "x", { x: 0.5, y: 0.5 })).toMatchObject({ ok: false });
    expect(comentarios()).toHaveLength(0);
    // En la suya sí.
    expect(await A.comentarLamina("ws-1", token("gc-b"), "l-b", "x")).toMatchObject({ ok: true });
  });
  it("una galería que no es un álbum no usa este camino", async () => {
    expect(await A.comentarLamina("ws-1", token("gc-sel"), "f-sel", "x")).toEqual({ ok: false, error: M.noEsAlbum, codigo: "REGLA" });
    expect(await A.decidirAlbum("ws-1", token("gc-sel"), "APROBADO", null)).toEqual({ ok: false, error: M.noEsAlbum, codigo: "REGLA" });
  });
  it("el comentario viejo de selección tampoco sirve en un álbum", async () => {
    expect(await P.comentarFoto("ws-1", T1, "l1", "x")).toMatchObject({ ok: false });
    expect(comentarios()).toHaveLength(0);
  });
});

describe("decidirAlbum", () => {
  it("aprobar pasa a EN_REVISION, guarda la decisión de la ronda abierta, el historial y devuelve lo del correo", async () => {
    const r = await A.decidirAlbum("ws-1", T1, "APROBADO", "  Gracias \n", AHORA);
    expect(r).toMatchObject({ ok: true, decision: "APROBADO", aviso: { galeriaId: "ga", galeriaClienteId: "gc1", rondaNumero: 2, decision: "APROBADO", mensaje: "Gracias", comentarios: 0 } });
    expect(estado()).toMatchObject({ status: "EN_REVISION", submittedAt: AHORA, submitMessage: "Gracias" });
    expect(decisiones()).toMatchObject([{ galeriaClienteId: "gc1", rondaId: "r2", decision: "APROBADO", message: "Gracias" }]);
    expect(tipos()).toEqual(["ALBUM_APROBADO"]);
    expect(B.datos.fotofficeGaleriaEvento[0]).toMatchObject({ galeriaId: "ga", galeriaClienteId: "gc1", data: { ronda: 2, comentarios: 0 } });
  });
  it("pedir cambios sin comentarios ni mensaje se rechaza y no cambia nada", async () => {
    expect(await A.decidirAlbum("ws-1", T1, "CAMBIOS", "  ", AHORA)).toEqual({ ok: false, error: M.cambiosSinNada, codigo: "REGLA" });
    expect(estado().status).toBe("EN_PROGRESO");
    expect(decisiones()).toHaveLength(0);
    expect(tipos()).toEqual([]);
  });
  it("pedir cambios con un mensaje, o con un comentario suyo en esta ronda, funciona", async () => {
    expect(await A.decidirAlbum("ws-1", T1, "CAMBIOS", "Cambiar todo", AHORA)).toMatchObject({ ok: true, decision: "CAMBIOS" });
    expect(tipos()).toEqual(["ALBUM_CAMBIOS_PEDIDOS"]);
    // Con comentario y sin mensaje.
    B.vaciar();
    B.agregar("fotofficeGaleria", { id: "ga", workspaceId: "ws-1", proyectoId: "pr1", number: "G-1", name: "Álbum", kind: "ALBUM", status: "PUBLICADA", orderMode: "NOMBRE" });
    B.agregar("fotofficeGaleriaRonda", { id: "r2", workspaceId: "ws-1", galeriaId: "ga", number: 2, status: "ABIERTA" });
    cliente("gc1");
    lamina("l1", "r2");
    await A.comentarLamina("ws-1", T1, "l1", "Mover el título", { x: 0.2, y: 0.3 });
    expect(await A.decidirAlbum("ws-1", T1, "CAMBIOS", null, AHORA)).toMatchObject({ ok: true, aviso: { comentarios: 1, mensaje: null } });
    expect(decisiones()).toMatchObject([{ decision: "CAMBIOS", message: null }]);
  });
  it("los comentarios de una ronda anterior o las respuestas del estudio no alcanzan para pedir cambios", async () => {
    B.agregar("fotofficeGaleriaComentario", { workspaceId: "ws-1", galeriaClienteId: "gc1", fotoId: "l-vieja", rondaId: "r1", author: "CLIENTE", body: "viejo" });
    B.agregar("fotofficeGaleriaComentario", { workspaceId: "ws-1", galeriaClienteId: "gc1", fotoId: "l1", rondaId: "r2", author: "ESTUDIO", body: "resp" });
    expect(await A.decidirAlbum("ws-1", T1, "CAMBIOS", null, AHORA)).toMatchObject({ ok: false, error: M.cambiosSinNada });
  });
  it("una decisión desconocida o un mensaje larguísimo se rechazan", async () => {
    expect(await A.decidirAlbum("ws-1", T1, "TAL_VEZ", null)).toMatchObject({ ok: false, error: M.decisionInvalida });
    expect(await A.decidirAlbum("ws-1", T1, "APROBADO", "x".repeat(2001))).toMatchObject({ ok: false, error: M.mensajeLargo });
    expect(estado().status).toBe("EN_PROGRESO");
  });
  it("la segunda decisión (otra pestaña) no pasa: queda una sola", async () => {
    expect(await A.decidirAlbum("ws-1", T1, "APROBADO", null, AHORA)).toMatchObject({ ok: true });
    expect(await A.decidirAlbum("ws-1", T1, "CAMBIOS", "me arrepentí", AHORA)).toEqual({ ok: false, error: M.yaDecidiste, codigo: "SOLO_LECTURA" });
    expect(decisiones()).toHaveLength(1);
    expect(tipos()).toEqual(["ALBUM_APROBADO"]);
  });
  it("si la decisión no se puede guardar (único), la transacción no deja el estado a medias", async () => {
    // Una decisión previa de esa ronda sin que el cliente figure EN_REVISION: el único la frena y todo se deshace.
    B.agregar("fotofficeGaleriaDecision", { workspaceId: "ws-1", galeriaClienteId: "gc1", rondaId: "r2", decision: "APROBADO", message: null });
    expect(await A.decidirAlbum("ws-1", T1, "APROBADO", null, AHORA)).toEqual({ ok: false, error: M.yaDecidiste, codigo: "SOLO_LECTURA" });
    expect(estado().status).toBe("EN_PROGRESO");
    expect(tipos()).toEqual([]);
  });
  it("si el estudio cerró la ronda justo antes, no guarda y avisa", async () => {
    // La ronda se cierra entre que se lee y que se escribe.
    const original = B.tablas.fotofficeGaleriaRonda.findFirst;
    let llamadas = 0;
    B.tablas.fotofficeGaleriaRonda.findFirst = async (...args: Parameters<typeof original>) => {
      const r = await original(...args);
      llamadas += 1;
      if (llamadas === 1) B.datos.fotofficeGaleriaRonda.find((x) => x.id === "r2")!.status = "CERRADA";
      return r;
    };
    try {
      expect(await A.decidirAlbum("ws-1", T1, "APROBADO", null, AHORA)).toEqual({ ok: false, error: M.rondaCambio, codigo: "SOLO_LECTURA" });
    } finally {
      B.tablas.fotofficeGaleriaRonda.findFirst = original;
    }
    expect(estado().status).toBe("EN_PROGRESO");
    expect(decisiones()).toHaveLength(0);
  });
  it("token anulado, de otra organización o de una galería sin publicar: nada", async () => {
    estado().revokedAt = new Date();
    expect(await A.decidirAlbum("ws-1", T1, "APROBADO", null)).toMatchObject({ ok: false, codigo: "INVALIDO" });
    estado().revokedAt = null;
    expect(await A.decidirAlbum("ws-2", T1, "APROBADO", null)).toMatchObject({ ok: false, codigo: "INVALIDO" });
    expect(decisiones()).toHaveLength(0);
  });
  it("el token de otra galería decide sobre SU ronda, nunca sobre la de ésta", async () => {
    expect(await A.decidirAlbum("ws-1", token("gc-b"), "APROBADO", null, AHORA)).toMatchObject({ ok: true, aviso: { galeriaId: "gb" } });
    expect(decisiones()).toMatchObject([{ galeriaClienteId: "gc-b", rondaId: "rb" }]);
    expect(estado("gc1").status).toBe("EN_PROGRESO");
  });
  it("sin ronda abierta no se puede decidir", async () => {
    B.datos.fotofficeGaleriaRonda.find((x) => x.id === "r2")!.status = "CERRADA";
    expect(await A.decidirAlbum("ws-1", T1, "APROBADO", null)).toEqual({ ok: false, error: M.rondaCerrada, codigo: "SOLO_LECTURA" });
  });
  it("con una ronda nueva el cliente puede decidir de nuevo (una decisión por ronda)", async () => {
    await A.decidirAlbum("ws-1", T1, "CAMBIOS", "retocar", AHORA);
    // El estudio abre la ronda 3: cierra la 2 y los clientes vuelven a EN_PROGRESO.
    B.datos.fotofficeGaleriaRonda.find((x) => x.id === "r2")!.status = "CERRADA";
    B.agregar("fotofficeGaleriaRonda", { id: "r3", workspaceId: "ws-1", galeriaId: "ga", number: 3, status: "ABIERTA" });
    estado().status = "EN_PROGRESO";
    expect(await A.decidirAlbum("ws-1", T1, "APROBADO", null, AHORA)).toMatchObject({ ok: true, aviso: { rondaNumero: 3 } });
    expect(decisiones().map((d) => [d.rondaId, d.decision])).toEqual([["r2", "CAMBIOS"], ["r3", "APROBADO"]]);
  });
});
