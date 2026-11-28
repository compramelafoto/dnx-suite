import { test } from "node:test";
import assert from "node:assert/strict";
import {
  asuntoRespuesta,
  cabecerasDeHilo,
  casillaClf,
  clasificar,
  firmarSvix,
  htmlRespuesta,
  leerAviso,
  leerCorreoRecibido,
  verificarSvix,
} from "./parse";

const SECRETO = `whsec_${Buffer.from("clave-de-prueba-123").toString("base64")}`;

test("casillaClf: toma info@ y descarta daniel@ y otros dominios", () => {
  assert.equal(casillaClf(["info@compramelafoto.com"]), "info@compramelafoto.com");
  assert.equal(casillaClf(["Soporte <INFO@compramelafoto.com>"]), "info@compramelafoto.com");
  assert.equal(casillaClf(["daniel@compramelafoto.com"]), null);
  assert.equal(casillaClf(["hola@fotoffice.com"]), null);
  assert.equal(casillaClf(["hola@fotoffice.com"], ["ventas@compramelafoto.com"]), "ventas@compramelafoto.com");
  // Un dominio que sólo termina parecido no cuenta.
  assert.equal(casillaClf(["info@nocompramelafoto.com.ar"]), null);
});

test("leerAviso: sólo email.received con id", () => {
  assert.deepEqual(leerAviso({ type: "email.received", data: { email_id: " abc ", to: ["info@compramelafoto.com"] } }), {
    emailId: "abc",
    to: ["info@compramelafoto.com"],
    cc: [],
  });
  assert.equal(leerAviso({ type: "email.sent", data: { email_id: "abc" } }), null);
  assert.equal(leerAviso({ type: "email.received", data: {} }), null);
  assert.equal(leerAviso(null), null);
});

test("verificarSvix: acepta la firma correcta y rechaza la alterada o vieja", () => {
  const cuerpo = JSON.stringify({ type: "email.received" });
  const ts = "1700000000";
  const firma = firmarSvix(SECRETO, "msg_1", ts, cuerpo);
  const base = { secreto: SECRETO, id: "msg_1", timestamp: ts, cuerpo, ahoraS: 1700000010 };
  assert.equal(verificarSvix({ ...base, firmas: `v1,${firma}` }), true);
  assert.equal(verificarSvix({ ...base, firmas: `v1,otra v1,${firma}` }), true);
  assert.equal(verificarSvix({ ...base, firmas: `v1,${firma}`, cuerpo: cuerpo + " " }), false);
  assert.equal(verificarSvix({ ...base, firmas: `v1,${firma}`, ahoraS: 1700000000 + 3600 }), false);
  assert.equal(verificarSvix({ ...base, firmas: null }), false);
});

test("leerCorreoRecibido: arma el correo con hilo y adjuntos", () => {
  const c = leerCorreoRecibido({
    id: "rcv_1",
    from: '"Mariela V" <Mariela_MVB@hotmail.com>',
    to: ["info@compramelafoto.com"],
    subject: "Re: Tu pedido",
    html: "<p>Hola&nbsp;equipo</p><p>Gracias</p>",
    created_at: "2026-11-27T15:00:00.000Z",
    headers: { "Message-ID": "abc@mail.com", "In-Reply-To": "<x@resend.dev>", References: "<a@r> <x@resend.dev>" },
    attachments: [{ id: "att_1", filename: "foto.jpg", content_type: "image/jpeg", size: 2048 }],
  });
  assert.ok(!("error" in c));
  if ("error" in c) return;
  assert.equal(c.fromEmail, "mariela_mvb@hotmail.com");
  assert.equal(c.fromName, "Mariela V");
  assert.equal(c.text, "Hola equipo\nGracias");
  assert.equal(c.messageId, "<abc@mail.com>");
  assert.equal(c.inReplyTo, "<x@resend.dev>");
  assert.deepEqual(c.references, ["<a@r>", "<x@resend.dev>"]);
  assert.equal(c.attachments[0]?.filename, "foto.jpg");
  assert.equal(c.receivedAt.toISOString(), "2026-11-27T15:00:00.000Z");
  assert.ok("error" in leerCorreoRecibido({ id: "x" }));
});

test("clasificar: rebotes, spam y respuestas automáticas", () => {
  const base = { fromEmail: "x@gmail.com", subject: "Hola", headers: {} as Record<string, string> };
  assert.equal(clasificar(base), "NORMAL");
  assert.equal(clasificar({ ...base, fromEmail: "mailer-daemon@googlemail.com" }), "REBOTE");
  assert.equal(clasificar({ ...base, headers: { "x-ses-spam-verdict": "FAIL" } }), "SPAM");
  assert.equal(clasificar({ ...base, headers: { "auto-submitted": "auto-replied" } }), "AUTOMATICA");
  assert.equal(clasificar({ ...base, headers: { "auto-submitted": "no" } }), "NORMAL");
  assert.equal(clasificar({ ...base, subject: "Respuesta automática: fuera de la oficina" }), "AUTOMATICA");
});

test("asuntoRespuesta y cabecerasDeHilo", () => {
  assert.equal(asuntoRespuesta("Tu pedido"), "Re: Tu pedido");
  assert.equal(asuntoRespuesta("RE: Tu pedido"), "RE: Tu pedido");
  assert.equal(asuntoRespuesta(""), "Re: tu mensaje");
  assert.deepEqual(cabecerasDeHilo({ messageId: null, references: null }), {});
  assert.deepEqual(cabecerasDeHilo({ messageId: "<m@x>", references: "<a@x> <b@x>" }), {
    "In-Reply-To": "<m@x>",
    References: "<a@x> <b@x> <m@x>",
  });
});

test("htmlRespuesta: escapa el texto y cita el original", () => {
  const html = htmlRespuesta({
    cuerpo: "Hola <b>Mariela</b>\n\nSaludos",
    original: { fromEmail: "m@x.com", fromName: "Mariela", receivedAt: new Date("2026-11-27T15:00:00Z"), text: "¿Y mis fotos?" },
  });
  assert.ok(html.includes("Hola &lt;b&gt;Mariela&lt;/b&gt;"));
  assert.ok(html.includes("<p style=\"margin:0 0 12px;\">Saludos</p>"));
  assert.ok(html.includes("Mariela &lt;m@x.com&gt; escribió:"));
  assert.ok(html.includes("¿Y mis fotos?"));
});
