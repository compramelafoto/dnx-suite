/**
 * Punto de entrada del editor Template V2 en FotoOffice.
 *
 * Registra el runtime del editor —base, sesión y almacenamiento de esta app— y reexporta lo
 * que usan las rutas HTTP. Importar desde acá, y no desde el paquete, garantiza que el runtime
 * esté configurado antes de cualquier consulta.
 *
 * Diferencia con Clickatón y ComprameLaFoto: acá quien diseña es **el equipo de una
 * institución**, no un admin de la plataforma ni un fotógrafo con rol propio. El permiso sale
 * de la membresía al workspace, igual que el resto de la administración.
 */
import { prisma } from "@repo/db";
import { setTemplateV2Runtime } from "@repo/template-editor-core/services";
import { getAuthUser } from "@/lib/auth";
import { resolveActiveWorkspace } from "@/lib/workspace";
import {
  generateFotofficeR2Key,
  getFotofficeR2PublicUrl,
  uploadToFotofficeR2,
} from "@/lib/images/r2-client";
import { FOTOFFICE_R2_PREFIXES } from "@/lib/images/r2-key-policy";
import { canDesignTemplates } from "./access";

setTemplateV2Runtime({
  prisma,
  requireUser: async () => {
    // No se redirige: en una ruta de API un redirect sale como "NEXT_REDIRECT" en vez de un
    // 401 limpio, y el editor no sabría qué mostrar.
    const user = await getAuthUser();
    if (!user) throw new Error("No autenticado");

    const workspace = await resolveActiveWorkspace(user.id);
    if (!workspace) throw new Error("No hay una institución activa");

    const membership = await prisma.workspaceMembership.findUnique({
      where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
      select: { role: true },
    });
    const role = membership?.role ? String(membership.role) : "";
    if (!canDesignTemplates(role)) throw new Error("Sin permisos para diseñar plantillas");

    return { id: user.id, role, email: user.email, workspaceId: workspace.id };
  },
  uploadImage: async (input) => {
    // Namespace propio dentro del prefijo de FotoOffice: el bucket es compartido entre apps
    // del monorepo y ninguna puede escribir en el espacio de otra.
    const key = generateFotofficeR2Key(
      `block_${crypto.randomUUID()}.${input.extension}`,
      `${FOTOFFICE_R2_PREFIXES.templateImage}/${input.templateId}/${input.versionId}`,
    );
    await uploadToFotofficeR2(input.body, key, input.contentType, {
      type: "template_v2_image",
      templateId: input.templateId,
      versionId: input.versionId,
    });
    return { url: getFotofficeR2PublicUrl(key), key };
  },
  policy: {
    // `requireUser` ya rechazó a quien no puede diseñar: si llegó hasta acá, puede.
    canDesign: () => true,
    /*
     * FALSE, y es deliberado. `isAdmin` no significa "administra su institución": significa
     * moderación de plataforma, ver y editar plantillas de cualquiera. Cuando acá decía `true`,
     * el dueño de una institución habría podido abrir el carnet de otra con solo adivinar el
     * id. No se notaba porque un 403 anterior tapaba todo, así que la puerta estaba abierta y
     * el pasillo cerrado.
     */
    isAdmin: () => false,
    /*
     * La plantilla es de la institución, no de quien la creó. Si dependiera de la persona, el
     * día que deja la comisión directiva la SFPR perdería su propio carnet.
     *
     * Una plantilla sin workspace no es de nadie: se cae al dueño original, que es la regla
     * del paquete.
     */
    owns: (user, template) =>
      template.workspaceId != null && user.workspaceId != null
        ? template.workspaceId === user.workspaceId
        : template.ownerUserId === user.id,
  },
});

export * from "@repo/template-editor-core";
export * from "@repo/template-editor-core/services";
export * from "@repo/template-editor-core/rendering";
