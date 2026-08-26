/**
 * Punto de entrada del editor Template V2 en Clickatón.
 *
 * Registra el runtime del editor con la base, la sesión y el almacenamiento de
 * esta app, y reexporta lo que usan las rutas HTTP. Importar desde acá — y no
 * desde el paquete — garantiza que el runtime esté configurado.
 *
 * Diferencia con ComprameLaFoto: acá diseñan los **admins de Clickatón**, no
 * fotógrafos con rol propio.
 */
import { setTemplateV2Runtime } from "@repo/template-editor-core/services";
import { hasClickatonAdminAccess } from "@/lib/admin/access";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import { getWelcomeCardStorage } from "@/lib/welcome-card/storage";

setTemplateV2Runtime({
  prisma,
  requireUser: async () => {
    // `requireClickatonAdmin()` redirige, y en una ruta de API eso sale como
    // "NEXT_REDIRECT" en vez de un 401 limpio. Acá se comprueba sin redirigir.
    const user = await getClickatonAuthUser();
    if (!user) {
      throw new Error("No autenticado");
    }
    if (!hasClickatonAdminAccess({ email: user.email, globalRole: user.globalRole })) {
      throw new Error("Sin permisos administrativos");
    }
    return { id: user.id, role: "CLICKATON_ADMIN", email: user.email };
  },
  uploadImage: async (input) => {
    const stored = await getWelcomeCardStorage().put({
      namespace: "products",
      extension: input.extension,
      body: input.body,
      contentType: input.contentType,
    });
    return {
      url: stored.publicUrl ?? `/api/media/${stored.key}`,
      key: stored.key,
    };
  },
  policy: {
    // `requireClickatonAdmin` ya rechazó a cualquiera que no sea admin.
    canDesign: () => true,
    isAdmin: () => true,
  },
});

export * from "@repo/template-editor-core";
export * from "@repo/template-editor-core/services";
export * from "@repo/template-editor-core/rendering";
