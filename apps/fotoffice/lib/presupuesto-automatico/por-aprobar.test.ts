import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const PA = await import("./por-aprobar");
const F = await import("./flujo");
const { precioDeLaFila } = await import("./por-aprobar-puro");

const WS = "ws-1";
const AHORA = new Date("2026-11-19T15:00:00.000Z");
const DIA = 86_400_000;
const hace = (dias: number) => new Date(AHORA.getTime() - dias * DIA);

const DUENO = { workspaceId: WS, userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: { quotes: "MANAGE" } } as never };
const LECTOR = { workspaceId: WS, userId: 3, userLabel: "Leo", role: "STAFF", acceso: { role: "STAFF", levels: { quotes: "VIEW" } } as never };

const TOTALES = (total: number, extra: Record<string, unknown> = {}) => ({ subtotal: total, descuentos: 0, total, renglones: {}, ...extra });

function presupuesto(id: string, totals: unknown) {
  B.agregar("fotofficePresupuesto", { id, workspaceId: WS, consultaLeadId: `lead-${id}`, status: "BORRADOR", currentVersionId: `ver-${id}` });
  B.agregar("fotofficePresupuestoVersion", { id: `ver-${id}`, workspaceId: WS, presupuestoId: id, number: 1, sentAt: null, items: [], totals, costSnapshot: null });
}

function aprobacion(id: string, datos: Record<string, unknown> = {}) {
  return B.agregar("fotofficePresupuestoAprobacion", {
    id, workspaceId: WS, leadId: `lead-${id}`, presupuestoId: `pres-${id}`, categoryId: "cat-15", origin: "WHATSAPP", waId: null, igChatId: null,
    status: "AVISADO", errorCode: null, createdAt: hace(1), ...datos,
  });
}

beforeEach(() => {
  B.vaciar();
  B.agregar("fotofficeConsultaCategoria", { id: "cat-15", workspaceId: WS, name: "15 años", group: "Social", order: 1, archivedAt: null });
  B.agregar("serviceSalesLead", { id: "lead-a", workspaceId: WS, name: "Lucía Gómez", phone: "+54 9 341 555-1234", email: null });
  B.agregar("serviceSalesLead", { id: "lead-b", workspaceId: WS, name: "  ", phone: "+54 9 341 555-9999", email: null });
  presupuesto("pres-a", TOTALES(1_100_000));
  // Con opciones (Básico, Premium): el precio es el rango.
  presupuesto("pres-b", TOTALES(800_000, {
    alternativas: [
      { id: "alt-1", nombre: "Básico", descripcion: null, masElegida: false, orden: 0, totales: TOTALES(800_000) },
      { id: "alt-2", nombre: "Premium", descripcion: null, masElegida: true, orden: 1, totales: TOTALES(1_400_000) },
    ],
  }));
});

describe("listarPorAprobar: qué se muestra", () => {
  it("sólo las que esperan aprobación y tienen cotización, de la más nueva a la más vieja", async () => {
    aprobacion("a", { createdAt: hace(3) });
    aprobacion("b", { status: "AVISO_FALLIDO", origin: "WEB", createdAt: hace(1) });
    aprobacion("enviada", { status: "ENVIADO" });
    aprobacion("sin-propuesta", { status: "SIN_PROPUESTA", presupuestoId: null });
    aprobacion("archivada", { status: "ARCHIVADO" });
    aprobacion("otra", { workspaceId: "ws-2" });
    const filas = await PA.listarPorAprobar(WS, AHORA);
    expect(filas.map((f) => f.id)).toEqual(["b", "a"]);
    expect(filas[0]).toMatchObject({ presupuestoId: "pres-b", origen: "WEB", sinAviso: true, categoria: "15 años" });
    expect(filas[1]).toMatchObject({ cliente: "Lucía Gómez", origen: "WHATSAPP", sinAviso: false });
  });

  it("sin nombre muestra el teléfono; con opciones, el rango de precios; nunca costos", async () => {
    aprobacion("a");
    aprobacion("b");
    const filas = await PA.listarPorAprobar(WS, AHORA);
    const a = filas.find((f) => f.id === "a")!;
    const b = filas.find((f) => f.id === "b")!;
    expect(b.cliente).toBe("+54 9 341 555-9999");
    expect(a.precio).toMatch(/^\$\s?1\.100\.000$/);
    expect(b.precio).toMatch(/^\$\s?800\.000 a \$\s?1\.400\.000$/);
    expect(JSON.stringify(filas)).not.toMatch(/costo|margen/i);
  });

  it("precioDeLaFila: una sola opción o todas iguales no es un rango", () => {
    expect(precioDeLaFila({ total: 500_000 })).toMatch(/^\$\s?500\.000$/);
    expect(precioDeLaFila({ total: 0, alternativas: [{ total: 700_000 }, { total: 700_000 }] as never })).toMatch(/^\$\s?700\.000$/);
  });

  it("la pendiente de un presupuesto (el aviso arriba del editor): sí si espera, no si se envió o se archivó", async () => {
    aprobacion("a");
    aprobacion("b", { status: "ENVIADO" });
    expect(await PA.aprobacionDelPresupuesto(WS, "pres-a", AHORA)).toEqual({ id: "a" });
    expect(await PA.aprobacionDelPresupuesto(WS, "pres-b", AHORA)).toBeNull();
    expect(await PA.aprobacionDelPresupuesto("ws-2", "pres-a", AHORA)).toBeNull();
  });
});

