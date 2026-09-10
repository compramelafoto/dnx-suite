import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { pickDefaultScanProtectionEnabled } from "./default-scan-protection";

describe("pickDefaultScanProtectionEnabled", () => {
  it("mantiene la protección activada para un fotógrafo sin álbumes previos", () => {
    assert.equal(pickDefaultScanProtectionEnabled(null), true);
  });

  it("mantiene la protección activada si la consulta no devolvió el dato", () => {
    assert.equal(pickDefaultScanProtectionEnabled(undefined), true);
    assert.equal(pickDefaultScanProtectionEnabled({}), true);
  });

  it("hereda la protección desactivada del último álbum del fotógrafo", () => {
    assert.equal(pickDefaultScanProtectionEnabled({ scanProtectionEnabled: false }), false);
  });

  it("hereda la protección activada del último álbum del fotógrafo", () => {
    assert.equal(pickDefaultScanProtectionEnabled({ scanProtectionEnabled: true }), true);
  });
})
