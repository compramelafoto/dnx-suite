import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateCreateCameraUploadLogAndEnqueueInput } from "./create-camera-upload-log-and-enqueue";

describe("validateCreateCameraUploadLogAndEnqueueInput", () => {
  const valid = {
    userId: 1,
    albumId: 42,
    rawKey: "albums/42/raw/abc-foto.jpg",
    filename: "DSC_0001.JPG",
    filesizeBytes: 2048,
  };

  it("acepta input válido con filesizeBytes", () => {
    assert.equal(validateCreateCameraUploadLogAndEnqueueInput(valid), null);
  });

  it("acepta filesizeBytes null/omitido", () => {
    assert.equal(
      validateCreateCameraUploadLogAndEnqueueInput({ ...valid, filesizeBytes: null }),
      null
    );
    const { filesizeBytes: _, ...withoutSize } = valid;
    assert.equal(validateCreateCameraUploadLogAndEnqueueInput(withoutSize), null);
  });

  it("rechaza userId inválido", () => {
    const error = validateCreateCameraUploadLogAndEnqueueInput({ ...valid, userId: 0 });
    assert.equal(error?.field, "userId");
  });

  it("rechaza albumId inválido", () => {
    const error = validateCreateCameraUploadLogAndEnqueueInput({ ...valid, albumId: -1 });
    assert.equal(error?.field, "albumId");
  });

  it("rechaza rawKey vacío", () => {
    const error = validateCreateCameraUploadLogAndEnqueueInput({ ...valid, rawKey: "  " });
    assert.equal(error?.field, "rawKey");
  });

  it("rechaza rawKey con prefijo incorrecto", () => {
    const error = validateCreateCameraUploadLogAndEnqueueInput({
      ...valid,
      rawKey: "albums/99/raw/foto.jpg",
    });
    assert.equal(error?.field, "rawKey");
    assert.match(error?.message ?? "", /albums\/42\/raw\//);
  });

  it("rechaza filename vacío", () => {
    const error = validateCreateCameraUploadLogAndEnqueueInput({ ...valid, filename: "  " });
    assert.equal(error?.field, "filename");
  });

  it("rechaza filesizeBytes cero", () => {
    const error = validateCreateCameraUploadLogAndEnqueueInput({
      ...valid,
      filesizeBytes: 0,
    });
    assert.equal(error?.field, "filesizeBytes");
  });

  it("rechaza filesizeBytes negativo", () => {
    const error = validateCreateCameraUploadLogAndEnqueueInput({
      ...valid,
      filesizeBytes: -100,
    });
    assert.equal(error?.field, "filesizeBytes");
  });
});
