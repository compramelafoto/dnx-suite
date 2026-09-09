/**
 * Vendedores habilitados a ofrecer inventario publicitario.
 *
 * `soldByOrganizationId` es una referencia opaca: puede apuntar a un workspace
 * de FotoOffice o a una organización de concurso, que viven en lugares
 * distintos. Esta tabla es lo único que permite listarlos con nombre y decir
 * quién puede ofrecer la red además de lo suyo.
 *
 * Sin una fila acá, una organización solo vende su propio inventario.
 */
import { prisma } from "./client.js";

export type SalesAgentStatus = "ACTIVE" | "SUSPENDED";

export type SalesAgentRow = {
  id: string;
  organizationId: string;
  displayName: string;
  canSellPlatform: boolean;
  status: SalesAgentStatus;
  notes: string | null;
};

const CAMPOS = {
  id: true,
  organizationId: true,
  displayName: true,
  canSellPlatform: true,
  status: true,
  notes: true,
} as const;

/** Los vendedores, para el desplegable y para la pantalla de administración. */
export async function listSalesAgents(input?: {
  onlyActive?: boolean;
}): Promise<SalesAgentRow[]> {
  const rows = await prisma.dnxPartnerSalesAgent.findMany({
    where: input?.onlyActive ? { status: "ACTIVE" } : undefined,
    orderBy: [{ status: "asc" }, { displayName: "asc" }],
    select: CAMPOS,
  });
  return rows as SalesAgentRow[];
}

/**
 * Qué puede vender esta organización.
 *
 * Devuelve `null` cuando no está habilitada. Quien llama decide qué hacer con
 * eso: para vender lo propio no hace falta habilitación, para la red sí.
 */
export async function getSalesAgent(
  organizationId: string,
): Promise<SalesAgentRow | null> {
  if (!organizationId.trim()) return null;
  const row = await prisma.dnxPartnerSalesAgent.findUnique({
    where: { organizationId: organizationId.trim() },
    select: CAMPOS,
  });
  return (row as SalesAgentRow | null) ?? null;
}

/**
 * Si esta organización puede ofrecer los espacios globales de la red.
 *
 * Una habilitación suspendida no habilita: se corta el acceso sin perder el
 * registro de que existió.
 */
export async function canOrganizationSellPlatform(
  organizationId: string | null | undefined,
): Promise<boolean> {
  if (!organizationId) return false;
  const agente = await getSalesAgent(organizationId);
  return agente?.status === "ACTIVE" && agente.canSellPlatform;
}

export type UpsertSalesAgentInput = {
  organizationId: string;
  displayName: string;
  canSellPlatform?: boolean;
  status?: SalesAgentStatus;
  notes?: string | null;
  userId?: number | null;
};

/**
 * Da de alta un vendedor o actualiza el que ya existe.
 *
 * La organización es única: habilitarla dos veces actualiza la misma fila en
 * lugar de dejar dos habilitaciones que se contradigan.
 */
export async function upsertSalesAgent(
  input: UpsertSalesAgentInput,
): Promise<SalesAgentRow> {
  const organizationId = input.organizationId.trim();
  const displayName = input.displayName.trim();

  const row = await prisma.dnxPartnerSalesAgent.upsert({
    where: { organizationId },
    create: {
      organizationId,
      displayName,
      canSellPlatform: input.canSellPlatform === true,
      status: input.status ?? "ACTIVE",
      notes: input.notes?.trim() || null,
      createdByUserId: input.userId ?? null,
      updatedByUserId: input.userId ?? null,
    },
    update: {
      displayName,
      ...(input.canSellPlatform !== undefined
        ? { canSellPlatform: input.canSellPlatform }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      updatedByUserId: input.userId ?? null,
    },
    select: CAMPOS,
  });
  return row as SalesAgentRow;
}

/** Suspende o reactiva sin perder el registro. */
export async function setSalesAgentStatus(input: {
  organizationId: string;
  status: SalesAgentStatus;
  userId?: number | null;
}): Promise<{ ok: boolean }> {
  const existe = await getSalesAgent(input.organizationId);
  if (!existe) return { ok: false };

  await prisma.dnxPartnerSalesAgent.update({
    where: { organizationId: input.organizationId.trim() },
    data: { status: input.status, updatedByUserId: input.userId ?? null },
  });
  return { ok: true };
}
