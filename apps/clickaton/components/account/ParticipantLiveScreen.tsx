"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ParticipantLiveRefresher } from "@/components/account/ParticipantLiveRefresher";
import { PromptPhotoUpload } from "@/components/account/PromptPhotoUpload";
import { PromptsCountdown } from "@/components/account/PromptsCountdown";
import { useParticipantNotes } from "@/components/account/useParticipantNotes";
import { CAMERA_CLOCK_WARNING_ES } from "@/config/editions/argentina-2026";
import { MAX_NOTE_LENGTH } from "@/lib/participant-notes/domain";
import {
  estaEnviada,
  estaResuelta,
  estaSinConfirmar,
  resolverEstadoConsigna,
  type EstadoConsigna,
} from "@/lib/participant-notes/prompt-state";

/**
 * Pantalla única del participante durante el evento.
 *
 * Una sola estructura, siempre la misma: instrucciones, anotaciones, "Ya la
 * tengo" y la entrega. Lo único que cambia con la hora es qué está habilitado.
 *
 * Redacción sin género: "Ya estás participando", "Acreditación confirmada".
 */

export type LivePromptView = {
  promptId: string | null;
  sequence: number;
  title: string;
  instructions: string | null;
  closed: boolean;
  captureStartsAt: string | null;
  captureEndsAt: string | null;
  uploadEndsAt: string | null;
  /** La ventana de entrega está abierta para esta consigna. */
  uploadWindowOpen: boolean;
  submissionStatus?: string | null;
  validationResult?: string | null;
  tecnica?: {
    dimensiones: string | null;
    captura: string | null;
    camara: string | null;
  } | null;
};

export type ParticipantLiveScreenProps = {
  registrationId: string;
  editionName: string;
  timezone: string;
  firstName: string;
  participantNumber: string | null;
  accreditedAt: string | null;
  promptCount: number;
  serverNow: string;
  gate: { opensAt: string | null; isOpen: boolean };
  prompts: LivePromptView[];
  /** La entrega sigue abierta: se puede anotar, marcar y subir. */
  entregaAbierta: boolean;
  credentialHref: string;
};

const CHIPS: Record<
  EstadoConsigna,
  { variant: "neutral" | "brand" | "success" | "warning" | "danger"; label: string }
> = {
  PENDIENTE: { variant: "neutral", label: "Pendiente" },
  YA_LA_TENGO: { variant: "brand", label: "Ya la tengo" },
  SIN_CONFIRMAR: { variant: "warning", label: "Sin confirmar" },
  ENVIADA: { variant: "success", label: "Enviada" },
  RECHAZADA: { variant: "danger", label: "No admitida" },
};

function formatHora(value: string | null, timezone: string): string {
  if (!value) return "a confirmar";
  return new Date(value).toLocaleTimeString("es-AR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatFechaHora(value: string | null, timezone: string): string {
  if (!value) return "a confirmar";
  const fecha = new Date(value).toLocaleDateString("es-AR", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
  });
  return `${fecha} a las ${formatHora(value, timezone)}`;
}

export function ParticipantLiveHeader({ editionName }: { editionName: string }) {
  return (
    <header className="space-y-4">
      <p className="ck-overline text-ck-yellow">Clickatón · {editionName}</p>
      <h1 className="font-[family-name:var(--font-ck-display)] text-4xl leading-[1.05] text-ck-text sm:text-5xl">
        Ya estás participando
      </h1>
    </header>
  );
}

/** Inscripción sin confirmar: no hay evento que mostrar todavía. */
export function ParticipantLiveInactive({
  editionName,
  credentialHref,
}: {
  editionName: string;
  credentialHref: string;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-14">
      <ParticipantLiveHeader editionName={editionName} />
      <Card variant="outlined" className="space-y-4">
        <h2 className="ck-heading-sm">Tu inscripción todavía no está confirmada</h2>
        <p className="text-sm leading-relaxed text-ck-text-secondary">
          Las consignas se habilitan para las inscripciones confirmadas. Revisá el estado de la
          tuya y, si quedó un pago pendiente, completalo desde ahí.
        </p>
        <Button href={credentialHref} variant="primary" className="min-h-11 w-full sm:w-auto">
          Ver mi inscripción
        </Button>
      </Card>
    </div>
  );
}

