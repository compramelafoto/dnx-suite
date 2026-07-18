/**
 * Selfcheck de diseño 10D1 — valida contratos estáticos (sin I/O a DB).
 */
import {
  CLICKATON_REGISTRATION_MVP_ENTITIES,
  CLICKATON_ROLE_CAPABILITIES,
  REGISTRATION_TRANSITIONS,
  type ClickatonQrPayload,
  type ClickatonVisibleCodeFormat,
} from "./contracts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`design.selfcheck: ${msg}`);
}

function main() {
  assert(CLICKATON_REGISTRATION_MVP_ENTITIES.includes("ClickatonRegistration"), "registration entity");
  assert(CLICKATON_REGISTRATION_MVP_ENTITIES.includes("ClickatonQrToken"), "qr token entity");
  assert(CLICKATON_REGISTRATION_MVP_ENTITIES.includes("ClickatonCheckIn"), "checkin entity");
  assert(
    CLICKATON_REGISTRATION_MVP_ENTITIES.includes("ClickatonKitDelivery"),
    "kit delivery entity",
  );
  assert(
    !CLICKATON_ROLE_CAPABILITIES.ACCREDITATION_OPERATOR.includes("payment.refund"),
    "accreditation must not refund",
  );
  assert(
    !CLICKATON_ROLE_CAPABILITIES.KIT_OPERATOR.includes("pricing.manage"),
    "kit op must not manage pricing",
  );
  assert(
    CLICKATON_ROLE_CAPABILITIES.ADMIN_GENERAL.includes("exports.pii"),
    "admin may export pii",
  );

  const confirmed = REGISTRATION_TRANSITIONS.filter((t) => t.to === "CONFIRMED");
  assert(confirmed.some((t) => t.actor === "payments_webhook"), "webhook can confirm");
  assert(
    !REGISTRATION_TRANSITIONS.some(
      (t) => t.action === "browser_return" && t.to === "CONFIRMED",
    ),
    "browser return must not confirm",
  );

  const format: ClickatonVisibleCodeFormat = {
    editionPrefix: "COR26",
    sequenceWidth: 5,
    example: "COR26-00428",
  };
  assert(format.example.includes(format.editionPrefix), "visible code format");

  const qr: ClickatonQrPayload = { strategy: "OPAQUE_TOKEN", token: "x".repeat(32) };
  assert(qr.strategy === "OPAQUE_TOKEN", "qr strategy");
  assert(qr.token.length >= 32, "opaque token length");

  console.log("clickaton registration design.selfcheck: ok");
}

main();
