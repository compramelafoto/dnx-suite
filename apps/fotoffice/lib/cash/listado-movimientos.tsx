import "server-only";
import type { ReactNode } from "react";
import Link from "next/link";
import { prisma, type Prisma } from "@repo/db";
import { formatMinorArs } from "@/lib/membership/money";
import { clientDisplayName } from "@/lib/clients/display";
import type { ConsultaResuelta, ContextoListado, DefinicionListado, Opcion, ResultadoLote } from "@/lib/listado/tipos";
import { AnularMovimiento, ETIQUETA_METODO } from "@/app/(shell)/caja/movements-table";
import { MOVEMENT_KINDS, MOVEMENT_SOURCES, PAYMENT_METHODS, type MovementSource } from "./constants";
import { movementSelect, toMovementRow, userDisplayNames, type MovementRow } from "./repository";

const RUTA = "/caja/movimientos";

/** Los ids que llegan de una dirección se validan en forma antes de tocar la base. */
const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

const ETIQUETA_TIPO: Record<string, string> = { INGRESO: "Ingreso", EGRESO: "Egreso" };
const ETIQUETA_ORIGEN: Record<MovementSource, string> = {
  manual: "Carga manual",
  membership: "Cuotas",
  bookings: "Reservas",
  sales: "Ventas",
  "work-orders": "Órdenes de trabajo",
  governance: "Proyectos de la comisión",
  pedidos: "Pedidos",
  "pedidos-pagos": "Pagos a proveedores",
};

const fechaHoraAR = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const etiquetaOrigen = (s: string) => ETIQUETA_ORIGEN[s as MovementSource] ?? s;
const etiquetaMedio = (s: string) => ETIQUETA_METODO[s] ?? s;
const etiquetaRubro = (c: { name: string; kind: string }) => `${c.name} (${c.kind === "EGRESO" ? "egreso" : "ingreso"})`;
/** El importe con signo, en centavos: los egresos restan en la planilla. */
const firmado = (m: Pick<MovementRow, "kind" | "amountMinor">) => (m.kind === "EGRESO" ? -m.amountMinor : m.amountMinor);

/** Puro: lo que se le pide a Prisma. `workspaceId` va siempre, primero. */
export function whereMovimientos(workspaceId: string, c: ConsultaResuelta): Prisma.CashMovementWhereInput {
  const where: Prisma.CashMovementWhereInput = { workspaceId };
  const q = c.q.trim();
  if (q) {
    const contiene = { contains: q, mode: "insensitive" as const };
    where.OR = [
      { description: contiene },
      { receiptRef: contiene },
      { client: { OR: [{ firstName: contiene }, { lastName: contiene }, { businessName: contiene }] } },
    ];
  }
  const f = c.filtros;
  if (f.cuenta) where.accountId = f.cuenta;
  if (f.rubro) where.categoryId = f.rubro;
  if (f.tipo && (MOVEMENT_KINDS as readonly string[]).includes(f.tipo)) where.kind = f.tipo;
  if (f.medio && (PAYMENT_METHODS as readonly string[]).includes(f.medio)) where.paymentMethod = f.medio;
  if (f.origen && (MOVEMENT_SOURCES as readonly string[]).includes(f.origen)) where.sourceModule = f.origen;
  if (f.cliente) where.clientId = f.cliente;
  const periodo = c.periodos.periodo;
  if (periodo) where.occurredAt = { gte: periodo.desde, lte: periodo.hasta };
  return where;
}

function ordenarPor(c: ConsultaResuelta): Prisma.CashMovementOrderByWithRelationInput[] {
  const dir = c.orden.desc ? "desc" : "asc";
  // `id` desempata para que la paginación no repita ni saltee filas.
  if (c.orden.campo === "importe") return [{ amountArs: dir }, { id: dir }];
  return [{ occurredAt: dir }, { id: dir }];
}

type MovimientoParaRubro = {
  id: string;
  kind: string;
  sourceModule: string;
  transferId: string | null;
  isReversed: boolean;
  reversesMovementId: string | null;
  categoryId: string | null;
};

/**
 * Puro: qué movimientos admiten el cambio de rubro. Sólo las cargas manuales que no sean un pase,
 * no estén anuladas ni sean una anulación, del mismo tipo que el rubro y con otro rubro.
 */
