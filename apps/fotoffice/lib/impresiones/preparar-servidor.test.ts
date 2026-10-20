import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-unused-vars -- los mocks reciben argumentos que la prueba lee con `mock.calls` */
type Item = {
  id: string; sourceKey: string; sourceName: string; widthCm: string; heightCm: string; quantity: number;
  cropX: number; cropY: number; cropW: number; cropH: number; proveedorId: string | null; proyectoId: string | null; sizeId?: string | null;
};
type Pedido = { id: string; workspaceId: string; number: number; nombre: string; paper: string; status: string; items: Item[] };

const item = (o: Partial<Item> & Pick<Item, "id" | "sourceName">): Item => ({
  sourceKey: `trabajos/ws/origen/${o.id}/${o.sourceName}`, widthCm: "13", heightCm: "18", quantity: 1,
  cropX: 0, cropY: 0, cropW: 1, cropH: 1, proveedorId: "f", proyectoId: "p-f", ...o,
});
const pedidoBase = (): Pedido => ({
  id: "ord1", workspaceId: "ws", number: 8, nombre: "Juan", paper: "BRILLO", status: "PAGADO",
  items: [
    item({ id: "i1", sourceName: "b.jpg", widthCm: "13", heightCm: "18", quantity: 2 }),
    item({ id: "i2", sourceName: "a.jpg", widthCm: "15", heightCm: "10", quantity: 1 }),
    item({ id: "i3", sourceName: "c.jpg", widthCm: "30", heightCm: "40", quantity: 1, proveedorId: "isla", proyectoId: "p-isla" }),
  ],
});

