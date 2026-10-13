import "server-only";
import { prisma, Prisma } from "@repo/db";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { CAMPOS_AUDITADOS_CLIENTE } from "@/lib/clients/audit";
import { diffCampos } from "@/lib/ficha/eventos";
import type { SyncablePerson } from "../person";
import { clientToSyncablePerson } from "./clients-person";
import type { ContactSource } from "./types";

/**
 * Los clientes como fuente de contactos: el grupo «FOTOFFICE · Clientes».
 *
 * Solo los ACTIVO. Uno que pasa a INACTIVO sale del grupo, pero su contacto no se borra
 * (lo resuelve `sync.ts`, igual que con los socios).
 */
const PULLABLE = ["firstName", "lastName", "email", "phone", "address", "city"] as const;

export const clientContactSource: ContactSource = {
  moduleKey: CLIENTS_MODULE_KEY,
  sourceType: "CLIENT",
  moduleLabel: "Clientes",

  // Los datos de contacto vuelven. Provincia y código postal viven en el perfil ampliado y
  // la razón social es la identidad del cliente: esas no se corrigen desde el celular.
  pullableFields: PULLABLE,

  async list(workspaceId) {
    const filas = await prisma.client.findMany({
      where: { workspaceId, status: "ACTIVO" },
      orderBy: { clientNumber: "asc" },
      select: {
        id: true,
        clientNumber: true,
        kind: true,
        firstName: true,
        lastName: true,
        businessName: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        updatedAt: true,
        fotofficePerfil: { select: { category: true, province: true, postalCode: true } },
        fotofficeTags: { select: { tag: { select: { name: true } } } },
      },
    });
    return filas.map(
      (f): SyncablePerson =>
        clientToSyncablePerson({
          ...f,
          perfil: f.fotofficePerfil,
          etiquetas: f.fotofficeTags.map((t) => t.tag.name),
        }),
    );
  },

  async applyPull(workspaceId, sourceId, changes) {
    const data: Record<string, string | null> = {};
    for (const campo of PULLABLE) {
      if (campo in changes) data[campo] = changes[campo] ?? null;
    }
    if (Object.keys(data).length === 0) return;

    await prisma.$transaction(async (tx) => {
      const antes = await tx.client.findFirst({ where: { id: sourceId, workspaceId } });
      if (!antes) return;
      await tx.client.update({ where: { id: sourceId }, data });
      const cambios = diffCampos(antes, data, CAMPOS_AUDITADOS_CLIENTE);
      if (Object.keys(cambios).length > 0) {
        await tx.clientAudit.create({
          data: {
            workspaceId,
            clientId: sourceId,
            action: "UPDATED",
            actorUserId: null,
            actorLabel: "Google Contacts",
            changesJson: cambios as Prisma.InputJsonValue,
          },
        });
      }
    });
  },
};
