import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ESCOLAR_ASISTENCIA_REASON,
  buildEscolarAsistenciaDescription,
  buildEscolarAsistenciaWhatsappUrl,
  buildOpenEscolarAsistenciaWhere,
  escolarPromoMode,
  findOpenEscolarAsistenciaTicket,
  isOpenEscolarAsistenciaTicket,
  normalizeAsistenciaMessage,
  normalizeAsistenciaPhone,
} from "@/lib/escolar/asistencia";
import { ALLOWED_REASONS, sanitizeCreateTicketBody } from "@/lib/support/sanitize";
import { getSupportReasonLabel } from "@/lib/support-url";

describe("asistencia escolar — motivo del ticket", () => {
  it("el motivo nuevo está en la lista y conserva los viejos", () => {
    assert.ok((ALLOWED_REASONS as readonly string[]).includes(ESCOLAR_ASISTENCIA_REASON));
    for (const r of ["PAYMENT_FAILED", "ORDER_STATUS", "LAB_ISSUE", "COMMISSION_ISSUE", "TECHNICAL_ISSUE", "OTHER"]) {
      assert.ok((ALLOWED_REASONS as readonly string[]).includes(r));
    }
  });
  it("sanitizeCreateTicketBody lo acepta tal cual", () => {
    const parsed = sanitizeCreateTicketBody(
      { reason: ESCOLAR_ASISTENCIA_REASON, description: "Pedido", requesterPhone: "341 555" },
      { name: "Ana", email: "Ana@Mail.com", role: "PHOTOGRAPHER" }
    );
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.data.reason, ESCOLAR_ASISTENCIA_REASON);
      assert.equal(parsed.data.requesterRole, "PHOTOGRAPHER");
      assert.equal(parsed.data.requesterPhone, "341 555");
    }
  });
  it("el panel lo muestra legible y deja los motivos libres como están", () => {
    assert.equal(getSupportReasonLabel(ESCOLAR_ASISTENCIA_REASON), "Asistencia módulo escolar");
    assert.equal(getSupportReasonLabel("PAYMENT_FAILED"), "Problema con el pago");
    assert.equal(getSupportReasonLabel("Consulta del bot"), "Consulta del bot");
    assert.equal(getSupportReasonLabel(null), "");
  });
});

describe("asistencia escolar — descripción del ticket", () => {
  const base = {
    photographerName: "Estudio Sol",
    phone: "+54 9 341 555-1234",
    message: "Quiero arrancar con el Colegio San José",
    schoolsCount: 2,
    publicPageHandler: "estudio-sol",
    isPublicPageEnabled: true,
  };
  it("incluye pedido, teléfono, mensaje y datos útiles", () => {
    const d = buildEscolarAsistenciaDescription(base);
    assert.match(d, /asistencia para configurar el módulo escolar/);
    assert.match(d, /Fotógrafo: Estudio Sol/);
    assert.match(d, /Teléfono \/ WhatsApp: \+54 9 341 555-1234/);
    assert.match(d, /Instituciones cargadas: 2/);
    assert.match(d, /Landing escolar: activa en \/estudio-sol\/escolar/);
    assert.match(d, /Mensaje del fotógrafo:\nQuiero arrancar con el Colegio San José/);
  });
  it("sin teléfono ni mensaje lo dice y no agrega el bloque", () => {
    const d = buildEscolarAsistenciaDescription({ ...base, phone: null, message: null });
    assert.match(d, /Teléfono \/ WhatsApp: no indicó/);
    assert.doesNotMatch(d, /Mensaje del fotógrafo/);
  });
  it("describe la landing apagada o sin dirección", () => {
    assert.match(
      buildEscolarAsistenciaDescription({ ...base, isPublicPageEnabled: false }),
      /dirección \/estudio-sol definida, pero la página pública está apagada/
    );
    assert.match(
      buildEscolarAsistenciaDescription({ ...base, publicPageHandler: null }),
      /sin dirección pública definida/
    );
  });
  it("no filtra HTML ni cantidades raras", () => {
    const d = buildEscolarAsistenciaDescription({
      ...base,
      photographerName: "<b>Ana</b>",
      schoolsCount: Number.NaN,
    });
    assert.match(d, /Fotógrafo: Ana/);
    assert.match(d, /Instituciones cargadas: 0/);
  });
  it("no incluye email (ya viaja en el ticket)", () => {
    assert.doesNotMatch(buildEscolarAsistenciaDescription(base), /@/);
  });
});