const H = vi.hoisted(() => {
  const estado = {
    pedidos: {} as Record<string, unknown>,
    lecturas: {} as Record<string, unknown[]>,
    pagados: [] as { id: string }[],
    pendientesPago: [] as { id: string; workspaceId: string }[],
    sinCircuito: [] as { id: string; workspaceId: string }[],
  };
  const db = {
    fotofficePrintOrder: {
      updateMany: vi.fn(async (..._a: unknown[]) => ({ count: 1 })),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        const cola = estado.lecturas[where.id];
        if (cola && cola.length > 0) return cola.shift();
        return estado.pedidos[where.id];
      }),
      findMany: vi.fn(async ({ where }: { where: { status?: string } }) =>
        where.status === "PENDIENTE_PAGO" ? estado.pendientesPago : where.status === "PAGADO_SIN_ENVIAR" ? estado.sinCircuito : estado.pagados,
      ),
      update: vi.fn(async (..._a: unknown[]) => ({})),
    },
    fotofficePrintSettings: { findUnique: vi.fn(async (..._a: unknown[]) => ({ testMode: false }) as unknown) },
    fotofficeWorkspaceBranding: { findFirst: vi.fn(async (..._a: unknown[]) => ({ commercialName: "DNX Estudio", contactEmail: "estudio@dnx.test" }) as unknown) },
    fotofficeProveedor: {
      findMany: vi.fn(async (..._a: unknown[]) => [
        { id: "f", name: "Fotolag", email: "pedidos@fotolag.test" as string | null },
        { id: "isla", name: "La Isla", email: "isla@lab.test" as string | null },
      ]),
    },
    fotofficeProyecto: {
      findMany: vi.fn(async (..._a: unknown[]) => [] as { id: string; proveedorEnviadoAt: Date | null }[]),
      update: vi.fn(async (..._a: unknown[]) => ({})),
    },
    fotofficeArchivoTrabajo: {
      create: vi.fn(async (..._a: unknown[]) => ({})),
      findMany: vi.fn(async (..._a: unknown[]) => [] as { id: string; key: string }[]),
      deleteMany: vi.fn(async (..._a: unknown[]) => ({ count: 0 })),
    },
    fotofficePrintSize: { findMany: vi.fn(async (..._a: unknown[]) => [] as unknown[]) },
    fotofficePrintOrderItem: { update: vi.fn(async (..._a: unknown[]) => ({})) },
  };
  return {
    estado,
    db,
    emitirEnlace: vi.fn(async (..._a: unknown[]) => ({ ok: true, url: "https://dnx.test/archivos/tok", vence: "2026-11-20T12:00:00.000Z" }) as unknown),
    moverAFase: vi.fn(async (..._a: unknown[]) => ({ ok: true, movido: true, etapa: "En el proveedor" })),
    asegurar: vi.fn(async (..._a: unknown[]) => "OK" as string),
    acreditar: vi.fn(async (..._a: unknown[]) => ({ ok: true, yaEstaba: false })),
    collector: vi.fn(async (..._a: unknown[]) => ({ ok: true, collector: { accessToken: "tok" } }) as unknown),
    buscar: vi.fn(async (..._a: unknown[]) => null as unknown),
    borrar: vi.fn(async (..._a: unknown[]) => undefined),
  };
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: H.db }));
vi.mock("@/lib/carpetas/carpeta", () => ({ emitirEnlace: H.emitirEnlace }));
vi.mock("@/lib/proyectos/avance", () => ({ moverAFase: H.moverAFase }));
vi.mock("@/lib/circuitos/acceso", () => ({ contextoDeSistema: (workspaceId: string) => ({ workspaceId, userId: null, userLabel: "Sistema", role: null }) }));
vi.mock("@/lib/communications/send-email", () => ({ sendTransactionalEmail: vi.fn() }));
vi.mock("@/lib/communications/load-workspace-sender", () => ({ loadWorkspaceSender: async () => ({ name: "DNX Estudio", replyTo: null }) }));
vi.mock("@/lib/carpetas/subir-servidor", () => ({ subirFlujo: vi.fn() }));
vi.mock("@/lib/carpetas/almacen", () => ({ borrarArchivoGuardado: H.borrar }));
vi.mock("./fuentes-servidor", () => ({ leerOriginal: vi.fn() }));
vi.mock("./acreditar-servidor", () => ({ asegurarTrabajosDelPedido: H.asegurar, acreditarPagoImpresion: H.acreditar }));
vi.mock("@/lib/payments/connect/collector", () => ({ resolveWorkspaceCollector: H.collector }));
vi.mock("@/lib/payments/connect/log", () => ({ sanitizeError: (e: unknown) => String((e as Error)?.message ?? e).slice(0, 40) }));
vi.mock("@repo/payments/mercado-pago", () => ({ createMercadoPagoCheckoutProLiveAdapter: () => ({ searchPaymentsByExternalReference: H.buscar }) }));
vi.mock("./pago-servidor", () => ({
  referenciaPedido: (id: string) => `fo-impresion:${id}`,
  pedidoDeReferencia: (raw: unknown) => (typeof raw === "string" && raw.startsWith("fo-impresion:") ? raw.slice(13) : null),
}));
const P = await import("./preparar-servidor");

const AHORA = new Date("2026-10-20T18:00:00.000Z");
const orden = H.db.fotofficePrintOrder as unknown as Record<string, ReturnType<typeof vi.fn>>;
const zips: { clave: string; buf: Buffer }[] = [];

function deps() {
  return {
    ahora: () => AHORA,
    leer: vi.fn(async (_k: string) => Buffer.from("original")),
    recortar: vi.fn(async (_o: Buffer, _i: { sourceName: string }) => Buffer.from("jpg")),
    subir: vi.fn(async (clave: string, flujo: AsyncIterable<Buffer>, _tipo: string) => {
      const partes: Buffer[] = [];
      for await (const b of flujo) partes.push(b);
      const buf = Buffer.concat(partes);
      zips.push({ clave, buf });
      return buf.length;
    }),
    enviar: vi.fn(async (..._a: unknown[]) => ({ status: "SENT", providerId: "re_1" }) as { status: "SENT"; providerId: string } | { status: "PROVIDER_REJECTED"; detail: string }),
  };
}
const actualizaciones = () => orden.update.mock.calls.map((c) => c[0] as { where: { id: string }; data: Record<string, unknown> });
const pagoAprobado = (ref: string) => ({ providerPaymentId: "mp-9", status: "APPROVED", amountMinor: 100000, currency: "ARS", externalReference: ref, rawSanitized: { status: "approved" } });

