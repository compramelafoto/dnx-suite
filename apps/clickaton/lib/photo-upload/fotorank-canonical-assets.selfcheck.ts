/**
 *   pnpm --filter @repo/db exec tsx ../../apps/clickaton/lib/photo-upload/fotorank-canonical-assets.selfcheck.ts
 */
import {
  isCanonicalFotoRankAssetsEnabled,
  isEnvCanonicalFotoRankAssetsEnabled,
} from "./fotorank-canonical-assets";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log("ok —", msg);
}

const prev = process.env.CLICKATON_FOTORANK_CANONICAL_ASSETS;
delete process.env.CLICKATON_FOTORANK_CANONICAL_ASSETS;
assert(!isEnvCanonicalFotoRankAssetsEnabled(), "env OFF por defecto");
assert(
  !isCanonicalFotoRankAssetsEnabled({ editionCanonicalAssetsEnabled: true }),
  "edition ON + env OFF = OFF",
);

process.env.CLICKATON_FOTORANK_CANONICAL_ASSETS = "1";
assert(isEnvCanonicalFotoRankAssetsEnabled(), "env ON");
assert(
  !isCanonicalFotoRankAssetsEnabled({ editionCanonicalAssetsEnabled: false }),
  "env ON + edition OFF = OFF",
);
assert(
  !isCanonicalFotoRankAssetsEnabled({ editionCanonicalAssetsEnabled: null }),
  "env ON + edition null = OFF",
);
assert(
  isCanonicalFotoRankAssetsEnabled({ editionCanonicalAssetsEnabled: true }),
  "env ON + edition ON = ON",
);

if (prev === undefined) delete process.env.CLICKATON_FOTORANK_CANONICAL_ASSETS;
else process.env.CLICKATON_FOTORANK_CANONICAL_ASSETS = prev;

console.log("FINAL: PASS");