describe("asistencia escolar — normalización", () => {
  it("teléfono: limpia y descarta lo que no tiene números", () => {
    assert.equal(normalizeAsistenciaPhone(" +54 (341) 555-1234 "), "+54 (341) 555-1234");
    assert.equal(normalizeAsistenciaPhone("<script>1</script>"), "1");
    assert.equal(normalizeAsistenciaPhone("sin teléfono"), null);
    assert.equal(normalizeAsistenciaPhone(undefined), null);
    assert.ok((normalizeAsistenciaPhone("1".repeat(100)) ?? "").length <= 40);
  });
  it("mensaje: vacío → null, recorta largo", () => {
    assert.equal(normalizeAsistenciaMessage("   "), null);
    assert.equal(normalizeAsistenciaMessage(" hola "), "hola");
    assert.equal((normalizeAsistenciaMessage("a".repeat(5000)) ?? "").length, 1500);
  });
});

describe("asistencia escolar — duplicados", () => {
  it("abierto = mismo motivo y estado OPEN o IN_PROGRESS", () => {
    assert.equal(isOpenEscolarAsistenciaTicket({ reason: ESCOLAR_ASISTENCIA_REASON, status: "OPEN" }), true);
    assert.equal(isOpenEscolarAsistenciaTicket({ reason: ESCOLAR_ASISTENCIA_REASON, status: "IN_PROGRESS" }), true);
    assert.equal(isOpenEscolarAsistenciaTicket({ reason: ESCOLAR_ASISTENCIA_REASON, status: "RESOLVED" }), false);
    assert.equal(isOpenEscolarAsistenciaTicket({ reason: ESCOLAR_ASISTENCIA_REASON, status: "CLOSED" }), false);
    assert.equal(isOpenEscolarAsistenciaTicket({ reason: "TECHNICAL_ISSUE", status: "OPEN" }), false);
  });
  it("encuentra el abierto entre varios", () => {
    const tickets = [
      { id: 1, reason: ESCOLAR_ASISTENCIA_REASON, status: "CLOSED" },
      { id: 2, reason: "OTHER", status: "OPEN" },
      { id: 3, reason: ESCOLAR_ASISTENCIA_REASON, status: "IN_PROGRESS" },
    ];
    assert.equal(findOpenEscolarAsistenciaTicket(tickets)?.id, 3);
    assert.equal(findOpenEscolarAsistenciaTicket(tickets.slice(0, 2)), null);
  });
  it("el filtro de base busca por email sin distinguir mayúsculas", () => {
    const where = buildOpenEscolarAsistenciaWhere(" Ana@Mail.com ");
    assert.equal(where.reason, ESCOLAR_ASISTENCIA_REASON);
    assert.deepEqual(where.status, { in: ["OPEN", "IN_PROGRESS"] });
    assert.deepEqual(where.requesterEmail, { equals: "ana@mail.com", mode: "insensitive" });
  });
});

describe("asistencia escolar — WhatsApp y variante", () => {
  it("arma el enlace con el número y el texto codificado", () => {
    const url = buildEscolarAsistenciaWhatsappUrl("Estudio Sol");
    assert.ok(url.startsWith("https://wa.me/5493413748324?text="));
    const text = decodeURIComponent(url.split("?text=")[1]);
    assert.equal(
      text,
      "Hola, soy Estudio Sol de ComprameLaFoto y quiero asistencia para configurar mi módulo escolar"
    );
  });
  it("sin nombre usa un texto genérico", () => {
    const text = decodeURIComponent(buildEscolarAsistenciaWhatsappUrl(null).split("?text=")[1]);
    assert.match(text, /^Hola, soy fotógrafo de ComprameLaFoto y quiero asistencia/);
  });
  it("con instituciones propias el módulo está en uso", () => {
    assert.equal(escolarPromoMode(0), "promo");
    assert.equal(escolarPromoMode(null), "promo");
    assert.equal(escolarPromoMode(3), "en-uso");
  });
});