beforeEach(() => {
  vi.clearAllMocks();
  zips.length = 0;
  H.estado.pedidos = { ord1: pedidoBase() };
  H.estado.lecturas = {};
  H.estado.pagados = [{ id: "ord1" }];
  H.estado.pendientesPago = [];
  H.estado.sinCircuito = [];
  H.db.fotofficeArchivoTrabajo.findMany.mockResolvedValue([]);
  H.db.fotofficePrintSize.findMany.mockResolvedValue([]);
  orden.updateMany.mockResolvedValue({ count: 1 });
  H.db.fotofficePrintSettings.findUnique.mockResolvedValue({ testMode: false });
  H.db.fotofficeProyecto.findMany.mockResolvedValue([]);
  H.db.fotofficeProveedor.findMany.mockResolvedValue([
    { id: "f", name: "Fotolag", email: "pedidos@fotolag.test" },
    { id: "isla", name: "La Isla", email: "isla@lab.test" },
  ]);
  H.asegurar.mockResolvedValue("OK");
  H.buscar.mockResolvedValue(null);
  H.collector.mockResolvedValue({ ok: true, collector: { accessToken: "tok" } });
});

describe("prepararPedido", () => {
  it("1. toma el pedido con una escritura condicional y, si otro lo tomó, no hace nada", async () => {
    const d = deps();
    expect(await P.prepararPedido("ord1", d)).toBe("ENVIADO");
    const toma = orden.updateMany.mock.calls[0][0] as { where: Record<string, unknown>; data: Record<string, unknown> };
    expect(toma.where).toEqual({ id: "ord1", status: "PAGADO" });
    expect(toma.data).toEqual({ status: "PREPARANDO", lockedAt: AHORA });

    vi.clearAllMocks();
    orden.updateMany.mockResolvedValue({ count: 0 });
    const d2 = deps();
    expect(await P.prepararPedido("ord1", d2)).toBe("OCUPADO");
    expect(orden.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(d2.subir).not.toHaveBeenCalled();
    expect(d2.enviar).not.toHaveBeenCalled();
    expect(orden.update).not.toHaveBeenCalled();
  });

  it("2. sube un ZIP ordenado por laboratorio, crea el archivo del trabajo y emite el enlace del laboratorio", async () => {
    const d = deps();
    await P.prepararPedido("ord1", d);
    expect(d.subir).toHaveBeenCalledTimes(2);
    expect(zips[0].clave).toMatch(/^trabajos\/ws\/p-f\/[0-9a-f-]{36}\/Pedido-8\.zip$/);
    expect(zips[1].clave).toMatch(/^trabajos\/ws\/p-isla\/[0-9a-f-]{36}\/Pedido-8\.zip$/);
    expect(d.subir.mock.calls[0][2]).toBe("application/zip");
    // Ordenado por tamaño: el 10x15 antes que el 13x18, con las carpetas tal cual.
    const fotolag = zips[0].buf.toString("utf8");
    const a = fotolag.indexOf("Pedido 8 - Juan/10x15 Brillo/1 copia/a.jpg");
    const b = fotolag.indexOf("Pedido 8 - Juan/13x18 Brillo/2 copias/b.jpg");
    expect(a).toBeGreaterThanOrEqual(0);
    expect(b).toBeGreaterThan(a);
    expect(zips[1].buf.toString("utf8")).toContain("Pedido 8 - Juan/30x40 Brillo/1 copia/c.jpg");

    const archivoId = zips[0].clave.split("/")[3];
    expect(H.db.fotofficeArchivoTrabajo.create).toHaveBeenCalledWith({
      data: { id: archivoId, workspaceId: "ws", proyectoId: "p-f", key: zips[0].clave, nombre: "Pedido-8.zip", tipo: "application/zip", bytes: BigInt(zips[0].buf.length), estado: "LISTO" },
    });
    expect(H.emitirEnlace).toHaveBeenCalledWith("ws", "p-f", "LABORATORIO", AHORA);
    expect(H.emitirEnlace).toHaveBeenCalledWith("ws", "p-isla", "LABORATORIO", AHORA);
    expect(d.recortar).toHaveBeenCalledTimes(3);
  });

  it("3. manda un correo por laboratorio al correo del proveedor, con PARA MAÑANA y el nombre del cliente", async () => {
    const d = deps();
    await P.prepararPedido("ord1", d);
    expect(d.enviar).toHaveBeenCalledTimes(2);
    expect(d.enviar).toHaveBeenCalledWith(expect.objectContaining({ to: "pedidos@fotolag.test", subject: "Pedido 8 – PARA MAÑANA – Juan" }));
    expect(d.enviar).toHaveBeenCalledWith(expect.objectContaining({ to: "isla@lab.test", subject: "Pedido 8 – PARA MAÑANA – Juan" }));
    const correo = d.enviar.mock.calls[0][0] as { text: string; sender: unknown };
    expect(correo.text).toContain("https://dnx.test/archivos/tok");
    expect(correo.text).toContain("13x18 Brillo: 2");
    expect(correo.text).toContain("20/11/2026");
    expect(correo.sender).toEqual({ name: "DNX Estudio", replyTo: null });
  });

  it("4. en modo prueba el correo va al estudio y el asunto empieza con [PRUEBA]", async () => {
    H.db.fotofficePrintSettings.findUnique.mockResolvedValue({ testMode: true });
    const d = deps();
    expect(await P.prepararPedido("ord1", d)).toBe("ENVIADO");
    expect(d.enviar).toHaveBeenCalledTimes(2);
    for (const c of d.enviar.mock.calls) {
      const m = c[0] as { to: string; subject: string };
      expect(m.to).toBe("estudio@dnx.test");
      expect(m.subject.startsWith("[PRUEBA] ")).toBe(true);
    }
    expect(H.moverAFase).toHaveBeenCalledWith(expect.anything(), "p-f", "EN_PROVEEDOR", "Pedido de impresión 8 enviado a Fotolag (modo prueba).");
  });

  it("5. marca cada trabajo como enviado, lo pasa a En el proveedor y deja el pedido ENVIADO", async () => {
    const d = deps();
    await P.prepararPedido("ord1", d);
    expect(H.db.fotofficeProyecto.update).toHaveBeenCalledWith({ where: { id: "p-f" }, data: { proveedorEnviadoAt: AHORA } });
    expect(H.db.fotofficeProyecto.update).toHaveBeenCalledWith({ where: { id: "p-isla" }, data: { proveedorEnviadoAt: AHORA } });
    expect(H.moverAFase).toHaveBeenCalledWith({ workspaceId: "ws", userId: null, userLabel: "Sistema", role: null }, "p-f", "EN_PROVEEDOR", "Pedido de impresión 8 enviado a Fotolag.");
    expect(H.moverAFase).toHaveBeenCalledWith(expect.anything(), "p-isla", "EN_PROVEEDOR", "Pedido de impresión 8 enviado a La Isla.");
    expect(actualizaciones().at(-1)).toEqual({ where: { id: "ord1" }, data: { status: "ENVIADO", sentAt: AHORA, lockedAt: null, lastError: null } });
  });

  it("6. un laboratorio sin correo deja el pedido PAGADO_SIN_ENVIAR, suma un intento y avisa al estudio", async () => {
    H.db.fotofficeProveedor.findMany.mockResolvedValue([
      { id: "f", name: "Fotolag", email: null },
      { id: "isla", name: "La Isla", email: "isla@lab.test" },
    ]);
    const d = deps();
    expect(await P.prepararPedido("ord1", d)).toBe("PAGADO_SIN_ENVIAR");
    expect(actualizaciones().at(-1)).toEqual({
      where: { id: "ord1" },
      data: { status: "PAGADO_SIN_ENVIAR", lockedAt: null, lastError: "Fotolag no tiene correo cargado.", attempts: { increment: 1 } },
    });
    expect(d.enviar).toHaveBeenCalledTimes(1);
    expect(d.enviar).toHaveBeenCalledWith(expect.objectContaining({ to: "estudio@dnx.test", subject: "El pedido de impresión 8 no se pudo mandar al laboratorio" }));
    expect((d.enviar.mock.calls[0][0] as { text: string }).text).toContain("Fotolag no tiene correo cargado.");
    expect(d.subir).not.toHaveBeenCalled();
  });

  it("7. si el correo al laboratorio es rechazado queda PAGADO_SIN_ENVIAR", async () => {
    const d = deps();
    d.enviar.mockResolvedValueOnce({ status: "PROVIDER_REJECTED", detail: "dominio" });
    expect(await P.prepararPedido("ord1", d)).toBe("PAGADO_SIN_ENVIAR");
    const ultima = actualizaciones().at(-1)!;
    expect(ultima.data).toMatchObject({ status: "PAGADO_SIN_ENVIAR", lockedAt: null, attempts: { increment: 1 } });
    expect(ultima.data.lastError).toBe("El correo a Fotolag no salió (PROVIDER_REJECTED).");
    expect(H.db.fotofficeProyecto.update).not.toHaveBeenCalled();
    expect(H.moverAFase).not.toHaveBeenCalled();
  });

  it("8. si una foto no se puede recortar, el pedido queda PAGADO_SIN_ENVIAR con el nombre del archivo y el cron sigue", async () => {
    H.estado.pedidos.ord2 = { ...pedidoBase(), id: "ord2", number: 9, items: pedidoBase().items.map((i) => ({ ...i, id: `${i.id}-2`, sourceName: `otra-${i.sourceName}` })) };
    H.estado.pagados = [{ id: "ord1" }, { id: "ord2" }];
    const d = deps();
    d.recortar.mockImplementation(async (_o, i) => {
      if (i.sourceName === "b.jpg") throw new Error("archivo dañado");
      return Buffer.from("jpg");
    });
    expect(await P.procesarPedidosDeImpresion(d)).toEqual({ procesados: 2, enviados: 1, fallidos: 1 });
    const ord1 = actualizaciones().filter((u) => u.where.id === "ord1").at(-1)!;
    expect(ord1.data).toMatchObject({ status: "PAGADO_SIN_ENVIAR", lastError: "No se pudo preparar b.jpg: archivo dañado" });
    const ord2 = actualizaciones().filter((u) => u.where.id === "ord2").at(-1)!;
    expect(ord2.data).toMatchObject({ status: "ENVIADO", sentAt: AHORA });
    // El ZIP a medias de ord1 no deja archivo en el trabajo.
    expect(H.db.fotofficeArchivoTrabajo.create).toHaveBeenCalledTimes(2);
  });

  it("9. un pedido PREPARANDO con el bloqueo vencido (más de 15 minutos) se vuelve a tomar", async () => {
    H.estado.pedidos.ord1 = { ...pedidoBase(), status: "PREPARANDO" };
    const d = deps();
    expect(await P.procesarPedidosDeImpresion(d)).toEqual({ procesados: 1, enviados: 1, fallidos: 0 });
    const busqueda = orden.findMany.mock.calls.map((c) => c[0] as { where: Record<string, unknown> }).find((q) => !("status" in q.where))!;
    const vencido = new Date(AHORA.getTime() - 15 * 60 * 1000);
    expect(busqueda.where).toEqual({ OR: [{ status: "PAGADO" }, { status: "PREPARANDO", lockedAt: { lt: vencido } }] });
    // Ya no estaba PAGADO: se retoma el PREPARANDO vencido sumando un intento.
    orden.updateMany.mockReset();
    orden.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValue({ count: 1 });
    expect(await P.prepararPedido("ord1", deps())).toBe("ENVIADO");
    expect(orden.updateMany.mock.calls[1][0]).toEqual({
      where: { id: "ord1", status: "PREPARANDO", lockedAt: { lt: vencido }, attempts: { lt: 2 } },
      data: { lockedAt: AHORA, attempts: { increment: 1 } },
    });
  });

  it("un PREPARANDO vencido que ya se trabó 3 veces no se vuelve a procesar: queda PAGADO_SIN_ENVIAR y avisa", async () => {
    orden.updateMany.mockReset();
    // No está PAGADO; tampoco tiene menos de 2 intentos; se corta.
    orden.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 0 }).mockResolvedValue({ count: 1 });
    const d = deps();
    expect(await P.prepararPedido("ord1", d)).toBe("PAGADO_SIN_ENVIAR");
    const vencido = new Date(AHORA.getTime() - 15 * 60 * 1000);
    expect(orden.updateMany.mock.calls[2][0]).toEqual({
      where: { id: "ord1", status: "PREPARANDO", lockedAt: { lt: vencido } },
      data: {
        status: "PAGADO_SIN_ENVIAR",
        lockedAt: null,
        attempts: { increment: 1 },
        lastError: "El pedido es muy grande o una foto no se pudo procesar. Revisalo y tocá «Reintentar envío».",
      },
    });
    expect(d.leer).not.toHaveBeenCalled();
    expect(d.subir).not.toHaveBeenCalled();
    expect(d.enviar).toHaveBeenCalledTimes(1);
    expect(d.enviar).toHaveBeenCalledWith(expect.objectContaining({ to: "estudio@dnx.test", subject: "El pedido de impresión 8 no se pudo mandar al laboratorio" }));
  });

  it("una copia sin laboratorio usa el laboratorio actual de su tamaño (así «Reintentar envío» anda tras arreglar la configuración)", async () => {
    H.estado.pedidos.ord1 = { ...pedidoBase(), items: [item({ id: "i1", sourceName: "b.jpg", proveedorId: null, sizeId: "s13" })] };
    H.db.fotofficePrintSize.findMany.mockResolvedValue([{ id: "s13", proveedorId: "f", proveedor: { active: true } }]);
    const d = deps();
    expect(await P.prepararPedido("ord1", d)).toBe("ENVIADO");
    expect(H.db.fotofficePrintSize.findMany.mock.calls[0][0]).toMatchObject({ where: { workspaceId: "ws", id: { in: ["s13"] } } });
    expect(H.db.fotofficePrintOrderItem.update).toHaveBeenCalledWith({ where: { id: "i1" }, data: { proveedorId: "f" } });
    expect(d.enviar).toHaveBeenCalledWith(expect.objectContaining({ to: "pedidos@fotolag.test" }));
  });

  it("si el laboratorio de la copia ya no está activo, también usa el actual de su tamaño", async () => {
    H.estado.pedidos.ord1 = { ...pedidoBase(), items: [item({ id: "i1", sourceName: "b.jpg", proveedorId: "viejo", sizeId: "s13" })] };
    H.db.fotofficePrintSize.findMany.mockResolvedValue([{ id: "s13", proveedorId: "isla", proveedor: { active: true } }]);
    const d = deps();
    expect(await P.prepararPedido("ord1", d)).toBe("ENVIADO");
    const activos = H.db.fotofficeProveedor.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(activos.where).toEqual({ workspaceId: "ws", active: true, id: { in: ["viejo"] } });
    expect(H.db.fotofficePrintOrderItem.update).toHaveBeenCalledWith({ where: { id: "i1" }, data: { proveedorId: "isla" } });
    expect(d.enviar).toHaveBeenCalledWith(expect.objectContaining({ to: "isla@lab.test" }));
  });

  it("si el tamaño tampoco tiene laboratorio, falla como antes", async () => {
    H.estado.pedidos.ord1 = { ...pedidoBase(), items: [item({ id: "i1", sourceName: "b.jpg", proveedorId: null, sizeId: "s13" })] };
    H.db.fotofficePrintSize.findMany.mockResolvedValue([{ id: "s13", proveedorId: null, proveedor: null }]);
    const d = deps();
    expect(await P.prepararPedido("ord1", d)).toBe("PAGADO_SIN_ENVIAR");
    expect(actualizaciones().at(-1)!.data.lastError).toBe("Hay copias sin laboratorio asignado.");
    expect(H.db.fotofficePrintOrderItem.update).not.toHaveBeenCalled();
  });

  it("antes de subir el ZIP de un reintento borra el ZIP anterior del mismo nombre en ese trabajo", async () => {
    H.db.fotofficeArchivoTrabajo.findMany.mockImplementation(async (a: unknown) => {
      const { where } = a as { where: { proyectoId: string } };
      return where.proyectoId === "p-f" ? [{ id: "viejo", key: "trabajos/ws/p-f/viejo/Pedido-8.zip" }] : [];
    });
    const d = deps();
    expect(await P.prepararPedido("ord1", d)).toBe("ENVIADO");
    expect(H.db.fotofficeArchivoTrabajo.findMany).toHaveBeenCalledWith({ where: { workspaceId: "ws", proyectoId: "p-f", nombre: "Pedido-8.zip" }, select: { id: true, key: true } });
    expect(H.borrar).toHaveBeenCalledWith("trabajos/ws/p-f/viejo/Pedido-8.zip");
    expect(H.db.fotofficeArchivoTrabajo.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["viejo"] }, workspaceId: "ws" } });
    expect(H.borrar).toHaveBeenCalledTimes(1);
    expect(H.db.fotofficeArchivoTrabajo.create).toHaveBeenCalledTimes(2);
  });

  it("sin circuito de trabajo (copias sin trabajo) queda PAGADO_SIN_ENVIAR, avisa y no rompe el cron", async () => {
    H.estado.pedidos.ord1 = { ...pedidoBase(), items: pedidoBase().items.map((i) => ({ ...i, proyectoId: null })) };
    H.asegurar.mockResolvedValue("SIN_CIRCUITO");
    const d = deps();
    expect(await P.procesarPedidosDeImpresion(d)).toEqual({ procesados: 1, enviados: 0, fallidos: 1 });
    expect(H.asegurar).toHaveBeenCalledWith("ws", "ord1", AHORA);
    expect(actualizaciones().at(-1)!.data).toMatchObject({
      status: "PAGADO_SIN_ENVIAR",
      lastError: "No hay un circuito de trabajo para crear el trabajo. Creá uno en Configuración → Circuitos y tocá «Reintentar envío».",
    });
    expect(d.enviar).toHaveBeenCalledWith(expect.objectContaining({ to: "estudio@dnx.test" }));
    expect(d.subir).not.toHaveBeenCalled();
  });

  it("al reintentar, si ahora hay circuito, crea los trabajos y manda el pedido", async () => {
    const sinTrabajo = { ...pedidoBase(), items: pedidoBase().items.map((i) => ({ ...i, proyectoId: null })) };
    H.estado.lecturas.ord1 = [sinTrabajo, pedidoBase()];
    const d = deps();
    expect(await P.prepararPedido("ord1", d)).toBe("ENVIADO");
    expect(H.asegurar).toHaveBeenCalledTimes(1);
    expect(d.enviar).toHaveBeenCalledTimes(2);
  });

  it("al reintentar no repite el laboratorio que ya recibió su parte", async () => {
    H.db.fotofficeProyecto.findMany.mockResolvedValue([{ id: "p-f", proveedorEnviadoAt: new Date("2026-10-20T17:00:00Z") }, { id: "p-isla", proveedorEnviadoAt: null }]);
    const d = deps();
    expect(await P.prepararPedido("ord1", d)).toBe("ENVIADO");
    expect(d.enviar).toHaveBeenCalledTimes(1);
    expect(d.enviar).toHaveBeenCalledWith(expect.objectContaining({ to: "isla@lab.test" }));
    expect(zips).toHaveLength(1);
  });
});

