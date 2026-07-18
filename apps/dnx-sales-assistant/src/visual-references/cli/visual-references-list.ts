import { loadLocalVisualReferenceCatalog } from "../catalog/load-local-visual-reference-catalog.js";
import { VISUAL_REFERENCES_CATALOG_PATH } from "../catalog/paths.js";

const loaded = loadLocalVisualReferenceCatalog(VISUAL_REFERENCES_CATALOG_PATH);

if (loaded.status === "MISSING") {
  console.log("No local visual reference catalog configured.");
  process.exit(0);
}

if (loaded.status === "INVALID_JSON") {
  console.log("Invalid catalog JSON.");
  process.exit(1);
}

console.log("ID\tTITLE\tNICHES\tSTATUS\tINTERNAL\tPUBLIC\tAUTHOR");
for (const ref of loaded.catalog.references) {
  console.log(
    [
      ref.id,
      ref.title.replace(/\t/g, " "),
      ref.niches.join("|"),
      ref.status,
      String(ref.rights?.authorizedForInternalReview ?? false),
      String(ref.rights?.authorizedForPublicAssistant ?? false),
      ref.rights?.authorName ?? "",
    ].join("\t"),
  );
}
