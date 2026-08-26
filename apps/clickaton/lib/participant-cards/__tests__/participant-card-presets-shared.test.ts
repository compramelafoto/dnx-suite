import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getClickatonTemplatePreset,
  CLICKATON_WELCOME_STORY_V1,
  CLICKATON_MEMBER_STORY_V1,
} from "@repo/template-engine/clickaton-presets";
// Los presets del editor viven ahora en @repo/template-editor-core, no dentro de ComprameLaFoto.
import {
  CLICKATON_WELCOME_STORY_V1 as CLF_WELCOME,
  CLICKATON_MEMBER_STORY_V1 as CLF_MEMBER,
} from "@repo/template-editor-core/presets/clickaton";

const CASES = [
  {
    key: "CLICKATON_WELCOME_STORY_V1",
    packagePreset: () => getClickatonTemplatePreset("CLICKATON_WELCOME_STORY_V1"),
    clfPreset: CLF_WELCOME,
    packageConst: CLICKATON_WELCOME_STORY_V1,
  },
  {
    key: "CLICKATON_MEMBER_STORY_V1",
    packagePreset: () => getClickatonTemplatePreset("CLICKATON_MEMBER_STORY_V1"),
    clfPreset: CLF_MEMBER,
    packageConst: CLICKATON_MEMBER_STORY_V1,
  },
] as const;

describe("clickaton presets shared with CLF registry", () => {
  for (const { key, packagePreset, clfPreset, packageConst } of CASES) {
    it(`${key} matches CLF re-export and registry lookup`, () => {
      const pkg = packagePreset();
      assert.ok(pkg, `package preset missing: ${key}`);

      assert.equal(pkg!.meta.templateKey, clfPreset.meta.templateKey);
      assert.equal(pkg!.meta.templateVersion, clfPreset.meta.templateVersion);
      assert.equal(pkg!.payload.blocks.length, clfPreset.payload.blocks.length);
      assert.equal(pkg!.payload.canvas.width, clfPreset.payload.canvas.width);
      assert.equal(pkg!.payload.canvas.height, clfPreset.payload.canvas.height);

      assert.equal(packageConst.meta.templateKey, clfPreset.meta.templateKey);
      assert.equal(
        packageConst.payload.blocks.length,
        clfPreset.payload.blocks.length
      );

      const pkgBindings = pkg!.payload.variableBindings?.length ?? 0;
      const clfBindings = clfPreset.payload.variableBindings?.length ?? 0;
      assert.equal(pkgBindings, clfBindings);

      const pkgBlockNames = pkg!.payload.blocks.map((b) => b.name).sort();
      const clfBlockNames = clfPreset.payload.blocks.map((b) => b.name).sort();
      assert.deepEqual(pkgBlockNames, clfBlockNames);
    });
  }
});
