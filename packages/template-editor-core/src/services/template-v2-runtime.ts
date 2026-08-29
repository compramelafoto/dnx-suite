import type { TemplateV2AccessPolicy } from "./template-v2-policy";
/**
 * Puntos de contacto del editor con la app que lo hospeda.
 *
 * El editor es agnóstico de la app: no sabe de dónde salen la base de datos, la
 * sesión ni el almacenamiento de imágenes. Cada app registra su implementación
 * una vez al arrancar y el resto del editor la consume por acá.
 *
 * Esto es lo que permite que ComprameLaFoto y Clickatón usen el mismo editor
 * con autenticación y permisos distintos.
 */

export type TemplateV2RuntimeUser = {
  id: number;
  /** Rol de la app; la política de permisos lo interpreta. */
  role: string;
  email?: string | null;
  /** Institución activa, cuando la app agrupa las plantillas por workspace. */
  workspaceId?: string | null;
};

export type TemplateV2UploadedImage = {
  url: string;
  key: string;
};

export type TemplateV2Runtime = {
  /** Cliente Prisma de la app (todas comparten la misma base). */
  prisma: unknown;
  /** Usuario autenticado o error si no hay sesión válida. */
  requireUser: () => Promise<TemplateV2RuntimeUser>;
  /** Sube una imagen del editor y devuelve su URL pública. */
  uploadImage: (input: {
    body: Buffer;
    contentType: string;
    extension: string;
    templateId: string;
    versionId: string;
  }) => Promise<TemplateV2UploadedImage>;
  /**
   * Permisos. Por defecto sólo el dueño edita; una app puede ampliarlo
   * (en Clickatón, cualquier admin puede editar las plantillas del evento).
   */
  policy?: Partial<TemplateV2AccessPolicy>;
};

let runtime: TemplateV2Runtime | null = null;

export function setTemplateV2Runtime(next: TemplateV2Runtime): void {
  runtime = next;
}

export function getTemplateV2Runtime(): TemplateV2Runtime {
  if (!runtime) {
    throw new Error(
      "Template V2 sin runtime: la app debe llamar setTemplateV2Runtime() antes de usar el editor"
    );
  }
  return runtime;
}

/** Cliente Prisma tipado laxo: los servicios acceden a modelos por nombre. */
export function templateV2Db(): Record<string, never> {
  return getTemplateV2Runtime().prisma as Record<string, never>;
}

/** La política declarada por la app, sin completar. La completa `resolveTemplateV2Policy`. */
export function peekTemplateV2Policy(): Partial<TemplateV2AccessPolicy> | undefined {
  return runtime?.policy;
}
