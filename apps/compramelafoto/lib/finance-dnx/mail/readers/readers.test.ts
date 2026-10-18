import assert from "node:assert/strict";
import test from "node:test";

import { readMail } from "./index";
import { parseAmount, parseEnglishDate } from "./parse";
import type { MailInput, ParsedDoc } from "./types";

// Textos reales recibidos el 18/10/2026, recortados y sin enlaces firmados.
const RECIBIDO = new Date("2026-10-08T18:53:00Z");

function mail(fromAddress: string, subject: string, bodyText: string, receivedAt = RECIBIDO): MailInput {
  return { fromAddress, subject, bodyText, receivedAt };
}

function docs(r: ReturnType<typeof readMail>): ParsedDoc[] {
  assert.ok(r && "docs" in r, `se esperaba un documento leído, llegó ${JSON.stringify(r)}`);
  return r.docs;
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

test("importes con punto o coma decimal y separador de miles", () => {
  assert.equal(parseAmount("45.00"), 45);
  assert.equal(parseAmount("1,234.56"), 1234.56);
  assert.equal(parseAmount("127,31"), 127.31);
  assert.equal(parseAmount("59.197,00"), 59197);
  assert.equal(parseAmount("abc"), null);
});

test("fechas en inglés como las escribe Stripe", () => {
  assert.equal(iso(parseEnglishDate("October 8, 2026")), "2026-10-08");
  assert.equal(iso(parseEnglishDate("March 21, 2026")), "2026-03-21");
  assert.equal(parseEnglishDate("Octubre 8, 2026"), null);
});

test("Stripe: recibo de Anthropic", () => {
  const [d] = docs(
    readMail(
      "anthropic",
      mail(
        '"Anthropic, PBC" <invoice+statements@mail.anthropic.com>',
        "Your receipt from Anthropic, PBC #2659-0290-2988",
        "Anthropic, PBC\r\n\r\nReceipt from Anthropic, PBC $45.00 Paid October 8, 2026 (invoice illustration) Download invoice Download receipt Receipt number 2659-0290-2988 Invoice number 6M9QV0FZ-0005 Payment method - 8598\r\n\r\nReceipt #2659-0290-2988 Prepaid extra usage, Individual plan Qty 1 $45.00 Total $45.00 Amount paid $45.00",
      ),
    ),
  );
  assert.deepEqual(
    { ...d, docDate: iso(d.docDate), paidAt: iso(d.paidAt) },
    {
      kind: "RECIBO",
      amount: 45,
      currency: "USD",
      invoiceNumber: "6M9QV0FZ-0005",
      docDate: "2026-10-08",
      paidAt: "2026-10-08",
      periodYear: 2026,
      periodMonth: 10,
      refunded: null,
      vendorKey: null,
    },
  );
});

test("Stripe: recibo de ElevenLabs con varios conceptos toma el total pagado", () => {
  const [d] = docs(
    readMail(
      "elevenlabs",
      mail(
        '"Eleven Labs Inc." <invoice+statements+acct_1M07hSLmdOdiMXBs@stripe.com>',
        "Your receipt from Eleven Labs Inc. #2172-4103-4959",
        "Receipt from Eleven Labs Inc. $22.00 Paid September 23, 2026 Receipt number 2172-4103-4959 Invoice number C625CFD-0007 Payment method - 2780 Receipt #2172-4103-4959 Aug 23–Sep 23, 2026 Seat Credit Usage Qty 0 $0.00 Sep 23–Oct 23, 2026 Creator (per subscription) Qty 1 $22.00 Total $22.00 Amount paid $22.00",
      ),
    ),
  );
  assert.equal(d.amount, 22);
  assert.equal(d.invoiceNumber, "C625CFD-0007");
  assert.equal(d.periodMonth, 9);
});

test("Stripe: reembolso de Cursor guarda lo pagado, lo devuelto y el mes del servicio", () => {
  const [d] = docs(
    readMail(
      "cursor",
      mail(
        "Cursor <invoice+statements+acct_1Lb5LzB4TZWxSIGU@stripe.com>",
        "Your refund from Cursor #3492-5626",
        "Refund from Cursor $4.27 Refunded on March 21, 2026 Receipt number 3492-5626 Invoice number TGAUGGOE-0006 Refunded to - 8828 Receipt #3492-5626 Feb 27–Mar 27, 2026 Cursor Ultra Qty 1 $200.00 Cursor Pro downgrade credit Qty 1 -$180.00 Total $20.00 Amount paid $20.00 Total refunded without credit note $4.27",
        new Date("2026-03-21T12:00:00Z"),
      ),
    ),
  );
  assert.equal(d.kind, "REEMBOLSO");
  assert.equal(d.amount, 20);
  assert.equal(d.refunded, 4.27);
  assert.equal(d.invoiceNumber, "TGAUGGOE-0006");
  assert.deepEqual([d.periodYear, d.periodMonth], [2026, 2]);
});

test("Stripe: un período que cruza el año toma el año del inicio", () => {
  const [d] = docs(
    readMail(
      "cursor",
      mail(
        "Cursor <invoice+statements+acct_1Lb5LzB4TZWxSIGU@stripe.com>",
        "Your refund from Cursor #1",
        "Refund from Cursor $1.00 Refunded on January 5, 2026 Invoice number X-1 Receipt #1 Dec 20, 2025 – Jan 20, 2026 Cursor Pro Qty 1 $20.00 Total $20.00 Amount paid $20.00",
        new Date("2026-01-05T12:00:00Z"),
      ),
    ),
  );
  assert.deepEqual([d.periodYear, d.periodMonth], [2025, 12]);
});

test("Stripe: Anthropic separa la compra de crédito de la API", () => {
  const [d] = docs(
    readMail(
      "anthropic",
      mail(
        "invoice+statements@mail.anthropic.com",
        "Your receipt from Anthropic, PBC #1",
        "Receipt from Anthropic, PBC $50.00 Paid October 2, 2026 Invoice number API-0001 Receipt #1 Anthropic API credits Qty 1 $50.00 Total $50.00 Amount paid $50.00",
      ),
    ),
  );
  assert.equal(d.vendorKey, "anthropic-api");
});

test("AWS: un pago con su factura y fecha de facturación", () => {
  const [d] = docs(
    readMail(
      "aws",
      mail(
        "Amazon Web Services <payment@aws.com>",
        "Gracias por el pago | Thank you for your payment",
        "Hemos cobrado correctamente el importe de 106.72 USD que intentó pagar el 2026-10-18 por la factura 2810533809 con un saldo pendiente total de 0.00 USD.\r\n\r\nCargos correctos:\r\n- Invoice 2810533809 - Billing Date 2026-08-01 - Charge Amount: 106.72 USD\r\n",
        new Date("2026-10-18T02:22:00Z"),
      ),
    ),
  );
  assert.deepEqual(
    { kind: d.kind, amount: d.amount, inv: d.invoiceNumber, y: d.periodYear, m: d.periodMonth, paid: iso(d.paidAt) },
    { kind: "PAGO_OK", amount: 106.72, inv: "2810533809", y: 2026, m: 8, paid: "2026-10-18" },
  );
});

test("Neon: pago fallido con importe en formato de coma", () => {
  const [d] = docs(
    readMail(
      "neon",
      mail(
        '"Neon, LLC" <noreply@ar.neon.tech>',
        "Payment failed for Neon, LLC invoice (#SWURZY-00008)",
        "Hola DANIEL ANDRES CUART, Hemos tenido un problema al procesar su pago para la factura n.º SWURZY-00008 (127,31 $). Por favor, actualice su cuenta",
        new Date("2026-10-10T00:47:00Z"),
      ),
    ),
  );
  assert.deepEqual([d.kind, d.amount, d.invoiceNumber], ["PAGO_FALLIDO", 127.31, "SWURZY-00008"]);
});

test("Neon: pago recibido sin importe en el cuerpo igual se lee (el importe es opcional)", () => {
  const [d] = docs(
    readMail(
      "neon",
      mail('"Neon, LLC" <noreply@ar.neon.tech>', "Payment received for Neon, LLC invoice (#SWURZY-00001)", "Payment received for Neon, LLC invoice (#SWURZY-00001)"),
    ),
  );
  assert.deepEqual([d.kind, d.amount, d.invoiceNumber], ["PAGO_OK", null, "SWURZY-00001"]);
});

test("Cloudflare: factura disponible en castellano y en inglés", () => {
  const es = docs(
    readMail(
      "cloudflare",
      mail(
        "Cloudflare <noreply@notify.cloudflare.com>",
        "Su factura está disponible",
        "Su factura está lista Detalles de la factura: - ID de la cuenta: f2657 - ID de la factura: IN-80185912 - Vence el: September 21, 2026 - Importe: $41.03 ¿Desea recibir",
      ),
    ),
  )[0];
  assert.deepEqual([es.kind, es.amount, es.invoiceNumber, es.periodMonth], ["FACTURA", 41.03, "IN-80185912", 9]);
  const en = docs(
    readMail(
      "cloudflare",
      mail("Cloudflare <noreply@notify.cloudflare.com>", "Your invoice is available", "Invoice details: - Invoice ID: IN-62978253 - Due on: April 21, 2026 - Amount: $15.56 Want"),
    ),
  )[0];
  assert.deepEqual([en.amount, en.invoiceNumber, en.periodMonth], [15.56, "IN-62978253", 4]);
  const usd = docs(
    readMail(
      "cloudflare",
      mail("Cloudflare <noreply@notify.cloudflare.com>", "Tu factura está disponible", "- ID de la factura: IN-68972593 - Fecha de vencimiento: June 21, 2026 - Importe: 24.20 USD ¿Quieres"),
    ),
  )[0];
  assert.deepEqual([usd.amount, usd.periodMonth], [24.2, 6]);
});

test("Cloudflare: compra confirmada es un pago sin número de factura", () => {
  const [d] = docs(
    readMail("cloudflare", mail("Cloudflare <noreply@notify.cloudflare.com>", "[Confirmación] Compra confirmada", "Compra confirmada Hemos confirmado tu compra de $41.03 con mastercard card.")),
  );
  assert.deepEqual([d.kind, d.amount, d.invoiceNumber], ["PAGO_OK", 41.03, null]);
});

test("Cloudflare: renovación con la tarjeta de reserva es un pago con factura", () => {
  const [d] = docs(
    readMail(
      "cloudflare",
      mail(
        "Cloudflare <noreply@notify.cloudflare.com>",
        "Tu suscripción se renovó con tu método de pago de reserva",
        "La renovación de tu suscripción por $14.76 (factura n.º IN-65876087) no se pudo procesar con tu método de pago principal. Hemos cobrado correctamente tu método de pago de reserva",
      ),
    ),
  );
  assert.deepEqual([d.kind, d.amount, d.invoiceNumber], ["PAGO_OK", 14.76, "IN-65876087"]);
});

test("Cloudflare: pago fallido con número de factura", () => {
  const [d] = docs(
    readMail("cloudflare", mail("Cloudflare <noreply@notify.cloudflare.com>", "[Action Required] Payment failed", "We were unable to process a payment on your Cloudflare account. Invoice: #IN-62978253 We will")),
  );
  assert.deepEqual([d.kind, d.invoiceNumber, d.amount], ["PAGO_FALLIDO", "IN-62978253", null]);
});

test("Cloudflare: la alerta de uso es un estimado del mes en que cierra el período", () => {
  const [d] = docs(
    readMail(
      "cloudflare",
      mail(
        "Cloudflare <noreply@notify.cloudflare.com>",
        "[Alerta] Tu uso medido ha alcanzado tu presupuesto configurado",
        "Detalles del presupuesto - Total actual: $37.40 - Período de facturación: 2026-09-21 hasta 2026-10-21 - Cuenta:",
      ),
    ),
  );
  assert.deepEqual([d.kind, d.amount, d.periodYear, d.periodMonth], ["ESTIMADO", 37.4, 2026, 10]);
});

test("Cloudflare: recordatorios y promociones se descartan", () => {
  const recordatorio = readMail(
    "cloudflare",
    mail("Cloudflare <noreply@notify.cloudflare.com>", "[Acción requerida] Pague antes del October 16 o los servicios serán degradados", "Saldo pendiente: $41.03"),
  );
  assert.ok(recordatorio && "ignore" in recordatorio);
  const promo = readMail("cloudflare", mail("Cloudflare <em@em1.cloudflare.com>", "It's Agents Week.", "Factura disponible $10"));
  assert.ok(promo && "ignore" in promo);
});

test("ChatGPT y CapCut no tienen cobros que leer", () => {
  const gpt = readMail("chatgpt", mail("OpenAI <noreply@tm.openai.com>", "Actualiza tu forma de pago de Plus", "No pudimos procesar tu último pago"));
  assert.ok(gpt && "ignore" in gpt);
  const capcut = readMail("capcut", mail("CapCut <no-reply@account.capcut.com>", "CapCut", "Verification Code 775001"));
  assert.ok(capcut && "ignore" in capcut);
});

test("Vercel: el aviso de pago fallido se descarta pero pide alerta", () => {
  const r = readMail(
    "vercel",
    mail("Vercel <notifications@vercel.com>", "[Action Required] Payment Failed And Shutdown Coming Soon", "We failed to charge your card ending with 8598 for the team compramelafoto's projects."),
  );
  assert.ok(r && "ignore" in r);
  assert.match(r.alert ?? "", /Vercel/);
});

test("un formato desconocido no se inventa: queda para revisar", () => {
  assert.equal(readMail("linkedin", mail("LinkedIn <billing@linkedin.com>", "Gracias por abonarte a Premium Business", "Te adjuntamos el recibo.")), null);
  assert.equal(readMail("anthropic", mail("invoice+statements@mail.anthropic.com", "Your receipt", "sin importe")), null);
});
