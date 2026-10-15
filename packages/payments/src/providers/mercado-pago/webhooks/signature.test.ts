import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import {
  buildMercadoPagoWebhookManifest,
  normalizeMercadoPagoDataId,
  parseMercadoPagoSignatureHeader,
  verifyMercadoPagoWebhookSignature,
} from "./signature.js";

const SECRET = "test-mp-webhook-secret-not-real";

function sign(manifest: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(manifest).digest("hex");
}

function header(ts: string, v1: string): string {
  return `ts=${ts},v1=${v1}`;
}

describe("verifyMercadoPagoWebhookSignature", () => {
  it("acepta firma válida", () => {
    const dataId = "169962120634";
    const requestId = "req-abc-123";
    const ts = "1700000000000";
    const manifest = buildMercadoPagoWebhookManifest({ dataId, requestId, ts });
    const v1 = sign(manifest);
    const result = verifyMercadoPagoWebhookSignature({
      signatureHeader: header(ts, v1),
      requestIdHeader: requestId,
      dataId,
      secret: SECRET,
    });
    assert.equal(result.ok, true);
  });

  it("acepta firma válida con orden distinto de propiedades en x-signature", () => {
    const dataId = "12345";
    const requestId = "rid-1";
    const ts = "1700000000001";
    const manifest = buildMercadoPagoWebhookManifest({ dataId, requestId, ts });
    const v1 = sign(manifest);
    const result = verifyMercadoPagoWebhookSignature({
      signatureHeader: `v1=${v1},ts=${ts}`,
      requestIdHeader: requestId,
      dataId,
      secret: SECRET,
    });
    assert.equal(result.ok, true);
  });

  it("rechaza firma inválida", () => {
    const result = verifyMercadoPagoWebhookSignature({
      signatureHeader: header("1700000000000", "00".repeat(32)),
      requestIdHeader: "rid",
      dataId: "1",
      secret: SECRET,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "signature_mismatch");
  });

  it("rechaza firma ausente", () => {
    const result = verifyMercadoPagoWebhookSignature({
      signatureHeader: null,
      requestIdHeader: "rid",
      dataId: "1",
      secret: SECRET,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "missing_signature");
  });

  it("rechaza data.id ausente", () => {
    const ts = "1700000000000";
    const result = verifyMercadoPagoWebhookSignature({
      signatureHeader: header(ts, "deadbeef"),
      requestIdHeader: "rid",
      dataId: null,
      secret: SECRET,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "missing_data_id");
  });

  it("rechaza x-request-id ausente", () => {
    const ts = "1700000000000";
    const result = verifyMercadoPagoWebhookSignature({
      signatureHeader: header(ts, "deadbeef"),
      requestIdHeader: null,
      dataId: "1",
      secret: SECRET,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "missing_request_id");
  });

  it("rechaza secret incorrecto", () => {
    const dataId = "99";
    const requestId = "rid-x";
    const ts = "1700000000002";
    const manifest = buildMercadoPagoWebhookManifest({ dataId, requestId, ts });
    const v1 = sign(manifest, SECRET);
    const result = verifyMercadoPagoWebhookSignature({
      signatureHeader: header(ts, v1),
      requestIdHeader: requestId,
      dataId,
      secret: "wrong-secret",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "signature_mismatch");
  });

  it("normaliza data.id alfanumérico a minúsculas", () => {
    assert.equal(
      normalizeMercadoPagoDataId("ORD01JQ4S4KY8HWQ6NA5PXB65B3D3"),
      "ord01jq4s4ky8hwq6na5pxb65b3d3",
    );
    assert.equal(normalizeMercadoPagoDataId("169962120634"), "169962120634");
  });

  it("parsea x-signature con espacios", () => {
    const parsed = parseMercadoPagoSignatureHeader(" ts=1 , v1=abc ");
    assert.equal(parsed.ts, "1");
    assert.equal(parsed.v1, "abc");
  });

  it("rechaza timestamp fuera de tolerancia", () => {
    const dataId = "1";
    const requestId = "r";
    const ts = "1000";
    const manifest = buildMercadoPagoWebhookManifest({ dataId, requestId, ts });
    const v1 = sign(manifest);
    const result = verifyMercadoPagoWebhookSignature({
      signatureHeader: header(ts, v1),
      requestIdHeader: requestId,
      dataId,
      secret: SECRET,
      maxSkewMs: 60_000,
      nowMs: 10_000_000,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "timestamp_out_of_tolerance");
  });
});


describe("verifyMercadoPagoWebhookSignature — data.id en mayúsculas (tópico order)", () => {
  const secret = "s3cr3t-de-prueba";
  const ts = "1700000000000";
  const requestId = "req-order-1";
  const orderId = "ORDTST01M2R3ABCD";

  function firmar(dataId: string): string {
    return createHmac("sha256", secret)
      .update(`id:${dataId};request-id:${requestId};ts:${ts};`)
      .digest("hex");
  }

  it("acepta la firma hecha con el id tal como llega", () => {
    const r = verifyMercadoPagoWebhookSignature({
      signatureHeader: `ts=${ts},v1=${firmar(orderId)}`,
      requestIdHeader: requestId,
      dataId: orderId,
      secret,
    });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.dataIdVariant, "as_received");
  });

  it("sigue aceptando la firma hecha con el id en minúsculas", () => {
    const r = verifyMercadoPagoWebhookSignature({
      signatureHeader: `ts=${ts},v1=${firmar(orderId.toLowerCase())}`,
      requestIdHeader: requestId,
      dataId: orderId,
      secret,
    });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.dataIdVariant, "lowercased");
  });

  it("rechaza una firma que no corresponde a ninguna de las dos", () => {
    const r = verifyMercadoPagoWebhookSignature({
      signatureHeader: `ts=${ts},v1=${"0".repeat(64)}`,
      requestIdHeader: requestId,
      dataId: orderId,
      secret,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "signature_mismatch");
  });
});

describe("verifyMercadoPagoWebhookSignature — manifest sin `id:`", () => {
  const secret = "s3cr3t-de-prueba";
  const ts = "1790721444";
  const requestId = "req-order-9";
  const orderId = "ORDTST01M3QN1DKXZGMKRA4X48HBDS62";

  it("acepta la firma que MP arma cuando no manda data.id en la URL", () => {
    // MP construye el manifest con los parámetros de la query: sin `data.id`
    // ahí, su firma no lleva el segmento `id:` aunque el cuerpo sí lo traiga.
    const v1 = createHmac("sha256", secret)
      .update(`request-id:${requestId};ts:${ts};`)
      .digest("hex");
    const r = verifyMercadoPagoWebhookSignature({
      signatureHeader: `ts=${ts},v1=${v1}`,
      requestIdHeader: requestId,
      dataId: orderId,
      queryDataId: null,
      secret,
    });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.dataIdVariant, "omitted");
  });

  it("prefiere el id de la query cuando MP sí lo manda ahí", () => {
    const v1 = createHmac("sha256", secret)
      .update(`id:${orderId};request-id:${requestId};ts:${ts};`)
      .digest("hex");
    const r = verifyMercadoPagoWebhookSignature({
      signatureHeader: `ts=${ts},v1=${v1}`,
      requestIdHeader: requestId,
      dataId: orderId,
      queryDataId: orderId,
      secret,
    });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.dataIdVariant, "query");
  });
});
