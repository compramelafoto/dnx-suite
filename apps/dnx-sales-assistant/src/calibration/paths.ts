import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export const CALIBRATION_LOCAL_DIR = path.join(
  PACKAGE_ROOT,
  ".local",
  "calibration",
);

export const CALIBRATION_INBOX_DIR = path.join(CALIBRATION_LOCAL_DIR, "inbox");
export const CALIBRATION_CANDIDATES_DIR = path.join(
  CALIBRATION_LOCAL_DIR,
  "candidates",
);
export const CALIBRATION_PROPOSALS_DIR = path.join(
  CALIBRATION_LOCAL_DIR,
  "proposals",
);
export const CALIBRATION_GOLDEN_DIR = path.join(CALIBRATION_LOCAL_DIR, "golden");
export const CALIBRATION_HISTORY_DIR = path.join(
  CALIBRATION_LOCAL_DIR,
  "history",
);
export const CALIBRATION_EXPORTS_DIR = path.join(
  CALIBRATION_LOCAL_DIR,
  "exports",
);
export const CALIBRATION_STORE_PATH = path.join(
  CALIBRATION_LOCAL_DIR,
  "store.json",
);

/** Directorios permitidos para importar exports del lab. */
export const CALIBRATION_ALLOWED_IMPORT_ROOTS = [
  path.join(PACKAGE_ROOT, ".local", "review-lab"),
  CALIBRATION_INBOX_DIR,
  CALIBRATION_EXPORTS_DIR,
] as const;

export function packageRoot(): string {
  return PACKAGE_ROOT;
}
