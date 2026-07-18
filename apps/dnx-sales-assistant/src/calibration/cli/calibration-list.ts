import { loadCalibrationStore } from "../store.js";

const store = loadCalibrationStore();
console.log(
  `Items: ${store.items.length} · Visual: ${store.visualItems.length} · Golden: ${store.goldenCases.length} · Copy proposals: ${store.copyProposals.length}`,
);
console.log("ID\tVERDICT\tCODE\tCOPY\tFIELD\tSCORE\tNOTE");
for (const item of store.items) {
  console.log(
    [
      item.id,
      item.verdict,
      item.calibrationCode,
      item.appliedCopyIds[0] ?? "",
      item.askedField ?? "",
      item.styleScore ?? "",
      (item.note ?? "").replace(/\t|\n/g, " ").slice(0, 60),
    ].join("\t"),
  );
}
