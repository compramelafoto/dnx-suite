import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

const H = vi.hoisted(() => ({ nivel: vi.fn(async (..._a: unknown[]) => true) }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
vi.mock("@/lib/permissions/module-access", () => ({ hasModuleLevel: H.nivel }));

const C = await import("./categorias");
const O = await import("./origenes");
const R = await import("./participantes");
const A = await import("./ajustes");
const S = await import("./semillas");
const K = await import("./constantes");
const { MENSAJES_CATALOGO: M } = await import("./catalogo");

const ADMIN = { workspaceId: "ws-1", userId: 1, userLabel: "Dueña", role: "WORKSPACE_OWNER" };
const STAFF = { ...ADMIN, userId: 2, role: "STAFF" };
const OTRO_WS = { ...ADMIN, workspaceId: "ws-2" };

const categorias = (ws = "ws-1") => B.datos.fotofficeConsultaCategoria.filter((c) => c.workspaceId === ws);
const idDe = (nombre: string, ws = "ws-1") => categorias(ws).find((c) => c.name === nombre)!.id as string;

function consultaCon(datos: Record<string, unknown>) {
  return B.agregar("fotofficeConsulta", { workspaceId: "ws-1", leadId: `l-${Math.random()}`, clientId: "c1", ...datos });
}

beforeEach(() => {
  B.vaciar();
  H.nivel.mockReset();
  H.nivel.mockResolvedValue(true);
});

describe("asegurarCatalogosIniciales", () => {
  it("DNX recibe sus 21 categorías con grupo, 8 orígenes y 16 roles, en orden", async () => {
    await S.asegurarCatalogosIniciales("ws-1", K.SLUG_DNX);
    expect(categorias()).toHaveLength(21);
    expect(categorias().map((c) => c.name)).toEqual(K.CATEGORIAS_DNX.map((c) => c.name));
    expect(categorias().find((c) => c.name === "Boda")).toMatchObject({ group: "BODA", legacyEventType: "BODA", order: 1 });
    expect(B.datos.fotofficeOrigen.map((o) => o.name)).toEqual(K.ORIGENES_DNX);
    expect(B.datos.fotofficeRolParticipante).toHaveLength(16);
  });

  it("las demás: 9 categorías equivalentes, el origen Otro y ningún rol", async () => {
    await S.asegurarCatalogosIniciales("ws-2", "otra-org");
    expect(categorias("ws-2")).toHaveLength(9);
    expect(categorias("ws-2").every((c) => c.legacyEventType !== null)).toBe(true);
    expect(B.datos.fotofficeOrigen.map((o) => o.name)).toEqual(["Otro"]);
    expect(B.datos.fotofficeRolParticipante).toHaveLength(0);
  });

  it("es idempotente y no devuelve lo que alguien borró", async () => {
    await S.asegurarCatalogosIniciales("ws-1", K.SLUG_DNX);
    await S.asegurarCatalogosIniciales("ws-1", K.SLUG_DNX);
    expect(categorias()).toHaveLength(21);
    expect(await C.borrarCategoria(ADMIN, idDe("Impresión"))).toEqual({ ok: true });
    await S.asegurarCatalogosIniciales("ws-1", K.SLUG_DNX);
    expect(categorias()).toHaveLength(20);
    // Otro workspace sigue recibiendo los suyos.
    await S.asegurarCatalogosIniciales("ws-2", "otra");
    expect(categorias("ws-2")).toHaveLength(9);
  });

  it("re-chequea adentro: si otra corrida sembró entre el conteo y la transacción, no duplica", async () => {
    const original = B.tablas.fotofficeConsultaCategoria.count;
    let primera = true;
    B.tablas.fotofficeConsultaCategoria.count = async (a) => {
      if (primera) {
        primera = false;
        B.agregar("fotofficeConsultaCategoria", { workspaceId: "ws-1", name: "Ya estaba", group: "EVENTO" });
        return 0;
      }
      return original(a);
    };
    await S.asegurarCatalogosIniciales("ws-1", K.SLUG_DNX);
    B.tablas.fotofficeConsultaCategoria.count = original;
    expect(categorias().map((c) => c.name)).toEqual(["Ya estaba"]);
  });

  it("asegurarCatalogosDelWorkspace lee el slug del branding", async () => {
    B.agregar("fotofficeWorkspaceBranding", { workspaceId: "ws-1", publicSlug: K.SLUG_DNX });
    await S.asegurarCatalogosDelWorkspace("ws-1");
    expect(categorias()).toHaveLength(21);
  });
});

describe("categorías", () => {
  beforeEach(async () => {
    await S.asegurarCatalogosIniciales("ws-1", "otra");
    await S.asegurarCatalogosIniciales("ws-2", "otra");
  });

  it("escribir exige configurar (dueño o administrador)", async () => {
    expect(await C.crearCategoria(STAFF, { nombre: "Nueva", grupo: "EVENTO" })).toEqual({ ok: false, error: M.sinPermiso });
    expect(await C.archivarCategoria(STAFF, idDe("Boda"))).toEqual({ ok: false, error: M.sinPermiso });
    expect(await C.borrarCategoria(STAFF, idDe("Boda"))).toEqual({ ok: false, error: M.sinPermiso });
    expect(await C.editarCategoria(STAFF, idDe("Boda"), { nombre: "x" })).toEqual({ ok: false, error: M.sinPermiso });
    expect(await C.reordenarCategorias(STAFF, [])).toEqual({ ok: false, error: M.sinPermiso });
    const admin = { ...STAFF, role: "WORKSPACE_ADMIN" };
    expect(await C.crearCategoria(admin, { nombre: "Nueva", grupo: "EVENTO" })).toMatchObject({ ok: true });
  });

  it("alta: nombre y grupo válidos, sin repetir (sin distinguir mayúsculas), al final", async () => {
    expect(await C.crearCategoria(ADMIN, { nombre: "  ", grupo: "EVENTO" })).toEqual({ ok: false, error: M.nombre });
    expect(await C.crearCategoria(ADMIN, { nombre: "X", grupo: "FIESTA" })).toEqual({ ok: false, error: M.grupo });
    expect(await C.crearCategoria(ADMIN, { nombre: "BODA", grupo: "BODA" })).toMatchObject({ ok: false });
    const r = await C.crearCategoria(ADMIN, { nombre: " Retrato   corporativo ", grupo: "TRABAJO_SIN_FECHA" });
    expect(r.ok).toBe(true);
    expect(categorias().find((c) => c.name === "Retrato corporativo")).toMatchObject({ order: 9, group: "TRABAJO_SIN_FECHA" });
  });

  it("archivar contra borrar: la usada no se borra, se archiva; la que nunca se usó, sí", async () => {
    consultaCon({ categoryId: idDe("Boda") });
    expect(await C.borrarCategoria(ADMIN, idDe("Boda"))).toEqual({ ok: false, error: "Esta categoría ya tiene consultas: archivala." });
    expect(await C.archivarCategoria(ADMIN, idDe("Boda"))).toEqual({ ok: true });
    expect(categorias().find((c) => c.name === "Boda")!.archivedAt).toBeInstanceOf(Date);
    expect((await C.listarCategorias("ws-1")).map((c) => c.name)).not.toContain("Boda");
    expect((await C.listarCategorias("ws-1", { incluirArchivados: true })).find((c) => c.name === "Boda")).toMatchObject({ usos: 1 });
    expect(await C.borrarCategoria(ADMIN, idDe("Show"))).toEqual({ ok: true });
    expect(categorias().some((c) => c.name === "Show")).toBe(false);
    expect(await C.desarchivarCategoria(ADMIN, idDe("Boda"))).toEqual({ ok: true });
    expect(categorias().find((c) => c.name === "Boda")).toMatchObject({ archivedAt: null });
  });

  it("el grupo no cambia si la categoría está usada; el nombre sí", async () => {
    consultaCon({ categoryId: idDe("Boda") });
    expect(await C.editarCategoria(ADMIN, idDe("Boda"), { grupo: "EVENTO" })).toEqual({ ok: false, error: M.grupoUsado });
    expect(await C.editarCategoria(ADMIN, idDe("Boda"), { nombre: "Casamiento" })).toEqual({ ok: true });
    expect(await C.editarCategoria(ADMIN, idDe("Casamiento"), { grupo: "BODA", nombre: "Casamiento" })).toEqual({ ok: true });
    expect(await C.editarCategoria(ADMIN, idDe("Show"), { grupo: "TRABAJO_CON_FECHA" })).toEqual({ ok: true });
    expect(categorias().find((c) => c.name === "Show")).toMatchObject({ group: "TRABAJO_CON_FECHA" });
    expect(await C.editarCategoria(ADMIN, idDe("Show"), { nombre: "casamiento" })).toMatchObject({ ok: false });
  });

  it("tiene que quedar al menos una activa", async () => {
    const ids = categorias().map((c) => c.id as string);
    for (const id of ids.slice(1)) expect(await C.archivarCategoria(ADMIN, id)).toEqual({ ok: true });
    expect(await C.archivarCategoria(ADMIN, ids[0])).toEqual({ ok: false, error: "Tiene que quedar al menos una categoría activa." });
    expect(await C.borrarCategoria(ADMIN, ids[0])).toMatchObject({ ok: false });
  });

  it("el mínimo de activas se vuelve a contar dentro de la transacción, con bloqueo", async () => {
    const ids = categorias().map((c) => c.id as string);
    for (const id of ids.slice(2)) await C.archivarCategoria(ADMIN, id);
    // Entre la lectura y la transacción, otra pestaña archivó la otra activa.
    B.ganchos.alEjecutarSql = (texto) => {
      if (texto.includes("pg_advisory_xact_lock")) {
        const otra = categorias().find((c) => c.id === ids[1])!;
        otra.archivedAt = new Date();
      }
    };
    expect(await C.archivarCategoria(ADMIN, ids[0])).toEqual({ ok: false, error: "Tiene que quedar al menos una categoría activa." });
    expect(categorias().find((c) => c.id === ids[0])!.archivedAt).toBeNull();
    expect(B.sql.some((q) => q.texto.includes("pg_advisory_xact_lock") && String(q.valores[0]).includes("fotofficeConsultaCategoria:ws-1"))).toBe(true);
  });

  it("borrar: si la FK frena (se usó después del conteo), dice que ya se usó", async () => {
    const original = B.tablas.fotofficeConsultaCategoria.deleteMany;
    B.tablas.fotofficeConsultaCategoria.deleteMany = async () => {
      throw Object.assign(new Error("Foreign key constraint failed"), { code: "P2003" });
    };
    expect(await C.borrarCategoria(ADMIN, idDe("Show"))).toEqual({ ok: false, error: "Esta categoría ya tiene consultas: archivala." });
    B.tablas.fotofficeConsultaCategoria.deleteMany = original;
    expect(categorias().some((c) => c.name === "Show")).toBe(true);
  });

  it("reordenar: exige todas las activas, sin repetir", async () => {
    const ids = categorias().map((c) => c.id as string);
    expect(await C.reordenarCategorias(ADMIN, ids.slice(1))).toEqual({ ok: false, error: M.ordenDesactualizado });
    expect(await C.reordenarCategorias(ADMIN, [ids[0], ...ids.slice(0, -1)])).toEqual({ ok: false, error: M.ordenDesactualizado });
    const nuevo = [...ids].reverse();
    expect(await C.reordenarCategorias(ADMIN, nuevo)).toEqual({ ok: true });
    expect((await C.listarCategorias("ws-1")).map((c) => c.id)).toEqual(nuevo);
  });

  it("aislamiento: una categoría de otro workspace no se encuentra ni se toca", async () => {
    const ajena = idDe("Boda", "ws-2");
    expect(await C.archivarCategoria(ADMIN, ajena)).toEqual({ ok: false, error: "No encontramos esa categoría." });
    expect(await C.borrarCategoria(ADMIN, ajena)).toMatchObject({ ok: false });
    expect(await C.editarCategoria(ADMIN, ajena, { nombre: "Hackeada" })).toMatchObject({ ok: false });
    expect(categorias("ws-2").find((c) => c.id === ajena)).toMatchObject({ name: "Boda", archivedAt: null });
    expect(await C.reordenarCategorias(ADMIN, categorias("ws-2").map((c) => c.id))).toEqual({ ok: false, error: M.ordenDesactualizado });
    // Los usos de otro workspace no cuentan.
    B.agregar("fotofficeConsulta", { workspaceId: "ws-2", leadId: "lx", clientId: "cx", categoryId: ajena });
    expect((await C.listarCategorias("ws-1")).every((c) => c.usos === 0)).toBe(true);
    expect(await C.crearCategoria(OTRO_WS, { nombre: "Solo ws-2", grupo: "EVENTO" })).toMatchObject({ ok: true });
    expect(categorias().some((c) => c.name === "Solo ws-2")).toBe(false);
  });
});

describe("categoría de un eventType (formularios y consultas viejas)", () => {
  it("DNX: cada tipo viejo cae en su equivalente", async () => {
    await S.asegurarCatalogosIniciales("ws-1", K.SLUG_DNX);
    for (const [tipo, nombre] of Object.entries(K.EQUIVALENCIA_EVENT_TYPE_DNX)) {
      expect(await C.categoriaParaEventType(B.prisma as never, "ws-1", tipo)).toMatchObject({ name: nombre, reemplazo: false });
    }
  });

  it("equivalente archivada: Otro del mismo grupo, si no la primera activa del grupo, si no la primera activa", async () => {
    await S.asegurarCatalogosIniciales("ws-1", "otra");
    await C.archivarCategoria(ADMIN, idDe("Infantil"));
    // Grupo EVENTO: "Otro evento" es su comodín.
    expect(await C.categoriaParaEventType(B.prisma as never, "ws-1", "INFANTIL")).toMatchObject({ name: "Otro evento", reemplazo: true });
    await C.archivarCategoria(ADMIN, idDe("Otro evento"));
    // Sin comodín activo: la primera activa del grupo (XV).
    expect(await C.categoriaParaEventType(B.prisma as never, "ws-1", "INFANTIL")).toMatchObject({ name: "XV", reemplazo: true });
    // El enganche de consultas viejas acepta la archivada: es lo que la consulta ya era.
    expect(await C.categoriaParaEventType(B.prisma as never, "ws-1", "INFANTIL", { incluirArchivadas: true })).toMatchObject({
      name: "Infantil", reemplazo: false,
    });
    await C.crearCategoria(ADMIN, { nombre: "Otro", grupo: "TRABAJO_SIN_FECHA" });
    // Grupo sin activas → la primera activa de cualquier grupo; tipo desconocido, igual.
    await C.archivarCategoria(ADMIN, idDe("Boda"));
    expect((await C.categoriaParaEventType(B.prisma as never, "ws-1", "BODA"))?.reemplazo).toBe(true);
    expect((await C.categoriaParaEventType(B.prisma as never, "ws-1", "NO_EXISTE"))?.name).toBe("Otro");
  });

  it("sin categorías: null; las de otro workspace no sirven", async () => {
    await S.asegurarCatalogosIniciales("ws-2", "otra");
    expect(await C.categoriaParaEventType(B.prisma as never, "ws-1", "BODA")).toBeNull();
  });

  it("el mapa por formulario resuelve cada formulario por su eventType, sin tocar ServiceLeadForm", async () => {
    await S.asegurarCatalogosIniciales("ws-1", K.SLUG_DNX);
    B.agregar("serviceLeadForm", { id: "f1", workspaceId: "ws-1", eventType: "XV", slug: "xv", name: "XV", configJson: {} });
    B.agregar("serviceLeadForm", { id: "f2", workspaceId: "ws-1", eventType: "SHOW", slug: "show", name: "Show", configJson: {} });
    B.agregar("serviceLeadForm", { id: "fx", workspaceId: "ws-2", eventType: "BODA", slug: "boda", name: "Boda", configJson: {} });
    const antes = JSON.stringify(B.datos.serviceLeadForm);
    const mapa = await C.categoriasDeFormularios("ws-1");
    expect([...mapa.keys()]).toEqual(["f1", "f2"]);
    expect(mapa.get("f1")).toMatchObject({ name: "Fotografía o Video de Cumpleaños de 15" });
    expect(mapa.get("f2")).toMatchObject({ name: "Producción de contenido fotográfico y/o audiovisual" });
    expect(JSON.stringify(B.datos.serviceLeadForm)).toBe(antes);
  });

  it("categoriaActiva: sólo activas y del workspace", async () => {
    await S.asegurarCatalogosIniciales("ws-1", "otra");
    await S.asegurarCatalogosIniciales("ws-2", "otra");
    expect(await C.categoriaActiva(B.prisma as never, "ws-1", idDe("Boda"))).toMatchObject({ name: "Boda", group: "BODA" });
    expect(await C.categoriaActiva(B.prisma as never, "ws-1", idDe("Boda", "ws-2"))).toBeNull();
    await C.archivarCategoria(ADMIN, idDe("Boda"));
    expect(await C.categoriaActiva(B.prisma as never, "ws-1", idDe("Boda"))).toBeNull();
  });
});

describe("orígenes y roles", () => {
  beforeEach(async () => {
    await S.asegurarCatalogosIniciales("ws-1", K.SLUG_DNX);
  });

  it("orígenes: alta, archivar contra borrar, permisos y aislamiento", async () => {
    expect(await O.crearOrigen(STAFF, { nombre: "TikTok" })).toEqual({ ok: false, error: M.sinPermiso });
    const r = await O.crearOrigen(ADMIN, { nombre: "TikTok" });
    expect(r.ok).toBe(true);
    expect(await O.crearOrigen(ADMIN, { nombre: "tiktok" })).toEqual({ ok: false, error: "Ya hay un origen con ese nombre." });
    const instagram = B.datos.fotofficeOrigen.find((o) => o.name === "Instagram")!.id as string;
    consultaCon({ categoryId: idDe("Boda"), originId: instagram });
    expect(await O.borrarOrigen(ADMIN, instagram)).toMatchObject({ ok: false });
    expect(await O.archivarOrigen(ADMIN, instagram)).toEqual({ ok: true });
    if (r.ok) expect(await O.borrarOrigen(ADMIN, r.id)).toEqual({ ok: true });
    // Se pueden archivar todos (el origen es opcional).
    for (const o of B.datos.fotofficeOrigen) expect(await O.archivarOrigen(ADMIN, o.id)).toEqual({ ok: true });
    expect(await O.listarOrigenes("ws-1")).toEqual([]);
    expect(await O.editarOrigen(OTRO_WS, instagram, { nombre: "x" })).toEqual({ ok: false, error: "No encontramos ese origen." });
  });

  it("roles: el usado por un participante no se borra", async () => {
    const dj = B.datos.fotofficeRolParticipante.find((x) => x.name === "DJ")!.id as string;
    B.agregar("fotofficeConsultaParticipante", { workspaceId: "ws-1", consultaId: "q1", clientId: "c1", roleId: dj });
    expect(await R.borrarRol(ADMIN, dj)).toEqual({ ok: false, error: "Este rol ya se usó en alguna consulta: archivalo." });
    expect((await R.listarRoles("ws-1")).find((x) => x.id === dj)).toMatchObject({ usos: 1 });
    expect(await R.editarRol(ADMIN, dj, { nombre: "Disc jockey" })).toEqual({ ok: true });
    const ids = (await R.listarRoles("ws-1")).map((x) => x.id);
    expect(await R.reordenarRoles(ADMIN, [...ids].reverse())).toEqual({ ok: true });
    expect((await R.listarRoles("ws-1"))[0]!.id).toBe(ids.at(-1));
  });
});

describe("ajustes del aviso", () => {
  beforeEach(() => {
    B.agregar("workspaceMembership", { userId: 5, workspaceId: "ws-1", role: "STAFF" });
    B.agregar("workspaceMembership", { userId: 9, workspaceId: "ws-2", role: "WORKSPACE_OWNER" });
  });

  it("sin fila: los de fábrica (sin responsable, con correo y tarea)", async () => {
    expect(await A.leerAjustes("ws-1")).toEqual({ responsableUserId: null, notificarCorreo: true, crearTarea: true });
  });

  it("guardar exige configurar y valida el responsable: del equipo y con Gestionar en Consultas", async () => {
    const datos = { responsableUserId: 5, notificarCorreo: false, crearTarea: true };
    expect(await A.guardarAjustes(STAFF, datos)).toEqual({ ok: false, error: A.MENSAJES_AJUSTES.sinPermiso });
    // Otro workspace: no es del equipo.
    expect(await A.guardarAjustes(ADMIN, { ...datos, responsableUserId: 9 })).toEqual({ ok: false, error: A.MENSAJES_AJUSTES.responsable });
    H.nivel.mockResolvedValueOnce(false);
    expect(await A.guardarAjustes(ADMIN, datos)).toEqual({ ok: false, error: A.MENSAJES_AJUSTES.responsable });
    expect(H.nivel).toHaveBeenLastCalledWith(5, "ws-1", "service-leads", "MANAGE");
    expect(await A.guardarAjustes(ADMIN, datos)).toEqual({ ok: true });
    expect(await A.leerAjustes("ws-1")).toEqual({ responsableUserId: 5, notificarCorreo: false, crearTarea: true });
    expect(await A.guardarAjustes(ADMIN, { responsableUserId: null, notificarCorreo: true, crearTarea: false })).toEqual({ ok: true });
    expect(B.datos.fotofficeConsultaAjustes).toHaveLength(1);
    expect(await A.leerAjustes("ws-1")).toEqual({ responsableUserId: null, notificarCorreo: true, crearTarea: false });
    expect(await A.leerAjustes("ws-2")).toEqual(A.AJUSTES_DE_FABRICA);
  });

  it("datos inválidos", async () => {
    expect(await A.guardarAjustes(ADMIN, { responsableUserId: null, notificarCorreo: "sí", crearTarea: true })).toMatchObject({ ok: false });
    expect(await A.guardarAjustes(ADMIN, { responsableUserId: "5", notificarCorreo: true, crearTarea: true })).toMatchObject({ ok: false });
  });
});
