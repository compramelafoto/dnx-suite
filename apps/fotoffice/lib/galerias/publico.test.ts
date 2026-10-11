import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/presupuestos/sitio", () => ({
  sitioDelWorkspace: async (ws: string) => ({ workspaceId: ws, slug: "dnxestudio", customDomain: null, nombre: "DNX Estudio", logoUrl: "https://logo.test/l.png", whatsapp: null, email: null }),
  workspaceDelSlug: async () => "ws-1",
}));
const firmarLote = vi.fn(async (fotos: { id: string; viewKey: string | null; thumbKey: string | null }[]) =>
  new Map(fotos.map((f) => [f.id, { thumbUrl: f.thumbKey ? `https://r2.test/${f.thumbKey}?firma` : null, viewUrl: f.viewKey ? `https://r2.test/${f.viewKey}?firma` : null }])),
);
const firmarUna = vi.fn(async (clave: string) => `https://r2.test/${clave}?firma`);
const firmarDescarga = vi.fn(async (clave: string, nombre: { ascii: string }) => `https://r2.test/${clave}?descarga=${nombre.ascii}`);
vi.mock("./almacen", () => ({
  urlsDeLecturaPorLote: firmarLote,
  urlDeLecturaFoto: firmarUna,
  urlDeDescargaFoto: firmarDescarga,
}));

const P = await import("./publico");
const { tokenDeGaleriaCliente, hashDeToken } = await import("./enlace");
const { MAX_COMENTARIOS_POR_CLIENTE } = await import("./constantes");
const { MENSAJES_PUBLICO: M } = await import("./publico-tipos");

const CLAVE = "clave-de-prueba";
const EMITIDO = new Date("2026-10-01T12:00:00.000Z");
const AHORA = new Date("2026-10-10T15:00:00.000Z");
const token = (id: string) => tokenDeGaleriaCliente(id, EMITIDO, CLAVE);
const TOKEN1 = token("gc1");

const cliente = (id = "gc1") => B.datos.fotofficeGaleriaCliente.find((c) => c.id === id)!;
const selecciones = (id = "gc1") => B.datos.fotofficeGaleriaSeleccion.filter((s) => s.galeriaClienteId === id).map((s) => s.fotoId).sort();
const eventos = () => B.datos.fotofficeGaleriaEvento.map((e) => e.type);

