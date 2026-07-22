import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveMessageButton } from "@/components/admin/messages/ArchiveMessageButton";
import { MarkReadButton } from "@/components/admin/messages/MarkReadButton";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { prisma, withClickatonDb } from "@/lib/admin/db";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { contactReasonLabel } from "@/lib/contact/reasons";
import { getContactMessageById } from "@/lib/contact/queries";

type Props = {
  params: Promise<{ id: string }>;
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(value);
}

export default async function AdminMessageDetailPage({ params }: Props) {
  await requireClickatonAdmin();
  const { id } = await params;
  const result = await getContactMessageById(id);
  if (!result.ok || !result.data) notFound();

  const message = result.data;
  if (!message.isRead) {
    await withClickatonDb(async () =>
      prisma.clickatonContactMessage.update({
        where: { id: message.id },
        data: { isRead: true, readAt: new Date() },
      }),
    );
    message.isRead = true;
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title={message.name}
        description={contactReasonLabel(message.reason)}
        breadcrumbs={[
          { label: "Mensajes", href: adminRoutes.messages },
          { label: message.name },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3">
        {message.isRead ? (
          <Badge variant="neutral">Leído</Badge>
        ) : (
          <Badge variant="brand">Nuevo</Badge>
        )}
        <Badge variant="neutral">Origen: {message.source}</Badge>
        {!message.isRead ? <MarkReadButton messageId={message.id} /> : null}
        <ArchiveMessageButton messageId={message.id} />
        <Link
          href={adminRoutes.messages}
          className="text-sm text-ck-text-secondary hover:text-ck-yellow"
        >
          Volver al listado
        </Link>
      </div>

      <Card className="space-y-6">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="ck-label text-ck-text-muted">Email</dt>
            <dd className="mt-2">
              <a href={`mailto:${message.email}`} className="text-ck-yellow hover:underline">
                {message.email}
              </a>
            </dd>
          </div>
          <div>
            <dt className="ck-label text-ck-text-muted">Teléfono</dt>
            <dd className="mt-2 text-ck-text">{message.phone || "—"}</dd>
          </div>
          <div>
            <dt className="ck-label text-ck-text-muted">Empresa</dt>
            <dd className="mt-2 text-ck-text">{message.company || "—"}</dd>
          </div>
          <div>
            <dt className="ck-label text-ck-text-muted">Fecha</dt>
            <dd className="mt-2 text-ck-text">{formatDate(message.createdAt)}</dd>
          </div>
        </dl>

        <div>
          <h2 className="ck-heading-md">Mensaje</h2>
          <p className="ck-body-md mt-4 whitespace-pre-wrap text-ck-text-secondary">
            {message.message}
          </p>
        </div>
      </Card>
    </div>
  );
}
