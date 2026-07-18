import { loadLocalVisualReferenceCatalog } from "../catalog/load-local-visual-reference-catalog.js";
import { VISUAL_REFERENCES_CATALOG_PATH } from "../catalog/paths.js";
import { validateVisualReferenceCatalog } from "../validation/validate-visual-reference-catalog.js";

const loaded = loadLocalVisualReferenceCatalog(VISUAL_REFERENCES_CATALOG_PATH);

if (loaded.status === "MISSING") {
  console.log("No local visual reference catalog configured.");
  console.log(`Expected: ${VISUAL_REFERENCES_CATALOG_PATH}`);
  console.log("Result: OK (empty — not an error).");
  process.exit(0);
}

if (loaded.status === "INVALID_JSON") {
  console.log("Local visual reference catalog is invalid JSON.");
  console.log(loaded.error);
  process.exit(1);
}

const issues = validateVisualReferenceCatalog(loaded.catalog, {
  requireFileExists: true,
  forbidPublicAuthorization: true,
});

console.log("DNX visual-references validate");
console.log(`catalog: ${loaded.path}`);
console.log(`references: ${loaded.catalog.references.length}`);
console.log(`issues: ${issues.length}`);

for (const issue of issues) {
  console.log(
    `  ERROR [${issue.code}]${issue.referenceId ? ` ${issue.referenceId}` : ""}: ${issue.message}`,
  );
}

if (issues.length > 0) {
  console.log("Result: INVALID");
  process.exit(1);
}

console.log("Result: OK");
process.exit(0);
