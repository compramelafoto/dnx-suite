import "server-only";
import { prisma } from "@repo/db";
import { puedeEnContexto } from "@/lib/access/policy";
import { armarRecorrido, recorridoDe, type RecorridoCompleto } from "@/lib/circuitos/ficha";
import { motivosActivos, responsablesDe } from "@/lib/circuitos/tablero";
import { hoyEnBuenosAires } from "@/lib/listado/periodos";
import { ETIQUETA_ESTADO_PEDIDO, type EstadoPedido } from "@/lib/pedidos/constantes";
import { nombreDeContacto } from "@/lib/pedidos/nombre-contacto";
import { PROJECTS_MODULE_KEY, puedeVerProyectos, type CtxProyectos } from "./acceso";
import { listarAdjuntos } from "./adjuntos";
import { fechaValida } from "./fechas";
import {
  atrasoDelProyecto, estadoDe, planDelRecorrido,
  type AdjuntoProyectoVista, type EstadoDeProyecto, type EtapaDelPlan, type NotaVista, type ParticipanteVista,
} from "./ficha-vista";
import { equipoDeProyectos } from "./equipo";
import { listarNotas } from "./notas";
import { listarParticipantes, listarRoles } from "./participantes";

/**
 * Datos de la ficha de un proyecto (`/proyectos/[id]`). Todo se lee acotado al workspace de la
 * sesión: un proyecto de otro workspace (o inexistente) devuelve null y la página responde "no
 * encontrado". Las fechas de calendario viajan como "YYYY-MM-DD" y los instantes como ISO.
 */

const etiquetaEstadoPedido = (s: string): string => ETIQUETA_ESTADO_PEDIDO[s as EstadoPedido] ?? s;

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

export type FichaProyecto = {
  id: string;
  numero: string;
  nombre: string;
  descripcion: string | null;
  contacto: { id: string; nombre: string };
  pedido: { id: string; numero: string; estado: string } | null;
  producto: string | null;
  circuito: { id: string; nombre: string };
  /** Fechas de calendario "YYYY-MM-DD". */
  eventDate: string | null;
  baseDate: string;
  finalDueDate: string | null;
  responsable: { id: number; nombre: string } | null;
  delegado: { id: number; nombre: string } | null;
  suspension: { desde: string; motivo: string | null } | null;
  estado: EstadoDeProyecto;
  /** Días de atraso contra el plan de la etapa actual (0 si no corresponde). */
  atraso: number;
  etapaActual: string | null;
  plan: EtapaDelPlan[];
  recorrido: RecorridoCompleto | null;
  motivos: { id: string; nombre: string }[];
  /** Quiénes pueden ser responsables: del equipo y con "Gestionar" en Proyectos. */
  equipo: { id: number; nombre: string }[];
  /** Todas las personas del workspace (para poner nombre a responsables y dueños de tareas). */
  miembros: { id: number; nombre: string }[];
  participantes: ParticipanteVista[];
  roles: { id: string; nombre: string }[];
  notas: NotaVista[];
  adjuntos: AdjuntoProyectoVista[];
};

