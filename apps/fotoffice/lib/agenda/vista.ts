import "server-only";
import { prisma } from "@repo/db";
import { puedeEnContexto } from "@/lib/access/policy";
import { adaptadorDe } from "@/lib/circuitos/sujetos";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { getEnabledModuleKeysForWorkspace } from "@/lib/modules/gating";
import { ORDERS_MODULE_KEY } from "@/lib/pedidos/acceso";
import { nombreDeContacto } from "@/lib/pedidos/nombre-contacto";
import { resumenDePlan } from "@/lib/pedidos/estado";
import { pesosDeBase, planesDe } from "@/lib/pedidos/plan";
import { PROJECTS_MODULE_KEY } from "@/lib/proyectos/acceso";
import { suspendidosEntre } from "@/lib/proyectos/proyectos";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { puedeGestionarAgenda, type CtxAgenda } from "./acceso";
import {
  armarEventos,
  type EntradaCapas,
  type FilaCita,
  type FilaConsulta,
  type FilaCuota,
  type FilaCumple,
  type FilaEntrega,
  type FilaReserva,
  type FilaTarea,
} from "./capas";
import type { ClaveCapa } from "./constantes";
import { diaArgentina, diasDelRango, type RangoVista } from "./fechas";
import { capasPermitidas } from "./permisos-capas";
import type { DetalleCita, EventoVista, OrigenDeCita, VistaDeAgenda } from "./vista-tipos";

/**
 * Lee las capas de la agenda para un rango (Etapa 4, Entrega B). Es el único lugar que arma lo que
 * se ve: cada capa se lee SÓLO si su módulo está encendido y la persona tiene "Ver" ahí
 * (`capasPermitidas`); una capa sin permiso no genera ni una consulta a la base. Todas las consultas
 * llevan el workspace de la sesión, el rango y un tope por capa (`TOPE_POR_CAPA`): si se pasa, la capa
 * se corta y se avisa en `truncadas`.
 */

export const TOPE_POR_CAPA = 500;
const TOPE_CUMPLEANOS_LEIDOS = 5000;
/** Cuotas que se leen del rango antes de quitar las pagas (las impagas son las que cuentan para el tope). */
const TOPE_CUOTAS_LEIDAS = TOPE_POR_CAPA * 4;
const TOPE_PARTICIPANTES = 50;

export type OpcionesVista = {
  rango: RangoVista;
  /** Deja sólo lo de ese responsable (en las capas que lo tienen). */
  ownerUserId?: number | null;
  /** Para pruebas y para quien ya los tiene: los módulos encendidos del workspace. */
  habilitados?: ReadonlySet<string>;
};

/** Medianoche UTC de un día "YYYY-MM-DD", como se guardan las columnas `@db.Date`. */
const diaDeBase = (dia: string) => new Date(`${dia}T00:00:00.000Z`);

function cortar<T>(filas: T[]): { filas: T[]; truncada: boolean } {
  return filas.length > TOPE_POR_CAPA ? { filas: filas.slice(0, TOPE_POR_CAPA), truncada: true } : { filas, truncada: false };
}

type FilaCitaLeida = {
  id: string;
  title: string;
  typeId: string | null;
  status: string;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  location: string | null;
  notes: string | null;
  ownerUserId: number | null;
  clientId: string | null;
  proyectoId: string | null;
  pedidoId: string | null;
  consultaLeadId: string | null;
  type: { color: string } | null;
  client: { firstName: string | null; lastName: string | null; businessName: string | null } | null;
  proyecto: { number: string; name: string } | null;
  pedido: { number: string } | null;
  consultaLead: { name: string } | null;
  participantes: {
    id: string;
    userId: number | null;
    clientId: string | null;
    roleId: string | null;
    client: { firstName: string | null; lastName: string | null; businessName: string | null } | null;
    role: { name: string } | null;
  }[];
};

