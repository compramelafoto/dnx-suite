import type { VisualReference } from "../domain/visual-reference.js";
import type { VisualReferenceNiche } from "../domain/visual-reference-niche.js";

/**
 * Contrato desacoplado. Fuentes futuras (ComprameLaFoto, Drive, etc.)
 * implementarán esta interfaz sin acoplarse al laboratorio.
 * No realizar solicitudes de red en implementaciones de esta etapa.
 */
export interface VisualReferenceProvider {
  listByNiche(niche: VisualReferenceNiche): Promise<VisualReference[]>;
  getById(id: string): Promise<VisualReference | null>;
}
