/**
 * Crea combos pagados por fuera para un álbum y genera el link único de cada familia.
 *
 * Uso:
 *   tsx scripts/canje-externo/crear-combos.ts --album 1045 --input familias.json --out links.json \
 *     [--unidades 3] [--tamano "15x21 cm"] [--sin-digital] [--dry-run]
 *
 * `familias.json`: [{ "student": "Josefina Altamirano", "parent": "María Jimena", "phone": "3415320475" }]
 *
 * Por defecto el combo es de 3 impresas 15x21 con su digital. Cada familia
 * queda como un Order PREVENTA_PACK pagado en $0 (ver lib/canje-externo/external-voucher.ts).
 * El token sólo existe en la salida de este script: en la base queda su hash. Guardá el
 * archivo de salida fuera del repo.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { CheckoutPaymentSource, OrderOrigin, OrderStatus, type Prisma } from "@prisma/client";
import { createPackAccessTokenForOrder } from "@/lib/preventa-canjeable/pack-access-tokens";
import {
  EXTERNAL_VOUCHER_KIND,
  type ExternalVoucherRefs,
} from "@/lib/canje-externo/external-voucher";
import {
  buildCanjeWhatsAppMessage,
  buildWhatsAppUrl,
  telefonoWhatsAppArgentina,
} from "@/lib/canje-externo/canje-whatsapp";

type Familia = { student: string; parent: string; phone: string };

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

function telefonoWhatsApp(phone: string): string {
  const tel = telefonoWhatsAppArgentina(phone);
  if (!tel) throw new Error(`Teléfono inválido (tiene que tener 10 dígitos con el código de área): ${phone}`);
  return tel;
}

async function main() {
  const albumId = Number(arg("album"));
  const input = arg("input");
  const out = arg("out");
  const dryRun = process.argv.includes("--dry-run");
  const unidades = Number(arg("unidades") ?? 3);
  const tamano = (arg("tamano") ?? "15x21 cm").trim();
  const conDigital = !process.argv.includes("--sin-digital");
  if (!Number.isInteger(unidades) || unidades < 1) throw new Error("--unidades tiene que ser un entero ≥ 1");
  const tamanoCorto = tamano.replace(/\s*cm$/i, "");
  const descripcion = `${unidades} ${unidades === 1 ? "foto impresa" : "fotos impresas"} ${tamanoCorto}${
    conDigital ? " con su digital" : ""
  }`;
  const baseUrl = (process.env.CANJE_BASE_URL || "https://www.compramelafoto.com").replace(/\/+$/, "");
  if (!Number.isInteger(albumId) || !input || !out) {
    throw new Error("Faltan --album, --input o --out");
  }

  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: { id: true, title: true, publicSlug: true, deletedAt: true },
  });
  if (!album || album.deletedAt) throw new Error(`Álbum ${albumId} no encontrado`);

  const familias = JSON.parse(readFileSync(input, "utf8")) as Familia[];
  // Validar todo antes de escribir nada: un teléfono mal cargado no deja combos a medias.
  for (const f of familias) {
    if (!f.student?.trim() || !f.parent?.trim()) throw new Error(`Familia incompleta: ${JSON.stringify(f)}`);
    telefonoWhatsApp(f.phone);
  }
  console.log(`${familias.length} familias para "${album.title}"${dryRun ? " (dry-run, no escribe)" : ""}`);
  if (dryRun) {
    for (const f of familias) console.log(" -", f.student, "|", f.parent, "|", telefonoWhatsApp(f.phone));
    return;
  }

  const salida = [];
  for (const f of familias) {
    const refs: ExternalVoucherRefs = {
      kind: EXTERNAL_VOUCHER_KIND,
      printUnits: unidades,
      size: tamano,
      includesDigital: conDigital,
      studentName: f.student.trim(),
      parentName: f.parent.trim(),
      label: descripcion,
    };
    const order = await prisma.order.create({
      data: {
        albumId,
        // Obligatorio en el esquema; el email real lo carga la familia al canjear.
        buyerEmail: "sin-email@canje-externo.invalid",
        buyerName: `${f.parent.trim()} (familia de ${f.student.trim()})`,
        buyerPhone: f.phone.replace(/\D/g, ""),
        status: OrderStatus.PAID,
        totalCents: 0,
        platformCommissionCents: 0,
        origin: OrderOrigin.PREVENTA_PACK,
        checkoutPaymentSource: CheckoutPaymentSource.PREPAID_PACK,
        redemptionPaymentRefsJson: refs as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    const token = await createPackAccessTokenForOrder(order.id, { ttlDays: 60 });
    if (!token) throw new Error(`No se pudo crear el link del combo ${order.id}`);
    // Página propia del canje: guía a la familia paso a paso y respeta las reglas de acceso
    // del álbum (selfie en álbumes de fotos ocultas, links de álbumes no listados).
    const link = `${baseUrl}/canje/${token.token}`;
    const mensaje = buildCanjeWhatsAppMessage({
      parentName: f.parent,
      studentName: f.student,
      albumTitle: album.title,
      comboLabel: descripcion,
      printUnits: unidades,
      link,
    });
    salida.push({
      comboOrderId: order.id,
      student: f.student.trim(),
      parent: f.parent.trim(),
      phone: f.phone,
      link,
      expiresAt: token.expiresAt,
      whatsapp: buildWhatsAppUrl(f.phone, mensaje),
      mensaje,
    });
    console.log(` ✓ combo ${order.id} · ${f.student}`);
  }
  writeFileSync(out, JSON.stringify(salida, null, 2));
  console.log(`Links guardados en ${out}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
