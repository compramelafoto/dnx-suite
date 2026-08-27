/**
 * Punto de entrada del editor Template V2 en ComprameLaFoto.
 *
 * Registra el runtime (base, sesión y almacenamiento de esta app) y reexporta
 * lo que usan las rutas HTTP. Importar desde acá — y no desde el paquete —
 * garantiza que el runtime esté configurado antes de cualquier consulta.
 */
import { Role } from "@prisma/client";
import {
  isTemplateV2DesignerRole,
  setTemplateV2Runtime,
} from "@repo/template-editor-core/services";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateR2Key, getR2PublicUrl, uploadToR2 } from "@/lib/r2-client";

const DESIGNER_ROLES = [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN];

setTemplateV2Runtime({
  prisma,
  requireUser: async () => {
    const { error, user } = await requireAuth(DESIGNER_ROLES);
    if (error || !user) throw new Error(error || "No autenticado");
    return { id: user.id, role: user.role };
  },
  uploadImage: async (input) => {
    const key = generateR2Key(
      `block_${crypto.randomUUID()}.${input.extension}`,
      `template-v2/${input.templateId}/${input.versionId}`
    );
    await uploadToR2(input.body, key, input.contentType, {
      type: "template_v2_image",
      templateId: input.templateId,
      versionId: input.versionId,
    });
    return { url: getR2PublicUrl(key), key };
  },
  policy: {
    canDesign: (user) => isTemplateV2DesignerRole(user.role),
  },
});

export * from "@repo/template-editor-core";
export * from "@repo/template-editor-core/services";
export * from "@repo/template-editor-core/rendering";
