import type { ConversationCalibrationItem } from "../domain/calibration-item.js";

export type CalibrationGroup = {
  key: string;
  dimension: string;
  total: number;
  approved: number;
  needsAdjustment: number;
  incorrect: number;
  predominantCode: string;
  averageScore: number;
  notes: string[];
  scenarioIds: string[];
  exampleItemIds: string[];
  flagFrequency: Record<string, number>;
};

function groupBy(
  items: ConversationCalibrationItem[],
  dimension: string,
  keyFn: (item: ConversationCalibrationItem) => string,
): CalibrationGroup[] {
  const map = new Map<string, ConversationCalibrationItem[]>();
  for (const item of items) {
    const key = keyFn(item) || "(none)";
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }

  const groups: CalibrationGroup[] = [];
  for (const [key, list] of [...map.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const codeCounts = new Map<string, number>();
    const flagFrequency: Record<string, number> = {};
    let scoreSum = 0;
    let scoreN = 0;
    const notes: string[] = [];
    const scenarioIds = new Set<string>();

    for (const item of list) {
      codeCounts.set(
        item.calibrationCode,
        (codeCounts.get(item.calibrationCode) ?? 0) + 1,
      );
      for (const f of item.styleFlags) {
        flagFrequency[f] = (flagFrequency[f] ?? 0) + 1;
      }
      if (item.styleScore !== undefined) {
        scoreSum += item.styleScore;
        scoreN += 1;
      }
      if (item.note) notes.push(item.note);
      if (item.scenarioId) scenarioIds.add(item.scenarioId);
    }

    const predominantCode =
      [...codeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
      "CALIBRATION_OTHER";

    groups.push({
      key,
      dimension,
      total: list.length,
      approved: list.filter((i) => i.verdict === "APPROVED").length,
      needsAdjustment: list.filter((i) => i.verdict === "NEEDS_ADJUSTMENT")
        .length,
      incorrect: list.filter((i) => i.verdict === "INCORRECT").length,
      predominantCode,
      averageScore: scoreN === 0 ? 0 : Math.round(scoreSum / scoreN),
      notes: notes.slice(0, 5),
      scenarioIds: [...scenarioIds],
      exampleItemIds: list.slice(0, 3).map((i) => i.id),
      flagFrequency,
    });
  }
  return groups;
}

export function groupCalibrationItems(items: ConversationCalibrationItem[]): {
  byCopyId: CalibrationGroup[];
  byAskedField: CalibrationGroup[];
  byCode: CalibrationGroup[];
  byIntent: CalibrationGroup[];
  byIntentAndField: CalibrationGroup[];
  byScenario: CalibrationGroup[];
  byVisualNiche: CalibrationGroup[];
} {
  return {
    byCopyId: groupBy(items, "copyId", (i) => i.appliedCopyIds[0] ?? ""),
    byAskedField: groupBy(items, "askedField", (i) => i.askedField ?? ""),
    byCode: groupBy(items, "calibrationCode", (i) => i.calibrationCode),
    byIntent: groupBy(items, "intent", (i) => i.detectedIntent ?? ""),
    byIntentAndField: groupBy(
      items,
      "intent+field",
      (i) => `${i.detectedIntent ?? ""}|${i.askedField ?? ""}`,
    ),
    byScenario: groupBy(items, "scenario", (i) => i.scenarioId ?? "free"),
    byVisualNiche: groupBy(
      items,
      "visualNiche",
      (i) => i.visualReferenceIntent?.niche ?? "",
    ),
  };
}
