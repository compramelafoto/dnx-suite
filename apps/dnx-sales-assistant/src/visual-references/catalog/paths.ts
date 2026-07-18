import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

export const VISUAL_REFERENCES_LOCAL_DIR = path.join(
  PACKAGE_ROOT,
  ".local",
  "visual-references",
);

export const VISUAL_REFERENCES_ASSETS_DIR = path.join(
  VISUAL_REFERENCES_LOCAL_DIR,
  "assets",
);

export const VISUAL_REFERENCES_CATALOG_PATH = path.join(
  VISUAL_REFERENCES_LOCAL_DIR,
  "catalog.json",
);

export const VISUAL_REFERENCES_EXAMPLE_CATALOG_PATH = path.join(
  PACKAGE_ROOT,
  "config",
  "visual-references",
  "catalog.example.json",
);

export const VISUAL_REFERENCE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export const VISUAL_REFERENCE_ALLOWED_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
] as const;

export const VISUAL_REFERENCE_MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export function packageRoot(): string {
  return PACKAGE_ROOT;
}
