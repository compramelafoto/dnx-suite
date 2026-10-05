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
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { canDesignPlacas, canDesignTemplates } from "./access";
import { listKeyedTemplates } from "./keyed-template";
import { isPlacaTemplateKey } from "@/lib/placas/constants";
import {
  placaInitials,
  placaInstagram,
  placaPhoto,
  placaSpecialty,
  placaZone,
} from "@/lib/placas/values";

/**
 * Rol con el que viaja quien diseña **sólo** placas: tiene Comunicación en "Gestionar" pero no
 * Socios. Puede abrir y guardar las plantillas de placa, y ninguna otra —el carnet incluido—.
 */
const ROL_SOLO_PLACAS = "FOTOFFICE_PLACAS_ONLY";

/**
 * Las plantillas que puede tocar cada persona con `ROL_SOLO_PLACAS`, por id de usuario.
 *
 * La política del paquete decide plantilla por plantilla con una función sincrónica (`owns`), y
 * a esa altura ya no se puede consultar la base. Por eso `requireUser` —que corre primero en
 * cada pedido— deja anotado acá qué plantillas son placas, y `owns` lo lee. Se recalcula en
 * cada pedido, así que una placa recién creada entra en el siguiente.
 */
const plantillasDePlacasPorUsuario = new Map<number, Set<string>>();

/** Lo que la vista previa necesita de un socio para dibujar cualquier plantilla del producto. */
const SOCIO_DE_MUESTRA = {
  id: true,
  firstName: true,
  lastName: true,
  memberNumber: true,
  documentNumber: true,
  joinedAt: true,
  avatarUrl: true,
  email: true,
  phone: true,
  city: true,
  category: { select: { name: true } },
  // Las de las placas de Comunicación.
  profilePhotoUrl: true,
  province: true,
  studioCity: true,
  studioProvince: true,
  specialties: true,
  instagram: true,
} as const;

setTemplateV2Runtime({
  prisma,
  requireUser: async () => {
    // No se redirige: en una ruta de API un redirect sale como "NEXT_REDIRECT" en vez de un
    // 401 limpio, y el editor no sabría qué mostrar.
    const user = await getAuthUser();
    if (!user) throw new Error("No autenticado");

    const workspace = await resolveActiveWorkspace(user.id);
    if (!workspace) throw new Error("No hay una institución activa");

    // Diseñar pide `members` MANAGE (todas las plantillas) o `communications` MANAGE (sólo
    // las placas). El rol sólo viaja como dato para el editor, salvo el de "sólo placas".
    if (await canDesignTemplates(user.id, workspace.id)) {
      plantillasDePlacasPorUsuario.delete(user.id);
    } else if (await canDesignPlacas(user.id, workspace.id)) {
      const placas = (await listKeyedTemplates(workspace.id))
        .filter((t) => isPlacaTemplateKey(t.templateKey))
        .map((t) => t.templateId);
      plantillasDePlacasPorUsuario.set(user.id, new Set(placas));
      return { id: user.id, role: ROL_SOLO_PLACAS, email: user.email, workspaceId: workspace.id };
    } else {
      throw new Error("Sin permisos para diseñar plantillas");
    }
    const role = (await resolveWorkspaceRole(user.id, workspace.id)) ?? "";

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
  /**
   * Datos de un socio real de la institución activa, para que la vista previa conteste la
   * pregunta que importa: cómo sale el carnet con los datos que hay, no con un nombre inventado.
   *
   * Se elige uno con foto cargada y, entre esos, el de número más bajo: un socio con foto
   * muestra el diseño completo, y un criterio fijo hace que la vista previa no cambie de persona
   * entre una recarga y otra.
   *
   * Alcance: solo la institución activa de quien está mirando, que es quien administra ese
   * padrón. Nunca datos de otra institución.
   */
  resolvePreviewValues: async () => {
    const user = await getAuthUser();
    if (!user) return null;
    const workspace = await resolveActiveWorkspace(user.id);
    if (!workspace) return null;

    const socio =
      (await prisma.member.findFirst({
        where: { workspaceId: workspace.id, status: "ACTIVE", avatarUrl: { not: null } },
        orderBy: { memberNumber: "asc" },
        select: SOCIO_DE_MUESTRA,
      })) ??
      (await prisma.member.findFirst({
        where: { workspaceId: workspace.id, status: "ACTIVE" },
        orderBy: { memberNumber: "asc" },
        select: SOCIO_DE_MUESTRA,
      }));
    if (!socio) return null;

    const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
      where: { workspaceId: workspace.id },
      select: { commercialName: true, logoUrl: true },
    });
    const carnet = await prisma.memberCard.findFirst({
      where: { memberId: socio.id },
      orderBy: { issuedAt: "desc" },
      select: { cardNumber: true, validUntil: true },
    });

    return {
      fullName: `${socio.firstName} ${socio.lastName}`.trim(),
      firstName: socio.firstName,
      lastName: socio.lastName,
      memberNumber: socio.memberNumber,
      category: socio.category?.name ?? null,
      documentNumber: socio.documentNumber,
      joinedAt: socio.joinedAt,
      photo: socio.avatarUrl,
      email: socio.email,
      phone: socio.phone,
      city: socio.city,
      cardNumber: carnet?.cardNumber ?? null,
      validUntil: carnet?.validUntil ?? null,
      institutionName: branding?.commercialName?.trim() || workspace.name,
      institutionLogo: branding?.logoUrl ?? null,
      // Las de las placas, con las mismas reglas con que se emiten (`lib/placas/values.ts`).
      profilePhoto: placaPhoto(socio),
      initials: placaInitials(socio.firstName, socio.lastName),
      zone: placaZone(socio),
      specialty: placaSpecialty(socio.specialties),
      instagramHandle: placaInstagram(socio.instagram),
      /*
       * La dirección de verificación no se muestra real: cada credencial lleva su propio código
       * y publicarlo acá lo dejaría a la vista de quien esté diseñando. El QR se ve, y lleva a
       * una dirección de ejemplo.
       */
    };
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
    owns: (user, template) => {
      if (user.role === ROL_SOLO_PLACAS) {
        return (
          template.workspaceId != null &&
          template.workspaceId === user.workspaceId &&
          (plantillasDePlacasPorUsuario.get(user.id)?.has(template.id) ?? false)
        );
      }
      return template.workspaceId != null && user.workspaceId != null
        ? template.workspaceId === user.workspaceId
        : template.ownerUserId === user.id;
    },
  },
});

export * from "@repo/template-editor-core";
export * from "@repo/template-editor-core/services";
export * from "@repo/template-editor-core/rendering";
