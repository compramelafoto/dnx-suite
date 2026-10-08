import { beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Task 6 (pantallas de Pedidos): lecturas de la ficha (historial de mensajes del pedido, costos
 * sólo con permiso, rubros, comprobantes), ayudas puras de las pantallas y reglas de fuente (el
 * navegador no importa la base ni recibe costos sin `configurar`/`verDinero`).
 */

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const F = await import("./ficha");
const P = await import("./pantalla");
const { aTarjetaPedido } = await import("@/components/pedidos/tarjeta-pedidos");
const { aItemDePedido } = await import("@/components/pedidos/items-pedido");

const DUENO = { workspaceId: "ws-1", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: { orders: "MANAGE" } } as never };
const EQUIPO = { workspaceId: "ws-1", userId: 2, userLabel: "Ana", role: "STAFF", acceso: { role: "STAFF", levels: { orders: "MANAGE" } } as never };

const COSTOS = { porItem: { r1: { costo: 50000, origen: "COSTO_PRODUCTO", margen: 70000 } }, costoTotal: 50000, itemsSinCosto: 0, margen: 70000, margenProporcion: 0.58 };

beforeEach(() => {
  B.vaciar();
});

describe("lecturas de la ficha", () => {
  it("historial: sólo los mensajes del pedido en el workspace, sin reservas en curso, el más nuevo primero", async () => {
    const base = { channel: "EMAIL", status: "SENT", automatic: false, toAddress: "a@b.test", subject: "S", body: "Cuerpo", errorCode: null, actorLabel: "Ana", templateId: null };
    B.agregar("fotofficeMessage", { ...base, id: "m1", workspaceId: "ws-1", entityType: "PEDIDO", entityId: "ped-1", createdAt: new Date("2026-10-01T12:00:00Z") });
    B.agregar("fotofficeMessage", { ...base, id: "m2", workspaceId: "ws-1", entityType: "PEDIDO", entityId: "ped-1", createdAt: new Date("2026-10-02T12:00:00Z") });
    B.agregar("fotofficeMessage", { ...base, id: "m3", workspaceId: "ws-1", entityType: "PEDIDO", entityId: "ped-1", errorCode: "EN_CURSO", createdAt: new Date("2026-10-03T12:00:00Z") });
    B.agregar("fotofficeMessage", { ...base, id: "m4", workspaceId: "ws-1", entityType: "PEDIDO", entityId: "ped-2", createdAt: new Date() });
    B.agregar("fotofficeMessage", { ...base, id: "m5", workspaceId: "ws-2", entityType: "PEDIDO", entityId: "ped-1", createdAt: new Date() });
    B.agregar("fotofficeMessage", { ...base, id: "m6", workspaceId: "ws-1", entityType: "CLIENTE", entityId: "ped-1", createdAt: new Date() });
    expect((await F.mensajesDePedido("ws-1", "ped-1")).map((m) => m.id)).toEqual(["m2", "m1"]);
  });

  it("costos y margen: sólo con configurar o verDinero; sin permiso no se lee nada", async () => {
    B.agregar("fotofficePresupuestoVersion", { id: "v1", workspaceId: "ws-1", presupuestoId: "p", number: 1, items: [], totals: {}, costSnapshot: COSTOS, createdAt: new Date() });
    B.agregar("fotofficePresupuestoVersion", { id: "v2", workspaceId: "ws-2", presupuestoId: "p2", number: 1, items: [], totals: {}, costSnapshot: COSTOS, createdAt: new Date() });
    expect(await F.costosDelPedido(DUENO, { acceptedVersionId: "v1" })).toEqual(COSTOS);
    expect(await F.costosDelPedido(EQUIPO, { acceptedVersionId: "v1" })).toBeNull();
    expect(await F.costosDelPedido(DUENO, { acceptedVersionId: null })).toBeNull();
    // De otro workspace, nada.
    expect(await F.costosDelPedido(DUENO, { acceptedVersionId: "v2" })).toBeNull();
  });

  it("rubros de ingreso activos del workspace (más el actual aunque esté inactivo) y comprobantes de los cobros", async () => {
    B.agregar("cashCategory", { id: "r1", workspaceId: "ws-1", name: "Bodas", kind: "INGRESO", isActive: true, order: 0 });
    B.agregar("cashCategory", { id: "r2", workspaceId: "ws-1", name: "Viejo", kind: "INGRESO", isActive: false, order: 1 });
    B.agregar("cashCategory", { id: "r3", workspaceId: "ws-1", name: "Luz", kind: "EGRESO", isActive: true, order: 2 });
    B.agregar("cashCategory", { id: "r4", workspaceId: "ws-2", name: "Ajeno", kind: "INGRESO", isActive: true, order: 3 });
    expect((await F.rubrosDeIngreso("ws-1", null)).map((r) => r.id)).toEqual(["r1"]);
    expect((await F.rubrosDeIngreso("ws-1", "r2")).map((r) => r.id)).toEqual(["r1", "r2"]);

    B.agregar("fotofficeAttachment", { id: "adj-1", workspaceId: "ws-1", clientId: "cli-1", fileName: "transferencia.pdf" });
    B.agregar("fotofficeAttachment", { id: "adj-2", workspaceId: "ws-2", clientId: "cli-9", fileName: "ajeno.pdf" });
    B.agregar("fotofficeCobro", { id: "cob-1", workspaceId: "ws-1", receiptNumber: "R1", idempotencyKey: "k1", cashMovementId: "mov-1", receiptTokenHash: "h1", pedidoId: "ped-1", attachmentId: "adj-1" });
    B.agregar("fotofficeCobro", { id: "cob-2", workspaceId: "ws-1", receiptNumber: "R2", idempotencyKey: "k2", cashMovementId: "mov-2", receiptTokenHash: "h2", pedidoId: "ped-1", attachmentId: "adj-2" });
    B.agregar("fotofficeCobro", { id: "cob-3", workspaceId: "ws-1", receiptNumber: "R3", idempotencyKey: "k3", cashMovementId: "mov-3", receiptTokenHash: "h3", pedidoId: "ped-1", attachmentId: null });
    expect([...(await F.comprobantesDeCobros("ws-1", ["cob-1", "cob-2", "cob-3"]))]).toEqual([["cob-1", "transferencia.pdf"]]);
  });
});

