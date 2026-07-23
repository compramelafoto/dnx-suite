import assert from "node:assert/strict";
import {
  deriveRegistrationQrPlaintext,
  hashQrPlaintext,
  issueRegistrationQrToken,
} from "./qr-token";

process.env.CLICKATON_QR_TOKEN_SECRET =
  process.env.CLICKATON_QR_TOKEN_SECRET || "test-qr-secret-11b-xxxxxxxx";

const a = issueRegistrationQrToken({
  registrationId: "reg_1",
  credentialId: "cred_1",
});
const b = issueRegistrationQrToken({
  registrationId: "reg_1",
  credentialId: "cred_1",
});
assert.equal(a.plaintext, b.plaintext, "QR must be regenerable");
assert.equal(a.tokenHash, hashQrPlaintext(a.plaintext));
assert.notEqual(
  a.plaintext,
  issueRegistrationQrToken({
    registrationId: "reg_2",
    credentialId: "cred_1",
  }).plaintext,
  "different registration → different QR",
);
assert.equal(
  deriveRegistrationQrPlaintext({
    registrationId: "reg_1",
    credentialId: "cred_1",
  }),
  a.plaintext,
);
assert.ok(!a.plaintext.includes("reg_1"), "no raw registration id in QR");
assert.ok(a.plaintext.length >= 32);

console.log("qr-token.selfcheck OK");
