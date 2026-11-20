import "server-only";
import { prisma } from "@repo/db";
import { leerAjustes as leerAjustesConsultas } from "@/lib/consultas/ajustes";
import { destinatarioDelAviso } from "@/lib/consultas/aviso";
import { diaDeCalendario } from "@/lib/consultas/fechas";
import { asignarItems, totalesConAlternativas } from "@/lib/presupuestos/alternativas";
import { itemsDeLaPropuesta } from "@/lib/presupuestos/items-de-la-propuesta";
import { leerPropuestaModelo } from "@/lib/presupuestos/propuestas-modelo";
import { eventoDeCategoria, primerNombre, type EventoConPortfolio, type Paquete } from "./eventos-con-portfolio";

/**
 * Lo que el circuito de XV y bodas del bot lee de la base (spec 2026-11-20). Nunca lanza: ante una
 * falla devuelve null y el bot sigue por el camino de siempre.
 */

function registrar(donde: string, e: unknown): void {
  console.error(`[fotoffice][whatsapp] ${donde} falló`, { codigo: (e as { code?: unknown } | null)?.code ?? "desconocido" });
}

/**
 * Los paquetes (opciones) de la propuesta modelo de una categoría, a los precios de hoy (catálogo y
 * perfil de ¿Cuánto cobro?, como cuando se arma la cotización), sin opcionales, traslado ni segundo
 * fotógrafo. Sin opciones, un solo "paquete" con el nombre de la categoría. [] si no hay propuesta.
 */
export async function paquetesDeLaCategoria(workspaceId: string, categoriaId: string, categoria: string, ahora: Date = new Date()): Promise<Paquete[]> {
  const propuesta = await leerPropuestaModelo(workspaceId, categoriaId);
  if (!propuesta || propuesta.items.length === 0) return [];
  const instanciada = await itemsDeLaPropuesta(workspaceId, propuesta.items, ahora);
  if (!instanciada.ok) return [];
  const items = asignarItems(instanciada.items, propuesta.alternativas);
  const t = totalesConAlternativas(items, propuesta.alternativas, null);
  if (t.alternativas.length === 0) return [{ nombre: categoria, total: Math.round(t.totales.total) }];
  return t.alternativas.map((a) => ({ nombre: a.nombre, total: Math.round(a.totales.total) }));
}

export type PaquetesDelEvento = { categoriaId: string; categoria: string; paquetes: Paquete[]; conOpciones: boolean };

/** La primera categoría activa de ese evento (por orden) y sus paquetes. null si no hay categoría. */
export async function paquetesDelEvento(workspaceId: string, evento: EventoConPortfolio, ahora: Date = new Date()): Promise<PaquetesDelEvento | null> {
  try {
    const categorias = await prisma.fotofficeConsultaCategoria.findMany({
      where: { workspaceId, archivedAt: null },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
      take: 500,
    });
    const delEvento = categorias.filter((c) => eventoDeCategoria(c.name) === evento);
    if (delEvento.length === 0) return null;
    // La que tenga propuesta con precio; si ninguna, la primera (el bot cotiza a mano).
    for (const c of delEvento) {
      const paquetes = await paquetesDeLaCategoria(workspaceId, c.id, c.name, ahora);
      if (paquetes.some((p) => p.total > 0)) {
        return { categoriaId: c.id, categoria: c.name, paquetes, conOpciones: !(paquetes.length === 1 && paquetes[0]!.nombre === c.name) };
      }
    }
    return { categoriaId: delEvento[0]!.id, categoria: delEvento[0]!.name, paquetes: [], conOpciones: false };
  } catch (e) {
    registrar("paquetesDelEvento", e);
    return null;
  }
}

const DIA_MS = 24 * 60 * 60 * 1000;

export type OcupacionDelDia = { contratados: number; capacidad: number; dueno: string | null; estudio: string | null };

/**
 * Los eventos contratados de un día ("aaaa-mm-dd"), con la misma regla que el semáforo de Consultas:
 * pedidos no cancelados con esa fecha de evento y consultas ganadas sin pedido. Más la capacidad del
 * estudio (eventos por día), el primer nombre del dueño y el nombre comercial. null si falla.
 */
export async function ocupacionDelDia(workspaceId: string, dia: string): Promise<OcupacionDelDia | null> {
  try {
    const inicio = new Date(`${dia}T00:00:00.000Z`);
    if (Number.isNaN(inicio.getTime())) return null;
    // El día puede estar guardado como medianoche UTC o como un instante en hora de Buenos Aires.
    const rango = { gte: new Date(inicio.getTime() - DIA_MS), lt: new Date(inicio.getTime() + 2 * DIA_MS) };
    const [pedidos, ganadas, ajustes, dueno, branding] = await Promise.all([
      prisma.fotofficePedido.findMany({ where: { workspaceId, status: { not: "CANCELADO" }, eventDate: rango }, select: { id: true, consultaLeadId: true, eventDate: true }, take: 500 }),
      prisma.serviceSalesLead.findMany({ where: { workspaceId, status: "WON", eventDate: rango }, select: { id: true, eventDate: true }, take: 500 }),
      leerAjustesConsultas(workspaceId),
      prisma.workspaceMembership.findFirst({ where: { workspaceId, role: "WORKSPACE_OWNER" }, orderBy: { createdAt: "asc" }, select: { user: { select: { name: true } } } }),
      prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId }, select: { commercialName: true } }),
    ]);
    const claves = new Set<string>();
    for (const p of pedidos) if (p.eventDate && diaDeCalendario(p.eventDate) === dia) claves.add(p.consultaLeadId ?? `pedido:${p.id}`);
    for (const g of ganadas) if (g.eventDate && diaDeCalendario(g.eventDate) === dia) claves.add(g.id);
    return { contratados: claves.size, capacidad: ajustes.eventosPorDia, dueno: primerNombre(dueno?.user?.name), estudio: branding?.commercialName?.trim() || null };
  } catch (e) {
    registrar("ocupacionDelDia", e);
    return null;
  }
}

export type Vendedora = { userId: number; nombre: string | null; esResponsable: boolean };

/**
 * A quién pasa el chat: la responsable de las consultas nuevas (Configuración → Consultas →
 * Avisos) si todavía puede serlo; si no, el dueño. null si no hay nadie.
 */
export async function vendedoraDeConsultas(workspaceId: string): Promise<Vendedora | null> {
  try {
    const ajustes = await leerAjustesConsultas(workspaceId);
    const userId = await destinatarioDelAviso(workspaceId, [ajustes.responsableUserId]);
    if (userId === null) return null;
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    return { userId, nombre: primerNombre(u?.name), esResponsable: userId === ajustes.responsableUserId };
  } catch (e) {
    registrar("vendedoraDeConsultas", e);
    return null;
  }
}
