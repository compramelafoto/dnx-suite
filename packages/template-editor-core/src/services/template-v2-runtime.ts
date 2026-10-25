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
  /**
   * Datos reales para la vista previa, de la base de la aplicación.
   *
   * Sin esto la vista previa dibuja con valores inventados, y sirve para ver el diseño pero no
   * para contestar la pregunta que uno se hace de verdad: "¿sale bien con los datos que tengo?".
   * Un nombre largo que se corta o una foto con otra proporción no se ven con datos de ejemplo.
   *
   * Devolver `null` es válido: una institución sin registros todavía cae en los datos de
   * ejemplo, que es mejor que una vista previa vacía.
   *
   * Quien la implemente responde por el alcance: solo datos que quien está mirando ya puede ver.
   */
  resolvePreviewValues?: () => Promise<Record<string, unknown> | null>;
  /**
   * Qué hacer al guardar una versión: pisarla, o —si ya la usa algo que no debe cambiar solo
   * (un diseño armado, un carnet impreso, una edición fijada)— crear una versión nueva y dejar
   * esta congelada. Ver `template-v2-version-lineage.ts`.
   *
   * Sin esto se pisa, salvo que la versión ya esté congelada (`isLocked`): esa nunca se pisa.
   */
  resolveVersionSave?: (input: TemplateV2VersionSaveInput) => Promise<TemplateV2VersionSaveDecision>;
  /** Avisa que se guardó una versión (pisada o nueva), para que la app acomode lo suyo. */
  onVersionSaved?: (input: TemplateV2VersionSavedEvent) => Promise<void>;
};

export type TemplateV2VersionSaveInput = {
  user: { id: number; role: string; workspaceId?: string | null };
  templateId: string;
  versionId: string;
  versionNumber: number;
  metaJson: unknown;
  isCurrent: boolean;
};

export type TemplateV2VersionSaveDecision =
  /** Se guarda sobre la misma versión. */
  | { mode: "in-place" }
  /** La versión está en uso: se congela y los cambios van a una versión nueva. */
  | { mode: "fork" }
  /** No se puede guardar (p. ej. el diseño ya se mandó a imprimir). */
  | { mode: "read-only"; message: string };

export type TemplateV2VersionSavedEvent = {
  user: { id: number; role: string; workspaceId?: string | null };
  templateId: string;
  /** La versión que quedó con los cambios. */
  versionId: string;
  /** Si se creó una versión nueva, de cuál salió. */
  forkedFromVersionId: string | null;
  metaJson: unknown;
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
