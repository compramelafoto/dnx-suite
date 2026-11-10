import "server-only";
import { prisma } from "@repo/db";
import { leerConexion } from "@/lib/bandeja/conexion";
import type { ResultadoEnvio } from "@/lib/bandeja/envio";
import { enviarPlantilla, type Plantilla } from "@/lib/bandeja/plantilla-meta";
import { resolverClaveDeEnlace, tokenDeVersion } from "./enlace";
import type { EstadoPresupuesto } from "./constantes";
import { estadoEfectivo } from "./estados";
import {
  cualSeguimiento, DIAS_MAXIMO, DIAS_PRIMERO, marcaDe, type NumeroSeguimiento, MARCA_SEGUIMIENTO, nombreDePila, PLANTILLA_SEGUIMIENTO, tipoDeEvento, ultimoSeguimiento,
} from "./seguimiento-whatsapp";

/**
 * Seguimiento por WhatsApp de las cotizaciones de eventos sin respuesta (lo corre el cron una vez
 * por día). Sale siempre con la plantilla `seguimiento_cotizacion` de Meta (se cobra): a los 3 días
 * la ventana de 24 h sólo puede estar abierta si el cliente escribió después de recibir la
 * cotización, y en ese caso ya no corresponde insistir. Si Meta la rechaza (por ejemplo, todavía no está
 * aprobada) no se anota y se vuelve a intentar al día siguiente. Cada envío deja un mensaje del
 * sistema en el chat, que es lo que cuenta cuántos salieron.
 */

const DIA_MS = 86_400_000;

type Candidato = {
  aprobacionId: string;
  workspaceId: string;
  waId: string;
  enviadaEn: Date;
  nombre: string | null;
  categoria: string | null;
  abierta: boolean;
  /** Lo que va después de la dirección de FOTOFFICE: `w/<slug>/presupuesto/<token>`. */
  ruta: string | null;
  chat: { id: string; estado: string; ultimoEntranteEn: Date | null } | null;
  yaEnviados: number;
};

export type DepsSeguimientoWa = {
  ahora?: Date;
  /** true: no manda ni anota nada; devuelve a quién le escribiría. */
  prueba?: boolean;
  candidatos?: (ahora: Date) => Promise<Candidato[]>;
  plantilla?: (workspaceId: string, waId: string, p: Plantilla, chatId: string) => Promise<ResultadoEnvio>;
  marcar?: (workspaceId: string, chatId: string, texto: string) => Promise<void>;
};

async function candidatosDeLaBase(ahora: Date): Promise<Candidato[]> {
  const aprobaciones = await prisma.fotofficePresupuestoAprobacion.findMany({
    where: { status: "ENVIADO", waId: { not: null }, presupuestoId: { not: null }, sentAt: { gte: new Date(ahora.getTime() - (DIAS_MAXIMO + 1) * DIA_MS), lte: new Date(ahora.getTime() - DIAS_PRIMERO * DIA_MS) } },
    select: { id: true, workspaceId: true, waId: true, presupuestoId: true, leadId: true, categoryId: true, sentAt: true },
    take: 200,
  });
  const clave = resolverClaveDeEnlace();
  const salida: Candidato[] = [];
  for (const a of aprobaciones) {
    if (!a.waId || !a.presupuestoId || !a.sentAt) continue;
    const [presupuesto, lead, categoria, branding, chat] = await Promise.all([
      prisma.fotofficePresupuesto.findUnique({ where: { id: a.presupuestoId }, select: { status: true, validUntil: true, currentVersionId: true, acceptedVersionId: true } }),
      prisma.serviceSalesLead.findUnique({ where: { id: a.leadId }, select: { name: true } }).catch(() => null),
      a.categoryId ? prisma.fotofficeConsultaCategoria.findUnique({ where: { id: a.categoryId }, select: { name: true } }).catch(() => null) : null,
      prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId: a.workspaceId }, select: { publicSlug: true } }),
      prisma.fotofficeWaChat.findFirst({ where: { workspaceId: a.workspaceId, waId: a.waId }, select: { id: true, estado: true, ultimoEntranteEn: true } }),
    ]);
    if (!presupuesto) continue;
    const estado = estadoEfectivo(presupuesto.status as EstadoPresupuesto, presupuesto.validUntil, ahora);
    const yaEnviados = chat
      ? ultimoSeguimiento(
          (await prisma.fotofficeWaMensaje.findMany({ where: { chatId: chat.id, direccion: "SISTEMA", texto: { startsWith: MARCA_SEGUIMIENTO }, createdAt: { gte: a.sentAt } }, select: { texto: true }, take: 10 })).map((m) => m.texto),
        )
      : 0;
    const ruta = clave && presupuesto.currentVersionId && branding?.publicSlug
      ? `w/${encodeURIComponent(branding.publicSlug)}/presupuesto/${encodeURIComponent(tokenDeVersion(presupuesto.currentVersionId, clave))}`
      : null;
    salida.push({
      aprobacionId: a.id, workspaceId: a.workspaceId, waId: a.waId, enviadaEn: a.sentAt, nombre: lead?.name ?? null, categoria: categoria?.name ?? null,
      abierta: (estado === "ENVIADO" || estado === "VISTO") && !presupuesto.acceptedVersionId, ruta, chat, yaEnviados,
    });
  }
  return salida;
}