function sembrarCliente(id: string, extra: Record<string, unknown> = {}) {
  B.agregar("fotofficeGaleriaCliente", {
    id, workspaceId: "ws-1", galeriaId: "g1", clientId: null, name: "Ana Gómez", email: "ana@x.com", tokenHash: hashDeToken(token(id)),
    tokenIssuedAt: EMITIDO, ...extra,
  });
}
function sembrarFoto(id: string, galeriaId = "g1", extra: Record<string, unknown> = {}) {
  B.agregar("fotofficeGaleriaFoto", {
    id, workspaceId: galeriaId === "g-ajena" ? "ws-2" : "ws-1", galeriaId, fileName: `${id}.jpg`, originalKey: `o/${id}`,
    viewKey: `v/${id}`, thumbKey: `t/${id}`, status: "LISTA", width: 3000, height: 2000, order: 0, ...extra,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  B.vaciar();
  B.agregar("fotofficeGaleria", { id: "g1", workspaceId: "ws-1", proyectoId: "pr1", number: "G-1", name: "Boda", message: "Elegí tus fotos", status: "PUBLICADA", ownerUserId: 7, orderMode: "NOMBRE" });
  B.agregar("fotofficeGaleria", { id: "g2", workspaceId: "ws-1", proyectoId: "pr1", number: "G-2", name: "Otra", status: "PUBLICADA" });
  B.agregar("fotofficeGaleria", { id: "g-borrador", workspaceId: "ws-1", proyectoId: "pr1", number: "G-3", name: "Borrador", status: "BORRADOR" });
  B.agregar("fotofficeGaleria", { id: "g-ajena", workspaceId: "ws-2", proyectoId: "pr9", number: "G-1", name: "Ajena", status: "PUBLICADA" });
  sembrarCliente("gc1");
  for (const id of ["f1", "f2", "f3", "f10"]) sembrarFoto(id);
  sembrarFoto("f-otra-galeria", "g2");
  sembrarFoto("f-ajena", "g-ajena");
  sembrarFoto("f-pendiente", "g1", { status: "PENDIENTE", viewKey: null, thumbKey: null });
});

describe("resolver el token", () => {
  it("un token vigente resuelve cliente y galería", async () => {
    const r = await P.resolverTokenGaleria("ws-1", TOKEN1);
    expect(r).toMatchObject({ ok: true, workspaceId: "ws-1", cliente: { id: "gc1", status: "EN_PROGRESO" }, galeria: { id: "g1", name: "Boda" } });
  });
  it.each([
    ["con forma pero desconocido", "A".repeat(43)],
    ["con forma inválida", "xyz"],
    ["vacío", ""],
    ["no es texto", 123],
    ["nulo", null],
  ])("token %s: no válido", async (_n, t) => {
    expect(await P.resolverTokenGaleria("ws-1", t)).toEqual({ ok: false });
  });
  it("el token de OTRA organización no sirve (workspace del slug distinto)", async () => {
    expect(await P.resolverTokenGaleria("ws-2", TOKEN1)).toEqual({ ok: false });
  });
  it("un token anulado no sirve", async () => {
    cliente().revokedAt = AHORA;
    expect(await P.resolverTokenGaleria("ws-1", TOKEN1)).toEqual({ ok: false });
  });
  it("galería en borrador o archivada: no sirve", async () => {
    sembrarCliente("gcb", { galeriaId: "g-borrador" });
    expect(await P.resolverTokenGaleria("ws-1", token("gcb"))).toEqual({ ok: false });
    B.datos.fotofficeGaleria.find((g) => g.id === "g1")!.status = "ARCHIVADA";
    expect(await P.resolverTokenGaleria("ws-1", TOKEN1)).toEqual({ ok: false });
  });
  it("un token regenerado reemplaza al viejo (el hash guardado ya no coincide)", async () => {
    cliente().tokenHash = hashDeToken(tokenDeGaleriaCliente("gc1", new Date("2026-10-05T00:00:00Z"), CLAVE));
    expect(await P.resolverTokenGaleria("ws-1", TOKEN1)).toEqual({ ok: false });
  });
});

describe("entrada", () => {
  it("la primera vez deja firstSeenAt y el evento ENTRO", async () => {
    const r = await P.resolverTokenGaleria("ws-1", TOKEN1);
    if (!r.ok) throw new Error();
    await P.registrarEntrada(r, AHORA);
    expect(cliente().firstSeenAt).toEqual(AHORA);
    expect(cliente().lastSeenAt).toEqual(AHORA);
    expect(eventos()).toEqual(["ENTRO"]);
  });
  it("después sólo actualiza lastSeenAt y a lo sumo cada 5 minutos, sin repetir el evento", async () => {
    const r = await P.resolverTokenGaleria("ws-1", TOKEN1);
    if (!r.ok) throw new Error();
    await P.registrarEntrada(r, AHORA);
    await P.registrarEntrada(r, new Date(AHORA.getTime() + 2 * 60_000));
    expect(cliente().lastSeenAt).toEqual(AHORA);
    const luego = new Date(AHORA.getTime() + 6 * 60_000);
    await P.registrarEntrada(r, luego);
    expect(cliente().lastSeenAt).toEqual(luego);
    expect(cliente().firstSeenAt).toEqual(AHORA);
    expect(eventos()).toEqual(["ENTRO"]);
  });
  it("no guarda datos personales en el evento", async () => {
    const r = await P.resolverTokenGaleria("ws-1", TOKEN1);
    if (!r.ok) throw new Error();
    await P.registrarEntrada(r, AHORA);
    expect(JSON.stringify(B.datos.fotofficeGaleriaEvento)).not.toMatch(/ana@x\.com|Ana|Gómez/);
  });
});

describe("la vista", () => {
  it("trae las fotos LISTAS en orden natural, con miniatura firmada, sin claves ni fotos de otras galerías", async () => {
    B.agregar("fotofficeGaleriaSeleccion", { workspaceId: "ws-1", galeriaClienteId: "gc1", fotoId: "f2" });
    B.agregar("fotofficeGaleriaComentario", { workspaceId: "ws-1", galeriaClienteId: "gc1", fotoId: "f1", author: "CLIENTE", body: "Más clara" });
    B.agregar("fotofficeGaleriaComentario", { workspaceId: "ws-1", galeriaClienteId: "gc1", fotoId: "f1", author: "ESTUDIO", authorUserId: 7, body: "Listo" });
    const r = await P.resolverTokenGaleria("ws-1", TOKEN1);
    if (!r.ok) throw new Error();
    const v = await P.armarVistaGaleria(r);
    expect(v.fotos.map((f) => f.id)).toEqual(["f1", "f2", "f3", "f10"]);
    expect(v.fotos[0]!.thumbUrl).toBe("https://r2.test/t/f1?firma");
    expect(v.seleccionadas).toEqual(["f2"]);
    expect(v.comentarios.map((c) => [c.autor, c.texto])).toEqual([["CLIENTE", "Más clara"], ["ESTUDIO", "Listo"]]);
    expect(v.galeria).toMatchObject({ nombre: "Boda", mensaje: "Elegí tus fotos", permiteComentarios: true, permiteDescarga: true });
    expect(v.cliente).toMatchObject({ nombre: "Ana Gómez", estado: "EN_PROGRESO", enviadaEn: null });
    const json = JSON.stringify(v);
    for (const prohibido of ["originalKey", "o/f1", "v/f1", "tokenHash", "ana@x.com", "f-otra-galeria", "f-ajena", "f-pendiente"]) expect(json).not.toContain(prohibido);
    // Las miniaturas se firman en lote; las vistas no (van a pedido).
    expect(firmarLote.mock.calls[0]![0].every((f) => f.viewKey === null)).toBe(true);
  });
  it("la portada va firmada si es una foto lista de la galería", async () => {
    B.datos.fotofficeGaleria.find((g) => g.id === "g1")!.coverFotoId = "f3";
    const r = await P.resolverTokenGaleria("ws-1", TOKEN1);
    if (!r.ok) throw new Error();
    expect((await P.armarVistaGaleria(r)).portadaUrl).toBe("https://r2.test/v/f3?firma");
  });
  it("en selección por cantidad informa mínimo y máximo; en libre, ninguno", async () => {
    const g = B.datos.fotofficeGaleria.find((x) => x.id === "g1")!;
    Object.assign(g, { selectionMode: "CANTIDAD", minSelect: 2, maxSelect: 3 });
    const r = await P.resolverTokenGaleria("ws-1", TOKEN1);
    if (!r.ok) throw new Error();
    expect((await P.armarVistaGaleria(r)).galeria).toMatchObject({ modo: "CANTIDAD", minimo: 2, maximo: 3 });
  });
  it("sin descarga cuando la galería no la permite", async () => {
    B.datos.fotofficeGaleria.find((g) => g.id === "g1")!.downloadMode = "NINGUNA";
    const r = await P.resolverTokenGaleria("ws-1", TOKEN1);
    if (!r.ok) throw new Error();
    expect((await P.armarVistaGaleria(r)).galeria.permiteDescarga).toBe(false);
  });
});

describe("vistas grandes y descarga", () => {
  it("firma sólo las fotos de la galería del cliente", async () => {
    const r = await P.urlsDeVista("ws-1", TOKEN1, ["f1", "f-otra-galeria", "f-ajena", "f-pendiente", "no-existe"]);
    expect(r).toEqual({ ok: true, urls: { f1: "https://r2.test/v/f1?firma" } });
  });
  it("tope por llamada y entradas raras", async () => {
    const muchos = Array.from({ length: 50 }, (_, i) => `x${i}`);
    expect(await P.urlsDeVista("ws-1", TOKEN1, muchos)).toEqual({ ok: true, urls: {} });
    expect(await P.urlsDeVista("ws-1", TOKEN1, "f1")).toEqual({ ok: true, urls: {} });
    expect(await P.urlsDeVista("ws-1", TOKEN1, [1, null, {}])).toEqual({ ok: true, urls: {} });
  });
  it("token inválido: no firma nada", async () => {
    expect(await P.urlsDeVista("ws-2", TOKEN1, ["f1"])).toMatchObject({ ok: false, codigo: "INVALIDO" });
    expect(firmarLote).not.toHaveBeenCalled();
  });
  it("descarga de la vista: sólo con downloadMode VISTA y con una foto propia", async () => {
    expect(await P.urlDeDescarga("ws-1", TOKEN1, "f1")).toEqual({ ok: true, url: "https://r2.test/v/f1?descarga=f1.jpg" });
    expect(await P.urlDeDescarga("ws-1", TOKEN1, "f-otra-galeria")).toMatchObject({ ok: false, error: M.fotoInvalida });
    expect(await P.urlDeDescarga("ws-1", TOKEN1, "f-ajena")).toMatchObject({ ok: false, error: M.fotoInvalida });
    B.datos.fotofficeGaleria.find((g) => g.id === "g1")!.downloadMode = "NINGUNA";
    expect(await P.urlDeDescarga("ws-1", TOKEN1, "f1")).toMatchObject({ ok: false, error: M.sinDescarga });
    B.datos.fotofficeGaleria.find((g) => g.id === "g1")!.downloadMode = "SELECCIONADAS";
    expect(await P.urlDeDescarga("ws-1", TOKEN1, "f1")).toMatchObject({ ok: false, error: M.sinDescarga });
  });
  it("la descarga también pasa por el token", async () => {
    cliente().revokedAt = AHORA;
    expect(await P.urlDeDescarga("ws-1", TOKEN1, "f1")).toMatchObject({ ok: false, codigo: "INVALIDO" });
  });
});

describe("elegir y quitar", () => {
  it("elegir es idempotente y devuelve la cantidad", async () => {
    expect(await P.elegirFoto("ws-1", TOKEN1, "f1", true)).toEqual({ ok: true, cantidad: 1 });
    expect(await P.elegirFoto("ws-1", TOKEN1, "f1", true)).toEqual({ ok: true, cantidad: 1 });
    expect(await P.elegirFoto("ws-1", TOKEN1, "f2", true)).toEqual({ ok: true, cantidad: 2 });
    expect(selecciones()).toEqual(["f1", "f2"]);
  });
  it("quitar saca la foto, y quitar una que no estaba no falla", async () => {
    await P.elegirFoto("ws-1", TOKEN1, "f1", true);
    expect(await P.elegirFoto("ws-1", TOKEN1, "f1", false)).toEqual({ ok: true, cantidad: 0 });
    expect(await P.elegirFoto("ws-1", TOKEN1, "f1", false)).toEqual({ ok: true, cantidad: 0 });
  });
  it("una foto de otra galería, de otra organización, pendiente o inexistente se rechaza", async () => {
    for (const id of ["f-otra-galeria", "f-ajena", "f-pendiente", "nada", 5, null, undefined]) {
      expect(await P.elegirFoto("ws-1", TOKEN1, id, true), String(id)).toMatchObject({ ok: false, error: M.fotoInvalida });
    }
    expect(selecciones()).toEqual([]);
  });
  it("marcar tiene que ser un booleano", async () => {
    expect(await P.elegirFoto("ws-1", TOKEN1, "f1", "true")).toMatchObject({ ok: false });
    expect(selecciones()).toEqual([]);
  });
  it("el token de otro cliente de la misma galería sólo toca su propia selección", async () => {
    sembrarCliente("gc2", { name: "Luis" });
    await P.elegirFoto("ws-1", token("gc2"), "f1", true);
    await P.elegirFoto("ws-1", TOKEN1, "f2", true);
    expect(selecciones("gc1")).toEqual(["f2"]);
    expect(selecciones("gc2")).toEqual(["f1"]);
  });
  it("por cantidad: no deja pasar el máximo (pero quitar sí)", async () => {
    Object.assign(B.datos.fotofficeGaleria.find((g) => g.id === "g1")!, { selectionMode: "CANTIDAD", minSelect: 1, maxSelect: 2 });
    await P.elegirFoto("ws-1", TOKEN1, "f1", true);
    await P.elegirFoto("ws-1", TOKEN1, "f2", true);
    expect(await P.elegirFoto("ws-1", TOKEN1, "f3", true)).toMatchObject({ ok: false, error: "Ya elegiste el máximo: 2 fotos." });
    expect(await P.elegirFoto("ws-1", TOKEN1, "f1", false)).toEqual({ ok: true, cantidad: 1 });
    expect(await P.elegirFoto("ws-1", TOKEN1, "f3", true)).toEqual({ ok: true, cantidad: 2 });
  });
  it.each(["EN_REVISION", "FINALIZADO"])("con la selección en %s es de sólo lectura", async (estado) => {
    cliente().status = estado;
    expect(await P.elegirFoto("ws-1", TOKEN1, "f1", true)).toMatchObject({ ok: false, codigo: "SOLO_LECTURA" });
    expect(await P.elegirFoto("ws-1", TOKEN1, "f1", false)).toMatchObject({ ok: false, codigo: "SOLO_LECTURA" });
    expect(selecciones()).toEqual([]);
  });
  it("token inválido (anulado, galería en borrador): no escribe", async () => {
    cliente().revokedAt = AHORA;
    expect(await P.elegirFoto("ws-1", TOKEN1, "f1", true)).toMatchObject({ ok: false, codigo: "INVALIDO" });
    expect(selecciones()).toEqual([]);
  });
});

describe("comentar", () => {
  it("guarda el comentario del cliente, recortado, en su foto", async () => {
    const r = await P.comentarFoto("ws-1", TOKEN1, "f1", "  Me gusta   \r\nmucho ");
    expect(r).toMatchObject({ ok: true, comentario: { fotoId: "f1", autor: "CLIENTE", texto: "Me gusta   \nmucho" } });
    expect(B.datos.fotofficeGaleriaComentario).toHaveLength(1);
    expect(B.datos.fotofficeGaleriaComentario[0]).toMatchObject({ galeriaClienteId: "gc1", author: "CLIENTE", authorUserId: null });
  });
  it("vacío, sólo espacios o más de 2000 caracteres: se rechaza", async () => {
    expect(await P.comentarFoto("ws-1", TOKEN1, "f1", "")).toMatchObject({ ok: false });
    expect(await P.comentarFoto("ws-1", TOKEN1, "f1", "   \n ")).toMatchObject({ ok: false });
    expect(await P.comentarFoto("ws-1", TOKEN1, "f1", 12)).toMatchObject({ ok: false });
    expect(await P.comentarFoto("ws-1", TOKEN1, "f1", "a".repeat(2001))).toMatchObject({ ok: false });
    expect(await P.comentarFoto("ws-1", TOKEN1, "f1", "a".repeat(2000))).toMatchObject({ ok: true });
    expect(B.datos.fotofficeGaleriaComentario).toHaveLength(1);
  });
  it("no deja comentar una foto de otra galería ni de otra organización", async () => {
    expect(await P.comentarFoto("ws-1", TOKEN1, "f-otra-galeria", "hola")).toMatchObject({ ok: false, error: M.fotoInvalida });
    expect(await P.comentarFoto("ws-1", TOKEN1, "f-ajena", "hola")).toMatchObject({ ok: false, error: M.fotoInvalida });
    expect(B.datos.fotofficeGaleriaComentario).toHaveLength(0);
  });
  it("si la galería no admite comentarios, se rechaza", async () => {
    B.datos.fotofficeGaleria.find((g) => g.id === "g1")!.allowComments = false;
    expect(await P.comentarFoto("ws-1", TOKEN1, "f1", "hola")).toMatchObject({ ok: false, error: M.sinComentarios });
  });
  it("tope de 300 comentarios del cliente (las respuestas del estudio no cuentan)", async () => {
    for (let i = 0; i < MAX_COMENTARIOS_POR_CLIENTE - 1; i++) B.agregar("fotofficeGaleriaComentario", { workspaceId: "ws-1", galeriaClienteId: "gc1", fotoId: "f1", author: "CLIENTE", body: `c${i}` });
    for (let i = 0; i < 20; i++) B.agregar("fotofficeGaleriaComentario", { workspaceId: "ws-1", galeriaClienteId: "gc1", fotoId: "f1", author: "ESTUDIO", body: `e${i}` });
    expect(await P.comentarFoto("ws-1", TOKEN1, "f1", "el 300")).toMatchObject({ ok: true });
    expect(await P.comentarFoto("ws-1", TOKEN1, "f1", "el 301")).toMatchObject({ ok: false, codigo: "TOPE", error: M.topeComentarios });
  });
  it("con la selección enviada ya no se comenta", async () => {
    cliente().status = "EN_REVISION";
    expect(await P.comentarFoto("ws-1", TOKEN1, "f1", "hola")).toMatchObject({ ok: false, codigo: "SOLO_LECTURA" });
  });
  it("token inválido: no escribe", async () => {
    expect(await P.comentarFoto("ws-2", TOKEN1, "f1", "hola")).toMatchObject({ ok: false, codigo: "INVALIDO" });
    expect(B.datos.fotofficeGaleriaComentario).toHaveLength(0);
  });
});

describe("enviar", () => {
  async function elegir(...ids: string[]) {
    for (const id of ids) await P.elegirFoto("ws-1", TOKEN1, id, true);
  }
  it("pasa a EN_REVISION con fecha y mensaje, deja el evento y devuelve lo que necesita after()", async () => {
    await elegir("f1", "f2");
    const r = await P.enviarSeleccion("ws-1", TOKEN1, "  La 1 en grande ", AHORA);
    expect(r).toMatchObject({ ok: true, cantidad: 2, aviso: { workspaceId: "ws-1", galeriaId: "g1", galeriaClienteId: "gc1", cantidad: 2 } });
    expect(cliente()).toMatchObject({ status: "EN_REVISION", submittedAt: AHORA, submitMessage: "La 1 en grande" });
    expect(eventos()).toEqual(["SELECCION_ENVIADA"]);
    expect(B.datos.fotofficeGaleriaEvento[0]!.data).toEqual({ cantidad: 2 });
  });
  it("el mensaje es opcional: vacío queda en null", async () => {
    await elegir("f1");
    await P.enviarSeleccion("ws-1", TOKEN1, "   ", AHORA);
    expect(cliente().submitMessage).toBeNull();
  });
  it("mensaje de más de 1000 caracteres: se rechaza y no cambia nada", async () => {
    await elegir("f1");
    expect(await P.enviarSeleccion("ws-1", TOKEN1, "a".repeat(1001), AHORA)).toMatchObject({ ok: false, error: M.mensajeLargo });
    expect(await P.enviarSeleccion("ws-1", TOKEN1, 55, AHORA)).toMatchObject({ ok: false });
    expect(cliente().status).toBe("EN_PROGRESO");
    expect(await P.enviarSeleccion("ws-1", TOKEN1, "a".repeat(1000), AHORA)).toMatchObject({ ok: true });
  });
  it("sin fotos elegidas no se puede enviar", async () => {
    expect(await P.enviarSeleccion("ws-1", TOKEN1, "", AHORA)).toMatchObject({ ok: false, error: "Elegí al menos una foto antes de enviar." });
    expect(cliente().status).toBe("EN_PROGRESO");
  });
  it("por cantidad: valida el mínimo y el máximo con lo que hay en la base", async () => {
    Object.assign(B.datos.fotofficeGaleria.find((g) => g.id === "g1")!, { selectionMode: "CANTIDAD", minSelect: 2, maxSelect: 3 });
    await elegir("f1");
    expect(await P.enviarSeleccion("ws-1", TOKEN1, "", AHORA)).toMatchObject({ ok: false, error: "Tenés que elegir al menos 2 fotos: te falta 1." });
    await elegir("f2", "f3");
    // El estudio bajó el máximo después de que eligiera: el envío lo vuelve a validar.
    B.datos.fotofficeGaleria.find((g) => g.id === "g1")!.maxSelect = 2;
    expect(await P.enviarSeleccion("ws-1", TOKEN1, "", AHORA)).toMatchObject({ ok: false, error: "Podés elegir hasta 2 fotos: te sobra 1." });
    expect(cliente().status).toBe("EN_PROGRESO");
    B.datos.fotofficeGaleria.find((g) => g.id === "g1")!.maxSelect = 3;
    expect(await P.enviarSeleccion("ws-1", TOKEN1, "", AHORA)).toMatchObject({ ok: true, cantidad: 3 });
  });
  it("enviar dos veces: la segunda ve 'ya enviada' y no pisa la fecha ni el mensaje", async () => {
    await elegir("f1");
    await P.enviarSeleccion("ws-1", TOKEN1, "primero", AHORA);
    const otra = await P.enviarSeleccion("ws-1", TOKEN1, "segundo", new Date(AHORA.getTime() + 60_000));
    expect(otra).toMatchObject({ ok: false, codigo: "SOLO_LECTURA", error: M.yaEnviada });
    expect(cliente()).toMatchObject({ submittedAt: AHORA, submitMessage: "primero" });
    expect(eventos().filter((e) => e === "SELECCION_ENVIADA")).toHaveLength(1);
  });
  it("dos envíos a la vez: gana uno solo", async () => {
    await elegir("f1");
    const [a, b] = await Promise.all([P.enviarSeleccion("ws-1", TOKEN1, "", AHORA), P.enviarSeleccion("ws-1", TOKEN1, "", AHORA)]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(eventos().filter((e) => e === "SELECCION_ENVIADA")).toHaveLength(1);
  });
  it("después de enviar es de sólo lectura: no elige, no quita, no comenta", async () => {
    await elegir("f1");
    await P.enviarSeleccion("ws-1", TOKEN1, "", AHORA);
    expect(await P.elegirFoto("ws-1", TOKEN1, "f2", true)).toMatchObject({ ok: false, codigo: "SOLO_LECTURA" });
    expect(await P.elegirFoto("ws-1", TOKEN1, "f1", false)).toMatchObject({ ok: false, codigo: "SOLO_LECTURA" });
    expect(await P.comentarFoto("ws-1", TOKEN1, "f1", "hola")).toMatchObject({ ok: false, codigo: "SOLO_LECTURA" });
    expect(selecciones()).toEqual(["f1"]);
    // Pero puede seguir mirando: la vista sigue armándose y muestra lo enviado.
    const r = await P.resolverTokenGaleria("ws-1", TOKEN1);
    if (!r.ok) throw new Error();
    const v = await P.armarVistaGaleria(r);
    expect(v.cliente.estado).toBe("EN_REVISION");
    expect(v.cliente.enviadaEn).toContain("2026");
  });
  it("si el estudio reactiva (vuelve a EN_PROGRESO), el cliente puede cambiar y volver a enviar", async () => {
    await elegir("f1");
    await P.enviarSeleccion("ws-1", TOKEN1, "", AHORA);
    Object.assign(cliente(), { status: "EN_PROGRESO", reopenedAt: AHORA });
    expect(await P.elegirFoto("ws-1", TOKEN1, "f2", true)).toMatchObject({ ok: true, cantidad: 2 });
    expect(await P.enviarSeleccion("ws-1", TOKEN1, "", AHORA)).toMatchObject({ ok: true, cantidad: 2 });
  });
  it("token inválido (otra organización, anulado, galería en borrador): no cambia nada", async () => {
    await elegir("f1");
    expect(await P.enviarSeleccion("ws-2", TOKEN1, "", AHORA)).toMatchObject({ ok: false, codigo: "INVALIDO" });
    cliente().revokedAt = AHORA;
    expect(await P.enviarSeleccion("ws-1", TOKEN1, "", AHORA)).toMatchObject({ ok: false, codigo: "INVALIDO" });
    cliente().revokedAt = null;
    B.datos.fotofficeGaleria.find((g) => g.id === "g1")!.status = "BORRADOR";
    expect(await P.enviarSeleccion("ws-1", TOKEN1, "", AHORA)).toMatchObject({ ok: false, codigo: "INVALIDO" });
    expect(cliente().status).toBe("EN_PROGRESO");
  });
});

describe("mensajeDeEnvio", () => {
  it("normaliza", () => {
    expect(P.mensajeDeEnvio(undefined)).toEqual({ ok: true, texto: null });
    expect(P.mensajeDeEnvio(" hola\r\nchau ")).toEqual({ ok: true, texto: "hola\nchau" });
  });
});
