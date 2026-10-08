import { beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createBaseCompleteProfile } from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";

/**
 * Task 4 (pantallas): lecturas del editor con y sin permiso de costos, la definición de la lista
 * con su lote "Marcar vencidos", y reglas de fuente (el navegador no importa la base ni recibe
 * costos sin `configurar`).
 */

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const D = await import("./editor-datos");
const L = await import("./listado");

const niveles = { quotes: "MANAGE", "service-leads": "MANAGE", clients: "MANAGE" };
const DUENO = { workspaceId: "ws-1", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: niveles } as never };
const EQUIPO = { workspaceId: "ws-1", userId: 2, userLabel: "Ana", role: "STAFF", acceso: { role: "STAFF", levels: niveles } as never };
const LECTOR = { workspaceId: "ws-1", userId: 3, userLabel: "Leo", role: "STAFF", acceso: { role: "STAFF", levels: { quotes: "VIEW" } } as never };

beforeEach(() => {
  B.vaciar();
});

describe("lecturas del editor", () => {
  it("catálogo: activos del workspace, sin costos, con el ahorro de los combos", async () => {
    B.agregar("product", { id: "cob", workspaceId: "ws-1", name: "Cobertura", priceArs: "600000.00", costArs: "200000.00" });
    B.agregar("product", { id: "alb", workspaceId: "ws-1", name: "Álbum", priceArs: "400000.00" });
    B.agregar("product", { id: "combo", workspaceId: "ws-1", name: "Combo Boda", priceArs: "900000.00" });
    B.agregar("product", { id: "viejo", workspaceId: "ws-1", name: "Viejo", priceArs: "1.00", isActive: false });
    B.agregar("product", { id: "ajeno", workspaceId: "ws-2", name: "Ajeno", priceArs: "1.00" });
    B.agregar("fotofficeProductoCatalogo", { workspaceId: "ws-1", productId: "combo", isCombo: true, inPriceList: true });
    B.agregar("fotofficeComboItem", { workspaceId: "ws-1", comboProductId: "combo", componentProductId: "cob", quantity: 1 });
    B.agregar("fotofficeComboItem", { workspaceId: "ws-1", comboProductId: "combo", componentProductId: "alb", quantity: 1 });
    const cat = await D.catalogoParaEditor("ws-1");
    expect(cat.map((p) => p.id).sort()).toEqual(["alb", "cob", "combo"]);
    expect(cat.find((p) => p.id === "combo")).toMatchObject({ precio: 900000, esCombo: true, enLista: true, sumaComponentes: 1000000, ahorro: 100000 });
    expect(JSON.stringify(cat)).not.toMatch(/cost|200000/i);
  });

  it("costos del catálogo y perfil de ¿Cuánto Cobro?: sólo con configurar; sin permiso, vacío", async () => {
    B.agregar("product", { id: "cob", workspaceId: "ws-1", name: "Cobertura", priceArs: "600000.00", costArs: "200000.00" });
    expect(await D.costosCatalogoParaEditor(EQUIPO, ["cob"])).toEqual({});
    expect(await D.perfilDelWorkspace(EQUIPO)).toBeNull();
    expect(await D.perfilDelWorkspace(LECTOR)).toBeNull();
    expect(await D.costosCatalogoParaEditor(DUENO, ["cob"])).toEqual({ cob: { plantillas: [], costoProducto: 200000 } });
    expect(await D.perfilDelWorkspace(DUENO)).toBeNull();
    B.agregar("fotofficePerfilPrecios", { workspaceId: "ws-1", schemaVersion: 1, profileData: createBaseCompleteProfile(), source: null, updatedAt: new Date(), updatedByUserId: 1 });
    expect(await D.perfilDelWorkspace(EQUIPO)).toBeNull();
    expect(await D.perfilDelWorkspace(DUENO)).toEqual(createBaseCompleteProfile());
    // Otro workspace no aporta su perfil.
    expect(await D.perfilDelWorkspace({ ...DUENO, workspaceId: "ws-2" })).toBeNull();
  });
});