export function separarElegiblesRubro(
  movs: MovimientoParaRubro[],
  categoria: { id: string; kind: string },
): { elegibles: string[]; excluidos: { id: string; motivo: string }[] } {
  const elegibles: string[] = [];
  const excluidos: { id: string; motivo: string }[] = [];
  for (const m of movs) {
    let motivo: string | null = null;
    if (m.sourceModule !== "manual") motivo = `viene de ${etiquetaOrigen(m.sourceModule)}: se corrige en su módulo`;
    else if (m.transferId) motivo = "es un pase entre cuentas";
    else if (m.isReversed) motivo = "está anulado";
    else if (m.reversesMovementId) motivo = "es una anulación";
    else if (m.kind !== categoria.kind)
      motivo = m.kind === "EGRESO" ? "es un egreso y el rubro es de ingresos" : "es un ingreso y el rubro es de egresos";
    else if (m.categoryId === categoria.id) motivo = "ya tiene ese rubro";
    if (motivo) excluidos.push({ id: m.id, motivo });
    else elegibles.push(m.id);
  }
  return { elegibles, excluidos };
}

/** El rubro elegido, sólo si es de este workspace y está activo. */
async function rubroValido(
  db: Pick<Prisma.TransactionClient, "cashCategory">,
  ctx: ContextoListado,
  parametro: string | null,
): Promise<{ id: string; kind: string } | null> {
  if (!parametro || !ID_VALIDO.test(parametro)) return null;
  return db.cashCategory.findFirst({
    where: { id: parametro, workspaceId: ctx.workspaceId, isActive: true },
    select: { id: true, kind: true },
  });
}

async function rubrosActivos(ctx: ContextoListado): Promise<Opcion[]> {
  const cats = await prisma.cashCategory.findMany({
    where: { workspaceId: ctx.workspaceId, isActive: true },
    orderBy: [{ kind: "asc" }, { order: "asc" }],
    select: { id: true, name: true, kind: true },
  });
  return cats.map((c) => ({ valor: c.id, etiqueta: etiquetaRubro(c) }));
}

async function elegiblesRubro(ctx: ContextoListado, ids: string[], parametro: string | null) {
  const categoria = await rubroValido(prisma, ctx, parametro);
  if (!categoria) return { elegibles: [], excluidos: ids.map((id) => ({ id, motivo: "rubro no válido" })) };
  const filas = await prisma.cashMovement.findMany({
    where: { workspaceId: ctx.workspaceId, id: { in: ids } },
    select: {
      id: true,
      kind: true,
      sourceModule: true,
      transferId: true,
      reversesMovementId: true,
      categoryId: true,
      reversedBy: { select: { id: true } },
    },
  });
  const porId = new Map(filas.map((f) => [f.id, f]));
  const encontrados: MovimientoParaRubro[] = [];
  const noEncontrados: { id: string; motivo: string }[] = [];
  for (const id of ids) {
    const f = porId.get(id);
    if (!f) noEncontrados.push({ id, motivo: "no encontrado" });
    else encontrados.push({ ...f, isReversed: f.reversedBy !== null });
  }
  const r = separarElegiblesRubro(encontrados, categoria);
  return { elegibles: r.elegibles, excluidos: [...r.excluidos, ...noEncontrados] };
}

/**
 * Todo o nada: una sola transacción. La guarda del `updateMany` repite contra la base las reglas
 * de `separarElegiblesRubro`, así que un movimiento que cambió entre la confirmación y este
 * momento (lo anularon, lo pasaron a otro tipo) queda afuera sin error. Sólo se escribe
 * `categoryId`: nunca el importe, la cuenta ni la fecha.
 */
