/**
 * Punto de entrada del diseñador compartido (Template V2) en FotoRank.
 *
 * Registra el runtime del editor —base, sesión y almacenamiento de esta app— y reexporta lo que
 * usan las rutas HTTP. Importar desde acá, y no desde el paquete, garantiza que el runtime esté
 * configurado antes de cualquier consulta. Es el mismo diseñador de FOTOFFICE, Clickatón y
 * ComprameLaFoto.
 *
 * En FotoRank quien diseña es **la organización** que hace el concurso: la plantilla queda a su
 * nombre (`workspaceId` = id de `ContestOrganization`), no al de la persona. Si dependiera de
 * quien la creó, el día que esa persona deja la organización el concurso perdería su diploma.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { setTemplateV2Runtime } from "@repo/template-editor-core/services";
import { getAuthUser } from "../../auth";
import { resolveActiveOrganizationForUser } from "../dashboard-org-context";
import { getPrivateContestStorageProvider } from "../storage/provider";
import { designAssetKey, designAssetUrl } from "./asset-storage";

setTemplateV2Runtime({
  prisma,
  requireUser: async () => {
    // No se redirige: en una ruta de API un redirect sale como "NEXT_REDIRECT" en vez de un 401
    // limpio, y el editor no sabría qué mostrar.
    const user = await getAuthUser();
    if (!user) throw new Error("No autenticado");
    const org = await resolveActiveOrganizationForUser(user.id);
    if (!org.ok) throw new Error(org.error);
    return { id: user.id, role: org.org.role, email: user.email, workspaceId: org.org.id };
  },
  uploadImage: async (input) => {
    const fileName = `block_${randomUUID()}.${input.extension.replace(/^\.+/, "").toLowerCase()}`;
    const key = designAssetKey({
      templateId: input.templateId,
      versionId: input.versionId,
      fileName,
    });
    await getPrivateContestStorageProvider().putObject(key, input.body, input.contentType);
    return { url: designAssetUrl(key), key };
  },
  /**
   * Datos reales de la organización activa para la vista previa: su nombre, su logo y el último
   * concurso. El premiado sigue siendo de muestra: mostrar el de un concurso real dejaría a la
   * vista de quien diseña el nombre de alguien que todavía no fue anunciado.
   */
  resolvePreviewValues: async () => {
    const user = await getAuthUser();
    if (!user) return null;
    const org = await resolveActiveOrganizationForUser(user.id);
    if (!org.ok) return null;
    const [organizacion, concurso] = await Promise.all([
      prisma.contestOrganization.findUnique({
        where: { id: org.org.id },
        select: { name: true, logoUrl: true },
      }),
      prisma.fotorankContest.findFirst({
        where: { organizationId: org.org.id },
        orderBy: { createdAt: "desc" },
        select: { title: true },
      }),
    ]);
    if (!organizacion) return null;
    return {
      organizerName: organizacion.name,
      ...(organizacion.logoUrl ? { organizerLogo: organizacion.logoUrl } : {}),
      ...(concurso ? { contestTitle: concurso.title } : {}),
    };
  },
  policy: {
    // `requireUser` ya rechazó a quien no tiene organización activa: si llegó hasta acá, diseña.
    canDesign: () => true,
    /*
     * FALSE, y es deliberado. `isAdmin` en el paquete significa moderación de plataforma: ver y
     * editar plantillas de cualquiera. Ningún organizador debe poder abrir el diploma de otra
     * organización adivinando el id.
     */
    isAdmin: () => false,
    owns: (user, template) =>
      template.workspaceId != null && user.workspaceId != null
        ? template.workspaceId === user.workspaceId
        : template.ownerUserId === user.id,
  },
});

export * from "@repo/template-editor-core";
export * from "@repo/template-editor-core/services";
export * from "@repo/template-editor-core/rendering";
