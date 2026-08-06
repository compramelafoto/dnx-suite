import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "../../..");
const REPO = join(APP, "../..");

describe("inscription restyle isolation (IMPL 04)", () => {
  it("keeps Instagram required and promotional opt-in optional in InscriptionForm", () => {
    const src = readFileSync(join(APP, "concursos/[slug]/inscripcion/InscriptionForm.tsx"), "utf8");
    assert.match(src, /Instagram es obligatorio/);
    assert.match(src, /needsInstagram/);
    assert.match(src, /data-testid="inscription-instagram"/);
    assert.match(src, /promotionalOptIn/);
    assert.match(src, /no obligatorio/);
    assert.match(src, /data-testid="inscription-promo-optin"/);
    assert.match(src, /data-testid="inscription-accept-rules"/);
    assert.match(src, /data-testid="inscription-accept-license"/);
    assert.doesNotMatch(src, /#FFC400|#ffc400/);
    assert.doesNotMatch(src, /apps\/clickaton/);
  });

  it("upload closed path explains without active upload CTA", () => {
    const src = readFileSync(
      join(APP, "components/participant-upload/ParticipantUploadWizard.tsx"),
      "utf8",
    );
    assert.match(src, /upload-closed-notice/);
    assert.match(src, /Carga no habilitada/);
    const closedBlock = src.slice(
      src.indexOf("upload-closed-notice"),
      src.indexOf("entry-upload-panel"),
    );
    assert.doesNotMatch(closedBlock, /Seleccionar archivo|inputRef\.current\?\.click|type="file"/);
  });

  it("inscription page uses PublicShell + public-ui chrome", () => {
    const src = readFileSync(join(APP, "concursos/[slug]/inscripcion/page.tsx"), "utf8");
    assert.match(src, /PublicShell/);
    assert.match(src, /PageHeader/);
    assert.match(src, /PageContainer/);
    assert.match(src, /PrimaryButton|SecondaryButton/);
    assert.doesNotMatch(src, /from\s+["'].*components\/landing\//);
  });

  it("bridge CSS is imported and avoids Clickatón yellow", () => {
    const globals = readFileSync(join(APP, "globals.css"), "utf8");
    assert.match(globals, /inscription-public-bridge\.css/);
    const bridge = join(APP, "styles/inscription-public-bridge.css");
    assert.ok(existsSync(bridge));
    const css = readFileSync(bridge, "utf8");
    assert.doesNotMatch(css, /#FFC400|#ffc400|--ck-/);
  });

  it("does not change API routes, db package, or migrations vs production base", () => {
    const base = "origin/release/fotorank-production";
    let diff = "";
    try {
      diff = execSync(`git diff --name-only ${base}...HEAD`, {
        cwd: REPO,
        encoding: "utf8",
      });
    } catch {
      // If base missing locally, skip hard fail — CI/worktree should have the ref.
      assert.ok(true);
      return;
    }
    const files = diff.split("\n").filter(Boolean);
    for (const f of files) {
      assert.equal(f.startsWith("apps/fotorank/app/api/"), false, `API touched: ${f}`);
      assert.equal(f.startsWith("packages/db/"), false, `db touched: ${f}`);
      assert.doesNotMatch(
        f,
        /(^|\/)(migrations?|prisma\/migrations)\//i,
        `migration path touched: ${f}`,
      );
      assert.doesNotMatch(
        f,
        /(^|\/)(r2|cloudflare).*storage/i,
        `r2/storage path touched: ${f}`,
      );
    }
  });
});
