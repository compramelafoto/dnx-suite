import { writeFileSync } from "node:fs";
import { loadLocalVisualReferenceCatalog } from "../catalog/load-local-visual-reference-catalog.js";
import { VISUAL_REFERENCES_CATALOG_PATH } from "../catalog/paths.js";
import { validateVisualReference } from "../validation/validate-visual-reference.js";

const id = process.argv[2];
if (!id) {
  console.error("Usage: visual-references:approve <id>");
  process.exit(1);
}

const loaded = loadLocalVisualReferenceCatalog(VISUAL_REFERENCES_CATALOG_PATH);
if (loaded.status === "MISSING") {
  console.error("No local visual reference catalog configured.");
  process.exit(1);
}
if (loaded.status === "INVALID_JSON") {
  console.error("Invalid catalog JSON.");
  process.exit(1);
}

const ref = loaded.catalog.references.find((r) => r.id === id);
if (!ref) {
  console.error(`Reference not found: ${id}`);
  process.exit(1);
}

if (ref.rights.authorizedForPublicAssistant) {
  console.error("authorizedForPublicAssistant must remain false in this stage.");
  process.exit(1);
}

// Require rights completed before approval
ref.rights.usageAuthorized = ref.rights.usageAuthorized === true;
ref.rights.authorizedForInternalReview =
  ref.rights.authorizedForInternalReview === true;
ref.rights.authorizedForPublicAssistant = false;

if (!ref.rights.usageAuthorized || !ref.rights.authorizedForInternalReview) {
  console.error(
    "Cannot approve: set usageAuthorized and authorizedForInternalReview to true in the catalog first.",
  );
  process.exit(1);
}

if (ref.rights.authorizationBasis === "UNKNOWN") {
  console.error("Cannot approve: authorizationBasis must not be UNKNOWN.");
  process.exit(1);
}

if (
  ref.rights.attributionRequired &&
  !ref.rights.attributionText?.trim()
) {
  console.error("Cannot approve: attributionText required.");
  process.exit(1);
}

if (!ref.educationalPurpose?.length) {
  console.error("Cannot approve: educationalPurpose required.");
  process.exit(1);
}

if (!ref.niches?.length) {
  console.error("Cannot approve: niche required.");
  process.exit(1);
}

ref.status = "APPROVED";
ref.updatedAt = new Date().toISOString();

const issues = validateVisualReference(ref, {
  requireFileExists: true,
  forbidPublicAuthorization: true,
});
if (issues.length > 0) {
  for (const issue of issues) {
    console.error(`[${issue.code}] ${issue.message}`);
  }
  process.exit(1);
}

writeFileSync(
  VISUAL_REFERENCES_CATALOG_PATH,
  `${JSON.stringify(loaded.catalog, null, 2)}\n`,
  "utf8",
);
console.log(`Approved for internal review only: ${id}`);
console.log("authorizedForPublicAssistant remains false.");