describe("lista de Presupuestos (motor 0.2)", () => {
  it("columnas, filtros y lote pedidos; ninguna columna de plata interna", () => {
    const d = L.listadoPresupuestos;
    expect(d.clave).toBe("presupuestos");
    expect(d.columnas.map((c) => c.clave)).toEqual(["numero", "contacto", "consulta", "estado", "total", "vence", "responsable", "actualizado"]);
    expect(d.filtros.map((f) => f.clave)).toEqual(["estado", "vencidos", "responsable"]);
    expect(d.acciones.map((a) => [a.clave, a.capacidad])).toEqual([["marcar-vencidos", "operar"]]);
    expect(JSON.stringify(d.exportar.columnas.map((c) => c.titulo))).not.toMatch(/costo|margen/i);
  });

  const consulta = (filtros: Record<string, string>, q = "") => ({ q, filtros, orden: { campo: "actualizado", desc: true }, pagina: 1, filas: 25 as const, ver: null, periodos: {}, etiquetasRelacion: {} });
  const AHORA = new Date("2026-10-07T15:00:00.000Z");
  const HOY = new Date("2026-10-07T00:00:00.000Z");

  it("where: siempre el workspace; vencido = marcado o enviado/visto con el último día pasado", () => {
    expect(L.wherePresupuestos("ws-1", consulta({}), AHORA)).toEqual({ workspaceId: "ws-1" });
    expect(L.wherePresupuestos("ws-1", consulta({ estado: "VENCIDO" }), AHORA)).toEqual({
      workspaceId: "ws-1",
      AND: [{ OR: [{ status: "VENCIDO" }, { status: { in: ["ENVIADO", "VISTO"] }, validUntil: { lt: HOY } }] }],
    });
    expect(L.wherePresupuestos("ws-1", consulta({ estado: "ENVIADO" }), AHORA).AND).toEqual([
      { status: "ENVIADO", OR: [{ validUntil: null }, { validUntil: { gte: HOY } }] },
    ]);
    expect(L.wherePresupuestos("ws-1", consulta({ vencidos: "no" }), AHORA).AND).toEqual([{ NOT: L.whereVencido(HOY) }]);
    expect(L.wherePresupuestos("ws-1", consulta({ estado: "INVENTADO", responsable: "x" }), AHORA)).toEqual({ workspaceId: "ws-1" });
    const c = consulta({}, "42");
    const conBusqueda = L.wherePresupuestos("ws-1", c, AHORA, L.idsDeBusqueda(c, ["p9"], ["p7", "p9"]));
    // Número del presupuesto y de su consulta, sin repetidos, en el OR de la búsqueda.
    expect(JSON.stringify(conBusqueda)).toContain('"id":{"in":["p9","p7"]}');
  });

  it("búsqueda por número: pasado el tope (o una subconsulta que se pasó) la lista sale vacía, con aviso", () => {
    const c = consulta({ estado: "BORRADOR" }, "N° 2");
    expect(L.textoDeNumero("N° 2026-0042")).toBe("2026-0042");
    expect(L.textoDeNumero("Laura")).toBeNull();
    expect(L.idsDeBusqueda(c, null, [])).toEqual({ excedido: true });
    expect(L.idsDeBusqueda(c, [], null)).toEqual({ excedido: true });
    const muchos = Array.from({ length: 20_001 }, (_, i) => `p${i}`);
    expect(L.idsDeBusqueda(c, muchos, []).excedido).toBe(true);
    expect(L.wherePresupuestos("ws-1", c, AHORA, { excedido: true })).toEqual({ workspaceId: "ws-1", id: { in: [] } });
    // Sin texto no hay búsqueda por número aunque lleguen listas.
    expect(L.idsDeBusqueda(consulta({}), null, null)).toEqual({ excedido: false, y: null, o: [] });
    expect(typeof L.listadoPresupuestos.aviso).toBe("function");
    expect(L.AVISO_DEMASIADOS).toMatch(/demasiados/);
  });

  it("marcar vencidos: sólo los enviados o vistos que ya vencieron, dentro del workspace", async () => {
    const vencido = B.agregar("fotofficePresupuesto", { id: "a", workspaceId: "ws-1", consultaLeadId: "l", clientId: "c", status: "ENVIADO", validUntil: new Date("2026-01-01") });
    B.agregar("fotofficePresupuesto", { id: "b", workspaceId: "ws-1", consultaLeadId: "l", clientId: "c", status: "ENVIADO", validUntil: new Date("2999-01-01") });
    B.agregar("fotofficePresupuesto", { id: "c", workspaceId: "ws-1", consultaLeadId: "l", clientId: "c", status: "BORRADOR", validUntil: new Date("2026-01-01") });
    B.agregar("fotofficePresupuesto", { id: "z", workspaceId: "ws-2", consultaLeadId: "l", clientId: "c", status: "ENVIADO", validUntil: new Date("2026-01-01") });
    const ctx = { workspaceId: "ws-1", workspaceName: "W", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: DUENO.acceso, modulo: "quotes" };
    const sep = await L.ACCION_MARCAR_VENCIDOS.elegibles!(ctx, ["a", "b", "c", "z"], null);
    expect(sep.elegibles).toEqual(["a"]);
    expect(sep.excluidos.map((e) => e.id)).toEqual(["b", "c", "z"]);
    const r = await L.ACCION_MARCAR_VENCIDOS.aplicar(ctx, ["a", "z"], null);
    expect(r.aplicados).toBe(1);
    expect(vencido.status).toBe("VENCIDO");
    expect(B.datos.fotofficePresupuesto.find((p) => p.id === "z")!.status).toBe("ENVIADO");
    // Sin "Gestionar" el lote no aplica nada.
    const soloVe = { ...ctx, acceso: LECTOR.acceso };
    expect((await L.ACCION_MARCAR_VENCIDOS.aplicar(soloVe, ["b"], null)).aplicados).toBe(0);
  });
});

