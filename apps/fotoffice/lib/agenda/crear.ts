import "server-only";
import { randomUUID } from "node:crypto";
import { prisma, type Prisma } from "@repo/db";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { nombreDeContacto } from "@/lib/pedidos/nombre-contacto";
import { itemsGuardados } from "@/lib/presupuestos/versiones";
import { AGENDA_MODULE_KEY } from "./acceso";
import { empujarCitas } from "./google/empuje";
import { PROFUNDIDAD_MAXIMA_COMBOS } from "./constantes";
import { citaDesdeRegla, sumarDias } from "./fechas";
import { citasDelPedido, type CitaDesdeRegla } from "./reglas";
import { aplicarPlantillaTitulo } from "./titulo";

/**
 * Citas creadas desde el pedido (Etapa 4, Entrega B). Igual que los proyectos de la Entrega A:
 *
 * - Al confirmar un pedido (y al darlo de alta a mano), dentro de la MISMA transacción,
 *   `crearCitasDelPedido` lee las reglas "Cita que genera" de los productos del pedido y de los
 *   componentes de sus combos (`citasDelPedido`) y crea una cita por regla, salvo las que la persona
 *   destildó en la vista previa. Sólo si el módulo Agenda está encendido.
 * - La fecha es la del evento + `daysFromEvent`; la hora, `startTime` o "todo el día" si no tiene.
 *   Sin fecha de evento no se crea ninguna cita y la vista previa lo avisa.
 * - Es idempotente: antes de insertar se mira el único (pedido, ítem, regla) en la misma transacción
 *   (en Postgres un choque de único aborta la transacción entera, no se puede capturar adentro).
 */

type Tx = Prisma.TransactionClient;
type Lector = Pick<Tx, "fotofficeProductoCita" | "fotofficeComboItem" | "fotofficeCitaTipo" | "product" | "client" | "workspaceMembership">;

export const AVISO_SIN_FECHA = "El pedido no tiene fecha de evento: no se crea esta cita.";

export type CitaPlanificada = {
  /** Posición en la lista: lo que se tilda en la vista previa y viaja como `citasOmitidas`. */
  index: number;
  regla: CitaDesdeRegla;
  titulo: string;
  tipo: string | null;
  /** "aaaa-mm-dd" del día de la cita; null sin fecha de evento. */
  dia: string | null;
  /** "HH:MM" de Argentina; null = todo el día. */
  hora: string | null;
  startAt: Date | null;
  endAt: Date | null;
  allDay: boolean;
  ownerUserId: number | null;
  /** Si está, la cita NO se crea y la vista previa muestra este motivo. */
  aviso: string | null;
};

export type DatosPlanificacion = {
  clientId: string;
  /** Los ítems guardados del pedido (`items` de la instantánea). */
  items: unknown;
  /** "aaaa-mm-dd" o el `Date` de la columna `eventDate`; null sin evento. */
  fechaEvento: string | Date | null;
  eventLabel: string | null;
  /** null en la vista previa (el número aún no existe). */
  numeroPedido: string | null;
  /** Responsable del pedido, para las reglas sin responsable propio. */
  ownerUserId: number | null;
};

function diaDeEvento(f: string | Date | null): string | null {
  return f === null ? null : typeof f === "string" ? f.slice(0, 10) : f.toISOString().slice(0, 10);
}

function fechaCorta(ymd: string): string {
  const [a, m, d] = ymd.split("-");
  return `${d}/${m}/${a}`;
}

