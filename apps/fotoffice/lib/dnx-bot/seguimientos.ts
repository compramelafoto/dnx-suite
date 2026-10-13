import "server-only";
import { prisma } from "@repo/db";
import { numeroDe } from "@/lib/numeracion/asignar";
import { leerAutomatico } from "@/lib/plantillas/definiciones";
import type { CtxPresupuestos } from "@/lib/presupuestos/acceso";
import { leerAjustes } from "@/lib/presupuestos/ajustes";
import { ENTIDAD_NUMERACION, esEstadoPresupuesto } from "@/lib/presupuestos/constantes";
import { diaEnBuenosAires, estadoEfectivo } from "@/lib/presupuestos/estados";
import { diasDesdeElEnvio, yaTieneSeguimiento } from "@/lib/presupuestos/seguimiento";
import { consultasPorId } from "./consultas";

/**
 * Presupuestos enviados sin respuesta (spec §6.3 y §6.5), para `presupuestos_sin_respuesta`. Sólo
 * LEE: el bot lista y propone un mensaje personal; el correo automático de `seguimiento.ts` sigue
 * igual, y acá se dice si ya salió para no insistir dos veces. Sin datos de contacto.
 */

export type SinRespuesta = {
  id: string;
  numero: string | null;
  nombreDePila: string | null;
  categoria: string | null;
  estado: string;
  diasDesdeEnvio: number;
  vistas: number;
  /** dd/mm/aaaa. */
  ultimaVista: string | null;
  venceEl: string | null;
  seguimientoAutomatico: "enviado" | "pendiente" | "apagado";
};

const MAX = 20;
const REVISADOS = 500;
const ddmmaaaa = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export async function presupuestosSinRespuesta(
  ctx: CtxPresupuestos,
  opciones: { dias?: number; ahora?: Date } = {},
): Promise<{ dias: number; seguimientoActivo: boolean; presupuestos: SinRespuesta[] }> {
  const { workspaceId } = ctx;
  const ahora = opciones.ahora ?? new Date();
  const ajustes = await leerAjustes(workspaceId);
  const dias = opciones.dias ?? ajustes.seguimientoDias;

  const filas = await prisma.fotofficePresupuesto.findMany({
    where: { workspaceId, status: { in: ["ENVIADO", "VISTO"] } },
    select: { id: true, status: true, validUntil: true, currentVersionId: true, consultaLeadId: true },
    orderBy: [{ updatedAt: "desc" }],
    take: REVISADOS,
  });
  const versionIds = filas.map((f) => f.currentVersionId).filter((x): x is string => !!x);
  const versiones = versionIds.length
    ? await prisma.fotofficePresupuestoVersion.findMany({ where: { workspaceId, id: { in: versionIds } }, select: { id: true, sentAt: true, acceptedAt: true } })
    : [];
  const versionDe = new Map(versiones.map((v) => [v.id, v]));

  const candidatos = filas
    .map((f) => ({ f, v: f.currentVersionId ? versionDe.get(f.currentVersionId) : undefined }))
    .filter((x): x is { f: (typeof filas)[number]; v: { id: string; sentAt: Date; acceptedAt: Date | null } } => !!x.v?.sentAt && !x.v.acceptedAt)
    .map((x) => ({ ...x, estado: esEstadoPresupuesto(x.f.status) ? estadoEfectivo(x.f.status, x.f.validUntil, ahora) : null }))
    .filter((x) => (x.estado === "ENVIADO" || x.estado === "VISTO") && diasDesdeElEnvio(x.v.sentAt, ahora) >= dias)
    .sort((a, b) => a.v.sentAt.getTime() - b.v.sentAt.getTime())
    .slice(0, MAX);
  if (candidatos.length === 0) return { dias, seguimientoActivo: ajustes.seguimientoActivo, presupuestos: [] };

  const auto = ajustes.seguimientoActivo ? await leerAutomatico(workspaceId, "PRESUPUESTO_SEGUIMIENTO") : null;
  const [vistas, numeros, consultas] = await Promise.all([
    prisma.fotofficePresupuestoVista.findMany({ where: { workspaceId, versionId: { in: candidatos.map((c) => c.v.id) } }, select: { versionId: true, viewedAt: true } }),
    numeroDe(workspaceId, ENTIDAD_NUMERACION, candidatos.map((c) => c.f.id)),
    consultasPorId(workspaceId, candidatos.map((c) => c.f.consultaLeadId)),
  ]);

  const presupuestos: SinRespuesta[] = [];
  for (const c of candidatos) {
    const suyas = vistas.filter((x) => x.versionId === c.v.id).map((x) => x.viewedAt.getTime());
    const consulta = consultas.get(c.f.consultaLeadId);
    let seguimiento: SinRespuesta["seguimientoAutomatico"] = "apagado";
    if (auto?.enabled) {
      seguimiento = (await yaTieneSeguimiento(prisma, workspaceId, auto.id, c.f.id, c.v.sentAt, ahora)) ? "enviado" : "pendiente";
    }
    presupuestos.push({
      id: c.f.id,
      numero: numeros.get(c.f.id) ?? null,
      nombreDePila: consulta?.nombreDePila ?? null,
      categoria: consulta?.categoria ?? null,
      estado: c.estado!,
      diasDesdeEnvio: diasDesdeElEnvio(c.v.sentAt, ahora),
      vistas: suyas.length,
      ultimaVista: suyas.length ? ddmmaaaa(diaEnBuenosAires(new Date(Math.max(...suyas)))) : null,
      venceEl: c.f.validUntil ? ddmmaaaa(c.f.validUntil.toISOString().slice(0, 10)) : null,
      seguimientoAutomatico: seguimiento,
    });
  }
  return { dias, seguimientoActivo: ajustes.seguimientoActivo, presupuestos };
}