describe("ayudas puras", () => {
  it("importes: sin decimales salvo que tengan centavos; lectura de lo escrito a mano", () => {
    expect(P.pesosPedido(120000)).toMatch(/^\$\s120\.000$/);
    expect(P.pesosPedido(40000.5)).toMatch(/^\$\s40\.000,50$/);
    expect(P.leerImporte("40000")).toBe(40000);
    expect(P.leerImporte("40.000")).toBe(40000);
    expect(P.leerImporte("40000.5")).toBe(40000.5);
    expect(P.leerImporte("40.000,50")).toBe(40000.5);
    expect(P.leerImporte("$ 1.234.567,89")).toBe(1234567.89);
    for (const malo of ["", "0", "-5", "1,234", "abc", "10,123"]) expect(P.leerImporte(malo)).toBeNull();
    expect(P.sumarPesos([0.1, 0.2])).toBe(0.3);
    expect(P.fechaCorta("2026-10-07")).toBe("07/10/2026");
    expect(P.fechaCorta(null)).toBe("—");
  });

  it("importe sugerido: el saldo de la cuota más vieja con saldo", () => {
    const c = (position: number, saldo: number) => ({ id: `c${position}`, position, dueDate: "2026-10-07", amountArs: 40000, saldo });
    expect(P.importeSugerido([c(3, 40000), c(2, 15000.25), c(1, 0)])).toBe(15000.25);
    expect(P.importeSugerido([])).toBe(0);
  });

  it("ajuste por forma de pago: descuento del contado (negativo), interés del plan (positivo) o nada", () => {
    expect(P.ajustePorFormaDePago(90000, 100000)).toEqual({ etiqueta: "Descuento por pago de contado", importe: -10000 });
    expect(P.ajustePorFormaDePago(115000.5, 100000)).toEqual({ etiqueta: "Interés de financiación", importe: 15000.5 });
    expect(P.ajustePorFormaDePago(100000, 100000)).toBeNull();
    // A centavos: una diferencia de redondeo de coma flotante no es un renglón.
    expect(P.ajustePorFormaDePago(0.1 + 0.2, 0.3)).toBeNull();
    expect(P.pesosConSigno(-10000).startsWith("−")).toBe(true);
    expect(P.pesosConSigno(15000.5).startsWith("+")).toBe(true);
    expect(P.pesosConSigno(-10000)).toContain("10.000");
  });

  it("clave de idempotencia: con la forma que acepta el servidor y distinta cada vez", () => {
    const a = P.claveDeCobro();
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
    expect(P.claveDeCobro()).not.toBe(a);
  });

  it("tarjeta e ítems: sólo lo que se muestra (sin costo ni cálculo)", () => {
    const fila = { id: "p", numero: "2026-0001", estado: "CONFIRMADO" as const, total: 1, aCobrar: 1, vencido: 0, eventDate: null, proximoVencimiento: null, costo: 5, margen: 3 };
    expect(Object.keys(aTarjetaPedido(fila)).sort()).toEqual(["aCobrar", "estado", "eventDate", "id", "numero", "proximoVencimiento", "total", "vencido"]);
    const item = { id: "r1", nombre: "Boda", descripcion: null, cantidad: 1, precioUnitario: 1, descuento: null, opcional: false, calculo: { costo: 5 }, productId: "x" };
    expect(JSON.stringify(aItemDePedido(item))).not.toMatch(/calculo|costo|productId/);
  });
});

