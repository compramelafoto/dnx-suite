/**
 * Tests de estabilización Etapa 11 (puro + licencia).
 * pnpm --filter infospot test:stabilization
 */

import assert from "node:assert/strict";
import {
  assertProductionLicensePolicy,
  resolveDefaultEditorialLicenseStatus,
} from "../editorial-photos/license-policy";
import { isSafeExternalRedirect } from "../distribution/metrics";
import { temporalStateLabel } from "../distribution/temporal";
import { toPublicEditorialPhoto } from "../public-coverage/photo-mapper";

function withEnv(
  patch: Record<string, string | undefined>,
  fn: () => void,
) {
  const prev: Record<string, string | undefined> = {};
  for (const key of Object.keys(patch)) {
    prev[key] = process.env[key];
    const val = patch[key];
    if (val === undefined) delete process.env[key];
    else process.env[key] = val;
  }
  try {
    fn();
  } finally {
    for (const key of Object.keys(patch)) {
      const val = prev[key];
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
  }
}

function main() {
  // Licencia: simular producción vía flags (sin mutar NODE_ENV tipado)
  withEnv(
    {
      // force production path using a helper flag in policy — see below
      INFOSPOT_FORCE_PRODUCTION_LICENSE_POLICY: "1",
      INFOSPOT_CLF_EDITORIAL_LICENSE_DEFAULT: "AUTHORIZED",
      INFOSPOT_CLF_EDITORIAL_LICENSE_CONTRACT: undefined,
    },
    () => {
      assert.equal(resolveDefaultEditorialLicenseStatus(), "PENDING");
      assert.equal(assertProductionLicensePolicy().ok, false);
    },
  );

  withEnv(
    {
      INFOSPOT_FORCE_PRODUCTION_LICENSE_POLICY: "1",
      INFOSPOT_CLF_EDITORIAL_LICENSE_DEFAULT: "AUTHORIZED",
      INFOSPOT_CLF_EDITORIAL_LICENSE_CONTRACT: "1",
    },
    () => {
      assert.equal(resolveDefaultEditorialLicenseStatus(), "AUTHORIZED");
      assert.equal(assertProductionLicensePolicy().ok, true);
    },
  );

  assert.equal(
    isSafeExternalRedirect("https://evil.example/x", ["https://compramelafoto.com"]),
    false,
  );

  assert.equal(temporalStateLabel("UPCOMING"), "Próximamente");

  {
    const p = toPublicEditorialPhoto(
      {
        usageType: "COVER",
        sortOrder: 0,
        caption: "x",
        altText: "y",
        displaySize: "full",
        photo: {
          id: "stab-1",
          photographerName: "A",
          credit: "Foto: A / ComprameLaFoto",
          commercialStatus: "AVAILABLE",
          editorialLicenseStatus: "REVOKED",
          processStatus: "READY",
          purchaseUrl: "https://compramelafoto.com/p/1",
          albumUrl: "https://compramelafoto.com/a/1",
          photographerProfileUrl: null,
          variants: [
            { width: 1280, format: "webp", url: "https://cdn.example/w1280.webp" },
          ],
        },
      },
      { articleId: "a1" },
    );
    assert.equal(p.revoked, true);
    assert.equal(p.src, null);
    assert.equal(p.canShowPurchaseCta, false);
  }

  console.log("stabilization tests: ok");
}

main();
