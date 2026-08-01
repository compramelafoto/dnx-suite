import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { looksLikeRawStatusEnum } from "@/lib/public-ux/status-presentation";
import {
  displayAdminValue,
  presentAdminFulfillmentStatus,
  presentAdminOperationalSummary,
  presentAdminPaymentStatus,
  presentAdminRegistrationStatus,
  presentAdminResendClassification,
  presentAdminWelcomeCardStatus,
} from "./admin-status-presentation";

const ROOT = join(process.cwd());

describe("presentAdminRegistrationStatus", () => {
  it("shows Spanish labels without raw enums", () => {
    for (const status of [
      "DRAFT",
      "PENDING_PAYMENT",
      "CONFIRMED",
      "WAITLISTED",
      "CANCELLED",
      "REFUNDED",
      "DISQUALIFIED",
      "EXPIRED",
      "REFUND_REQUESTED",
    ] as const) {
      const p = presentAdminRegistrationStatus(status);
      assert.equal(looksLikeRawStatusEnum(p.label), false, status);
      assert.ok(p.description.length > 8);
      assert.ok(p.attention);
    }
  });
});

describe("presentAdminPaymentStatus", () => {
  it("maps payment states in Spanish with attention levels", () => {
    const approved = presentAdminPaymentStatus("APPROVED");
    assert.match(approved.label, /aprobado|recibido|acreditado|pagado/i);
    assert.equal(approved.attention, "ok");

    const pending = presentAdminPaymentStatus("PENDING");
    assert.match(pending.label, /pendiente/i);
    assert.equal(pending.attention, "action");

    for (const status of [
      "NOT_REQUIRED",
      "PROCESSING",
      "FAILED",
      "EXPIRED",
      "CANCELLED",
      "REFUNDED",
      "MANUAL_REVIEW",
    ] as const) {
      assert.equal(
        looksLikeRawStatusEnum(presentAdminPaymentStatus(status).label),
        false,
        status,
      );
    }
  });
});

describe("presentAdminOperationalSummary", () => {
  it("derives presentation-only summaries", () => {
    assert.equal(
      presentAdminOperationalSummary({
        registrationStatus: "CONFIRMED",
        paymentStatus: "APPROVED",
        fulfillmentStatus: "DELIVERED",
      }).key,
      "all_set",
    );
    assert.equal(
      presentAdminOperationalSummary({
        registrationStatus: "CONFIRMED",
        paymentStatus: "APPROVED",
        fulfillmentStatus: "PENDING",
      }).key,
      "kit_pending",
    );
    assert.equal(
      presentAdminOperationalSummary({
        registrationStatus: "PENDING_PAYMENT",
        paymentStatus: "PENDING",
      }).key,
      "incomplete",
    );
    assert.equal(
      presentAdminOperationalSummary({
        registrationStatus: "CANCELLED",
        paymentStatus: "CANCELLED",
      }).key,
      "cancelled",
    );
    assert.equal(
      presentAdminOperationalSummary({
        registrationStatus: "CONFIRMED",
        paymentStatus: "FAILED",
      }).key,
      "payment_review",
    );
  });

  it("never exposes raw enums in summary labels", () => {
    const cases = [
      { registrationStatus: "CONFIRMED", paymentStatus: "APPROVED", fulfillmentStatus: "PENDING" },
      { registrationStatus: "DRAFT", paymentStatus: "PENDING" },
      { registrationStatus: "WAITLISTED", paymentStatus: "NOT_REQUIRED" },
      { registrationStatus: "CANCELLED", paymentStatus: "CANCELLED" },
    ] as const;
    for (const c of cases) {
      const s = presentAdminOperationalSummary(c);
      assert.equal(looksLikeRawStatusEnum(s.label), false, s.label);
    }
  });
});

describe("presentAdminFulfillmentStatus / welcome / resend", () => {
  it("translates kit and welcome card states", () => {
    assert.match(presentAdminFulfillmentStatus("DELIVERED").label, /entregado/i);
    assert.match(presentAdminFulfillmentStatus("PENDING").label, /pendiente/i);
    assert.equal(presentAdminWelcomeCardStatus("GENERATED").label, "Placa disponible");
    assert.equal(presentAdminWelcomeCardStatus("PENDING").label, "Placa pendiente");
    assert.match(presentAdminResendClassification("BOUNCED").label, /rebot/i);
  });
});

describe("displayAdminValue", () => {
  it("avoids nullish technical placeholders", () => {
    assert.equal(displayAdminValue(null), "No informado");
    assert.equal(displayAdminValue(""), "No informado");
    assert.equal(displayAdminValue("hola"), "hola");
  });
});

