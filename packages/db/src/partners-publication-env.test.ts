import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PUBLICATION_ENV_BY_DB_KEY } from "@repo/partners";
import { WELCOME_CONTEXT_FOTORANK_ENV } from "./partners-welcome-context-clients";

describe("partners publication env mapping", () => {
  it("FOTORANK publication uses ADS database URL", () => {
    assert.equal(
      PUBLICATION_ENV_BY_DB_KEY.FOTORANK,
      "DNX_PARTNERS_FOTORANK_ADS_DATABASE_URL",
    );
  });

  it("FOTORANK ads env is distinct from welcome contest context", () => {
    assert.equal(WELCOME_CONTEXT_FOTORANK_ENV, "DNX_PARTNERS_FOTORANK_DATABASE_URL");
    assert.notEqual(PUBLICATION_ENV_BY_DB_KEY.FOTORANK, WELCOME_CONTEXT_FOTORANK_ENV);
    assert.notEqual(
      PUBLICATION_ENV_BY_DB_KEY.FOTORANK,
      "DNX_PARTNERS_FOTORANK_DATABASE_URL",
    );
  });
});
