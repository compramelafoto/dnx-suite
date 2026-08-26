import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = HERE;
const PUBLIC_UX = join(HERE, "../../lib/fotorank/public-ux");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|css)$/.test(name)) out.push(p);
  }
  return out;
}

const FORBIDDEN = [
  /apps\/clickaton/,
  /@\/components\/marathon/,
  /clickaton/i,
  /--ck-/,
  /ck-yellow/,
  /#FFC400/,
  /#ffc400/,
  /marat[oó]n/i,
  /camiseta/i,
];

describe("public-ui isolation from Clickatón", () => {
  it("contains no Clickatón-specific imports, tokens or product terms", () => {
    const files = [...walk(ROOT), ...walk(PUBLIC_UX)];
    assert.ok(files.length > 5, "expected public-ui files");
    for (const file of files) {
      if (file.endsWith(".test.ts")) continue;
      const src = readFileSync(file, "utf8");
      for (const re of FORBIDDEN) {
        assert.equal(
          re.test(src),
          false,
          `${file} matched forbidden pattern ${re}`,
        );
      }
    }
  });

  it("exports the minimum public component set", async () => {
    const mod = await import("./index");
    for (const name of [
      "PublicShell",
      "PublicHeader",
      "PublicFooter",
      "PageContainer",
      "PageHeader",
      "ContestHero",
      "PrimaryButton",
      "SecondaryButton",
      "FormField",
      "StatusBadge",
      "ProgressChecklist",
      "InfoCard",
      "DateCard",
      "CategoryCard",
      "Notice",
      "EmptyState",
      "LoadingState",
      "ErrorState",
      "ParticipantDashboard",
      "ParticipantArtworkCard",
      "MobileActionBar",
    ]) {
      assert.equal(typeof (mod as Record<string, unknown>)[name], "function", name);
    }
  });
});