const POR_OMISION: Required<Omit<DepsSeguimientoWa, "ahora" | "prueba">> = {
  candidatos: candidatosDeLaBase,
  plantilla: async (workspaceId, waId, p, chatId) => {
    const conexion = await leerConexion(workspaceId);
    const r = await enviarPlantilla(conexion, waId, p);
    const ahora = new Date();
    await prisma.fotofficeWaMensaje
      .create({
        data: {
          workspaceId, chatId, direccion: "SALIENTE", autor: "BOT", autorLabel: "Seguimiento de cotización", tipo: "PLANTILLA",
          texto: `Plantilla «${p.nombre}» (${p.cuerpo.join(" · ")})`, estadoEnvio: r.ok ? (r.simulado ? "SIMULADO" : "ENVIADO") : "FALLO",
          waMessageId: r.ok && !r.simulado ? r.waMessageId : null, errorCodigo: r.ok ? null : r.codigo, createdAt: ahora,
        },
      })
      .catch((e) => console.warn("[fotoffice][seguimiento] no se pudo guardar la plantilla en el chat", { codigo: e instanceof Error ? e.name : "desconocido" }));
    return r;
  },
  marcar: async (workspaceId, chatId, texto) => {
    const { escribirSistema } = await import("@/lib/bandeja/acciones");
    await prisma.$transaction((tx) => escribirSistema(tx, workspaceId, chatId, texto, new Date()));
  },
};

export async function seguirCotizacionesPorWhatsapp(deps: DepsSeguimientoWa = {}) {
  const d = { ...POR_OMISION, ...deps };
  const ahora = deps.ahora ?? new Date();
  const prueba: { aprobacionId: string; numero: NumeroSeguimiento }[] = [];
  let revisadas = 0;
  let enviadas = 0;
  let fallidas = 0;
  for (const c of await d.candidatos(ahora)) {
    revisadas++;
    try {
      if (!c.chat || !c.ruta) continue;
      const numero = cualSeguimiento({
        enviadaEn: c.enviadaEn, ahora, yaEnviados: c.yaEnviados, abierta: c.abierta,
        respondioDespues: c.chat.ultimoEntranteEn !== null && c.chat.ultimoEntranteEn.getTime() > c.enviadaEn.getTime(),
        atiendePersona: c.chat.estado === "HUMANO",
      });
      if (!numero) continue;
      if (deps.prueba) {
        prueba.push({ aprobacionId: c.aprobacionId, numero });
        continue;
      }
      const ok = (await d.plantilla(c.workspaceId, c.waId, { ...PLANTILLA_SEGUIMIENTO, cuerpo: [nombreDePila(c.nombre) || "¡hola", tipoDeEvento(c.categoria)], boton: c.ruta }, c.chat.id)).ok;
      if (!ok) {
        fallidas++;
        continue;
      }
      await d.marcar(c.workspaceId, c.chat.id, marcaDe(numero));
      enviadas++;
    } catch (e) {
      fallidas++;
      console.warn("[fotoffice][seguimiento] falló un seguimiento por WhatsApp", { codigo: e instanceof Error ? e.name : "desconocido" });
    }
  }
  return deps.prueba ? { revisadas, enviadas, fallidas, prueba } : { revisadas, enviadas, fallidas };
}
