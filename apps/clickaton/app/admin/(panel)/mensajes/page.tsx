import Link from "next/link";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminDataTable, type AdminDataTableColumn } from "@/components/admin/AdminDataTable";
import { Badge } from "@/components/ui/Badge";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { contactReasonLabel } from "@/lib/contact/reasons";
import {
  countUnreadContactMessages,
  listContactMessages,
  type ContactMessageListItem,
} from "@/lib/contact/queries";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

export default async function AdminMessagesPage() {
  await requireClickatonAdmin();

  const [listResult, unreadResult] = await Promise.all([
    listContactMessages(),
    countUnreadContactMessages(),
  ]);

  if (!listResult.ok) {
    return (
      <div className="space-y-8">
        <AdminPageHeader
          title="Mensajes"
          description="Casilla de consultas del formulario público."
          breadcrumbs={[{ label: "Mensajes" }]}
        />
        <AdminEmptyState
          title="Casilla no disponible"
          description={listResult.message}
          note="Aplicá la migración de ClickatonContactMessage si todavía no corrió."
        />
      </div>
    );
  }

  const rows = listResult.data;
  const unread = unreadResult.ok ? unreadResult.data : 0;

  const columns: AdminDataTableColumn<ContactMessageListItem>[] = [
    {
      key: "status",
      header: "Estado",
      cell: (row) =>
        row.isRead ? (
          <Badge variant="neutral">Leído</Badge>
        ) : (
          <Badge variant="brand">Nuevo</Badge>
        ),
    },
    {
      key: "name",
      header: "Nombre",
      cell: (row) => (
        <div>
          <Link
            href={`${adminRoutes.messages}/${row.id}`}
            className="font-semibold text-ck-text hover:text-ck-yellow"
          >
            {row.name}
          </Link>
          {row.company ? (
            <p className="mt-1 text-xs text-ck-text-muted">{row.company}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      cell: (row) => (
        <a href={`mailto:${row.email}`} className="text-ck-yellow hover:underline">
          {row.email}
        </a>
      ),
    },
    {
      key: "reason",
      header: "Motivo",
      cell: (row) => contactReasonLabel(row.reason),
    },
    {
      key: "createdAt",
      header: "Fecha",
      cell: (row) => formatDate(row.createdAt),
    },
  ];

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Mensajes"
        description="Consultas del formulario de contacto y Formá parte. Respondé por email al remitente."
        breadcrumbs={[{ label: "Mensajes" }]}
      />

      <p className="ck-body-sm text-ck-text-secondary">
        {unread > 0
          ? `${unread} sin leer · ${rows.length} en total`
          : `${rows.length} mensajes · ninguno pendiente`}
      </p>

      {rows.length === 0 ? (
        <AdminEmptyState
          title="Sin mensajes todavía"
          description="Cuando alguien complete el formulario de contacto o Formá parte, aparece acá."
        />
      ) : (
        <AdminDataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          emptyMessage="Sin mensajes."
          mobileCard={(row) => (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Link
                  href={`${adminRoutes.messages}/${row.id}`}
                  className="font-semibold text-ck-text hover:text-ck-yellow"
                >
                  {row.name}
                </Link>
                {row.isRead ? (
                  <Badge variant="neutral">Leído</Badge>
                ) : (
                  <Badge variant="brand">Nuevo</Badge>
                )}
              </div>
              <p className="text-sm text-ck-text-secondary">{row.email}</p>
              <p className="text-sm text-ck-text-muted">
                {contactReasonLabel(row.reason)} · {formatDate(row.createdAt)}
              </p>
            </div>
          )}
        />
      )}
    </div>
  );
}
