import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { ETIQUETAS_CAMPO_CLIENTE } from "@/lib/clients/audit";
import { IVA_CONDITION_LABELS } from "@/lib/clients/constants";
import { whereCorte, type Proveedor } from "../linea-de-tiempo";
import { filas, leerCambios } from "./comun";

const PREFIJO = "historial-cliente:";

const VALORES: Record<string, Record<string, string>> = {
  kind: { PERSONA: "Persona", EMPRESA: "Empresa" },
  status: { ACTIVO: "Activo", INACTIVO: "Inactivo" },
  ivaCondition: IVA_CONDITION_LABELS,
};

function valor(campo: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "vacío";
  const s = typeof v === "string" ? v : String(v);
  return VALORES[campo]?.[s] ?? s;
}

const TITULOS: Record<string, string> = { CREATED: "Alta del cliente", UPDATED: "Datos del cliente modificados" };

/** Historial de datos del cliente (`ClientAudit`). */
export const proveedorHistorialCliente: Proveedor = {
  clave: "historial-cliente",
  tipo: "cambios",
  async traer(ctx, persona, antesDe, take, opciones) {
    if (!persona.clientId) return [];
    const filasAudit = await prisma.clientAudit.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        clientId: persona.clientId,
        AND: [whereCorte("createdAt", PREFIJO, antesDe, opciones?.idTope) as Prisma.ClientAuditWhereInput],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: filas(take),
      select: { id: true, action: true, actorLabel: true, changesJson: true, createdAt: true },
    });
    return filasAudit.map((a) => {
      const cambios = leerCambios(a.changesJson).map(([campo, c]) => ({
        campo: ETIQUETAS_CAMPO_CLIENTE[campo] ?? campo,
        antes: valor(campo, c.before),
        despues: valor(campo, c.after),
      }));
      return {
        id: `${PREFIJO}${a.id}`,
        tipo: "cambios" as const,
        fecha: a.createdAt,
        actor: a.actorLabel || null,
        titulo: TITULOS[a.action] ?? "Cambio en el cliente",
        ...(cambios.length > 0 ? { cambios } : {}),
      };
    });
  },
};
