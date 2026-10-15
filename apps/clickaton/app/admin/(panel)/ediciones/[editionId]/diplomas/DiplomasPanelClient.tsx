"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminDataTable, type AdminDataTableColumn } from "@/components/admin/AdminDataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  generateEditionDiplomasAction,
  regenerateDiplomaAction,
  regenerateDiplomasAction,
  retryDiplomaEmailAction,
  sendEditionDiplomaEmailsAction,
} from "@/lib/admin/editions/diploma-actions";
import {
  presentDiplomaEmailState,
  presentDiplomaRowState,
  type DiplomaRowState,
} from "@/lib/diplomas/ui/diploma-row-presentation";

export type DiplomaPanelRow = {
  registrationId: string;
  fullName: string;
  visibleCode: string | null;
  accreditedAtIso: string;
  state: DiplomaRowState;
  errorCode: string | null;
  /** `id` de `ClickatonDiplomaIssue`. `null` mientras el diploma no se emitió: todavía no hay nada que mandar. */
  diplomaId: string | null;
  /** `ClickatonDiplomaIssue.emailStatus`. `null` = mismo caso que `diplomaId` nulo. */
  emailStatus: string | null;
  /** `true` si el evento del buzón de salida agotó sus reintentos automáticos (quedó "DEAD"). */
  emailDead: boolean;
};

type Props = {
  editionId: string;
  /** `null` = sin plantilla asignada: generar y ver un ejemplo quedan apagados. */
  templateName: string | null;
  /** Cuántos se encolarían ahora mismo si se aprieta "Generar los diplomas". */
  pendingCount: number;
  /** Cuántos correos se encolarían ahora mismo si se aprieta "Enviar por correo". */
  pendingEmailCount: number;
  /** Cuántos de los que tienen diploma vigente no tienen dirección de correo. */
  withoutEmailCount: number;
  rows: DiplomaPanelRow[];
};

function downloadUrl(editionId: string, ids?: string[]): string {
  // Misma ruta que baja el ZIP de todas las piezas listas de la edición, filtrada acá
  // por cardType=diploma (y por ids cuando hay selección).
  //
  // `ids` ausente es "todos"; `ids` presente pero vacío es "ninguno" y se manda
  // igual, vacío. Son dos cosas distintas y la ruta las distingue: si acá se
  // tratara una selección vacía como "sin filtro", un error de cálculo del
  // llamador bajaría los 29 diplomas en vez de no bajar nada.
  const base = `/api/admin/ediciones/${editionId}/placas/descargar?cardType=diploma`;
  return ids ? `${base}&ids=${ids.join(",")}` : base;
}

/** Ruta admin que sirve el diploma ya emitido de una inscripción (PNG, o PDF con `format=pdf`). */
function diplomaFileUrl(
  registrationId: string,
  opciones: { formato?: "pdf"; descargar?: boolean } = {},
): string {
  const params = new URLSearchParams();
  if (opciones.formato === "pdf") params.set("format", "pdf");
  if (opciones.descargar) params.set("disposition", "attachment");
  const query = params.toString();
  return `/api/admin/registrations/${registrationId}/cards/diploma${query ? `?${query}` : ""}`;
}