describe("conciliación de pagos", () => {
  it("un pedido sin pagar con un pago aprobado en Mercado Pago se acredita una vez", async () => {
    H.estado.pagados = [];
    H.estado.pendientesPago = [{ id: "ord9", workspaceId: "ws" }];
    H.buscar.mockResolvedValue(pagoAprobado("fo-impresion:ord9"));
    await P.procesarPedidosDeImpresion(deps());
    const q = orden.findMany.mock.calls.map((c) => c[0] as { where: Record<string, unknown>; take: number }).find((x) => x.where.status === "PENDIENTE_PAGO")!;
    // Sin exigir la preferencia: si no se pudo anotar, la búsqueda por referencia igual lo encuentra.
    expect(q.where).toEqual({
      status: "PENDIENTE_PAGO",
      createdAt: { gte: new Date(AHORA.getTime() - 3 * 24 * 60 * 60 * 1000), lte: new Date(AHORA.getTime() - 10 * 60 * 1000) },
    });
    expect(q.take).toBe(5);
    expect(H.buscar).toHaveBeenCalledWith("fo-impresion:ord9");
    expect(H.acreditar).toHaveBeenCalledTimes(1);
    expect(H.acreditar).toHaveBeenCalledWith("ws", pagoAprobado("fo-impresion:ord9"));
  });
  it("sin pago (o no aprobado, o de otro pedido) no acredita nada", async () => {
    H.estado.pagados = [];
    H.estado.pendientesPago = [{ id: "ord9", workspaceId: "ws" }, { id: "ord10", workspaceId: "ws" }];
    H.buscar.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...pagoAprobado("fo-impresion:otro"), rawSanitized: { status: "approved" } });
    await P.procesarPedidosDeImpresion(deps());
    expect(H.buscar).toHaveBeenCalledTimes(2);
    expect(H.acreditar).not.toHaveBeenCalled();
  });
  it("si Mercado Pago falla se anota y sigue con lo demás", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    H.estado.pendientesPago = [{ id: "ord9", workspaceId: "ws" }];
    H.buscar.mockRejectedValueOnce(new Error("timeout"));
    expect(await P.procesarPedidosDeImpresion(deps())).toEqual({ procesados: 1, enviados: 1, fallidos: 0 });
    expect(H.acreditar).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("procesarPedidosDeImpresion", () => {
  it("deja de empezar pedidos nuevos pasados los 200 segundos", async () => {
    H.estado.pedidos.ord2 = { ...pedidoBase(), id: "ord2" };
    H.estado.pedidos.ord3 = { ...pedidoBase(), id: "ord3" };
    H.estado.pagados = [{ id: "ord1" }, { id: "ord2" }, { id: "ord3" }];
    const d = deps();
    let t = AHORA.getTime();
    const reloj = vi.fn(() => new Date(t));
    // Cada pedido "tarda" 150 segundos.
    d.enviar.mockImplementation(async () => {
      t += 75_000;
      return { status: "SENT", providerId: "re_1" };
    });
    const r = await P.procesarPedidosDeImpresion({ ...d, ahora: reloj });
    expect(r).toEqual({ procesados: 2, enviados: 2, fallidos: 0 });
    expect(orden.updateMany.mock.calls.some((c) => (c[0] as { where: { id: string } }).where.id === "ord3")).toBe(false);
  });

  it("sin almacenamiento sólo concilia los pagos, no prepara", async () => {
    H.estado.pendientesPago = [{ id: "ord9", workspaceId: "ws" }];
    const d = deps();
    expect(await P.procesarPedidosDeImpresion(d, { preparar: false })).toEqual({ procesados: 0, enviados: 0, fallidos: 0 });
    expect(H.buscar).toHaveBeenCalledWith("fo-impresion:ord9");
    expect(d.subir).not.toHaveBeenCalled();
  });

  it("reintenta solo (hasta 3) los pedidos trabados por falta de circuito cuando el estudio ya tiene uno", async () => {
    H.estado.pagados = [];
    H.estado.sinCircuito = [{ id: "ord5", workspaceId: "ws" }];
    await P.procesarPedidosDeImpresion(deps());
    const q = orden.findMany.mock.calls.map((c) => c[0] as { where: Record<string, unknown>; take: number }).find((x) => x.where.status === "PAGADO_SIN_ENVIAR")!;
    expect(q.where).toEqual({
      status: "PAGADO_SIN_ENVIAR",
      lastError: { startsWith: "No hay un circuito de trabajo" },
      workspace: { fotofficeCircuits: { some: { kind: "TRABAJO", isActive: true, stages: { some: { archivedAt: null } } } } },
    });
    expect(q.take).toBe(3);
    expect(orden.updateMany).toHaveBeenCalledWith({
      where: { id: "ord5", status: "PAGADO_SIN_ENVIAR" },
      data: { status: "PAGADO", lastError: null, lockedAt: null, attempts: 0 },
    });
  });

  it("si nadie espera un circuito, no reintenta nada", async () => {
    H.estado.pagados = [];
    await P.procesarPedidosDeImpresion(deps());
    expect(orden.updateMany).not.toHaveBeenCalled();
  });
});

describe("recortarParaImprimir", () => {
  it("recorta en píxeles reales y devuelve un JPG", async () => {
    const original = await sharp({ create: { width: 200, height: 100, channels: 3, background: { r: 200, g: 10, b: 10 } } }).jpeg().toBuffer();
    const salida = await P.recortarParaImprimir(original, { cropX: 0.25, cropY: 0, cropW: 0.5, cropH: 1 });
    const meta = await sharp(salida).metadata();
    expect(meta.format).toBe("jpeg");
    expect([meta.width, meta.height]).toEqual([100, 100]);
  });
});