const SELECT_CITA = {
  id: true, title: true, typeId: true, status: true, startAt: true, endAt: true, allDay: true, location: true, notes: true,
  ownerUserId: true, clientId: true, proyectoId: true, pedidoId: true, consultaLeadId: true,
  type: { select: { color: true } },
  client: { select: { firstName: true, lastName: true, businessName: true } },
  proyecto: { select: { number: true, name: true } },
  pedido: { select: { number: true } },
  consultaLead: { select: { name: true } },
  participantes: {
    select: {
      id: true, userId: true, clientId: true, roleId: true,
      client: { select: { firstName: true, lastName: true, businessName: true } },
      role: { select: { name: true } },
    },
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
    take: TOPE_PARTICIPANTES,
  },
};

type Ve = { clientes: boolean; proyectos: boolean; pedidos: boolean; consultas: boolean };

/** Qué orígenes y contactos puede nombrar quien mira (no se filtran nombres de módulos que no ve). */
export function vePara(ctx: CtxAgenda, habilitados: ReadonlySet<string>): Ve {
  const ve = (m: string) => habilitados.has(m) && puedeEnContexto(ctx, "ver", m);
  return { clientes: ve(CLIENTS_MODULE_KEY), proyectos: ve(PROJECTS_MODULE_KEY), pedidos: ve(ORDERS_MODULE_KEY), consultas: ve(SERVICE_LEADS_MODULE_KEY) };
}

export function detalleDeCita(f: FilaCitaLeida, ve: Ve): DetalleCita {
  const origen: OrigenDeCita[] = [];
  if (f.pedidoId) {
    origen.push({
      tipo: "pedido", id: f.pedidoId,
      etiqueta: ve.pedidos && f.pedido ? `Pedido N° ${f.pedido.number}` : "Pedido",
      href: ve.pedidos ? `/pedidos/${encodeURIComponent(f.pedidoId)}` : null,
    });
  }
  if (f.proyectoId) {
    origen.push({
      tipo: "proyecto", id: f.proyectoId,
      etiqueta: ve.proyectos && f.proyecto ? `Proyecto ${f.proyecto.name}` : "Proyecto",
      href: ve.proyectos ? `/proyectos/${encodeURIComponent(f.proyectoId)}` : null,
    });
  }
  if (f.consultaLeadId) {
    origen.push({
      tipo: "consulta", id: f.consultaLeadId,
      etiqueta: ve.consultas && f.consultaLead ? `Consulta de ${f.consultaLead.name}` : "Consulta",
      href: ve.consultas ? `/consultas/${encodeURIComponent(f.consultaLeadId)}` : null,
    });
  }
  return {
    id: f.id,
    title: f.title,
    typeId: f.typeId,
    status: f.status,
    startAt: f.startAt.toISOString(),
    endAt: f.endAt.toISOString(),
    allDay: f.allDay,
    location: f.location,
    notes: f.notes,
    ownerUserId: f.ownerUserId,
    clientId: f.clientId,
    clientNombre: ve.clientes && f.client ? nombreDeContacto(f.client) : null,
    origen,
    participantes: f.participantes.map((p) => ({
      id: p.id,
      userId: p.userId,
      clientId: p.clientId,
      nombre: ve.clientes && p.client ? nombreDeContacto(p.client) : null,
      roleId: p.roleId,
      roleName: p.role?.name ?? null,
    })),
  };
}

/** Una cita del workspace con su detalle, para abrirla por su dirección (`?cita=`). null si no es de acá. */
export async function leerDetalleDeCita(ctx: CtxAgenda, citaId: string, habilitados?: ReadonlySet<string>): Promise<DetalleCita | null> {
  const modulos = habilitados ?? (await getEnabledModuleKeysForWorkspace(ctx.workspaceId));
  const { capas } = capasPermitidas(ctx, modulos);
  if (!capas.includes("CITAS")) return null;
  const f = (await prisma.fotofficeCita.findFirst({ where: { id: citaId, workspaceId: ctx.workspaceId }, select: SELECT_CITA })) as unknown as FilaCitaLeida | null;
  return f ? detalleDeCita(f, vePara(ctx, modulos)) : null;
}