/** Lo que se va a crear, sin escribir nada. El orden es estable: lo usan la vista previa y la creación. */
export async function planificarCitas(cliente: Lector, workspaceId: string, d: DatosPlanificacion): Promise<CitaPlanificada[]> {
  const items = itemsGuardados(d.items).map((i) => ({ productId: i.productId, cantidad: i.cantidad, opcional: i.opcional }));
  const raiz = [...new Set(items.filter((i) => !i.opcional && typeof i.productId === "string" && i.productId).map((i) => i.productId as string))];
  if (raiz.length === 0) return [];

  // Los componentes de los combos, nivel por nivel (un combo puede tener otro combo adentro).
  const vistos = new Set(raiz);
  const combos: { comboProductId: string; componentProductId: string; quantity: number }[] = [];
  let frontera = raiz;
  for (let nivel = 0; nivel < PROFUNDIDAD_MAXIMA_COMBOS && frontera.length > 0; nivel++) {
    const filas = await cliente.fotofficeComboItem.findMany({
      where: { workspaceId, comboProductId: { in: frontera } },
      orderBy: [{ order: "asc" }],
      select: { comboProductId: true, componentProductId: true, quantity: true },
    });
    combos.push(...filas);
    frontera = [...new Set(filas.map((f) => f.componentProductId).filter((id) => !vistos.has(id)))];
    for (const id of frontera) vistos.add(id);
  }

  const reglas = await cliente.fotofficeProductoCita.findMany({
    where: { workspaceId, productId: { in: [...vistos] } },
    orderBy: [{ order: "asc" }],
    select: { id: true, productId: true, typeId: true, title: true, daysFromEvent: true, startTime: true, durationMinutes: true, ownerUserId: true },
  });
  if (reglas.length === 0) return [];

  const desdeReglas = citasDelPedido(items, reglas, combos);
  if (desdeReglas.length === 0) return [];

  const tipoIds = [...new Set(desdeReglas.map((c) => c.typeId).filter((x): x is string => x !== null))];
  const productIds = [...new Set(desdeReglas.map((c) => c.productId))];
  const duenos = [...new Set([...desdeReglas.map((c) => c.ownerUserId), d.ownerUserId].filter((x): x is number => x !== null))];
  const [tipos, productos, contacto, miembros] = await Promise.all([
    tipoIds.length ? cliente.fotofficeCitaTipo.findMany({ where: { workspaceId, id: { in: tipoIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
    cliente.product.findMany({ where: { workspaceId, id: { in: productIds } }, select: { id: true, name: true } }),
    cliente.client.findFirst({ where: { id: d.clientId, workspaceId }, select: { firstName: true, lastName: true, businessName: true } }),
    duenos.length ? cliente.workspaceMembership.findMany({ where: { workspaceId, userId: { in: duenos } }, select: { userId: true } }) : Promise.resolve([]),
  ]);
  const nombreTipo = new Map(tipos.map((t) => [t.id as string, t.name as string]));
  const nombreProducto = new Map(productos.map((p) => [p.id as string, p.name as string]));
  const equipo = new Set(miembros.map((m) => m.userId as number));
  const evento = diaDeEvento(d.fechaEvento);
  const nombreContacto = nombreDeContacto(contacto);
  const textoEvento = evento ? fechaCorta(evento) : d.eventLabel;

  return desdeReglas.map((regla, index) => {
    const titulo = aplicarPlantillaTitulo(regla.title, {
      contacto: nombreContacto,
      producto: nombreProducto.get(regla.productId) ?? "",
      evento: textoEvento,
      pedido: d.numeroPedido,
    });
    const dueno =
      regla.ownerUserId !== null && equipo.has(regla.ownerUserId)
        ? regla.ownerUserId
        : d.ownerUserId !== null && equipo.has(d.ownerUserId)
          ? d.ownerUserId
          : null;
    const tipo = regla.typeId ? (nombreTipo.get(regla.typeId) ?? null) : null;
    if (evento === null) {
      return { index, regla, titulo, tipo, dia: null, hora: null, startAt: null, endAt: null, allDay: false, ownerUserId: dueno, aviso: AVISO_SIN_FECHA };
    }
    const c = citaDesdeRegla(evento, regla.daysFromEvent, regla.startTime, regla.durationMinutes);
    const dia = sumarDias(evento, regla.daysFromEvent);
    return {
      index, regla, titulo, tipo, dia, hora: c.allDay ? null : (regla.startTime ?? "").trim(),
      startAt: c.startAt, endAt: c.endAt, allDay: c.allDay, ownerUserId: dueno, aviso: null,
    };
  });
}

/** Lo que muestra la vista previa de "Confirmar pedido". */
export type CitaVistaPrevia = { index: number; titulo: string; tipo: string | null; dia: string | null; hora: string | null; aviso?: string };

export function aVistaPrevia(planificadas: readonly CitaPlanificada[]): CitaVistaPrevia[] {
  return planificadas.map((p) => ({
    index: p.index,
    titulo: p.titulo,
    tipo: p.tipo,
    dia: p.dia,
    hora: p.hora,
    ...(p.aviso ? { aviso: p.aviso } : {}),
  }));
}

/** ¿El módulo Agenda está encendido? Sin él, ni la vista previa ni la creación hacen nada. */
export function agendaEncendida(workspaceId: string): Promise<boolean> {
  return isModuleEnabledForWorkspace(workspaceId, AGENDA_MODULE_KEY);
}

export type DatosCrearDelPedido = DatosPlanificacion & {
  pedidoId: string;
  createdByUserId: number | null;
  /** Posiciones (de la lista de `planificarCitas`) que la persona destildó. */
  omitidos?: ReadonlySet<number>;
};

export type ResultadoCrearDelPedido = { creadas: number; salteadas: string[]; ids: string[] };

/** Un índice destildado que no corresponde a ninguna cita de la lista. */
export class IndiceCitaInvalido extends Error {
  constructor() {
    super("indice-cita");
  }
}

/**
 * Crea las citas del pedido que acaba de insertarse. Lanza `IndiceCitaInvalido` si `omitidos` trae una
 * posición que no existe. Sin fecha de evento no crea nada (las devuelve en `salteadas`); un error de
 * la base sí corta la transacción entera.
 */
export async function crearCitasDelPedido(tx: Tx, workspaceId: string, d: DatosCrearDelPedido): Promise<ResultadoCrearDelPedido> {
  const planificadas = await planificarCitas(tx, workspaceId, d);
  for (const i of d.omitidos ?? []) if (!Number.isInteger(i) || i < 0 || i >= planificadas.length) throw new IndiceCitaInvalido();
  const salteadas: string[] = [];
  const ids: string[] = [];
  for (const p of planificadas) {
    if (d.omitidos?.has(p.index)) continue;
    if (p.aviso || !p.startAt || !p.endAt) {
      if (p.aviso && !salteadas.includes(p.aviso)) salteadas.push(p.aviso);
      continue;
    }
    const ya = await tx.fotofficeCita.findFirst({
      where: { pedidoId: d.pedidoId, pedidoItemIndex: p.regla.pedidoItemIndex, reglaId: p.regla.reglaId },
      select: { id: true },
    });
    if (ya) continue;
    const id = randomUUID();
    await tx.fotofficeCita.create({
      data: {
        id,
        workspaceId,
        title: p.titulo,
        typeId: p.regla.typeId,
        status: "AGENDADA",
        startAt: p.startAt,
        endAt: p.endAt,
        allDay: p.allDay,
        ownerUserId: p.ownerUserId,
        clientId: d.clientId,
        pedidoId: d.pedidoId,
        reglaId: p.regla.reglaId,
        pedidoItemIndex: p.regla.pedidoItemIndex,
        createdByUserId: d.createdByUserId,
      },
      select: { id: true },
    });
    ids.push(id);
  }
  return { creadas: ids.length, salteadas, ids };
}

/**
 * Después de confirmar el pedido (fuera de la transacción, con `after()` en la acción): avisa a Google de
 * cada cita que el pedido acaba de crear. Sin citas, no hace nada. Un fallo de una no frena las demás.
 */
export async function empujarCitasDelPedido(workspaceId: string, pedidoId: string): Promise<void> {
  try {
    // Con el módulo apagado no hay nada que empujar: ni siquiera se buscan las citas.
    if (!(await agendaEncendida(workspaceId))) return;
    const citas = await prisma.fotofficeCita.findMany({ where: { workspaceId, pedidoId }, select: { id: true } });
    // Un solo pedido de permiso a Google para todas las citas del pedido.
    await empujarCitas(workspaceId, citas.map((c) => c.id as string));
  } catch {
    console.error("[agenda] empujarCitasDelPedido falló");
  }
}
