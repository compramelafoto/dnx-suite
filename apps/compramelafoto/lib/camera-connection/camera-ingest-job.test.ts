import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateEnqueueCameraIngestInput } from "./camera-ingest-job";

describe("validateEnqueueCameraIngestInput", () => {
  const valid = {
    userId: 1,
    albumId: 42,
    rawKey: "albums/42/raw/abc-foto.jpg",
    uploadLogId: 10,
  };

  it("acepta input válido", () => {
    assert.equal(validateEnqueueCameraIngestInput(valid), null);
  });

  it("rechaza userId inválido", () => {
    const error = validateEnqueueCameraIngestInput({ ...valid, userId: 0 });
    assert.equal(error?.field, "userId");
  });

  it("rechaza rawKey vacío", () => {
    const error = validateEnqueueCameraIngestInput({ ...valid, rawKey: "  " });
    assert.equal(error?.field, "rawKey");
  });

  it("rechaza rawKey con prefijo incorrecto", () => {
    const error = validateEnqueueCameraIngestInput({
      ...valid,
      rawKey: "albums/99/raw/foto.jpg",
    });
    assert.equal(error?.field, "rawKey");
    assert.match(error?.message ?? "", /albums\/42\/raw\//);
  });

  it("rechaza filesizeBytes negativo", () => {
    const error = validateEnqueueCameraIngestInput({
      ...valid,
      filesizeBytes: -1,
    });
    assert.equal(error?.field, "filesizeBytes");
  });
});
