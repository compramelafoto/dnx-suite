import { existsSync, readFileSync } from "node:fs";
import {
  EMPTY_VISUAL_REFERENCE_CATALOG,
  type VisualReferenceCatalog,
} from "./visual-reference-catalog.js";
import { VISUAL_REFERENCES_CATALOG_PATH } from "./paths.js";

export type LoadCatalogResult =
  | { status: "MISSING"; catalog: VisualReferenceCatalog; path: string }
  | { status: "INVALID_JSON"; catalog: VisualReferenceCatalog; path: string; error: string }
  | { status: "OK"; catalog: VisualReferenceCatalog; path: string };

/**
 * Carga el catálogo local. Si no existe, no falla: catálogo vacío.
 */
export function loadLocalVisualReferenceCatalog(
  catalogPath: string = VISUAL_REFERENCES_CATALOG_PATH,
): LoadCatalogResult {
  if (!existsSync(catalogPath)) {
    return {
      status: "MISSING",
      catalog: { ...EMPTY_VISUAL_REFERENCE_CATALOG, references: [] },
      path: catalogPath,
    };
  }
  try {
    const raw = readFileSync(catalogPath, "utf8");
    const parsed = JSON.parse(raw) as VisualReferenceCatalog;
    if (!parsed || !Array.isArray(parsed.references)) {
      return {
        status: "INVALID_JSON",
        catalog: { ...EMPTY_VISUAL_REFERENCE_CATALOG, references: [] },
        path: catalogPath,
        error: "Catalog must include a references array.",
      };
    }
    return {
      status: "OK",
      catalog: {
        version: typeof parsed.version === "number" ? parsed.version : 1,
        updatedAt: parsed.updatedAt,
        references: parsed.references,
      },
      path: catalogPath,
    };
  } catch (err) {
    return {
      status: "INVALID_JSON",
      catalog: { ...EMPTY_VISUAL_REFERENCE_CATALOG, references: [] },
      path: catalogPath,
      error: err instanceof Error ? err.message : "parse_error",
    };
  }
}
