import "server-only";
import { prisma, type Prisma } from "@repo/db";
import {
  MEMBER_AUDIT_ACTION_LABELS,
  MEMBER_AUDIT_SOURCE_LABELS,
  formatAuditValue,
  memberFieldLabel,
} from "@/lib/members/audit-labels";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { whereCorte, type Proveedor, type TipoEvento } from "../linea-de-tiempo";
import { filas, leerCambios } from "./comun";

const PREFIJO = "historial-socio:";

/** Lo que tiene que ver con el acceso al portal va como `portal`; el resto, como `cambios`. */
const TIPO_POR_ACCION: Record<string, TipoEvento> = {
  CREATED: "cambios",
  UPDATED: "cambios",
  STATUS_CHANGED: "cambios",
  IMPORTED: "cambios",
  USER_LINKED: "portal",
  USER_UNLINKED: "portal",
  INVITE_CREATED: "portal",
  INVITE_SENT: "portal",
  INVITE_RESENT: "portal",
  INVITE_SEND_FAILED: "portal",
  INVITE_REVOKED: "portal",
  INVITE_ACCEPTED: "portal",
};

const TITULOS_PORTAL: Record<string, string> = {
  INVITE_CREATED: "Invitación al portal creada",
  INVITE_SENT: "Invitación al portal enviada",
  INVITE_RESENT: "Invitación al portal reenviada",
  INVITE_SEND_FAILED: "No se pudo enviar la invitación al portal",
  INVITE_REVOKED: "Invitación al portal revocada",
  INVITE_ACCEPTED: "Invitación al portal aceptada",
};

/** Historial del socio (`MemberAudit`): altas, cambios de datos y de estado, acceso al portal. */
export const proveedorHistorialSocio: Proveedor = {
  clave: "historial-socio",
  tipo: ["cambios", "portal"],
  async traer(ctx, persona, antesDe, take, opciones) {
    if (!persona.memberId) return [];
    const acciones = Object.keys(TIPO_POR_ACCION).filter((a) => !opciones?.tipo || TIPO_POR_ACCION[a] === opciones.tipo);
    if (acciones.length === 0) return [];
    const filasAudit = await prisma.memberAudit.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        memberId: persona.memberId,
        action: { in: acciones } as Prisma.MemberAuditWhereInput["action"],
        AND: [whereCorte("createdAt", PREFIJO, antesDe, opciones?.idTope) as Prisma.MemberAuditWhereInput],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: filas(take),
      select: { id: true, action: true, source: true, actorLabel: true, changesJson: true, reason: true, sourceRow: true, createdAt: true },
    });
    const conCambios = filasAudit.some((a) => leerCambios(a.changesJson).length > 0);
    const vocabulario = conCambios ? await loadPersonVocabulary(ctx.workspaceId) : null;
    return filasAudit.map((a) => {
      const cambios = vocabulario
        ? leerCambios(a.changesJson).map(([campo, c]) => ({
            campo: memberFieldLabel(campo, vocabulario),
            antes: formatAuditValue(campo, c.before),
            despues: formatAuditValue(campo, c.after),
          }))
        : [];
      const partes: string[] = [];
      if (a.source !== "MANUAL") partes.push(MEMBER_AUDIT_SOURCE_LABELS[a.source] ?? a.source);
      if (a.sourceRow !== null) partes.push(`fila ${a.sourceRow} del archivo`);
      if (a.reason) partes.push(`Motivo: ${a.reason}`);
      return {
        id: `${PREFIJO}${a.id}`,
        tipo: TIPO_POR_ACCION[a.action] ?? "cambios",
        fecha: a.createdAt,
        actor: a.actorLabel || null,
        titulo: TITULOS_PORTAL[a.action] ?? MEMBER_AUDIT_ACTION_LABELS[a.action] ?? a.action,
        ...(partes.length > 0 ? { detalle: partes.join(" · ") } : {}),
        ...(cambios.length > 0 ? { cambios } : {}),
      };
    });
  },
};