export async function cargarFichaProyecto(ctx: CtxProyectos, proyectoId: string, ahora: Date): Promise<FichaProyecto | null> {
  if (!puedeVerProyectos(ctx) || !ID_VALIDO.test(proyectoId)) return null;
  const { workspaceId } = ctx;
  const p = await prisma.fotofficeProyecto.findFirst({
    where: { id: proyectoId, workspaceId },
    select: {
      id: true, number: true, name: true, description: true, clientId: true, pedidoId: true, productId: true, circuitId: true,
      eventDate: true, baseDate: true, finalDueDate: true, ownerUserId: true, delegateUserId: true, suspendedAt: true, suspendReason: true,
    },
  });
  if (!p) return null;

  const [cliente, pedido, producto, circuito, j, motivos, miembros, planes] = await Promise.all([
    prisma.client.findFirst({ where: { id: p.clientId, workspaceId }, select: { firstName: true, lastName: true, businessName: true } }),
    p.pedidoId ? prisma.fotofficePedido.findFirst({ where: { id: p.pedidoId, workspaceId }, select: { id: true, number: true, status: true } }) : Promise.resolve(null),
    p.productId ? prisma.product.findFirst({ where: { id: p.productId, workspaceId }, select: { name: true } }) : Promise.resolve(null),
    prisma.fotofficeCircuit.findFirst({ where: { id: p.circuitId, workspaceId }, select: { id: true, name: true } }),
    recorridoDe(workspaceId, p.id, "PROYECTO"),
    motivosActivos(workspaceId),
    responsablesDe(workspaceId),
    prisma.fotofficeProyectoEtapaPlan.findMany({ where: { workspaceId, proyectoId: p.id }, select: { stageId: true, plannedDueDate: true } }),
  ]);
  const nombreMiembro = new Map(miembros.map((m) => [m.id, m.nombre]));
  const persona = (id: number | null) => (id === null ? null : { id, nombre: nombreMiembro.get(id) ?? `Usuario ${id}` });

  const recorrido = j ? await armarRecorrido(workspaceId, j, ahora) : null;
  const cerrado = recorrido ? !recorrido.recorrido.abierto : false;
  const suspendido = p.suspendedAt !== null;
  const estado = estadoDe(suspendido, cerrado);

  const planPorEtapa = new Map(planes.map((x) => [x.stageId as string, fechaValida(x.plannedDueDate as Date) as string]));
  const etapas = recorrido?.recorrido.etapas ?? [];
  const etapaActualId = recorrido?.recorrido.etapaActualId ?? null;
  const plan = planDelRecorrido(etapas, etapaActualId, planPorEtapa);
  const etapaActual = etapaActualId ? (etapas.find((e) => e.id === etapaActualId)?.nombre ?? null) : null;

  const [participantes, roles, notas, adjuntos, equipo] = await Promise.all([
    listarParticipantes(ctx, p.id),
    listarRoles(ctx),
    listarNotas(ctx, p.id),
    listarAdjuntos(ctx, p.id, { conBorrados: puedeEnContexto(ctx, "configurar"), ahora }),
    puedeEnContexto(ctx, "operar", PROJECTS_MODULE_KEY) ? equipoDeProyectos(workspaceId) : Promise.resolve([]),
  ]);

  // Nombres de los integrantes del equipo y de los contactos que participan (una lectura cada uno).
  const idsContacto = [...new Set(participantes.map((x) => x.clientId).filter((x): x is string => x !== null))];
  const contactos = idsContacto.length
    ? await prisma.client.findMany({ where: { workspaceId, id: { in: idsContacto } }, select: { id: true, firstName: true, lastName: true, businessName: true } })
    : [];
  const nombreContacto = new Map(contactos.map((c) => [c.id as string, nombreDeContacto(c)]));
  const idsAutores = [...new Set(notas.map((n) => n.authorUserId).filter((x): x is number => x !== null))];
  const autores = idsAutores.length
    ? await prisma.user.findMany({ where: { id: { in: idsAutores } }, select: { id: true, name: true, email: true } })
    : [];
  const nombreAutor = new Map(autores.map((u) => [u.id as number, ((u.name as string | null) || (u.email as string)) as string]));
  const esConfigurador = puedeEnContexto(ctx, "configurar");

  return {
    id: p.id,
    numero: p.number,
    nombre: p.name,
    descripcion: p.description,
    contacto: { id: p.clientId, nombre: nombreDeContacto(cliente) },
    pedido: pedido ? { id: pedido.id, numero: pedido.number, estado: etiquetaEstadoPedido(pedido.status as string) } : null,
    producto: producto?.name ?? null,
    circuito: circuito ? { id: circuito.id, nombre: circuito.name } : { id: p.circuitId, nombre: "Flujo" },
    eventDate: fechaValida(p.eventDate),
    baseDate: fechaValida(p.baseDate) ?? hoyEnBuenosAires(ahora),
    finalDueDate: fechaValida(p.finalDueDate),
    responsable: persona(p.ownerUserId),
    delegado: persona(p.delegateUserId),
    suspension: suspendido ? { desde: p.suspendedAt!.toISOString(), motivo: p.suspendReason } : null,
    estado,
    atraso: atrasoDelProyecto(estado, plan.find((e) => e.estado === "actual")?.plan ?? null, hoyEnBuenosAires(ahora)),
    etapaActual,
    plan,
    recorrido,
    motivos,
    equipo,
    miembros,
    participantes: participantes.map((x) => ({
      id: x.id,
      tipo: x.userId !== null ? "EQUIPO" : "CONTACTO",
      userId: x.userId,
      clientId: x.clientId,
      nombre: x.userId !== null ? (nombreMiembro.get(x.userId) ?? `Usuario ${x.userId}`) : (nombreContacto.get(x.clientId ?? "") ?? "Contacto"),
      roleId: x.roleId,
      rol: x.roleName,
      nota: x.note,
    })),
    roles: roles.map((r) => ({ id: r.id, nombre: r.name })),
    notas: notas.map((n) => ({
      id: n.id,
      texto: n.body,
      autor: n.authorUserId !== null ? (nombreAutor.get(n.authorUserId) ?? null) : null,
      fecha: n.createdAt.toISOString(),
      editada: n.updatedAt.getTime() - n.createdAt.getTime() > 1000,
      puedeModificar: esConfigurador || (ctx.userId !== null && n.authorUserId === ctx.userId),
    })),
    adjuntos: adjuntos.map(
      (a): AdjuntoProyectoVista => ({
        id: a.id,
        nombre: a.fileName,
        tipo: a.contentType,
        tamano: a.sizeBytes,
        estado: a.status,
        subidoPor: a.uploadedByLabel,
        fecha: a.createdAt.toISOString(),
        restaurableHasta: a.status === "BORRADO" && a.purgeAfter ? a.purgeAfter.toISOString() : null,
      }),
    ),
  };
}
