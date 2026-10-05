import Link from "next/link";
import { toggleGoogleContactsAction } from "@/app/(shell)/members/contactos-actions";

/** Igual criterio que `IntegrationStatusValue` de `@/lib/integrations/store`. */
export type GoogleContactsAccount = {
  email: string;
  status: "ACTIVE" | "NEEDS_RECONSENT" | "REVOKED";
};

/**
 * El interruptor de agendar los socios en Google, dentro de Padrón.
 *
 * Va acá y no en una pantalla nueva: Socios es una sección llena (P7 del documento de
 * navegación) y lo que llega de acá en adelante va adentro de una de sus siete pantallas.
 *
 * La CUENTA no se conecta acá: eso vive en Integraciones, porque la misma cuenta sirve a
 * Calendar, Classroom y Contacts. Esta tarjeta informa y enlaza.
 *
 * `account` distingue "nunca se conectó nada" de "se conectó y el permiso se revocó desde
 * Google": son dos situaciones distintas —mismo criterio que la pantalla de
 * Integraciones— y confundirlas le hace decirle a alguien "falta conectar" cuando en
 * realidad ya había una cuenta y hay que retomarla, no empezar de cero.
 */
export function GoogleContactsCard({
  enabled,
  account,
  lastSyncAt,
  lastSyncOk,
  lastSyncMessage,
  syncedContacts,
}: {
  enabled: boolean;
  /** `null` = la institución no conectó ninguna cuenta de Google todavía. */
  account: GoogleContactsAccount | null;
  lastSyncAt: Date | null;
  lastSyncOk: boolean | null;
  lastSyncMessage: string | null;
  syncedContacts: number;
}) {
  const activa = account?.status === "ACTIVE";
  // Solo mientras la cuenta está activa el interruptor tiene efecto real: si el permiso se
  // revocó, "encendido" no es mentira (el dato queda como quedó), pero la sincronización
  // está de hecho pausada hasta que alguien reconecte.
  const pausadaPorCuenta = enabled && !activa;

  return (
    <section className="fo-card space-y-4 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 min-w-0">
          <h2 className="text-base font-semibold">Agendar los socios en Google</h2>
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed max-w-2xl">
            Cada socio del padrón se agenda en los contactos de la institución, y las
            correcciones que se hagan desde el celular vuelven al padrón.
          </p>
          {activa && account ? (
            <p className="text-xs text-[var(--fo-muted-soft)] leading-relaxed">
              Van a la cuenta <span className="font-medium">{account.email}</span>, al grupo
              &ldquo;FOTOFFICE · Socios&rdquo;. Los contactos que ya estaban en esa cuenta no
              se tocan, y nada se borra.
            </p>
          ) : null}
        </div>

        <div className="flex flex-col items-start gap-2 shrink-0 sm:items-end">
          {activa && account ? (
            <form action={toggleGoogleContactsAction}>
              <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
              <button
                type="submit"
                className={`fo-btn text-sm inline-flex ${enabled ? "fo-btn-secondary" : "fo-btn-primary"}`}
              >
                {enabled ? "Dejar de agendar" : "Empezar a agendar"}
              </button>
            </form>
          ) : account ? (
            <>
              <span className="text-xs font-medium text-[var(--fo-danger)]">
                Necesita reconectarse
              </span>
              <span className="text-sm font-medium">{account.email}</span>
              <p className="text-xs text-[var(--fo-muted)] max-w-xs sm:text-right leading-relaxed">
                El permiso se revocó desde la cuenta de Google.
              </p>
              <Link
                href="/workspace/configuracion/integraciones"
                className="fo-btn fo-btn-primary text-sm inline-flex"
              >
                Reconectar en Integraciones
              </Link>
            </>
          ) : (
            <>
              <span className="text-xs text-[var(--fo-muted)]">Falta conectar la cuenta</span>
              <Link
                href="/workspace/configuracion/integraciones"
                className="fo-btn fo-btn-primary text-sm inline-flex"
              >
                Ir a Integraciones
              </Link>
            </>
          )}
        </div>
      </div>

      {pausadaPorCuenta ? (
        <p className="text-xs text-[var(--fo-danger)]" role="alert">
          La sincronización está pausada hasta que se reconecte la cuenta de Google. Lo ya
          agendado no se pierde.
        </p>
      ) : enabled ? (
        <p className="text-xs text-[var(--fo-muted-soft)]">
          {lastSyncAt
            ? `Última sincronización: ${lastSyncAt.toLocaleString("es-AR")} · ${syncedContacts} socios agendados.`
            : "La primera sincronización está en curso: en unos minutos los socios aparecen en la agenda. Después se sincroniza todos los días a la madrugada y cuando cierra el padrón de un sorteo."}
        </p>
      ) : null}

      {activa && enabled && lastSyncOk === false && lastSyncMessage ? (
        <p className="text-xs text-[var(--fo-danger)]" role="alert">
          {lastSyncMessage}
        </p>
      ) : null}
    </section>
  );
}
