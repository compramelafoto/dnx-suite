import { loadLocalVisualReferenceCatalog } from "../catalog/load-local-visual-reference-catalog.js";
import { VISUAL_REFERENCES_CATALOG_PATH } from "../catalog/paths.js";
import type { VisualReference } from "../domain/visual-reference.js";
import type { VisualReferenceNiche } from "../domain/visual-reference-niche.js";
import { isDisplayableVisualReference } from "../validation/validate-visual-reference.js";
import type { VisualReferenceProvider } from "./visual-reference-provider.js";

export type LocalCuratedProviderOptions = {
  catalogPath?: string;
  requireFileExists?: boolean;
};

/**
 * Proveedor local curado. Catálogo ausente → lista vacía (sin inventar datos).
 */
export class LocalCuratedVisualReferenceProvider implements VisualReferenceProvider {
  private readonly catalogPath: string;
  private readonly requireFileExists: boolean;

  constructor(options: LocalCuratedProviderOptions = {}) {
    this.catalogPath = options.catalogPath ?? VISUAL_REFERENCES_CATALOG_PATH;
    this.requireFileExists = options.requireFileExists !== false;
  }

  private loadApproved(): VisualReference[] {
    const loaded = loadLocalVisualReferenceCatalog(this.catalogPath);
    const opts = { requireFileExists: this.requireFileExists };
    return loaded.catalog.references
      .filter((ref) => isDisplayableVisualReference(ref, opts))
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  async listByNiche(niche: VisualReferenceNiche): Promise<VisualReference[]> {
    return this.loadApproved().filter((ref) => ref.niches.includes(niche));
  }

  async getById(id: string): Promise<VisualReference | null> {
    const found = this.loadApproved().find((ref) => ref.id === id);
    return found ?? null;
  }

  /** Todas las aprobadas (para selección). */
  listApprovedSync(): VisualReference[] {
    return this.loadApproved();
  }

  catalogStatus(): "MISSING" | "INVALID_JSON" | "OK" {
    return loadLocalVisualReferenceCatalog(this.catalogPath).status;
  }
}
