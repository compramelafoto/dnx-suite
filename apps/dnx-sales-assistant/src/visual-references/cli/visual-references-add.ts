import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  VISUAL_REFERENCE_MAX_BYTES,
  VISUAL_REFERENCES_ASSETS_DIR,
  VISUAL_REFERENCES_CATALOG_PATH,
} from "../catalog/paths.js";
import { loadLocalVisualReferenceCatalog } from "../catalog/load-local-visual-reference-catalog.js";
import type { VisualReference } from "../domain/visual-reference.js";
import { isVisualReferenceNiche } from "../domain/visual-reference-niche.js";
import { resolveAllowedAssetPath } from "../validation/resolve-asset-path.js";

function argValue(argv: string[], name: string): string | undefined {
  const idx = argv.indexOf(name);
  if (idx >= 0 && argv[idx + 1]) return argv[idx + 1];
  return undefined;
}

function usage(): never {
  console.log(`Usage:
  pnpm --filter dnx-sales-assistant visual-references:add -- \\
    --file <path> --title <text> --niche <niche> \\
    [--id <id>] [--description <text>] [--purpose <purpose>]

Leaves the entry in DRAFT with rights NOT authorized.
Does not approve. Does not set public authorization.
`);
  process.exit(1);
}

const argv = process.argv.slice(2);
const file = argValue(argv, "--file");
const title = argValue(argv, "--title");
const niche = argValue(argv, "--niche");
const idArg = argValue(argv, "--id");
const description =
  argValue(argv, "--description") ??
  "Referencia local pendiente de completar derechos y aprobación.";
const purpose = argValue(argv, "--purpose") ?? "composición";

if (!file || !title || !niche) usage();
if (!isVisualReferenceNiche(niche)) {
  console.error(`Invalid niche: ${niche}`);
  process.exit(1);
}
if (!existsSync(file)) {
  console.error("Source file not found.");
  process.exit(1);
}

const buf = readFileSync(file);
if (buf.length > VISUAL_REFERENCE_MAX_BYTES) {
  console.error("File too large (max 10 MB).");
  process.exit(1);
}

const ext = path.extname(file).toLowerCase();
const resolvedProbe = resolveAllowedAssetPath(`probe${ext}`);
if (!resolvedProbe.ok && resolvedProbe.reason === "INVALID_EXT") {
  console.error("Invalid format. Allowed: JPEG, PNG, WebP.");
  process.exit(1);
}

mkdirSync(VISUAL_REFERENCES_ASSETS_DIR, { recursive: true });

const hash = createHash("sha256").update(buf).digest("hex").slice(0, 10);
const id =
  idArg?.trim() ||
  `vr-${niche.replace(/\s+/g, "-").slice(0, 24)}-${hash}`;
const destName = `${id.replace(/[^a-zA-Z0-9_-]/g, "-")}${ext}`;
const destRelative = destName;
const destAbs = path.join(VISUAL_REFERENCES_ASSETS_DIR, destName);

if (existsSync(destAbs)) {
  console.error("Destination file already exists. Refuse to overwrite.");
  process.exit(1);
}

const resolved = resolveAllowedAssetPath(destRelative);
if (!resolved.ok) {
  console.error("Unsafe destination path.");
  process.exit(1);
}

copyFileSync(file, destAbs);

const loaded = loadLocalVisualReferenceCatalog(VISUAL_REFERENCES_CATALOG_PATH);
const catalog = loaded.catalog;
if (catalog.references.some((r) => r.id === id)) {
  console.error("Duplicate ID in catalog.");
  process.exit(1);
}

const now = new Date().toISOString();
const entry: VisualReference = {
  id,
  version: 1,
  title,
  description,
  niches: [niche],
  imagePath: destRelative,
  orientation: "LANDSCAPE",
  educationalPurpose: [purpose as VisualReference["educationalPurpose"][number]],
  tags: ["imported"],
  source: {
    kind: "LOCAL_CURATED",
    originalFilename: path.basename(file),
    originalIdentifier: randomUUID(),
  },
  rights: {
    usageAuthorized: false,
    authorizedForInternalReview: false,
    authorizedForPublicAssistant: false,
    authorizationBasis: "UNKNOWN",
    attributionRequired: false,
    notes: "Completar derechos antes de aprobar.",
  },
  status: "DRAFT",
  createdAt: now,
  updatedAt: now,
};

catalog.references.push(entry);
catalog.updatedAt = now;
mkdirSync(path.dirname(VISUAL_REFERENCES_CATALOG_PATH), { recursive: true });
writeFileSync(
  VISUAL_REFERENCES_CATALOG_PATH,
  `${JSON.stringify(catalog, null, 2)}\n`,
  "utf8",
);

console.log(`Added DRAFT reference: ${id}`);
console.log("Complete rights, then run visual-references:approve <id>");
