/**
 * Script para enviar emails de respuestas de soporte que no se enviaron.
 * Ejecutar: npx tsx scripts/backfill-support-emails.ts
 * Requiere: .env con EMAIL_FROM, RESEND_API_KEY
 *
 * Incluye tickets sin requesterEmail: intenta obtener el email desde
 * printOrder.customerEmail, printOrder.client.email o el primer mensaje del usuario.
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { sendEmail } from "../emails/send";
import { buildSupportReplyEmail } from "../emails/templates/support-reply";
import { getSupportUrlForRole } from "../lib/support-url";

function resolveRecipientEmail(
  ticket: {
    requesterEmail: string | null;
    printOrder?: {
      customerEmail: string | null;
      client: { email: string } | null;
    } | null;
    messages?: { authorId: number | null; authorEmail: string | null; author: { email: string } | null }[];
  },
  adminUserIds: number[]
): string | null {
  if (ticket.requesterEmail?.trim()) return ticket.requesterEmail.trim().toLowerCase();

  if (ticket.printOrder) {
    if (ticket.printOrder.customerEmail?.trim())
      return ticket.printOrder.customerEmail.trim().toLowerCase();
    if (ticket.printOrder.client?.email?.trim())
      return ticket.printOrder.client.email.trim().toLowerCase();
  }

  // Primer mensaje del usuario (no admin): authorEmail o author.email
  const userMessages = (ticket.messages ?? []).filter(
    (m) => m.authorId == null || !adminUserIds.includes(m.authorId)
  );
  for (const m of userMessages) {
    const email = m.authorEmail?.trim() || m.author?.email?.trim();
    if (email) return email.toLowerCase();
  }

  return null;
}

async function main() {
  console.log("Buscando tickets con respuestas de admin que no recibieron email...");

  const adminUserIds = await prisma.user
    .findMany({ where: { role: "ADMIN" }, select: { id: true } })
    .then((u) => u.map((x) => x.id));

  const ticketsWithAdminMsg = await prisma.supportTicket.findMany({
    where: {
      lastReplyEmailSentAt: null,
      messages: {
        some: {
          authorId: { not: null },
          isInternal: false,
        },
      },
    },
    include: {
      printOrder: {
        select: {
          customerEmail: true,
          client: { select: { email: true } },
        },
      },
      messages: {
        where: { isInternal: false },
        orderBy: { createdAt: "asc" },
        select: {
          authorId: true,
          authorEmail: true,
          author: { select: { email: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const ticketsToProcess: typeof ticketsWithAdminMsg = [];
  for (const t of ticketsWithAdminMsg) {
    const adminMsg = await prisma.supportMessage.findFirst({
      where: {
        ticketId: t.id,
        authorId: { in: adminUserIds },
        isInternal: false,
      },
      orderBy: { createdAt: "desc" },
    });
    if (adminMsg) ticketsToProcess.push(t);
  }

  console.log(`Encontrados ${ticketsToProcess.length} tickets para enviar.`);

  let sent = 0;
  let errors = 0;
  let skipped = 0;

  for (const ticket of ticketsToProcess) {
    const toEmail = resolveRecipientEmail(ticket, adminUserIds);
    if (!toEmail) {
      console.log(`  ⊘ Ticket #${ticket.id}: sin email (requester: ${ticket.requesterName ?? "?"})`);
      skipped++;
      continue;
    }

    const latestAdminMsg = await prisma.supportMessage.findFirst({
      where: {
        ticketId: ticket.id,
        authorId: { in: adminUserIds },
        isInternal: false,
      },
      orderBy: { createdAt: "desc" },
      include: { author: { select: { name: true } } },
    });
    if (!latestAdminMsg) continue;

    try {
      const supportUrl = getSupportUrlForRole(ticket.requesterRole);
      const { subject, html } = buildSupportReplyEmail({
        requesterName: ticket.requesterName,
        ticketId: ticket.id,
        message: latestAdminMsg.message,
        supportUrl,
        adminName: latestAdminMsg.author?.name,
      });

      await sendEmail({
        to: toEmail,
        subject,
        html,
        templateKey: "SUPPORT_REPLY",
      });

      await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: { lastReplyEmailSentAt: new Date() },
      });

      sent++;
      console.log(`  ✓ Ticket #${ticket.id} → ${toEmail}`);
    } catch (err) {
      errors++;
      console.error(`  ✗ Ticket #${ticket.id}:`, err);
    }
  }

  console.log(`\nCompletado: ${sent} enviados, ${errors} errores${skipped ? `, ${skipped} omitidos (sin email)` : ""}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