// --- Fuente ----------------------------------------------------------------------------------------

const RAIZ = process.cwd();
const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), "utf8");

/** Resuelve `@/…` y `./…` a un archivo del proyecto (o null si es un paquete). */
function resolver(desde: string, mod: string): string | null {
  const base = mod.startsWith("@/") ? join(RAIZ, mod.slice(2)) : mod.startsWith(".") ? join(dirname(desde), mod) : null;
  if (!base) return null;
  for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) if (existsSync(base + ext)) return base + ext;
  return null;
}

/** Todos los módulos del proyecto que arrastra un archivo (sin contar los "use server", que el navegador llama por red). */
function cierre(archivo: string, vistos = new Set<string>()): Set<string> {
  if (vistos.has(archivo)) return vistos;
  vistos.add(archivo);
  const src = readFileSync(archivo, "utf8");
  if (src.startsWith('"use server"') && vistos.size > 1) return vistos;
  for (const m of src.matchAll(/^\s*import\s+(?!type\s)[^;]*?from\s+["']([^"']+)["']/gm)) {
    const r = resolver(archivo, m[1]!);
    if (r) cierre(r, vistos);
  }
  return vistos;
}

describe("fuente de las pantallas", () => {
  const clientes = readdirSync(join(RAIZ, "components/presupuestos"))
    .map((f) => join(RAIZ, "components/presupuestos", f))
    .filter((f) => readFileSync(f, "utf8").startsWith('"use client"'));

  it("hay componentes de navegador y ninguno arrastra la base ni código de servidor", () => {
    expect(clientes.length).toBeGreaterThanOrEqual(5);
    for (const c of clientes) {
      for (const dep of cierre(c)) {
        const src = readFileSync(dep, "utf8");
        if (src.startsWith('"use server"')) continue;
        expect(src, `${c} → ${dep}`).not.toMatch(/from ["']@repo\/db["']|import ["']server-only["']/);
      }
    }
  });

  it("la página del presupuesto lee costos del catálogo y perfil sólo con veCostos, y el editor no los pide de otro lado", () => {
    const pagina = leer("app/(shell)/presupuestos/[id]/page.tsx");
    expect(pagina).toMatch(/detalle\.veCostos\s*\?\s*await Promise\.all\(\[costosCatalogoParaEditor\(ctx, ids\), perfilDelWorkspace\(ctx\)\]\)/);
    expect(pagina).toContain("costos={detalle.veCostos ? vigente.costos : null}");
    expect(pagina).toContain("armarDatosEditor(");
    const editor = leer("components/presupuestos/editor-presupuesto.tsx");
    // El panel y el asistente sólo se dibujan con `internos`.
    expect(editor).toMatch(/itemCalculando && internos \?/);
    expect(editor).toMatch(/asistente && internos \?/);
    expect(editor).toContain("itemsParaGuardar(items, !!internos, ajustados)");
  });

  it("las tarjetas de la consulta y del contacto pasan por `aTarjeta` (sin costo ni margen)", () => {
    for (const ruta of ["app/(shell)/consultas/[id]/page.tsx", "app/(shell)/clientes/[clientId]/page.tsx"]) {
      const src = leer(ruta);
      expect(src).toMatch(/listarPresupuestos\([\s\S]*?\)\s*\)\.map\(aTarjeta\)/);
      expect(src).toContain('puede(acceso, "ver", QUOTES_MODULE_KEY)');
      expect(src).toContain('puede(acceso, "operar", QUOTES_MODULE_KEY)');
    }
  });

  it("el menú muestra Presupuestos sólo con nivel en el módulo quotes", () => {
    const nav = leer("components/shell/shell-nav.tsx");
    expect(nav).toMatch(/\.\.\.\(ve\(QUOTES_MODULE_KEY\)\s*\?\s*\[\s*\{\s*href: "\/presupuestos"/);
    expect(nav).toContain('const QUOTES_MODULE_KEY = "quotes";');
  });

  it("las pantallas pasan por la guarda del módulo; Nuevo pide Gestionar", () => {
    for (const ruta of ["app/(shell)/presupuestos/layout.tsx", "app/(shell)/presupuestos/page.tsx", "app/(shell)/presupuestos/[id]/page.tsx"]) {
      expect(leer(ruta)).toContain('requirePresupuestos("ver")');
    }
    expect(leer("app/(shell)/presupuestos/nuevo/page.tsx")).toContain('requirePresupuestos("operar")');
    const guarda = leer("lib/presupuestos/pagina.ts");
    const orden = ["requireAuth(", "resolveActiveWorkspace(", "isModuleEnabledForWorkspace(", "puede(acceso, nivel, QUOTES_MODULE_KEY)"];
    const pos = orden.map((s) => guarda.indexOf(s));
    expect(pos.every((p) => p > -1)).toBe(true);
    expect([...pos].sort((a, b) => a - b)).toEqual(pos);
  });

  it("revisión de la Task 4: editor, asistente, accesibilidad y Nuevo", () => {
    const editor = leer("components/presupuestos/editor-presupuesto.tsx");
    // El tipo del descuento vive en el campo (pasar a "$" vacío no vuelve a "%"); % se acota a 100.
    expect(editor).toMatch(/const \[tipo, setTipo\] = useState<TipoDescuento>/);
    expect(editor).toContain('t === "PORCENTAJE" ? Math.min(n, 100) : n');
    // Etiquetas por fila con el nombre del ítem.
    expect(editor).toContain("aria-label={`Cantidad de ${etiquetaFila}`}");
    expect(editor).not.toMatch(/aria-label="(Cantidad|Precio unitario|Quitar)"/);
    // Después de guardar, el editor se vuelve a montar con lo del servidor.
    expect(leer("app/(shell)/presupuestos/[id]/page.tsx")).toContain("key={`${borrador.id}:${detalle.updatedAt.getTime()}`}");
    const asistente = leer("components/presupuestos/asistente-cuanto-cobro.tsx");
    // Claves de verdad sólo al agregar; la vista previa usa claves fijas.
    expect(asistente.match(/opciones\(nuevaClave\)/g)).toHaveLength(1);
    expect(asistente.indexOf("opciones(nuevaClave)")).toBeGreaterThan(asistente.indexOf("onClick={() => {"));
    // Una sola región viva por componente, siempre presente y sólo con el resultado.
    for (const ruta of ["components/presupuestos/asistente-cuanto-cobro.tsx", "components/presupuestos/panel-cuanto-cobro.tsx"]) {
      const src = leer(ruta);
      expect(src.match(/aria-live=/g)).toHaveLength(1);
      expect(src).not.toContain('role="status"');
    }
    const panel = leer("components/presupuestos/panel-cuanto-cobro.tsx");
    expect(panel).toContain("perfilParaPanel(item, perfilDelWorkspace)");
    expect(panel).toContain("/workspace/configuracion/precios");
    // El perfil se carga en Configuración → Precios: ningún componente usa el perfil corto.
    for (const f of readdirSync(join(RAIZ, "components/presupuestos"))) {
      const src = leer(`components/presupuestos/${f}`);
      expect(src, f).not.toContain("PerfilPanel");
      expect(src, f).not.toContain("CamposPerfil");
    }
    // Nuevo: el nombre del contacto de la consulta, sólo con Ver en Consultas y en Clientes.
    const nuevo = leer("app/(shell)/presupuestos/nuevo/page.tsx");
    expect(nuevo).toContain('puedeEnContexto(ctx, "ver", SERVICE_LEADS_MODULE_KEY) && puedeEnContexto(ctx, "ver", CLIENTS_MODULE_KEY)');
    expect(nuevo).toContain("veConsultas ? c : { id: c.id, etiqueta: CONSULTA_GENERICA }");
  });
});
