import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTechnicalInfo } from "@/components/admin/AdminTechnicalInfo";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { presentarInterruptorDeAcreditacion } from "@/lib/accreditation/ui/accreditation-switch";
import { prisma } from "@/lib/admin/db";
import {
  registerDeviceAction,
  toggleAccreditationAction,
  syncOfflineAction,
} from "@/lib/accreditation/actions";
import {
  ensureAccreditationConfig,
  getAccreditationDashboard,
} from "@/lib/accreditation/service";

type Props = { params: Promise<{ editionId: string }> };

export default async function EditionAccreditationPage({ params }: Props) {
  const user = await requireClickatonAdmin();
  const { editionId } = await params;
  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    select: { id: true, name: true },
  });
  if (!edition) notFound();

  await ensureAccreditationConfig(editionId);
  const dash = await getAccreditationDashboard(editionId, {
    id: user.id,
    email: user.email,
    globalRole: user.globalRole,
  });

  const interruptor = presentarInterruptorDeAcreditacion({
    habilitado: dash.window.enabled,
    ingresosRegistrados: dash.totals.checkedIn,
    ventanaAbierta: dash.window.canCheckIn === true,
  });

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title={`Acreditación · ${edition.name}`}
        description="Operación de sede con credenciales y código QR. Deshabilitada por defecto. El check-in no altera el pago."
        breadcrumbs={[
          { label: "Ediciones", href: adminRoutes.editions },
          { label: edition.name, href: `${adminRoutes.editions}/${editionId}` },
          { label: "Acreditación" },
        ]}
        actions={
          <>
            <Button href={`${adminRoutes.editions}/${editionId}/acreditacion/escanear`} variant="primary" className="min-h-11">
              Escanear credencial
            </Button>
            <Button
              href={`/api/admin/editions/${editionId}/accreditation/export`}
              variant="secondary"
            >
              Exportar CSV
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Inscriptos", dash.totals.registered],
          ["Pagos confirmados", dash.totals.paid],
          ["Acreditados", dash.totals.checkedIn],
          ["Sin acreditar", dash.totals.notCheckedIn],
          ["Kits entregados", dash.totals.kitDelivered],
          ["Kits pendientes", dash.totals.kitPending],
        ].map(([label, value]) => (
          <Card key={String(label)} variant="outlined" className="space-y-1 p-4">
            <p className="text-xs uppercase tracking-wide text-ck-text-muted">{label}</p>
            <p className="text-2xl font-semibold">{value}</p>
          </Card>
        ))}
      </div>

      <Card variant="outlined" className="space-y-3 p-5 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={interruptor.tono}>{interruptor.estado}</Badge>
              <span className="text-ck-text-secondary">
                Horario de acreditación:{" "}
                <strong>
                  {dash.window.canCheckIn == null
                    ? "a confirmar"
                    : dash.window.canCheckIn
                      ? "abierto"
                      : "cerrado"}
                </strong>
              </span>
            </div>
            <p className="text-ck-text-muted">{interruptor.explicacion}</p>
          </div>

          <form action={toggleAccreditationAction.bind(null, editionId)}>
            <input
              type="hidden"
              name="enabled"
              value={interruptor.accion === "ENCENDER" ? "true" : "false"}
            />
            {interruptor.pideConfirmacion && interruptor.textoDeConfirmacion ? (
              <ConfirmSubmitButton
                confirmMessage={interruptor.textoDeConfirmacion}
                variant="outline"
                size="sm"
              >
                {interruptor.etiquetaDelBoton}
              </ConfirmSubmitButton>
            ) : (
              <Button
                type="submit"
                variant={interruptor.accion === "ENCENDER" ? "primary" : "outline"}
                size="sm"
              >
                {interruptor.etiquetaDelBoton}
              </Button>
            )}
          </form>
        </div>
        <p className="text-ck-text-secondary">
          El código QR se utiliza durante la acreditación para identificar al participante.
        </p>
        <p className="text-ck-text-muted">
          Identidad:{" "}
          {dash.config?.identityMode === "VISUAL" || !dash.config?.identityMode
            ? "Verificación visual"
            : dash.config.identityMode}{" "}
          · Geofence:{" "}
          {dash.config?.geofenceMode === "OFF" || !dash.config?.geofenceMode
            ? "Sin geofence"
            : dash.config.geofenceMode}
        </p>
      </Card>

      <Card variant="outlined" className="space-y-4 p-5">
        <h2 className="font-semibold">Dispositivos</h2>
        <form action={registerDeviceAction.bind(null, editionId)} className="flex flex-wrap gap-3">
          <input
            name="name"
            placeholder="Nombre del dispositivo"
            className="rounded border border-ck-border bg-transparent px-3 py-2 text-sm"
            required
          />
          <Button type="submit" size="sm" variant="secondary">
            Registrar dispositivo
          </Button>
        </form>
        <ul className="space-y-2 text-sm">
          {dash.devices.map((d) => (
            <li key={d.id} className="flex flex-wrap justify-between gap-2 border-b border-ck-border py-2">
              <span>
                {d.name} · {d.status}
              </span>
              <span className="text-xs text-ck-text-muted">
                visto {d.lastSeenAt ?? "—"}
              </span>
            </li>
          ))}
          {dash.devices.length === 0 ? (
            <li className="text-ck-text-muted">Sin dispositivos registrados.</li>
          ) : null}
        </ul>
        <form action={syncOfflineAction.bind(null, editionId)}>
          <Button type="submit" size="sm" variant="outline">
            Sincronizar cola offline
          </Button>
        </form>
      </Card>

      <Card variant="outlined" className="space-y-3 p-5">
        <h2 className="font-semibold">Remeras por talle (operativo)</h2>
        <p className="text-sm text-ck-text-secondary">{dash.stockOperational.note}</p>
        <ul className="space-y-2 text-sm">
          {Object.entries(dash.stockOperational.bySize).map(([size, row]) => (
            <li key={size} className="flex flex-wrap justify-between gap-2 border-b border-ck-border py-2">
              <span>{size}</span>
              <span className="text-ck-text-muted">
                reservadas {row.reserved} · entregadas {row.delivered} · pendientes {row.pending}
              </span>
            </li>
          ))}
          {Object.keys(dash.stockOperational.bySize).length === 0 ? (
            <li className="text-ck-text-muted">Sin ítems de kit aún.</li>
          ) : null}
        </ul>
        <p className="text-sm text-ck-text-secondary">
          Stock físico configurado:{" "}
          {dash.stockOperational.configuredPhysicalStock ?? "no cargado (no inventar)"}
        </p>
      </Card>

      <AdminTechnicalInfo
        rows={[
          {
            label: "Hora del servidor",
            value: String(dash.window.serverNow ?? "—"),
            mono: true,
          },
          {
            label: "Modo identidad (interno)",
            value: dash.config?.identityMode ?? "VISUAL",
            mono: true,
          },
          {
            label: "Geofence (interno)",
            value: dash.config?.geofenceMode ?? "OFF",
            mono: true,
          },
        ]}
      />
    </div>
  );
}
