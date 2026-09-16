import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireCoveragesReviewer } from "@/lib/coverages/access";
import { listEvents } from "@/lib/coverages/events";
import { datetimeLocalValue, sugerirCobertura, sugerirRoles } from "@/lib/coverages/generar-cobertura";
import { fechaHoraArgentina } from "@/lib/coverages/format";
import { recomendarRefuerzo } from "@/lib/coverages/reinforcement";
import { loadRequest, loadSettings } from "@/lib/coverages/repository";
import { coverageEventLabel, coverageStatusLabel, requestStatusLabel } from "@/lib/coverages/states";
import { canCoordinateCoverages } from "@/lib/coverages/access-policy";
import { CONSENT_LABELS, type ConsentKind } from "@/lib/coverages/consents";
import { EvaluacionPanel } from "./evaluacion-panel";
import { GenerarCoberturaPanel } from "./generar-cobertura-panel";

export const dynamic = "force-dynamic";

/**
 * La ficha de una solicitud.
 *
 * `loadRequest` ya filtra por `workspaceId` en su `where` (ver `lib/coverages/repository.ts` y
 * la barrera de `aislamiento.test.ts`): una solicitud de otro workspace vuelve `null` acá y
 * cae en `notFound()`, igual que un id inexistente. No hay una segunda consulta ni un campo
 * adicional que pudiera abrir otra puerta.
 */
export default async function FichaSolicitudPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { workspace, role } = await requireCoveragesReviewer();
  const { id } = await params;

  const solicitud = await loadRequest({ workspaceId: workspace.id, id });
  if (!solicitud) notFound();

  const [settings, historial] = await Promise.all([
    loadSettings(workspace.id),
    listEvents({ workspaceId: workspace.id, entityType: "REQUEST", entityId: solicitud.id }),
  ]);

  const duracion = Math.round(
    (solicitud.endsAt.getTime() - solicitud.startsAt.getTime()) / 60000,
  );
  const refuerzo = recomendarRefuerzo({ durationMinutes: duracion, assigned: 0, settings });

  return (
    <div className="space-y-6">
      <PageHeader
        title={solicitud.eventTitle}
        description={`${solicitud.publicCode} · ${requestStatusLabel(solicitud.status)}`}
      />

      {refuerzo ? (
        <p className="fo-card border-l-4 border-l-[var(--fo-accent,#1d4ed8)] p-4 text-sm leading-relaxed">
          <strong>Conviene sumar gente.</strong> {refuerzo.reason} Te recomendamos armar el
          equipo con {refuerzo.recommended} personas. Podés seguir con menos: te vamos a pedir
          que dejes una observación.
        </p>
      ) : null}

      <section className="fo-card space-y-3 p-5">
        <h2 className="text-base font-semibold">La actividad</h2>
        <Dato label="Cuándo" valor={`${fechaHoraArgentina(solicitud.startsAt)} a ${fechaHoraArgentina(solicitud.endsAt)}`} />
        <Dato label="Dónde" valor={[solicitud.addressLine, solicitud.city].filter(Boolean).join(", ") || "—"} />
        <Dato label="Qué esperan" valor={solicitud.purpose ?? "—"} />
        <Dato label="Momentos importantes" valor={solicitud.keyMoments ?? "—"} />
      </section>

      <section className="fo-card space-y-3 p-5">
        <h2 className="text-base font-semibold">Quién lo pide</h2>
        <Dato label="Organización" valor={solicitud.client.businessName ?? "—"} />
        <Dato label="Correo" valor={solicitud.client.email ?? "—"} />
        {/*
          El teléfono y el CUIT de la solicitud van primero, antes que los del padrón de
          clientes: son los que esta organización escribió para ESTE pedido. La ficha del
          cliente puede tener un teléfono de hace dos años (o el de otra persona, si el correo
          coincidió con un cliente que ya existía); el de la solicitud es el de ahora.
        */}
        <Dato label="Teléfono" valor={solicitud.contactPhone ?? solicitud.client.phone ?? "—"} />
        <Dato label="CUIT" valor={solicitud.orgTaxId ?? solicitud.client.docNumber ?? "—"} />
      </section>

      <section className="fo-card space-y-2 p-5">
        <h2 className="text-base font-semibold">Permisos que dio</h2>
        <ul className="space-y-1 text-sm">
          {solicitud.consents.map((c) => (
            <li key={c.id} className="flex gap-2">
              <span aria-hidden>{c.granted ? "✓" : "✗"}</span>
              <span className={c.granted ? "" : "text-[var(--fo-muted)]"}>
                {CONSENT_LABELS[c.kind as ConsentKind] ?? c.kind}{" "}
                <span className="text-xs">({c.textVersion})</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <EvaluacionPanel
        id={solicitud.id}
        status={solicitud.status}
        puedeCoordinar={canCoordinateCoverages(role)}
        infoRequested={solicitud.infoRequested}
      />

      <section className="fo-card space-y-3 p-5">
        <h2 className="text-base font-semibold">Coberturas</h2>
        {solicitud.coverages.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">
            Todavía no se generó ninguna cobertura para este pedido.
          </p>
        ) : (
          <ul className="space-y-2">
            {solicitud.coverages.map((c) => (
              <li key={c.id}>
                <Link href={`/coberturas/c/${c.id}`} className="fo-card block space-y-1 p-3">
                  <p className="font-medium">{c.title}</p>
                  <p className="text-sm text-[var(--fo-muted)]">
                    {fechaHoraArgentina(c.startsAt)} a {fechaHoraArgentina(c.endsAt)}
                    {" · "}
                    {coverageStatusLabel(c.status)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/*
        Se genera desde APROBADA y la solicitud no cambia de estado al hacerlo (ver
        `planGenerarCobertura`): por eso el bloque sigue disponible aunque ya haya coberturas —
        una jornada de dos turnos son dos coberturas de la misma solicitud.
      */}
      {solicitud.status === "APROBADA" && canCoordinateCoverages(role) ? (
        <GenerarCoberturaPanel
          requestId={solicitud.id}
          sugerido={{
            title: sugerirCobertura(solicitud).title,
            startsAt: datetimeLocalValue(solicitud.startsAt),
            endsAt: datetimeLocalValue(solicitud.endsAt),
            addressLine: solicitud.addressLine ?? "",
            city: solicitud.city ?? "",
          }}
          rolesSugeridos={sugerirRoles(solicitud, settings)}
        />
      ) : null}

      <section className="fo-card space-y-3 p-5">
        <h2 className="text-base font-semibold">Historial</h2>
        {historial.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Todavía no pasó nada.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {historial.map((e) => (
              <li key={e.id} className="space-y-0.5">
                <p className="text-xs text-[var(--fo-muted)]">
                  {fechaHoraArgentina(e.createdAt)} · {e.actorLabel ?? "El sistema"}
                </p>
                <p>
                  {coverageEventLabel(e.type)}
                  {e.toStatus ? ` → ${requestStatusLabel(e.toStatus)}` : ""}
                </p>
                {e.note ? <p className="text-[var(--fo-muted)]">{e.note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <p className="text-sm">
      <span className="text-[var(--fo-muted)]">{label}: </span>
      {valor}
    </p>
  );
}
