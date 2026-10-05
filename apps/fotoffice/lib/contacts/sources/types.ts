import type { FieldValues, SyncableField, SyncablePerson } from "../person";

/**
 * El contrato que cumple cada módulo que quiera agendar a su gente en Google.
 *
 * El motor NO sabe qué es un socio. Sumar Reservas o Cursos es escribir un archivo como
 * `members.ts` y registrarlo en `index.ts`: no se toca el motor ni la base.
 */
export type ContactSource = {
  /** Clave de `lib/modules/registry.ts`. Es la que lleva el interruptor. */
  moduleKey: string;
  /**
   * Va en la base y en la marca de cada contacto de Google. **Estable para siempre**:
   * cambiarlo deja huérfanos a todos los contactos ya creados.
   */
  sourceType: string;
  /** Cómo se llama el módulo en la pantalla. Arma el nombre del grupo: "FOTOFFICE · Socios". */
  moduleLabel: string;
  /** Las personas VIGENTES del módulo. Las que no están dejan de pertenecer al grupo. */
  list(workspaceId: string): Promise<SyncablePerson[]>;
  /** Qué campos acepta que Google le corrija. El resto se ignora al traer. */
  pullableFields: readonly SyncableField[];
  /** Aplica una corrección que vino de Google. Valida como valide el módulo. */
  applyPull(
    workspaceId: string,
    sourceId: string,
    changes: Partial<FieldValues>,
  ): Promise<void>;
};
