import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { EstadoCoberturaChip, EstadoSolicitudChip } from "@/components/coberturas/estado-chip";
import { LugarConfirmado } from "@/components/coberturas/lugar-confirmado";
import { requireCoveragesReviewer } from "@/lib/coverages/access";
import { listEvents } from "@/lib/coverages/events";
import { datetimeLocalValue, sugerirCobertura, sugerirRoles } from "@/lib/coverages/generar-cobertura";
import { fechaHoraArgentina } from "@/lib/coverages/format";
import { recomendarRefuerzo } from "@/lib/coverages/reinforcement";
import { choiceOptionValue, choiceValueLabel, requestFieldByKey } from "@/lib/coverages/request-fields";
import { loadRequest, loadSettings } from "@/lib/coverages/repository";
import { coverageEventLabel, requestStatusLabel } from "@/lib/coverages/states";
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
 *
 * **El orden de la pantalla es el orden del trabajo**: primero qué hay que hacer con este pedido,
 * después la cobertura que sale de él, y recién al final los datos y el historial. Antes la
 * decisión era la cuarta tarjeta y había que bajar buscándola; quien coordina entraba a decidir y
 * lo primero que encontraba era la dirección del evento.
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
  const puedeCoordinar = canCoordinateCoverages(role);
  const muestraCoberturas = solicitud.coverages.length > 0 || solicitud.status === "APROBADA";

  return (
    <div className="space-y-6">
      <PageHeader
        title={solicitud.eventTitle}
        description={`${solicitud.publicCode} · ${fechaHoraArgentina(solicitud.startsAt)}`}
        actions={
          <Link href="/coberturas" className="fo-btn fo-btn-secondary text-sm">
            Volver a la bandeja
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <EstadoSolicitudChip status={solicitud.status} />
      </div>

      {refuerzo ? (
        <p className="fo-card fo-alert-warning p-4 text-sm leading-relaxed">
          <strong>Conviene sumar gente.</strong> {refuerzo.reason} Te recomendamos armar el
          equipo con {refuerzo.recommended} personas. Podés seguir con menos: te vamos a pedir
          que dejes una observación.
        </p>
      ) : null}

      {/*
        La advertencia de que ya hay otra cobertura se calcula acá y viaja al panel: es el dato
        que puede cambiar la decisión, y hasta ahora vivía tres tarjetas más abajo, entre la
        dirección y los momentos importantes.
      */}
      <EvaluacionPanel
        id={solicitud.id}
        status={solicitud.status}
        puedeCoordinar={puedeCoordinar}
        infoRequested={solicitud.infoRequested}
        advertenciaOtraCobertura={advertirOtraCobertura(solicitud.otherCoverage)}
      />

      {muestraCoberturas ? (
        <section className="fo-card space-y-3 p-5">
          <h2 className="text-base font-semibold">Coberturas de este pedido</h2>
          {solicitud.coverages.length === 0 ? (
            <p className="text-sm text-[var(--fo-muted)]">
              Todavía no se generó ninguna. Es el paso que sigue: acá abajo.
            </p>
          ) : (
            <ul className="space-y-2">
              {solicitud.coverages.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/coberturas/c/${c.id}`}
                    className="fo-card flex flex-wrap items-center justify-between gap-2 !p-3 hover:bg-[var(--fo-surface-hover)]"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{c.title}</span>
                      <span className="block text-sm text-[var(--fo-muted)]">
                        {fechaHoraArgentina(c.startsAt)} a {fechaHoraArgentina(c.endsAt)}
                      </span>
                    </span>
                    <EstadoCoberturaChip status={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {/*
        Se genera desde APROBADA y la solicitud no cambia de estado al hacerlo (ver
        `planGenerarCobertura`): por eso el bloque sigue disponible aunque ya haya coberturas —
        una jornada de dos turnos son dos coberturas de la misma solicitud.
      */}
      {solicitud.status === "APROBADA" && puedeCoordinar ? (
        <GenerarCoberturaPanel
          requestId={solicitud.id}
          yaHayCoberturas={solicitud.coverages.length > 0}
          sugerido={{
            title: sugerirCobertura(solicitud).title,
            startsAt: datetimeLocalValue(solicitud.startsAt),
            endsAt: datetimeLocalValue(solicitud.endsAt),
            addressLine: solicitud.addressLine ?? "",
            city: solicitud.city ?? "",
            // El punto viaja con la dirección: si se copiara una sin el otro, la cobertura
            // quedaría con la parte ambigua del dato y sin la que saca la duda.
            latitude: sugerirCobertura(solicitud).latitude,
            longitude: sugerirCobertura(solicitud).longitude,
          }}
          rolesSugeridos={sugerirRoles(solicitud, settings)}
        />
      ) : null}

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">La actividad</h2>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Dato
            label="Cuándo"
            valor={`${fechaHoraArgentina(solicitud.startsAt)} a ${fechaHoraArgentina(solicitud.endsAt)}`}
          />
          {/*
            El lugar ya no es una línea de texto: es la dirección, el punto que confirmó la
            organización y un enlace que lo abre en la aplicación de mapas. Una dirección bien
            escrita igual es ambigua —un predio puede tener tres accesos— y esto es lo que
            después mira quien va a cubrir.
          */}
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">Dónde</dt>
            <dd>
              <LugarConfirmado
                direccion={
                  [solicitud.addressLine, solicitud.city].filter(Boolean).join(", ") || "—"
                }
                latitude={solicitud.latitude}
                longitude={solicitud.longitude}
              />
            </dd>
          </div>
          {/*
            Las tres respuestas de elección, leídas con la etiqueta que vio quien contestó y no
            con el valor que guarda la base: "Confirmo que NO habrá otros fotógrafos" es una
            respuesta; "SIN_OTRA_COBERTURA" es un identificador.

            Si ya hay otra cobertura, es lo primero que mira quien prioriza; hasta acá había que
            abrir la base para enterarse. Las solicitudes anteriores a estas preguntas no las
            tienen, y ahí muestran un guión: no se preguntó.
          */}
          <Dato label="Lugar" valor={eleccionLegible("venueKind", solicitud.venueKind)} />
          <Dato
            label="Otra cobertura"
            valor={eleccionLegible("otherCoverage", solicitud.otherCoverage)}
          />
          <Dato
            label="Nos autorizan a difundir"
            valor={eleccionLegible("showcaseScope", solicitud.showcaseScope)}
            ancho
          />
          <Dato label="Qué esperan" valor={solicitud.purpose ?? "—"} ancho />
          <Dato label="Momentos importantes" valor={solicitud.keyMoments ?? "—"} ancho />
        </dl>
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Quién lo pide</h2>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
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
        </dl>
      </section>

      <section className="fo-card space-y-3 p-5">
        <h2 className="text-base font-semibold">Permisos que dio</h2>
        <ul className="space-y-1.5 text-sm">
          {solicitud.consents.map((c) => (
            <li key={c.id} className="flex gap-2">
              <span aria-hidden className={c.granted ? "text-[var(--fo-success)]" : "text-[var(--fo-muted-soft)]"}>
                {c.granted ? "✓" : "✗"}
              </span>
              <span className={c.granted ? "" : "text-[var(--fo-muted)]"}>
                {CONSENT_LABELS[c.kind as ConsentKind] ?? c.kind}{" "}
                <span className="text-xs text-[var(--fo-muted-soft)]">({c.textVersion})</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

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

/**
 * Lo que hay que saber antes de tomar un pedido, si la organización lo contestó.
 *
 * Sólo dos de las tres respuestas ameritan un aviso: que ya haya otro equipo cubriendo, y que no
 * lo sepan. La tercera —«confirmo que no habrá otros»— es la respuesta esperada y no hace falta
 * repetirla al lado del botón: está en «La actividad», como todo lo demás.
 *
 * Se lee el valor del catálogo y no el texto guardado entero, porque una respuesta de «Otros»
 * guarda la aclaración detrás (ver `choiceOptionValue`).
 */
function advertirOtraCobertura(guardado: string | null): string | null {
  switch (choiceOptionValue(guardado)) {
    case "HAY_OTRA_COBERTURA":
      return "la organización avisó que va a haber otro fotógrafo o equipo de foto/video cubriendo el evento.";
    case "NO_LO_SE":
      return "la organización no pudo confirmar si va a haber otro equipo cubriendo el evento.";
    default:
      return null;
  }
}

/**
 * Cómo se lee una respuesta de elección guardada.
 *
 * El guión no es un adorno: distingue "no se preguntó" de una respuesta vacía, que en este
 * módulo no existe —o se eligió una opción, o el campo estaba oculto—.
 */
function eleccionLegible(key: string, guardado: string | null): string {
  const campo = requestFieldByKey(key);
  if (!campo) return "—";
  return choiceValueLabel(campo, guardado) ?? "—";
}

/**
 * Un dato, con su nombre arriba y en gris.
 *
 * Antes iba todo en un renglón —«Dónde: Av. Siempreviva 742, Springfield»— y en un teléfono las
 * respuestas largas cortaban donde caía, mezclando el nombre del dato con el dato. Arriba y
 * abajo se leen las dos cosas.
 */
function Dato({ label, valor, ancho }: { label: string; valor: string; ancho?: boolean }) {
  return (
    <div className={ancho ? "sm:col-span-2" : undefined}>
      <dt className="text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">{label}</dt>
      <dd className="text-sm leading-relaxed">{valor}</dd>
    </div>
  );
}