export function DiplomasPanelClient({
  editionId,
  templateName,
  pendingCount,
  pendingEmailCount,
  withoutEmailCount,
  rows,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generatePending, startGenerate] = useTransition();
  const [generateResult, setGenerateResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryPending, startRetry] = useTransition();
  const [retryError, setRetryError] = useState<string | null>(null);

  const [rehaciendoId, setRehaciendoId] = useState<string | null>(null);
  const [rehacerPending, startRehacer] = useTransition();
  const [rehacerResult, setRehacerResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  const [sendEmailsPending, startSendEmails] = useTransition();
  const [sendEmailsResult, setSendEmailsResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );
  const [retryingEmailId, setRetryingEmailId] = useState<string | null>(null);
  const [retryEmailPending, startRetryEmail] = useTransition();
  const [retryEmailError, setRetryEmailError] = useState<string | null>(null);

  /*
   * Los que tienen un diploma vigente, que es lo que se puede ver, bajar,
   * rehacer o mandar. Se mira `diplomaId` y no el estado de la fila: un
   * diploma que se está rehaciendo muestra "Generando…" pero su archivo
   * anterior sigue estando y se puede bajar igual.
   */
  const emitidas = useMemo(() => rows.filter((r) => r.diplomaId !== null), [rows]);
  const seleccionables = useMemo(
    () => new Set(emitidas.map((r) => r.registrationId)),
    [emitidas],
  );
  const allSelected = emitidas.length > 0 && emitidas.every((r) => selected.has(r.registrationId));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(emitidas.map((r) => r.registrationId)));
  }

  function toggleOne(registrationId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(registrationId)) next.delete(registrationId);
      else next.add(registrationId);
      return next;
    });
  }

  function handleGenerate() {
    if (!templateName || generatePending) return;
    const confirmText =
      pendingCount === 0
        ? "No hay nadie pendiente en este momento. ¿Igual querés disparar el proceso?"
        : `Se van a generar ${pendingCount} diploma${pendingCount === 1 ? "" : "s"}. ¿Confirmás?`;
    if (!window.confirm(confirmText)) return;
    setGenerateResult(null);
    startGenerate(async () => {
      const result = await generateEditionDiplomasAction(editionId);
      setGenerateResult(result);
      router.refresh();
    });
  }

  function handleRetry(registrationId: string) {
    if (retryPending) return;
    setRetryError(null);
    setRetryingId(registrationId);
    startRetry(async () => {
      const result = await regenerateDiplomaAction(editionId, registrationId);
      if (!result.ok) setRetryError(result.message);
      router.refresh();
    });
  }

  /**
   * "Rehacer" de una fila ya emitida. Se confirma aunque sea uno solo: el
   * archivo que esa persona ya tiene se reemplaza. Lo que NO cambia es el
   * código ni el enlace de verificación, y el texto lo dice.
   */
  function handleRehacerUno(row: DiplomaPanelRow) {
    if (!templateName || rehacerPending || retryPending) return;
    const confirmText = `Se va a rehacer el diploma de ${row.fullName} con la plantilla actual. El código y el enlace de verificación no cambian. ¿Confirmás?`;
    if (!window.confirm(confirmText)) return;
    setRehacerResult(null);
    setRehaciendoId(row.registrationId);
    startRehacer(async () => {
      const result = await regenerateDiplomasAction(editionId, [row.registrationId]);
      setRehacerResult(result);
      router.refresh();
    });
  }

  function handleRehacerSeleccionados() {
    if (!templateName || rehacerPending || selected.size === 0) return;
    const cuantos = selected.size;
    const confirmText = `Se ${cuantos === 1 ? "va" : "van"} a rehacer ${cuantos} diploma${
      cuantos === 1 ? "" : "s"
    } con la plantilla actual. Los archivos anteriores se reemplazan; el código y el enlace de verificación no cambian. ¿Confirmás?`;
    if (!window.confirm(confirmText)) return;
    setRehacerResult(null);
    setRehaciendoId(null);
    startRehacer(async () => {
      const result = await regenerateDiplomasAction(editionId, Array.from(selected));
      setRehacerResult(result);
      router.refresh();
    });
  }

  function handleSendEmails() {
    if (sendEmailsPending) return;
    const confirmText =
      pendingEmailCount === 0
        ? withoutEmailCount > 0
          ? `No hay ningún correo pendiente de mandar ahora mismo. ${withoutEmailCount} participante${
              withoutEmailCount === 1 ? "" : "s"
            } no tiene${withoutEmailCount === 1 ? "" : "n"} dirección de correo y no va${
              withoutEmailCount === 1 ? "" : "n"
            } a recibir nada. ¿Igual querés disparar el proceso?`
          : "No hay ningún correo pendiente de mandar en este momento. ¿Igual querés disparar el proceso?"
        : `Se van a mandar ${pendingEmailCount} correo${pendingEmailCount === 1 ? "" : "s"} con el diploma.${
            withoutEmailCount > 0
              ? ` ${withoutEmailCount} participante${withoutEmailCount === 1 ? "" : "s"} no tiene${
                  withoutEmailCount === 1 ? "" : "n"
                } dirección de correo y no va${withoutEmailCount === 1 ? "" : "n"} a recibir nada.`
              : ""
          } ¿Confirmás?`;
    if (!window.confirm(confirmText)) return;
    setSendEmailsResult(null);
    startSendEmails(async () => {
      const result = await sendEditionDiplomaEmailsAction(editionId);
      setSendEmailsResult(result);
      router.refresh();
    });
  }

  function handleRetryEmail(diplomaId: string) {
    if (retryEmailPending) return;
    setRetryEmailError(null);
    setRetryingEmailId(diplomaId);
    startRetryEmail(async () => {
      const result = await retryDiplomaEmailAction(editionId, diplomaId);
      if (!result.ok) setRetryEmailError(result.message);
      router.refresh();
    });
  }

  const previewHref = `/api/admin/ediciones/${editionId}/diplomas/preview`;
  const seleccionadosHref = selected.size > 0 ? downloadUrl(editionId, Array.from(selected)) : null;
  const todosHref = emitidas.length > 0 ? downloadUrl(editionId) : null;

  const columns: AdminDataTableColumn<DiplomaPanelRow>[] = [
    {
      key: "select",
      header: "",
      className: "w-10",
      cell: (row) =>
        seleccionables.has(row.registrationId) ? (
          <input
            type="checkbox"
            aria-label={`Seleccionar diploma de ${row.fullName}`}
            checked={selected.has(row.registrationId)}
            onChange={() => toggleOne(row.registrationId)}
            className="h-4 w-4 accent-ck-yellow"
          />
        ) : null,
    },
    {
      key: "name",
      header: "Acreditado",
      cell: (row) => (
        <div>
          <p className="font-medium text-ck-text">{row.fullName}</p>
          {row.visibleCode ? <p className="text-xs text-ck-text-muted">{row.visibleCode}</p> : null}
        </div>
      ),
    },
    {
      key: "accreditedAt",
      header: "Acreditado el",
      cell: (row) => new Date(row.accreditedAtIso).toLocaleDateString("es-AR"),
    },
    {
      key: "state",
      header: "Estado",
      cell: (row) => {
        const presentation = presentDiplomaRowState(row.state, row.errorCode);
        const isRetryingThisRow = retryPending && retryingId === row.registrationId;
        return (
          <div className="max-w-xs space-y-1.5">
            <Badge variant={presentation.tone}>{presentation.label}</Badge>
            {presentation.reason ? (
              <p className="text-xs text-ck-text-muted">{presentation.reason}</p>
            ) : null}
            {row.state === "fallido" ? (
              <button
                type="button"
                className="text-xs text-ck-yellow underline-offset-2 hover:underline disabled:opacity-50"
                disabled={isRetryingThisRow}
                onClick={() => handleRetry(row.registrationId)}
              >
                {isRetryingThisRow ? "Reencolando…" : "Reintentar"}
              </button>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "acciones",
      header: "Diploma",
      cell: (row) => {
        // Sin emisión vigente no hay archivo que mostrar ni que rehacer: la
        // fila fallida ya tiene su propio "Reintentar" en la columna de estado.
        if (row.diplomaId === null) {
          return <span className="text-xs text-ck-text-muted">—</span>;
        }
        const rehaciendoEsta = rehacerPending && rehaciendoId === row.registrationId;
        return (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <a
              href={diplomaFileUrl(row.registrationId)}
              target="_blank"
              rel="noreferrer"
              className="text-ck-yellow underline-offset-2 hover:underline"
            >
              Ver
            </a>
            <a
              href={diplomaFileUrl(row.registrationId, { descargar: true })}
              className="text-ck-yellow underline-offset-2 hover:underline"
            >
              PNG
            </a>
            <a
              href={diplomaFileUrl(row.registrationId, { formato: "pdf", descargar: true })}
              className="text-ck-yellow underline-offset-2 hover:underline"
            >
              PDF
            </a>
            <button
              type="button"
              className="text-ck-yellow underline-offset-2 hover:underline disabled:opacity-50"
              disabled={!templateName || rehacerPending}
              onClick={() => handleRehacerUno(row)}
            >
              {rehaciendoEsta ? "Reencolando…" : "Rehacer"}
            </button>
          </div>
        );
      },
    },
    {
      key: "email",
      header: "Correo",
      cell: (row) => {
        const presentation = presentDiplomaEmailState(row.emailStatus, row.emailDead);
        // Sin diploma emitido todavía no hay nada que mandar: la columna
        // queda vacía en vez de mostrar un estado que no existe.
        if (!presentation) return <span className="text-xs text-ck-text-muted">—</span>;
        const isRetryingThisRow = retryEmailPending && retryingEmailId === row.diplomaId;
        // Reintentar aplica a los dos casos sin salida propia: un rebote
        // real (BOUNCED) y un evento que agotó sus reintentos automáticos
        // (QUEUED + emailDead). `requeueDiplomaEmail` ya soporta los dos.
        const canRetryEmail =
          row.diplomaId !== null &&
          (row.emailStatus === "BOUNCED" || (row.emailStatus === "QUEUED" && row.emailDead));
        return (
          <div className="max-w-xs space-y-1.5">
            <Badge variant={presentation.tone}>{presentation.label}</Badge>
            {canRetryEmail ? (
              <button
                type="button"
                className="block text-xs text-ck-yellow underline-offset-2 hover:underline disabled:opacity-50"
                disabled={isRetryingThisRow}
                onClick={() => handleRetryEmail(row.diplomaId as string)}
              >
                {isRetryingThisRow ? "Reencolando…" : "Reintentar"}
              </button>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <Card variant="outlined" className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {templateName ? (
            <Button href={previewHref} variant="outline" size="sm">
              Ver un ejemplo
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" disabled>
              Ver un ejemplo
            </Button>
          )}

          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={!templateName || generatePending}
            onClick={handleGenerate}
          >
            {generatePending ? "Generando…" : "Generar los diplomas"}
          </Button>

          {seleccionadosHref ? (
            <Button href={seleccionadosHref} variant="secondary" size="sm">
              Descargar seleccionados ({selected.size})
            </Button>
          ) : (
            <Button type="button" variant="secondary" size="sm" disabled>
              Descargar seleccionados
            </Button>
          )}

          {todosHref ? (
            <Button href={todosHref} variant="outline" size="sm">
              Descargar todos ({emitidas.length})
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!templateName || selected.size === 0 || rehacerPending}
            onClick={handleRehacerSeleccionados}
          >
            {rehacerPending && rehaciendoId === null
              ? "Reencolando…"
              : `Rehacer seleccionados${selected.size > 0 ? ` (${selected.size})` : ""}`}
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={emitidas.length === 0 || sendEmailsPending}
            onClick={handleSendEmails}
          >
            {sendEmailsPending ? "Encolando…" : "Enviar por correo"}
          </Button>
        </div>

        {!templateName ? (
          <p className="text-xs text-ck-text-muted">
            Asigná una plantilla de diploma en Placas para poder generar diplomas y ver un
            ejemplo.
          </p>
        ) : null}
        {generateResult ? (
          <p
            className={
              generateResult.ok ? "text-sm text-ck-text-secondary" : "text-sm text-red-200"
            }
            role="status"
          >
            {generateResult.message}
          </p>
        ) : null}
        {retryError ? (
          <p className="text-sm text-red-200" role="alert">
            {retryError}
          </p>
        ) : null}
        {rehacerResult ? (
          <p
            className={
              rehacerResult.ok ? "text-sm text-ck-text-secondary" : "text-sm text-red-200"
            }
            role="status"
          >
            {rehacerResult.message}
          </p>
        ) : null}
        {sendEmailsResult ? (
          <p
            className={
              sendEmailsResult.ok ? "text-sm text-ck-text-secondary" : "text-sm text-red-200"
            }
            role="status"
          >
            {sendEmailsResult.message}
          </p>
        ) : null}
        {retryEmailError ? (
          <p className="text-sm text-red-200" role="alert">
            {retryEmailError}
          </p>
        ) : null}
      </Card>

      <label className="flex w-fit items-center gap-2 text-sm text-ck-text-secondary">
        <input
          type="checkbox"
          checked={allSelected}
          disabled={emitidas.length === 0}
          onChange={toggleAll}
          className="h-4 w-4 accent-ck-yellow"
        />
        Seleccionar todos los emitidos
      </label>

      <AdminDataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.registrationId}
        emptyMessage="Todavía no hay acreditados en esta edición."
      />
    </div>
  );
}