describe("admin registrations UI source contracts", () => {
  it("list uses mobile cards and no wide min-width table", () => {
    const list = readFileSync(
      join(ROOT, "app/admin/(panel)/inscripciones/page.tsx"),
      "utf8",
    );
    assert.match(list, /RegistrationListMobileCard/);
    assert.match(list, /mobileCard/);
    assert.match(list, /registrationStatusLabel|presentAdminRegistrationStatus/);
    assert.doesNotMatch(list, /min-w-\[640px\]|min-w-\[720px\]|min-w-\[880px\]/);
    assert.match(list, /No hay inscripciones todavía/);
    assert.match(list, /No encontramos resultados/);
  });

  it("mobile card shows participant, summary, payment and accreditation cue", () => {
    const card = readFileSync(
      join(ROOT, "components/admin/registrations/RegistrationListMobileCard.tsx"),
      "utf8",
    );
    assert.match(card, /presentAdminOperationalSummary/);
    assert.match(card, /presentAdminPaymentStatus/);
    assert.match(card, /Acreditación/);
    assert.match(card, /Abrir inscripción/);
    assert.doesNotMatch(card, /min-w-\[/);
  });

  it("filters panel can open and close secondary filters", () => {
    const filters = readFileSync(
      join(ROOT, "components/admin/registrations/RegistrationFiltersPanel.tsx"),
      "utf8",
    );
    assert.match(filters, /Más filtros/);
    assert.match(filters, /Ocultar filtros/);
    assert.match(filters, /aria-expanded/);
    assert.match(filters, /Limpiar filtros/);
    assert.match(filters, /activeChips/);
  });

  it("detail uses human labels, concrete actions and collapsed technical info", () => {
    const detail = readFileSync(
      join(ROOT, "app/admin/(panel)/inscripciones/[registrationId]/page.tsx"),
      "utf8",
    );
    assert.match(detail, /Inscripción de \$\{reg\.firstName\}/);
    assert.match(detail, /AdminTechnicalInfo/);
    assert.match(detail, /Nombre y apellido/);
    assert.match(detail, /Correo electrónico/);
    assert.match(detail, /Usuario de Instagram/);
    assert.match(detail, /Fotografía de perfil/);
    assert.match(detail, /Fecha de inscripción/);
    assert.match(detail, /Marcar como entregado|ItemFulfillmentForm/);
    assert.match(detail, /Reenviar correo/);
    assert.match(detail, /Volver a generar placa|Generar placa/);
    assert.match(detail, /Información técnica|AdminTechnicalInfo/);
    // Labels visibles: no usar nombres de propiedad como copy de UI.
    assert.doesNotMatch(detail, /label=["']instagramHandle["']/);
    assert.doesNotMatch(detail, />instagramHandle</);
    assert.doesNotMatch(detail, />profilePhotoUrl</);
    assert.doesNotMatch(detail, />documentNumber</);
    assert.doesNotMatch(detail, />createdAt</);
    assert.doesNotMatch(detail, /min-w-\[640px\]/);
    assert.doesNotMatch(detail, /\bRegenerar\b/);
    assert.doesNotMatch(detail, /Encolar placa/);
    assert.doesNotMatch(detail, /Resend ID/);
    assert.doesNotMatch(detail, /DNX Payments/);
  });

  it("fulfillment form renames actions and confirms destructive revert", () => {
    const form = readFileSync(
      join(ROOT, "components/admin/registrations/ItemFulfillmentForm.tsx"),
      "utf8",
    );
    assert.match(form, /Marcar como entregado/);
    assert.match(form, /Revertir entrega/);
    assert.match(form, /window\.confirm/);
    assert.doesNotMatch(form, /\bToggle\b|\bExecute\b/);
  });

  it("transition buttons keep confirmation for destructive actions", () => {
    const transitions = readFileSync(
      join(ROOT, "components/admin/registrations/RegistrationTransitionButtons.tsx"),
      "utf8",
    );
    assert.match(transitions, /window\.confirm/);
    assert.match(transitions, /Confirmar inscripción|plan\.label/);
    const plans = readFileSync(
      join(ROOT, "lib/admin-registration/domain/transitions.ts"),
      "utf8",
    );
    assert.match(plans, /Confirmar inscripción/);
    assert.match(plans, /Cancelar inscripción/);
    assert.doesNotMatch(plans, /Pasa a CONFIRMED/);
  });

  it("technical info defaults to closed", () => {
    const tech = readFileSync(
      join(ROOT, "components/admin/AdminTechnicalInfo.tsx"),
      "utf8",
    );
    assert.match(tech, /defaultOpen = false/);
    assert.match(tech, /aria-expanded/);
  });
});