async function cambiarRubro(ctx: ContextoListado, ids: string[], parametro: string | null): Promise<ResultadoLote> {
  const validos = ids.filter((id) => ID_VALIDO.test(id));
  return prisma.$transaction(async (tx) => {
    // El motor ya validó la opción; se revalida acá, adentro de la transacción, porque esto escribe.
    const categoria = await rubroValido(tx, ctx, parametro);
    if (!categoria) return { aplicados: 0, fallidos: ids.map((id) => ({ id, error: "rubro no válido" })), detalle: [] };

    const leer = () =>
      tx.cashMovement.findMany({ where: { workspaceId: ctx.workspaceId, id: { in: validos } }, select: { id: true, categoryId: true } });
    const antes = new Map((await leer()).map((m) => [m.id, m.categoryId]));
    const { count } = await tx.cashMovement.updateMany({
      where: {
        id: { in: validos },
        workspaceId: ctx.workspaceId,
        sourceModule: "manual",
        transferId: null,
        reversesMovementId: null,
        reversedBy: { is: null },
        kind: categoria.kind,
      },
      data: { categoryId: categoria.id },
    });
    // Se relee para saber cuáles quedaron afuera por la guarda.
    const despues = new Map((await leer()).map((m) => [m.id, m.categoryId]));

    const r: ResultadoLote = { aplicados: count, fallidos: [], detalle: [] };
    for (const id of ids) {
      if (despues.get(id) === categoria.id) {
        const previo = antes.get(id) ?? null;
        if (previo !== categoria.id) r.detalle.push({ id, antes: previo, despues: categoria.id });
      } else r.fallidos.push({ id, error: "cambió mientras tanto" });
    }
    return r;
    // Hasta el tope del lote en una sola transacción: el plazo por defecto (5 s) queda corto.
  }, { timeout: 30_000 });
}

function Dato({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[var(--fo-muted)]">{k}</dt>
      <dd className="text-right text-[var(--fo-text)]">{children}</dd>
    </div>
  );
}

async function panelMovimiento(ctx: ContextoListado, id: string) {
  if (!ID_VALIDO.test(id)) return null;
  const fila = await prisma.cashMovement.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { ...movementSelect, createdByUserId: true },
  });
  if (!fila) return null;
  const m = toMovementRow(fila);
  const nombres = await userDisplayNames([fila.createdByUserId]);
  const cargadoPor = fila.createdByUserId === null ? null : (nombres.get(fila.createdByUserId) ?? `Usuario ${fila.createdByUserId}`);
  const contramovimiento = fila.reversedBy?.id ?? null;

  return (
    <div className="space-y-4 text-sm">
      <div>
        <h3 className="text-base font-semibold text-[var(--fo-text)]">{m.description}</h3>
        <p className={`text-lg font-semibold tabular-nums ${m.kind === "INGRESO" ? "text-[var(--fo-success)]" : "text-[var(--fo-danger)]"}`}>
          <span className={m.isReversed ? "line-through" : ""}>
            {m.kind === "EGRESO" ? "−" : "+"}
            {formatMinorArs(m.amountMinor)}
          </span>
        </p>
      </div>
      <dl className="space-y-2">
        <Dato k="Fecha y hora">{fechaHoraAR.format(m.occurredAt)}</Dato>
        <Dato k="Tipo">{ETIQUETA_TIPO[m.kind] ?? m.kind}</Dato>
        <Dato k="Cuenta">{m.accountName}</Dato>
        <Dato k="Rubro">{m.categoryName ?? "Sin rubro"}</Dato>
        <Dato k="Medio de pago">{etiquetaMedio(m.paymentMethod)}</Dato>
        <Dato k="Cliente">
          {m.clientId ? (
            <Link href={`/clientes/${m.clientId}`} className="font-medium text-[var(--fo-accent)] hover:underline">
              {m.clientName}
            </Link>
          ) : (
            "—"
          )}
        </Dato>
        <Dato k="Comprobante">{m.receiptRef ?? "—"}</Dato>
        <Dato k="Origen">{etiquetaOrigen(m.sourceModule)}</Dato>
        {m.transferId ? <Dato k="Pase">Es una pata de un pase entre cuentas</Dato> : null}
        <Dato k="Cargado por">{cargadoPor ?? "—"}</Dato>
        {contramovimiento ? (
          <Dato k="Anulado">
            <Link href={`${RUTA}?ver=${encodeURIComponent(contramovimiento)}`} className="font-medium text-[var(--fo-accent)] hover:underline">
              Ver el contramovimiento
            </Link>
          </Dato>
        ) : null}
        {m.reversesMovementId ? (
          <Dato k="Anula a">
            <Link href={`${RUTA}?ver=${encodeURIComponent(m.reversesMovementId)}`} className="font-medium text-[var(--fo-accent)] hover:underline">
              Ver el movimiento original
            </Link>
          </Dato>
        ) : null}
        {m.reverseReason ? <Dato k="Motivo">{m.reverseReason}</Dato> : null}
      </dl>
    </div>
  );
}