describe("archivado por antigüedad", () => {
  it("las de más de 14 días se archivan solas, no aparecen y no frenan otra consulta del mismo número", async () => {
    aprobacion("a", { createdAt: hace(15), waId: "5493415551234" });
    aprobacion("b", { createdAt: hace(13) });
    aprobacion("enviada", { status: "ENVIADO", createdAt: hace(30) });
    expect((await PA.listarPorAprobar(WS, AHORA)).map((f) => f.id)).toEqual(["b"]);
    const filas = B.datos.fotofficePresupuestoAprobacion;
    expect(filas.find((f) => f.id === "a")).toMatchObject({ status: "ARCHIVADO", errorCode: "ANTIGUEDAD" });
    expect(filas.find((f) => f.id === "b")).toMatchObject({ status: "AVISADO" });
    expect(filas.find((f) => f.id === "enviada")).toMatchObject({ status: "ENVIADO" });
    expect(await PA.contarPorAprobar(WS, AHORA)).toBe(1);
    expect(await F.enPreparacionParaWhatsapp(WS, "5493415551234", AHORA)).toBe(false);
  });

  it("una archivada no se puede aprobar (ni desde Telegram)", async () => {
    aprobacion("a", { status: "ARCHIVADO" });
    expect(await F.aprobarYEnviar(WS, "a", { tipo: "TELEGRAM" }, { ahora: () => AHORA })).toMatchObject({ ok: false, codigo: "ARCHIVADO" });
  });
});

describe("descartar", () => {
  it("la archiva una sola vez; una enviada no se toca; sin «Gestionar» no", async () => {
    aprobacion("a");
    aprobacion("b", { status: "ENVIADO" });
    expect(await PA.descartarAprobacion(LECTOR, "a")).toEqual({ ok: false, error: PA.MENSAJES_POR_APROBAR.sinPermiso });
    expect(await PA.descartarAprobacion(DUENO, "a")).toEqual({ ok: true });
    expect(B.datos.fotofficePresupuestoAprobacion.find((f) => f.id === "a")).toMatchObject({ status: "ARCHIVADO", errorCode: "DESCARTADO" });
    expect(await PA.descartarAprobacion(DUENO, "a")).toEqual({ ok: false, error: PA.MENSAJES_POR_APROBAR.yaNoEspera });
    expect(await PA.descartarAprobacion(DUENO, "b")).toEqual({ ok: false, error: PA.MENSAJES_POR_APROBAR.yaNoEspera });
    expect(await PA.listarPorAprobar(WS, AHORA)).toEqual([]);
  });

  it("no toca la de otro workspace", async () => {
    aprobacion("a", { workspaceId: "ws-2" });
    expect(await PA.descartarAprobacion(DUENO, "a")).toMatchObject({ ok: false });
    expect(B.datos.fotofficePresupuestoAprobacion[0]).toMatchObject({ status: "AVISADO" });
  });
});

describe("aprobar desde el presupuesto o la lista", () => {
  it("usa el mismo camino que Telegram: aprobarYEnviar con PANEL y el usuario", async () => {
    const aprobar = vi.fn(async () => ({ ok: true as const, canales: { correo: "SIN_CORREO" as const, whatsapp: "ENVIADO" as const }, texto: "Enviado por WhatsApp." }));
    const r = await PA.aprobarDesdeElPanel(DUENO, "a", {}, aprobar);
    expect(r).toMatchObject({ ok: true, texto: "Enviado por WhatsApp." });
    expect(aprobar).toHaveBeenCalledWith(WS, "a", { tipo: "PANEL", userId: 1 }, {});
  });

  it("sin «Gestionar» o con un id inválido no llama a nada", async () => {
    const aprobar = vi.fn();
    expect(await PA.aprobarDesdeElPanel(LECTOR, "a", {}, aprobar as never)).toMatchObject({ ok: false, codigo: "SIN_PERMISO" });
    expect(await PA.aprobarDesdeElPanel(DUENO, "x".repeat(65), {}, aprobar as never)).toMatchObject({ ok: false, codigo: "DATOS" });
    expect(aprobar).not.toHaveBeenCalled();
  });

  it("las acciones y las pantallas: el aviso del presupuesto y la lista usan la misma acción; Telegram ya no tiene la lista", () => {
    const leer = (...f: string[]) => readFileSync(join(__dirname, "..", "..", ...f), "utf8");
    const acciones = leer("app", "actions", "presupuestos.ts");
    expect(acciones).toContain("aprobarDesdeElPanel(ctx, aprobacionId)");
    expect(acciones).toContain('contextoDePresupuestos("operar")');
    const boton = leer("components", "presupuestos", "aprobar-cotizacion.tsx");
    expect(boton).toContain("aprobarCotizacionAction(aprobacionId)");
    expect(boton).toContain("hayCambiosSinGuardar(presupuestoId)");
    expect(leer("components", "presupuestos", "editor-presupuesto.tsx")).toContain("marcarCambiosSinGuardar(datos.presupuestoId, cambios)");
    const ficha = leer("app", "(shell)", "presupuestos", "[id]", "page.tsx");
    expect(ficha).toContain("Esta cotización la armó el bot y espera tu aprobación");
    expect(ficha).toContain("<AprobarCotizacion");
    expect(leer("app", "(shell)", "presupuestos", "por-aprobar", "page.tsx")).toContain('requirePresupuestos("operar")');
    const telegram = leer("app", "workspace", "configuracion", "telegram", "page.tsx");
    expect(telegram).toContain('href="/presupuestos/por-aprobar"');
    expect(telegram).not.toContain("pendientesDeAprobar");
  });

  it("«✏️ Corregir» de Telegram abre ese mismo presupuesto", async () => {
    aprobacion("a", { leadId: "lead-a" });
    const datos = await F.datosDelResumen(WS, "a", { origenApp: "https://fotoffice.com" });
    expect(datos?.urlPresupuesto).toBe("https://fotoffice.com/presupuestos/pres-a");
  });
});
