/**
 * Genera los cuatro correos del regalo como archivos HTML, para mirarlos.
 * No manda nada: usa el modo de sólo armado.
 *
 * Uso: tsx scripts/gift-email-preview.ts <carpeta-de-salida>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sendGiftEmail, type GiftEmailKind } from "@/lib/gift-vouchers/notifications/gift-email";

const CASOS: Array<{ kind: GiftEmailKind; archivo: string; titulo: string }> = [
  { kind: "gift_purchased_buyer", archivo: "1-al-que-regala.html", titulo: "Al que regala" },
  {
    kind: "gift_invitation_recipient",
    archivo: "2-al-amigo.html",
    titulo: "Al amigo (la invitación)",
  },
  {
    kind: "gift_redeemed_buyer",
    archivo: "3-tu-amigo-activo.html",
    titulo: "Al que regala, cuando se activa",
  },
  {
    kind: "gift_reminder_recipient",
    archivo: "4-recordatorio.html",
    titulo: "Recordatorio al amigo",
  },
];

async function main() {
  const salida = process.argv[2];
  if (!salida) throw new Error("Falta la carpeta de salida.");
  mkdirSync(salida, { recursive: true });

  const indice: string[] = [];

  for (const caso of CASOS) {
    const mail = await sendGiftEmail({
      kind: caso.kind,
      to: "ejemplo@example.test",
      buyerName: "Ana",
      recipientName: "Beto",
      editionName: "Clickatón - Navidad 2026 - 2º Edición",
      voucherCode: "REGALO-7K3M-9QX2",
      giftMessage: "¡Feliz cumple! Salí a sacar fotos con esto.",
      editionDate: "26/12/2026",
      redeemedByName: "Beto Gómez",
      dryRunBuildOnly: true,
    });

    writeFileSync(
      join(salida, caso.archivo),
      `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${caso.titulo}</title></head><body style="margin:0;background:#222;">
<div style="padding:16px 24px;background:#000;color:#fff;font-family:Helvetica,Arial,sans-serif;">
  <p style="margin:0;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:.08em;">${caso.titulo}</p>
  <p style="margin:6px 0 0;font-size:15px;"><strong>Asunto:</strong> ${mail.subject}</p>
</div>
${mail.html}
</body></html>`,
      "utf8",
    );

    indice.push(
      `<li style="margin:0 0 12px;"><a href="${caso.archivo}" style="color:#F9B114;">${caso.titulo}</a><br><span style="color:#999;font-size:13px;">${mail.subject}</span></li>`,
    );
    console.log(`  ${caso.archivo} — ${mail.subject}`);
  }

  writeFileSync(
    join(salida, "index.html"),
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Correos del regalo</title></head>
<body style="margin:0;padding:32px;background:#111;color:#fff;font-family:Helvetica,Arial,sans-serif;">
<h1 style="font-size:22px;">Los cuatro correos del regalo</h1>
<p style="color:#999;">Así los ve la persona. Generados con el código real, sin enviar nada.</p>
<ul style="list-style:none;padding:0;margin:24px 0 0;">${indice.join("")}</ul>
</body></html>`,
    "utf8",
  );

  console.log(`\nListo: ${join(salida, "index.html")}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