// --- Fuente ----------------------------------------------------------------------------------------

const RAIZ = process.cwd();
const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), "utf8");

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
  const clientes = readdirSync(join(RAIZ, "components/pedidos"))
    .map((f) => join(RAIZ, "components/pedidos", f))
    .filter((f) => readFileSync(f, "utf8").startsWith('"use client"'));

  it("hay componentes de navegador y ninguno arrastra la base ni código de servidor", () => {
    expect(clientes.length).toBeGreaterThanOrEqual(7);
    for (const c of clientes) {
      for (const dep of cierre(c)) {
        const src = readFileSync(dep, "utf8");
        if (src.startsWith('"use server"')) continue;
        expect(src, `${c} → ${dep}`).not.toMatch(/from ["']@repo\/db["']|import ["']server-only["']/);
      }
    }
  });

  it("ningún componente de navegador recibe costos ni margen", () => {
    for (const c of clientes) expect(readFileSync(c, "utf8"), c).not.toMatch(/costo|margen|CostosVersion/i);
  });

  it("la ficha lee costos sólo con veCostos y sólo se los pasa a los ítems (componente de servidor)", () => {
    const pagina = leer("app/(shell)/pedidos/[id]/page.tsx");
    expect(pagina).toContain("const costos = detalle.veCostos ? await costosDelPedido(ctx, detalle) : null;");
    expect(pagina.match(/costos=\{/g)).toHaveLength(1);
    expect(pagina).toContain("costos={costos}");
    expect(pagina).toContain("detalle.items.map((i) => aItemDePedido(i))");
    expect(leer("components/pedidos/items-pedido.tsx").startsWith('"use client"')).toBe(false);
    // `costosDelPedido` vuelve a mirar el permiso antes de leer.
    expect(leer("lib/pedidos/ficha.ts")).toMatch(/if \(!veCostosDePedido\(ctx\) \|\| !detalle\.acceptedVersionId\) return null;/);
  });

  it("la ficha, la confirmación y la página pública muestran el renglón del descuento o del interés", () => {
    const ficha = leer("app/(shell)/pedidos/[id]/page.tsx");
    expect(ficha).toContain("ajustePorFormaDePago(plan.total, totalItems)");
    expect(ficha).toContain("{ajuste.etiqueta}");
    const confirmar = leer("components/pedidos/confirmar-pedido.tsx");
    expect(confirmar).toContain("ajustePorFormaDePago(vista.total, vista.totalPresupuesto)");
    expect(confirmar).toContain("{ajuste.etiqueta}");
    const publico = leer("components/pedidos/pedido-publico.tsx");
    expect(publico).toContain("{vista.ajuste.etiqueta}");
    expect(publico).toContain("pesosConSigno(vista.ajuste.importe)");
  });

  it("el historial de la ficha lee los mensajes registrados con entityType PEDIDO", () => {
    expect(leer("lib/pedidos/ficha.ts")).toContain('entityType: "PEDIDO"');
    expect(leer("app/(shell)/pedidos/[id]/page.tsx")).toContain("mensajesDePedido(workspace.id, detalle.id)");
    const envio = leer("lib/pedidos/envio.ts");
    expect(envio).toContain('const registrarEn = { entityType: "PEDIDO" as const, entityId: leido.pedidoId };');
  });

  it("las pantallas pasan por la guarda del módulo; Nuevo pide Gestionar", () => {
    for (const ruta of ["app/(shell)/pedidos/layout.tsx", "app/(shell)/pedidos/page.tsx", "app/(shell)/pedidos/[id]/page.tsx"]) {
      expect(leer(ruta)).toContain('requirePedidos("ver")');
    }
    expect(leer("app/(shell)/pedidos/nuevo/page.tsx")).toContain('requirePedidos("operar")');
    const guarda = leer("lib/pedidos/pagina.ts");
    const orden = ["requireAuth(", "resolveActiveWorkspace(", "isModuleEnabledForWorkspace(", "puede(acceso, nivel, ORDERS_MODULE_KEY)"];
    const pos = orden.map((s) => guarda.indexOf(s));
    expect(pos.every((p) => p > -1)).toBe(true);
    expect([...pos].sort((a, b) => a - b)).toEqual(pos);
  });

  it("las tarjetas del contacto y de la consulta pasan por `aTarjetaPedido`; Nuevo pedido sólo en el contacto, con Gestionar", () => {
    for (const ruta of ["app/(shell)/consultas/[id]/page.tsx", "app/(shell)/clientes/[clientId]/page.tsx"]) {
      const src = leer(ruta);
      expect(src).toMatch(/listarPedidos\([\s\S]*?\)\s*\)\.map\(aTarjetaPedido\)/);
      expect(src).toContain('puede(acceso, "ver", ORDERS_MODULE_KEY)');
    }
    expect(leer("app/(shell)/clientes/[clientId]/page.tsx")).toContain('puede(acceso, "operar", ORDERS_MODULE_KEY) ? `/pedidos/nuevo?contacto=');
    expect(leer("app/(shell)/consultas/[id]/page.tsx")).not.toContain("/pedidos/nuevo");
  });

  it("el presupuesto aceptado ofrece Confirmar pedido (Gestionar) o el enlace al pedido", () => {
    const src = leer("app/(shell)/presupuestos/[id]/page.tsx");
    expect(src).toContain("const pedido = aceptado ? await pedidoDePresupuesto(ctx, detalle.id) : null;");
    expect(src).toContain("const confirmaPedido = aceptado && pedido === null && puedeGestionarPedidos(ctx);");
    expect(src).toContain("<ConfirmarPedido presupuestoId={detalle.id}");
  });

  it("el menú muestra Pedidos sólo con nivel en el módulo orders", () => {
    const nav = leer("components/shell/shell-nav.tsx");
    expect(nav).toMatch(/\.\.\.\(ve\(ORDERS_MODULE_KEY\)\s*\?\s*\[\s*\{\s*href: "\/pedidos"/);
    expect(nav).toContain('const ORDERS_MODULE_KEY = "orders";');
  });

  it("revisión: la vista del recibo sobrevive al cobro que salda el pedido y muestra el importe del servidor", () => {
    const pagina = leer("app/(shell)/pedidos/[id]/page.tsx");
    // RegistrarCobro no depende del saldo para montarse: sólo el botón.
    expect(pagina).not.toMatch(/plan\.saldo > 0 \? \(\s*<RegistrarCobro/);
    expect(pagina).toContain("puedeCobrar={!cancelado && plan.saldo > 0}");
    const src = leer("components/pedidos/registrar-cobro.tsx");
    expect(src).toMatch(/\{puedeCobrar \? \(\s*<button/);
    expect(src).toContain("importe: r.importe");
    expect(src).not.toContain("importe: monto }");
    // Los recibos anulados no ofrecen enviarse.
    expect(leer("components/pedidos/cobros-del-pedido.tsx")).toContain("gestiona && envio && !c.anulado");
  });

  it("el cobro manda una clave de idempotencia generada al abrir el diálogo", () => {
    const src = leer("components/pedidos/registrar-cobro.tsx");
    expect(src).toContain("setClave(claveDeCobro());");
    expect(src).toContain("idempotencyKey: clave");
    // Sólo se genera en `abrir` (una vez por apertura), nunca al guardar.
    expect(src.match(/claveDeCobro\(\)/g)).toHaveLength(1);
  });
});
