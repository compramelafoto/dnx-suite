"use client";

import { useActionState, useState } from "react";
import {
  checkWebsiteDomainAction,
  connectWebsiteDomainAction,
  removeWebsiteDomainAction,
  type WebsiteDomainState,
} from "@/app/actions/website-domain";
import type { DnsRecord, DomainStatus } from "@/lib/website/domain/dns-records";

const initial: WebsiteDomainState = { error: null };

type DomainInfo = {
  domain: string;
  status: DomainStatus;
  registeredInVercel: boolean;
  lastCheckedAt: string | null;
  lastError: string | null;
};

export function WebsiteDomainPanel({
  canEdit,
  currentUrl,
  vercelConnected,
  domain,
  records,
}: {
  canEdit: boolean;
  currentUrl: string | null;
  vercelConnected: boolean;
  domain: DomainInfo | null;
  records: DnsRecord[];
}) {
  return (
    <div className="space-y-5">
      <div className="fo-card space-y-2">
        <h2 className="text-base font-semibold text-[var(--fo-text)]">Dominio propio</h2>
        <p className="text-sm text-[var(--fo-muted)]">
          Hacé que tu sitio se vea en tu propia dirección, por ejemplo <strong>tuinstitucion.com.ar</strong>.
          {currentUrl ? (
            <>
              {" "}Hoy se ve en{" "}
              <a href={currentUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                {currentUrl}
              </a>
              , y esa dirección va a seguir funcionando.
            </>
          ) : null}
        </p>
      </div>

      {domain ? (
        <ConnectedDomain canEdit={canEdit} domain={domain} records={records} vercelConnected={vercelConnected} />
      ) : (
        <ConnectForm canEdit={canEdit} />
      )}
    </div>
  );
}

function ConnectForm({ canEdit }: { canEdit: boolean }) {
  const [state, action, pending] = useActionState(connectWebsiteDomainAction, initial);
  return (
    <form action={action} className="fo-card space-y-4">
      <fieldset disabled={!canEdit} className="space-y-4 border-0">
        <label className="block space-y-2">
          <span className="fo-label">Tu dominio</span>
          <input name="domain" className="fo-input" placeholder="sfpr.com.ar" autoComplete="off" spellCheck={false} maxLength={253} />
          <p className="fo-helper">
            Escribilo sin «www» ni «https». Tiene que ser un dominio que ya tengas registrado (por ejemplo en NIC Argentina).
          </p>
        </label>
      </fieldset>
      {state.error ? <p className="text-sm text-[var(--fo-danger)]" role="alert">{state.error}</p> : null}
      {canEdit ? (
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pending}>
          {pending ? "Conectando…" : "Conectar dominio"}
        </button>
      ) : (
        <p className="fo-helper">Sólo el dueño o un administrador de la institución puede conectar un dominio.</p>
      )}
    </form>
  );
}

