/**
 * Tipos de la política de permisos del editor.
 *
 * Viven en su propio archivo, sin depender de Prisma, por una razón concreta: el runtime del
 * editor se importa desde el navegador, y si arrastrara el cliente de Prisma se llevaría medio
 * servidor al bundle. La implementación por omisión —que sí necesita el enum de roles— queda
 * en `template-v2-authorization.ts`, que solo corre en el servidor.
 */

export type TemplateV2AuthUser = {
  id: number;
  /** Rol de la app hospedadora; la política lo interpreta. */
  role: string;
  /** Institución activa, cuando la app agrupa las plantillas por workspace. */
  workspaceId?: string | null;
};

export type TemplateV2AccessRow = {
  id: string;
  ownerUserId: number;
  status: string;
  /** Institución dueña de la plantilla, si la app las agrupa así. */
  workspaceId?: string | null;
};

/**
 * Cómo decide permisos la app que hospeda el editor.
 *
 * Es un parámetro y no una constante porque cada app tiene su propio vocabulario de roles:
 * Clickatón habla de PHOTOGRAPHER y ADMIN, FotoOffice de WORKSPACE_OWNER. Cuando esto estaba
 * escrito adentro del paquete, el dueño de una institución recibía un 403 al abrir su propio
 * carnet: su rol no figuraba en la lista de otra aplicación.
 *
 * `owns` merece atención: por omisión la plantilla es de quien la creó, pero en FotoOffice es
 * de la institución. Si dependiera de la persona, el día que deja la comisión directiva la
 * institución perdería su propio carnet.
 *
 * `isAdmin` no significa "administra su organización": significa moderación de plataforma, ver
 * y editar plantillas de cualquiera. Una app que lo confunda abre las plantillas de todas las
 * demás organizaciones.
 */
export type TemplateV2AccessPolicy = {
  /** Puede usar el editor. */
  canDesign: (user: TemplateV2AuthUser) => boolean;
  /** Ve y edita cualquier plantilla, de cualquiera. Moderación de plataforma. */
  isAdmin: (user: TemplateV2AuthUser) => boolean;
  /** Esta plantilla le pertenece. */
  owns: (user: TemplateV2AuthUser, template: TemplateV2AccessRow) => boolean;
};