async function traerPorIds(ctx: ContextoListado, ids: string[]): Promise<MovementRow[]> {
  const validos = ids.filter((id) => ID_VALIDO.test(id));
  if (validos.length === 0) return [];
  const filas = await prisma.cashMovement.findMany({ where: { workspaceId: ctx.workspaceId, id: { in: validos } }, select: movementSelect });
  const porId = new Map(filas.map((f) => [f.id, toMovementRow(f)]));
  return validos.flatMap((id) => porId.get(id) ?? []);
}

export const listadoMovimientos: DefinicionListado<MovementRow> = {
  clave: "caja-movimientos",
  titulo: "Movimientos",
  sustantivo: { singular: "movimiento", plural: "movimientos" },
  placeholderBusqueda: "Buscar por descripción, comprobante o cliente",
  columnas: [
    {
      clave: "fecha",
      titulo: "Fecha y hora",
      orden: "fecha",
      celda: (m) => <span className="whitespace-nowrap text-[var(--fo-muted)]">{fechaHoraAR.format(m.occurredAt)}</span>,
    },
    {
      clave: "descripcion",
      titulo: "Descripción",
      celda: (m) => (
        <>
          <span className="text-[var(--fo-text)]">{m.description}</span>
          {m.receiptRef ? <span className="block text-xs text-[var(--fo-muted-soft)]">Comprobante {m.receiptRef}</span> : null}
          {m.reverseReason ? <span className="block text-xs text-[var(--fo-muted-soft)]">Motivo: {m.reverseReason}</span> : null}
        </>
      ),
    },
    { clave: "cliente", titulo: "Cliente", secundaria: true, celda: (m) => m.clientName ?? "—" },
    { clave: "cuenta", titulo: "Cuenta", celda: (m) => m.accountName },
    { clave: "rubro", titulo: "Rubro", celda: (m) => m.categoryName ?? "Sin rubro" },
    { clave: "medio", titulo: "Medio", secundaria: true, celda: (m) => etiquetaMedio(m.paymentMethod) },
    {
      clave: "importe",
      titulo: "Importe",
      orden: "importe",
      alinear: "derecha",
      celda: (m) => (
        <span
          className={`whitespace-nowrap font-medium tabular-nums ${m.kind === "INGRESO" ? "text-[var(--fo-success)]" : "text-[var(--fo-danger)]"} ${m.isReversed ? "line-through opacity-70" : ""}`}
          title={m.isReversed ? "Anulado" : undefined}
        >
          {m.kind === "EGRESO" ? "−" : ""}
          {formatMinorArs(m.amountMinor)}
        </span>
      ),
    },
    // La acción por fila de siempre: anular con motivo (no aparece en anulados ni en pases).
    { clave: "acciones", titulo: "", celda: (m) => <AnularMovimiento movement={m} /> },
  ],
  filtros: [
    { tipo: "relacion", clave: "cuenta", etiqueta: "Cuenta" },
    { tipo: "relacion", clave: "rubro", etiqueta: "Rubro" },
    { tipo: "opcion", clave: "tipo", etiqueta: "Tipo", opciones: MOVEMENT_KINDS.map((k) => ({ valor: k, etiqueta: ETIQUETA_TIPO[k] })) },
    { tipo: "opcion", clave: "medio", etiqueta: "Medio de pago", opciones: PAYMENT_METHODS.map((p) => ({ valor: p, etiqueta: etiquetaMedio(p) })) },
    { tipo: "opcion", clave: "origen", etiqueta: "Origen", opciones: MOVEMENT_SOURCES.map((s) => ({ valor: s, etiqueta: ETIQUETA_ORIGEN[s] })) },
    { tipo: "relacion", clave: "cliente", etiqueta: "Cliente", conBuscador: true },
    { tipo: "periodo", clave: "periodo", etiqueta: "Período" },
  ],
  ordenes: ["fecha", "importe"],
  ordenPorDefecto: { campo: "fecha", desc: true },
  idDe: (m) => m.id,
  // Un movimiento no tiene ficha propia: su ficha es el panel.
  hrefFicha: (id) => `${RUTA}?ver=${encodeURIComponent(id)}`,
  contar: (ctx, c) => prisma.cashMovement.count({ where: whereMovimientos(ctx.workspaceId, c) }),
  traer: async (ctx, c, { skip, take }) => {
    const filas = await prisma.cashMovement.findMany({
      where: whereMovimientos(ctx.workspaceId, c),
      select: movementSelect,
      orderBy: ordenarPor(c),
      skip,
      take,
    });
    return filas.map(toMovementRow);
  },
  traerIds: async (ctx, c, tope) => {
    const filas = await prisma.cashMovement.findMany({
      where: whereMovimientos(ctx.workspaceId, c),
      select: { id: true },
      orderBy: ordenarPor(c),
      take: tope,
    });
    return filas.map((f) => f.id);
  },
  traerPorIds,
  // Los filtros incluyen cuentas y rubros dados de baja: sirven para encontrar movimientos viejos.
  opcionesRelacion: async (ctx, clave) => {
    if (clave === "cuenta") {
      const cuentas = await prisma.cashAccount.findMany({
        where: { workspaceId: ctx.workspaceId },
        orderBy: { order: "asc" },
        select: { id: true, name: true },
      });
      return cuentas.map((c) => ({ valor: c.id, etiqueta: c.name }));
    }
    if (clave === "rubro") {
      const cats = await prisma.cashCategory.findMany({
        where: { workspaceId: ctx.workspaceId },
        orderBy: [{ kind: "asc" }, { order: "asc" }],
        select: { id: true, name: true, kind: true },
      });
      return cats.map((c) => ({ valor: c.id, etiqueta: etiquetaRubro(c) }));
    }
    return [];
  },
  buscarRelacion: async (ctx, clave, texto) => {
    if (clave !== "cliente") return [];
    const q = texto.trim();
    if (!q) return [];
    const contiene = { contains: q, mode: "insensitive" as const };
    const doc = q.replace(/[.\-\s]/g, "");
    const clientes = await prisma.client.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        OR: [{ firstName: contiene }, { lastName: contiene }, { businessName: contiene }, ...(doc ? [{ docNumber: { contains: doc } }] : [])],
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { businessName: "asc" }, { id: "asc" }],
      take: 20,
      select: { id: true, kind: true, firstName: true, lastName: true, businessName: true },
    });
    return clientes.map((c) => ({ valor: c.id, etiqueta: clientDisplayName(c) }));
  },
  validarRelacion: async (ctx, clave, id) => {
    if (!ID_VALIDO.test(id)) return null;
    const where = { id, workspaceId: ctx.workspaceId };
    if (clave === "cliente") {
      const c = await prisma.client.findFirst({ where, select: { kind: true, firstName: true, lastName: true, businessName: true } });
      return c ? clientDisplayName(c) : null;
    }
    if (clave === "cuenta") {
      const c = await prisma.cashAccount.findFirst({ where, select: { name: true } });
      return c?.name ?? null;
    }
    if (clave === "rubro") {
      const c = await prisma.cashCategory.findFirst({ where, select: { name: true, kind: true } });
      return c ? etiquetaRubro(c) : null;
    }
    return null;
  },
  acciones: [
    {
      clave: "rubro",
      etiqueta: "Cambiar rubro",
      capacidad: "operar",
      maximo: 5000,
      confirmacion: "Vas a cambiar el rubro de {n} movimientos a {parametro}.",
      parametro: { etiqueta: "Rubro", opciones: rubrosActivos },
      elegibles: elegiblesRubro,
      aplicar: cambiarRubro,
    },
  ],
  exportar: {
    columnas: [
      { titulo: "Fecha y hora", tipo: "fechaHora", valor: (m) => m.occurredAt },
      { titulo: "Tipo", tipo: "texto", valor: (m) => ETIQUETA_TIPO[m.kind] ?? m.kind },
      { titulo: "Importe", tipo: "importe", valor: (m) => firmado(m) },
      { titulo: "Cuenta", tipo: "texto", valor: (m) => m.accountName },
      { titulo: "Rubro", tipo: "texto", valor: (m) => m.categoryName },
      { titulo: "Medio", tipo: "texto", valor: (m) => etiquetaMedio(m.paymentMethod) },
      { titulo: "Descripción", tipo: "texto", valor: (m) => m.description },
      { titulo: "Comprobante", tipo: "texto", valor: (m) => m.receiptRef },
      { titulo: "Cliente", tipo: "texto", valor: (m) => m.clientName },
      { titulo: "Origen", tipo: "texto", valor: (m) => etiquetaOrigen(m.sourceModule) },
      { titulo: "Anulado", tipo: "texto", valor: (m) => (m.isReversed ? "Sí" : "No") },
    ],
  },
  panel: panelMovimiento,
};