function ConnectedDomain({
  canEdit,
  domain,
  records,
  vercelConnected,
}: {
  canEdit: boolean;
  domain: DomainInfo;
  records: DnsRecord[];
  vercelConnected: boolean;
}) {
  const [checkState, checkAction, checking] = useActionState(checkWebsiteDomainAction, initial);
  const [removeState, removeAction, removing] = useActionState(removeWebsiteDomainAction, initial);
  const connected = domain.status === "CONNECTED";

  return (
    <>
      <div className="fo-card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-semibold text-[var(--fo-text)] break-all">{domain.domain}</p>
            {connected ? (
              <a href={`https://${domain.domain}`} target="_blank" rel="noreferrer" className="text-sm underline underline-offset-2">
                Abrir https://{domain.domain}
              </a>
            ) : null}
          </div>
          <StatusBadge status={domain.status} />
        </div>

        {!connected && domain.lastError ? <p className="text-sm text-[var(--fo-muted)]">{domain.lastError}</p> : null}
        {domain.lastCheckedAt ? (
          <p className="fo-helper">Última comprobación: {formatArgentina(domain.lastCheckedAt)}</p>
        ) : null}
        {!vercelConnected ? (
          <p className="rounded-md border border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] px-3 py-2 text-sm text-[var(--fo-warning)]">
            Falta que DNX habilite la conexión automática con el servidor. Podés ir cargando los registros DNS igual: avisanos y lo
            terminamos de conectar.
          </p>
        ) : null}

        {checkState.message ? <p className="text-sm text-[var(--fo-text)]" role="status">{checkState.message}</p> : null}
        {checkState.error ? <p className="text-sm text-[var(--fo-danger)]" role="alert">{checkState.error}</p> : null}
        {removeState.error ? <p className="text-sm text-[var(--fo-danger)]" role="alert">{removeState.error}</p> : null}

        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <form action={checkAction}>
              <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={checking}>
                {checking ? "Comprobando…" : connected ? "Comprobar de nuevo" : domain.registeredInVercel ? "Comprobar ahora" : "Reintentar conexión"}
              </button>
            </form>
            <form
              action={removeAction}
              onSubmit={(e) => {
                if (!window.confirm(`¿Quitar ${domain.domain}? El sitio deja de verse en esa dirección (sigue en la de FOTOFFICE).`)) {
                  e.preventDefault();
                }
              }}
            >
              <button type="submit" className="fo-btn fo-btn-danger-outline text-sm" disabled={removing}>
                {removing ? "Quitando…" : "Quitar dominio"}
              </button>
            </form>
          </div>
        ) : null}
      </div>

      {!connected ? <DnsInstructions domain={domain.domain} records={records} /> : null}
    </>
  );
}

function DnsInstructions({ domain, records }: { domain: string; records: DnsRecord[] }) {
  return (
    <div className="fo-card space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-[var(--fo-text)]">Qué cargar en el DNS de {domain}</h3>
        <p className="text-sm text-[var(--fo-muted)]">
          Entrá a donde administrás el dominio (NIC Argentina o tu proveedor de hosting) y cargá estos registros. Los cambios pueden
          tardar desde unos minutos hasta unas horas en verse.
        </p>
      </div>

      <p className="rounded-md border border-[var(--fo-danger-border)] bg-[var(--fo-danger-soft)] px-3 py-2 text-sm text-[var(--fo-danger)]">
        <strong>No borres ni cambies los registros MX ni TXT</strong> si usás correos @{domain}: son los del correo. Sólo hay que
        tocar los de esta tabla.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--fo-muted)]">
              <th className="py-2 pr-3 font-medium">Tipo</th>
              <th className="py-2 pr-3 font-medium">Nombre</th>
              <th className="py-2 pr-3 font-medium">Valor</th>
              <th className="py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={`${r.type}-${r.name}-${r.value}`} className="border-t border-[var(--fo-border)] align-top">
                <td className="py-2 pr-3 font-mono">{r.type}</td>
                <td className="py-2 pr-3 font-mono">{r.name}</td>
                <td className="py-2 pr-3">
                  <span className="font-mono break-all">{r.value}</span>
                  <p className="fo-helper mt-1">{r.note}</p>
                </td>
                <td className="py-2 text-right">
                  <CopyButton value={r.value} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="fo-helper">
        Si tu dominio hoy muestra otra web, esa web deja de verse cuando cambies el registro A. Hacelo con tu sitio nuevo ya publicado.
      </p>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="fo-btn fo-btn-ghost text-xs"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? "Copiado ✓" : "Copiar"}
    </button>
  );
}

function StatusBadge({ status }: { status: DomainStatus }) {
  const map = {
    CONNECTED: { label: "✓ Conectado", cls: "bg-[var(--fo-success-soft)] text-[var(--fo-success)] border-[var(--fo-success-border)]" },
    PENDING: { label: "● Pendiente", cls: "bg-[var(--fo-warning-soft)] text-[var(--fo-warning)] border-[var(--fo-warning-border)]" },
    ERROR: { label: "✕ Con error", cls: "bg-[var(--fo-danger-soft)] text-[var(--fo-danger)] border-[var(--fo-danger-border)]" },
  }[status];
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${map.cls}`}>{map.label}</span>;
}

function formatArgentina(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}