/** Falta que el equipo escanee el QR: la pantalla espera sola. */
export function ParticipantLivePending({
  editionName,
  firstName,
  credentialHref,
}: {
  editionName: string;
  firstName: string;
  credentialHref: string;
}) {
  const nombre = firstName.trim();
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-14">
      <ParticipantLiveRefresher />
      <ParticipantLiveHeader editionName={editionName} />
      <Card variant="yellow" className="space-y-4">
        <h2 className="ck-heading-sm">Falta la acreditación en sede</h2>
        <p className="text-sm leading-relaxed text-ck-text-secondary">
          {nombre ? `${nombre}, mostrá` : "Mostrá"} tu código QR en el punto de acreditación.
          Apenas el equipo lo escanee, esta pantalla se actualiza sola y vas a ver acá las
          consignas.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            href={`${credentialHref}#credencial-qr`}
            variant="primary"
            className="min-h-11 w-full sm:w-auto"
          >
            Mostrar mi código QR
          </Button>
          <Button href="/mi-cuenta" variant="secondary" className="min-h-11 w-full sm:w-auto">
            Volver a Mi cuenta
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function ParticipantLiveScreen(props: ParticipantLiveScreenProps) {
  const { notas, estado: estadoGuardado, escribir } = useParticipantNotes(
    props.registrationId,
    props.entregaAbierta,
  );
  const nombre = props.firstName.trim();

  const consignas = useMemo(
    () =>
      props.prompts.map((p) => {
        const nota = p.promptId ? notas[p.promptId] : undefined;
        const solved = nota?.solved ?? false;
        return {
          vista: p,
          body: nota?.body ?? "",
          solved,
          estado: resolverEstadoConsigna({ submissionStatus: p.submissionStatus, solved }),
        };
      }),
    [notas, props.prompts],
  );

  const enviadas = consignas.filter((c) => estaEnviada(c.estado)).length;
  const resueltas = consignas.filter((c) => estaResuelta(c.estado)).length;
  const sinConfirmar = consignas.filter((c) => estaSinConfirmar(c.estado)).length;

  if (!props.gate.isOpen) {
    return (
      <div className="mx-auto max-w-2xl space-y-8 px-4 py-14">
        <ParticipantLiveHeader editionName={props.editionName} />
        <Card variant="yellow" className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">Acreditación confirmada</Badge>
            {props.participantNumber ? (
              <Badge variant="brand">Nº {props.participantNumber}</Badge>
            ) : null}
          </div>
          <p className="text-base leading-relaxed text-ck-text">
            {nombre ? `${nombre}, ya` : "Ya"} estás dentro del evento. Esta es tu pantalla: acá
            aparecen todas las consignas y desde acá subís tus fotos.
          </p>
          {props.accreditedAt ? (
            <p className="text-sm text-ck-text-muted">
              Acreditación registrada el {formatFechaHora(props.accreditedAt, props.timezone)} h.
            </p>
          ) : null}
        </Card>

        <Card variant="outlined" className="space-y-6">
          <div className="space-y-2 text-center">
            <h2 className="ck-heading-sm">Las consignas todavía no están publicadas</h2>
            <p className="text-sm leading-relaxed text-ck-text-secondary">
              Se publican todas juntas, en un solo momento. No hay consignas que se vayan
              soltando de a una.
            </p>
          </div>

          {props.gate.opensAt ? (
            <PromptsCountdown
              opensAtIso={props.gate.opensAt}
              serverNowIso={props.serverNow}
              promptCount={props.promptCount}
              timezone={props.timezone}
            />
          ) : (
            <>
              <ParticipantLiveRefresher intervalMs={20000} />
              <p className="rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface px-4 py-3 text-center text-sm leading-relaxed text-ck-text-secondary">
                El horario de apertura todavía no está publicado. Dejá esta pantalla abierta: se
                actualiza sola cuando la organización lo confirme.
              </p>
            </>
          )}

          <AvisoRelojCamara />
        </Card>

        <PieDeAcciones credentialHref={props.credentialHref} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16">
      {/* Barra de estado del día: lo único que cambia con la hora. */}
      <div className="sticky top-0 z-20 -mx-4 mb-6 border-b border-ck-border bg-ck-bg/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="ck-overline text-ck-yellow">
              {props.entregaAbierta ? "Podés subir tus fotos" : "Entrega cerrada"}
            </p>
            <p className="mt-1 text-xs text-ck-text-muted">
              {props.entregaAbierta
                ? `La entrega cierra a las ${formatHora(props.prompts[0]?.uploadEndsAt ?? null, props.timezone)} h`
                : "Ya no se pueden subir ni cambiar fotos"}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-[family-name:var(--font-ck-display)] text-2xl leading-none tabular-nums text-ck-text">
              {enviadas}
              <span className="text-ck-text-muted">/{props.prompts.length}</span>
            </p>
            <p className="ck-overline mt-1 text-ck-text-muted">enviadas</p>
            <p className="mt-0.5 text-[11px] tabular-nums text-ck-text-muted">
              {resueltas} {resueltas === 1 ? "resuelta" : "resueltas"}
            </p>
          </div>
        </div>
      </div>

      {/* Una foto subida y sin confirmar no compite: hay que decirlo fuerte. */}
      {sinConfirmar > 0 ? (
        <p
          role="alert"
          className={`mb-6 rounded-[var(--ck-radius-card)] border px-4 py-3 text-sm leading-relaxed ${
            props.entregaAbierta
              ? "border-[var(--ck-warning)]/60 bg-[var(--ck-warning-soft)] text-[var(--ck-warning)]"
              : "border-[var(--ck-danger)]/60 bg-[var(--ck-danger-soft)] text-[var(--ck-danger)]"
          }`}
        >
          {props.entregaAbierta
            ? `Te ${sinConfirmar === 1 ? "queda 1 foto subida" : `quedan ${sinConfirmar} fotos subidas`} sin confirmar. Si no ${sinConfirmar === 1 ? "la confirmás" : "las confirmás"} antes del cierre, no ${sinConfirmar === 1 ? "compite" : "compiten"}.`
            : `${sinConfirmar === 1 ? "Quedó 1 foto subida" : `Quedaron ${sinConfirmar} fotos subidas`} sin confirmar. No ${sinConfirmar === 1 ? "entró" : "entraron"} al concurso.`}
        </p>
      ) : null}

      <header className="mb-6 space-y-3">
        <p className="ck-overline text-ck-yellow">Clickatón · {props.editionName}</p>
        <h1 className="font-[family-name:var(--font-ck-display)] text-4xl leading-[1.05] text-ck-text">
          Ya estás participando
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success">Acreditación confirmada</Badge>
          {props.participantNumber ? (
            <Badge variant="brand">Nº {props.participantNumber}</Badge>
          ) : null}
        </div>
        <p className="text-sm leading-relaxed text-ck-text-secondary">
          {props.entregaAbierta
            ? "Estas son tus consignas, todas disponibles desde ahora. Abrí cada una para leerla, anotar y subir tu foto."
            : "Acá queda tu participación: lo que enviaste y lo que fuiste anotando."}
        </p>
      </header>

      {estadoGuardado === "pendiente" ? (
        <p className="mb-6 rounded-[var(--ck-radius-card)] border border-[var(--ck-warning)]/50 bg-[var(--ck-warning-soft)] px-4 py-3 text-sm leading-relaxed text-[var(--ck-warning)]">
          Sin conexión. Lo que escribís queda guardado en este dispositivo y se sincroniza solo
          cuando vuelva la señal.
        </p>
      ) : null}

      <AvisoRelojCamara className="mb-6" />

      {consignas.length === 0 ? (
        <Card variant="outlined" className="space-y-3">
          <ParticipantLiveRefresher />
          <h2 className="ck-heading-sm">Todavía no hay consignas cargadas</h2>
          <p className="text-sm leading-relaxed text-ck-text-secondary">
            Dejá esta pantalla abierta: se actualiza sola en cuanto la organización las publique.
          </p>
        </Card>
      ) : (
        <ol className="space-y-3">
          {consignas.map((c) => (
            <li key={c.vista.sequence}>
              <TarjetaConsigna
                vista={c.vista}
                estado={c.estado}
                body={c.body}
                solved={c.solved}
                timezone={props.timezone}
                registrationId={props.registrationId}
                entregaAbierta={props.entregaAbierta}
                estadoGuardado={estadoGuardado}
                onChange={(cambio) =>
                  c.vista.promptId ? escribir(c.vista.promptId, cambio) : undefined
                }
              />
            </li>
          ))}
        </ol>
      )}

      {!props.entregaAbierta ? (
        <p className="mt-8 text-center text-xs leading-relaxed text-ck-text-muted">
          Tus anotaciones quedan disponibles 30 días después del cierre de la entrega. Después se
          borran.
        </p>
      ) : null}

      <PieDeAcciones credentialHref={props.credentialHref} className="mt-8" />
    </div>
  );
}

function AvisoRelojCamara({ className = "" }: { className?: string }) {
  return (
    <p
      className={`rounded-[var(--ck-radius-card)] border border-ck-yellow/40 bg-[var(--ck-brand-primary-soft)] px-4 py-3 text-sm leading-relaxed text-ck-text ${className}`}
      role="note"
    >
      {CAMERA_CLOCK_WARNING_ES}
    </p>
  );
}

function PieDeAcciones({
  credentialHref,
  className = "",
}: {
  credentialHref: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-3 border-t border-ck-border pt-6 sm:flex-row ${className}`}
    >
      <Button href={credentialHref} variant="secondary" className="min-h-11 w-full sm:w-auto">
        Ver mi credencial y QR
      </Button>
      <Button href="/contacto" variant="outline" className="min-h-11 w-full sm:w-auto">
        Pedir ayuda
      </Button>
    </div>
  );
}

function TarjetaConsigna({
  vista,
  estado,
  body,
  solved,
  timezone,
  registrationId,
  entregaAbierta,
  estadoGuardado,
  onChange,
}: {
  vista: LivePromptView;
  estado: EstadoConsigna;
  body: string;
  solved: boolean;
  timezone: string;
  registrationId: string;
  entregaAbierta: boolean;
  estadoGuardado: string;
  onChange: (cambio: { body?: string; solved?: boolean }) => void;
}) {
  const chip = CHIPS[estado];
  const resumenNota = body.split("\n")[0]?.trim() ?? "";
  const hayFoto = estado === "SIN_CONFIRMAR" || estado === "ENVIADA";
  const puedeSubir = entregaAbierta && vista.uploadWindowOpen && solved;

  return (
    <Card variant="default" className="space-y-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="font-[family-name:var(--font-ck-display)] text-2xl leading-none tabular-nums text-ck-yellow"
        >
          {String(vista.sequence).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <h3 className="ck-heading-sm break-words">{vista.title}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={chip.variant}>{chip.label}</Badge>
            {resumenNota ? (
              <span className="min-w-0 flex-1 truncate text-xs text-ck-text-muted">
                ✎ {resumenNota}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {vista.instructions ? (
        <p className="whitespace-pre-line text-sm leading-relaxed text-ck-text-secondary">
          {vista.instructions}
        </p>
      ) : null}

      <dl className="grid gap-2 border-t border-ck-border pt-4 text-xs text-ck-text-muted sm:grid-cols-2">
        <div>
          <dt className="inline">Tomar la foto entre </dt>
          <dd className="inline">
            {formatHora(vista.captureStartsAt, timezone)} y{" "}
            {formatHora(vista.captureEndsAt, timezone)} h
          </dd>
        </div>
        <div>
          <dt className="inline">Subirla hasta </dt>
          <dd className="inline">{formatHora(vista.uploadEndsAt, timezone)} h</dd>
        </div>
      </dl>

      <Cuaderno
        valor={body}
        editable={entregaAbierta}
        estadoGuardado={estadoGuardado}
        onChange={(v) => onChange({ body: v })}
      />

      <TengoLaFoto
        marcada={solved || hayFoto}
        bloqueada={hayFoto}
        habilitada={entregaAbierta}
        onChange={(v) => onChange({ solved: v })}
      />

      {vista.promptId ? (
        <PromptPhotoUpload
          registrationId={registrationId}
          promptId={vista.promptId}
          sequence={vista.sequence}
          title={vista.title}
          canUpload={puedeSubir}
          blockedReason={
            !entregaAbierta || !vista.uploadWindowOpen
              ? "La entrega está cerrada."
              : !solved
                ? "Marcá “Ya la tengo” para habilitar la entrega."
                : null
          }
          submissionStatus={vista.submissionStatus}
          validationResult={vista.validationResult}
          tecnica={vista.tecnica ?? null}
          showClockWarning={false}
        />
      ) : null}
    </Card>
  );
}

/**
 * El check que habilita la entrega.
 * Queda tildado y bloqueado una vez que hay foto subida.
 */
function TengoLaFoto({
  marcada,
  bloqueada,
  habilitada,
  onChange,
}: {
  marcada: boolean;
  bloqueada: boolean;
  habilitada: boolean;
  onChange: (v: boolean) => void;
}) {
  const activo = habilitada && !bloqueada;
  return (
    <label
      className={`flex items-start gap-3 rounded-[var(--ck-radius-card)] border px-4 py-3 ${
        marcada ? "border-ck-yellow/50 bg-[var(--ck-brand-primary-soft)]" : "border-ck-border"
      } ${activo ? "cursor-pointer" : "cursor-default opacity-70"}`}
    >
      <input
        type="checkbox"
        checked={marcada}
        disabled={!activo}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-5 shrink-0 accent-[var(--ck-brand-primary)]"
      />
      <span className="text-sm text-ck-text">
        Ya la tengo
        <span className="mt-0.5 block text-xs text-ck-text-muted">
          {bloqueada
            ? "La subiste, así que queda marcada."
            : "Marcala cuando tengas la foto hecha. Recién ahí se habilita la entrega."}
        </span>
      </span>
    </label>
  );
}

function Cuaderno({
  valor,
  editable,
  estadoGuardado,
  onChange,
}: {
  valor: string;
  editable: boolean;
  estadoGuardado: string;
  onChange: (v: string) => void;
}) {
  if (!editable) {
    return (
      <div className="space-y-2">
        <p className="ck-overline text-ck-text-muted">Tus anotaciones</p>
        <p className="whitespace-pre-line rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface-muted px-4 py-3 text-sm leading-relaxed text-ck-text-secondary">
          {valor.trim() || "No anotaste nada en esta consigna."}
        </p>
      </div>
    );
  }

  const leyenda =
    estadoGuardado === "guardando"
      ? "Guardando…"
      : estadoGuardado === "pendiente"
        ? "Guardado en este dispositivo · se sincroniza al volver la señal"
        : estadoGuardado === "guardado"
          ? "Guardado"
          : "";

  return (
    <div className="space-y-2">
      <p className="ck-overline text-ck-text-muted">Tus anotaciones · solo las ves vos</p>
      <textarea
        rows={4}
        value={valor}
        maxLength={MAX_NOTE_LENGTH}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Dónde la viste, qué te falta, a qué hora volver…"
        aria-label="Tus anotaciones de esta consigna"
        className="w-full rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface-muted px-4 py-3 text-sm leading-relaxed text-ck-text placeholder:text-ck-text-muted focus:border-ck-yellow focus:outline-none"
      />
      <p
        className={`text-right text-xs ${
          estadoGuardado === "pendiente" ? "text-[var(--ck-warning)]" : "text-ck-text-muted"
        }`}
        role="status"
      >
        {leyenda || " "}
      </p>
    </div>
  );
}
