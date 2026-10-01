import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  SCAN_PROTECTION_OFF_TAG,
  pickDefaultScanProtectionEnabled,
} from "./default-scan-protection";

const sinTag = { tags: [] as string[] };
const conTag = { tags: [SCAN_PROTECTION_OFF_TAG] };

describe("pickDefaultScanProtectionEnabled", () => {
  it("mantiene la protección activada para un fotógrafo sin álbumes previos", () => {
    assert.equal(pickDefaultScanProtectionEnabled(sinTag, null), true);
  });

  it("mantiene la protección activada si la consulta no devolvió el dato", () => {
    assert.equal(pickDefaultScanProtectionEnabled(sinTag, undefined), true);
    assert.equal(pickDefaultScanProtectionEnabled(sinTag, {}), true);
  });

  it("hereda la protección desactivada del último álbum del fotógrafo", () => {
    assert.equal(
      pickDefaultScanProtectionEnabled(sinTag, { scanProtectionEnabled: false }),
      false
    );
  });

  it("hereda la protección activada del último álbum del fotógrafo", () => {
    assert.equal(
      pickDefaultScanProtectionEnabled(sinTag, { scanProtectionEnabled: true }),
      true
    );
  });

  it("con la marca del fotógrafo, el álbum nuevo siempre nace sin protección", () => {
    assert.equal(pickDefaultScanProtectionEnabled(conTag, null), false);
    assert.equal(
      pickDefaultScanProtectionEnabled(conTag, { scanProtectionEnabled: true }),
      false
    );
  });

  it("tolera un fotógrafo sin datos o sin tags", () => {
    assert.equal(pickDefaultScanProtectionEnabled(null, { scanProtectionEnabled: false }), false);
    assert.equal(pickDefaultScanProtectionEnabled({}, null), true);
  });
});