export async function cargarVistaAgenda(ctx: CtxAgenda, opciones: OpcionesVista): Promise<VistaDeAgenda> {
  const { workspaceId } = ctx;
  const { rango } = opciones;
  const dueno = opciones.ownerUserId ?? null;
  const modulos = opciones.habilitados ?? (await getEnabledModuleKeysForWorkspace(workspaceId));
  const { capas, tiposDeTarea } = capasPermitidas(ctx, modulos);
  const permitida = (c: ClaveCapa) => capas.includes(c);
  const truncadas: ClaveCapa[] = [];
  const entrada: { -readonly [K in keyof EntradaCapas]: EntradaCapas[K] } = {};
  let citas: DetalleCita[] = [];
  const ve = vePara(ctx, modulos);

  const cargas: Promise<void>[] = [];

  if (permitida("CITAS")) {
    cargas.push(
      (async () => {
        const leidas = (await prisma.fotofficeCita.findMany({
          where: {
            workspaceId,
            status: { not: "ANULADA" },
            startAt: { lt: rango.hasta },
            endAt: { gt: rango.desde },
            ...(dueno !== null ? { ownerUserId: dueno } : {}),
          },
          select: SELECT_CITA,
          orderBy: [{ startAt: "asc" }, { id: "asc" }],
          take: TOPE_POR_CAPA + 1,
        })) as unknown as FilaCitaLeida[];
        const { filas, truncada } = cortar(leidas);
        if (truncada) truncadas.push("CITAS");
        citas = filas.map((f) => detalleDeCita(f, ve));
        entrada.citas = filas.map(
          (f): FilaCita => ({
            id: f.id, title: f.title, status: f.status, startAt: f.startAt, endAt: f.endAt, allDay: f.allDay,
            ownerUserId: f.ownerUserId, typeColor: f.type?.color ?? null,
          }),
        );
      })(),
    );
  }

  if (permitida("ENTREGAS")) {
    cargas.push(
      (async () => {
        const leidos = await prisma.fotofficeProyecto.findMany({
          where: {
            workspaceId,
            suspendedAt: null,
            finalDueDate: { gte: diaDeBase(rango.desdeDia), lte: diaDeBase(rango.hastaDia) },
            ...(dueno !== null ? { ownerUserId: dueno } : {}),
          },
          select: { id: true, name: true, finalDueDate: true, ownerUserId: true },
          orderBy: [{ finalDueDate: "asc" }, { id: "asc" }],
          take: TOPE_POR_CAPA + 1,
        });
        const { filas, truncada } = cortar(leidos);
        if (truncada) truncadas.push("ENTREGAS");
        // "Abierto" = tiene un recorrido abierto: uno terminado o cancelado ya no se entrega.
        const abiertos = filas.length
          ? await prisma.fotofficeJourney.findMany({
              where: { workspaceId, subjectType: "PROYECTO", closedAt: null, subjectId: { in: filas.map((f) => f.id as string) } },
              select: { subjectId: true },
            })
          : [];
        const vivos = new Set(abiertos.map((a) => a.subjectId as string));
        entrada.entregas = filas
          .filter((f) => vivos.has(f.id as string) && f.finalDueDate !== null)
          .map((f): FilaEntrega => ({ proyectoId: f.id as string, nombre: f.name as string, finalDueDate: f.finalDueDate as Date, ownerUserId: (f.ownerUserId as number | null) ?? null }));
      })(),
    );
  }

  if (permitida("TAREAS")) {
    cargas.push(
      (async () => {
        const leidas = await prisma.fotofficeTask.findMany({
          where: {
            workspaceId,
            doneAt: null,
            subjectType: { in: tiposDeTarea },
            dueAt: { gte: rango.desde, lt: rango.hasta },
            journey: { workspaceId, closedAt: null },
            ...(dueno !== null ? { assigneeUserId: dueno } : {}),
          },
          select: { id: true, title: true, dueAt: true, assigneeUserId: true, subjectType: true, subjectId: true },
          orderBy: [{ dueAt: "asc" }, { id: "asc" }],
          take: TOPE_POR_CAPA + 1,
        });
        const { filas, truncada } = cortar(leidas);
        if (truncada) truncadas.push("TAREAS");
        // Las tareas de un proyecto suspendido se retoman al reanudarlo: no aparecen.
        const suspendidos = await suspendidosEntre(workspaceId, filas.filter((f) => f.subjectType === "PROYECTO").map((f) => f.subjectId as string));
        const vigentes = filas.filter((f) => !(f.subjectType === "PROYECTO" && suspendidos.has(f.subjectId as string)));
        const nombres = new Map<string, Awaited<ReturnType<NonNullable<ReturnType<typeof adaptadorDe>>["nombre"]>>>();
        for (const tipo of new Set(vigentes.map((f) => f.subjectType as string))) {
          const adaptador = adaptadorDe(tipo);
          if (!adaptador) continue;
          nombres.set(tipo, await adaptador.nombre(workspaceId, vigentes.filter((f) => f.subjectType === tipo).map((f) => f.subjectId as string)));
        }
        entrada.tareas = vigentes.flatMap((f): FilaTarea[] => {
          const adaptador = adaptadorDe(f.subjectType as string);
          if (!adaptador || f.dueAt === null) return [];
          const sujeto = nombres.get(f.subjectType as string)?.get(f.subjectId as string);
          return [
            {
              id: f.id as string,
              titulo: sujeto ? `${f.title} · ${sujeto.titulo}` : (f.title as string),
              // La tarea vence a una hora; en la agenda ocupa el día de Argentina.
              vencimiento: diaArgentina(f.dueAt as Date),
              ownerUserId: (f.assigneeUserId as number | null) ?? null,
              href: sujeto?.href ?? adaptador.rutaFicha(f.subjectId as string),
            },
          ];
        });
      })(),
    );
  }

  if (permitida("CUOTAS")) {
    cargas.push(
      (async () => {
        const leidas = await prisma.fotofficePedidoCuota.findMany({
          where: {
            workspaceId,
            dueDate: { gte: diaDeBase(rango.desdeDia), lte: diaDeBase(rango.hastaDia) },
            pedido: { status: { not: "CANCELADO" } },
          },
          select: {
            id: true, pedidoId: true, dueDate: true,
            pedido: { select: { number: true, status: true, totalArs: true, client: { select: { firstName: true, lastName: true, businessName: true } } } },
          },
          orderBy: [{ dueDate: "asc" }, { id: "asc" }],
          take: TOPE_CUOTAS_LEIDAS + 1,
        });
        // El tope se aplica DESPUÉS de sacar las cuotas pagas: un mes con muchas pagas no tapa a las impagas.
        const filas = leidas.slice(0, TOPE_CUOTAS_LEIDAS);
        const planes = await planesDe(workspaceId, filas.map((f) => f.pedidoId as string));
        const hoy = diaArgentina(new Date());
        const saldos = new Map<string, number>();
        for (const f of filas) {
          const pedidoId = f.pedidoId as string;
          if (saldos.has(`p:${pedidoId}`)) continue;
          saldos.set(`p:${pedidoId}`, 1);
          const plan = planes.get(pedidoId) ?? { cuotas: [], imputaciones: [] };
          const resumen = resumenDePlan(plan.cuotas, plan.imputaciones, {
            hoy,
            estadoPedido: f.pedido.status as never,
            total: pesosDeBase(f.pedido.totalArs),
          });
          for (const c of resumen.cuotas) saldos.set(c.id, c.saldo);
        }
        const conSaldo = filas
          .map(
            (f): FilaCuota => ({
              pedidoId: f.pedidoId as string,
              cuotaId: f.id as string,
              pedidoNumero: f.pedido.number as string,
              contacto: nombreDeContacto(f.pedido.client),
              vencimiento: f.dueDate as Date,
              saldo: saldos.get(f.id as string) ?? 0,
            }),
          )
          .filter((c) => c.saldo > 0);
        const { filas: visibles, truncada } = cortar(conSaldo);
        // Truncada si hay más impagas que el tope o si ni siquiera se alcanzó a leer todo el rango.
        if (truncada || leidas.length > TOPE_CUOTAS_LEIDAS) truncadas.push("CUOTAS");
        entrada.cuotas = visibles;
      })(),
    );
  }

  if (permitida("CONSULTAS")) {
    cargas.push(
      (async () => {
        const leidos = await prisma.fotofficeJourney.findMany({
          where: {
            workspaceId,
            subjectType: "CAPTACION",
            closedAt: null,
            stageDueAt: { gte: rango.desde, lt: rango.hasta },
            ...(dueno !== null ? { ownerUserId: dueno } : {}),
          },
          select: { subjectId: true, stageDueAt: true, ownerUserId: true },
          orderBy: [{ stageDueAt: "asc" }, { id: "asc" }],
          take: TOPE_POR_CAPA + 1,
        });
        const { filas, truncada } = cortar(leidos);
        if (truncada) truncadas.push("CONSULTAS");
        const adaptador = adaptadorDe("CAPTACION");
        const nombres = adaptador ? await adaptador.nombre(workspaceId, filas.map((f) => f.subjectId as string)) : new Map();
        entrada.consultas = filas.flatMap((f): FilaConsulta[] => {
          const n = nombres.get(f.subjectId as string);
          if (!n || f.stageDueAt === null) return [];
          return [{ leadId: f.subjectId as string, nombre: n.titulo, proximaAccion: f.stageDueAt as Date, ownerUserId: (f.ownerUserId as number | null) ?? null }];
        });
      })(),
    );
  }

  if (permitida("CUMPLEANOS")) {
    cargas.push(
      (async () => {
        const leidos = await prisma.fotofficeContactoPerfil.findMany({
          where: { workspaceId, birthday: { not: null }, client: { status: "ACTIVO" } },
          select: { id: true, clientId: true, birthday: true, client: { select: { firstName: true, lastName: true, businessName: true } } },
          orderBy: [{ id: "asc" }],
          take: TOPE_CUMPLEANOS_LEIDOS,
        });
        // Mes y día no se pueden comparar en SQL sin pelear con la zona: se filtra en memoria por
        // los días del rango (el año no cuenta).
        const buscados = new Set(diasDelRango(rango).map((d) => d.slice(5)));
        // Si el workspace tiene más perfiles con cumpleaños que el tope, los que no se leyeron faltan: se avisa.
        if (leidos.length >= TOPE_CUMPLEANOS_LEIDOS) truncadas.push("CUMPLEANOS");
        const delRango = leidos.filter((f) => f.birthday !== null && buscados.has((f.birthday as Date).toISOString().slice(5, 10)));
        const { filas, truncada } = cortar(delRango);
        if (truncada && !truncadas.includes("CUMPLEANOS")) truncadas.push("CUMPLEANOS");
        entrada.cumpleanos = filas.map(
          (f): FilaCumple => ({
            id: f.id as string,
            clientId: f.clientId as string,
            nombre: nombreDeContacto(f.client),
            mes: Number((f.birthday as Date).toISOString().slice(5, 7)),
            dia: Number((f.birthday as Date).toISOString().slice(8, 10)),
          }),
        );
      })(),
    );
  }

  if (permitida("RESERVAS")) {
    cargas.push(
      (async () => {
        const leidas = await prisma.booking.findMany({
          where: { workspaceId, status: "CONFIRMED", startAt: { lt: rango.hasta }, endAt: { gt: rango.desde } },
          select: { id: true, startAt: true, endAt: true, contactName: true, space: { select: { name: true } } },
          orderBy: [{ startAt: "asc" }, { id: "asc" }],
          take: TOPE_POR_CAPA + 1,
        });
        const { filas, truncada } = cortar(leidas);
        if (truncada) truncadas.push("RESERVAS");
        entrada.reservas = filas.map(
          (f): FilaReserva => ({ id: f.id as string, titulo: `${f.space.name as string} · ${f.contactName as string}`, inicio: f.startAt as Date, fin: f.endAt as Date }),
        );
      })(),
    );
  }

  await Promise.all(cargas);

  const eventos: EventoVista[] = armarEventos(entrada, {
    rango,
    puedeGestionar: puedeGestionarAgenda(ctx),
    capasVisibles: capas,
    ownerUserId: dueno,
  }).map((e) => ({
    id: e.id, capa: e.capa, titulo: e.titulo, inicio: e.inicio.toISOString(), fin: e.fin.toISOString(),
    todoElDia: e.todoElDia, color: e.color, href: e.href, editable: e.editable,
  }));

  return { eventos, capas, truncadas, citas };
}
