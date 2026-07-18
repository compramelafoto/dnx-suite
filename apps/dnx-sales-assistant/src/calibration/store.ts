import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  EMPTY_CALIBRATION_STORE,
  type CalibrationStore,
} from "./domain/calibration-item.js";
import { CALIBRATION_LOCAL_DIR, CALIBRATION_STORE_PATH } from "./paths.js";

export function ensureCalibrationDirs(): void {
  for (const dir of [
    CALIBRATION_LOCAL_DIR,
    path.join(CALIBRATION_LOCAL_DIR, "inbox"),
    path.join(CALIBRATION_LOCAL_DIR, "candidates"),
    path.join(CALIBRATION_LOCAL_DIR, "proposals"),
    path.join(CALIBRATION_LOCAL_DIR, "golden"),
    path.join(CALIBRATION_LOCAL_DIR, "history"),
    path.join(CALIBRATION_LOCAL_DIR, "exports"),
  ]) {
    mkdirSync(dir, { recursive: true });
  }
}

export function loadCalibrationStore(
  storePath: string = CALIBRATION_STORE_PATH,
): CalibrationStore {
  if (!existsSync(storePath)) {
    return {
      ...EMPTY_CALIBRATION_STORE,
      items: [],
      visualItems: [],
      importedSessionIds: [],
      goldenCases: [],
      pendingGoldenProposals: [],
      copyProposals: [],
      ruleProposals: [],
      updatedAt: new Date().toISOString(),
    };
  }
  const raw = JSON.parse(readFileSync(storePath, "utf8")) as CalibrationStore;
  return {
    ...EMPTY_CALIBRATION_STORE,
    ...raw,
    items: raw.items ?? [],
    visualItems: raw.visualItems ?? [],
    importedSessionIds: raw.importedSessionIds ?? [],
    goldenCases: raw.goldenCases ?? [],
    pendingGoldenProposals: raw.pendingGoldenProposals ?? [],
    copyProposals: raw.copyProposals ?? [],
    ruleProposals: raw.ruleProposals ?? [],
  };
}

export function saveCalibrationStore(
  store: CalibrationStore,
  storePath: string = CALIBRATION_STORE_PATH,
): void {
  ensureCalibrationDirs();
  store.updatedAt = new Date().toISOString();
  writeFileSync(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

export function appendCalibrationHistory(
  event: string,
  payload: Record<string, unknown>,
): void {
  ensureCalibrationDirs();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(
    CALIBRATION_LOCAL_DIR,
    "history",
    `${stamp}-${event}.json`,
  );
  writeFileSync(
    file,
    `${JSON.stringify({ event, at: new Date().toISOString(), ...payload }, null, 2)}\n`,
    "utf8",
  );
}
