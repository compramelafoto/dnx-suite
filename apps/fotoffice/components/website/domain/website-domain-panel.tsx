"use client";

import { useActionState, useState, type ReactNode } from "react";
import {
  checkWebsiteDomainAction,
  connectWebsiteDomainAction,
  removeWebsiteDomainAction,
  type WebsiteDomainState,
} from "@/app/actions/website-domain";
import type { DnsRecord, DomainStatus } from "@/lib/website/domain/dns-records";
import type { DnsInspection } from "@/lib/website/domain/dns-inspect";

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
  dns,
}: {
  canEdit: boolean;
  currentUrl: string | null;
  vercelConnected: boolean;
  domain: DomainInfo | null;
  records: DnsRecord[];
  dns: DnsInspection | null;
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
        <ConnectedDomain canEdit={canEdit} domain={domain} records={records} vercelConnected={vercelConnected} dns={dns} />
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
      <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--fo-muted)]">
        <li>Escribí tu dominio acá abajo y tocá «Conectar dominio».</li>
        <li>Te mostramos qué cambiar y dónde: copiás dos datos en el lugar donde se administra tu dominio.</li>
        <li>Volvés acá y tocás «Comprobar ahora». Cuando diga «Conectado», tu sitio ya se ve en tu dirección.</li>
      </ol>
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
  dns,
}: {
  canEdit: boolean;
  domain: DomainInfo;
  records: DnsRecord[];
  vercelConnected: boolean;
  dns: DnsInspection | null;
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

      {!connected ? <DnsInstructions domain={domain.domain} records={records} dns={dns} /> : null}
    </>
  );
}

function DnsInstructions({ domain, records, dns }: { domain: string; records: DnsRecord[]; dns: DnsInspection | null }) {
  const provider = dns?.provider ?? null;
  const where = provider?.name ?? dns?.providerDomain ?? null;
  return (
    <div className="fo-card space-y-5">
      <h3 className="text-base font-semibold text-[var(--fo-text)]">Paso a paso para conectar {domain}</h3>

      <Step n={1} title="Averiguá dónde se administra tu dominio">
        {where ? (
          <p>
            Lo detectamos: el DNS de {domain} se administra en <strong>{where}</strong>
            {dns?.nameservers.length ? <span className="text-[var(--fo-muted)]"> ({dns.nameservers.join(", ")})</span> : null}. Ahí es
            donde vas a hacer los cambios, aunque el dominio esté registrado en NIC Argentina.
          </p>
        ) : (
          <p>
            No pudimos detectarlo. Entrá a <a href="https://nic.ar" target="_blank" rel="noreferrer" className="underline">nic.ar</a> →
            Mis dominios → {domain} → <strong>Delegaciones</strong>: ahí figura quién administra el DNS (por ejemplo Cloudflare,
            DonWeb o tu proveedor de hosting). En NIC Argentina sólo se elige el proveedor; los registros se cargan en él.
          </p>
        )}
      </Step>

      <Step n={2} title={where ? `Entrá al panel de ${where}` : "Entrá al panel de ese proveedor"}>
        <p>
          {provider?.panelHint ?? "Buscá la sección «DNS», «Zona DNS» o «Registros» de tu dominio."}
          {provider?.helpUrl ? (
            <>
              {" "}
              <a href={provider.helpUrl} target="_blank" rel="noreferrer" className="underline">
                Abrir {provider.name}
              </a>
            </>
          ) : null}
        </p>
      </Step>

      <Step n={3} title="Cargá estos registros">
        <p>
          Si ya existe un registro con el mismo nombre (<code>@</code> o <code>www</code>), editalo y poné el valor nuevo; si hay dos,
          dejá sólo uno. Usá el botón «Copiar» para no equivocarte.
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
      </Step>

      <Step n={4} title="No toques nada más">
        {dns && dns.mailRecords > 0 ? (
          <p className="rounded-md border border-[var(--fo-danger-border)] bg-[var(--fo-danger-soft)] px-3 py-2 text-[var(--fo-danger)]">
            <strong>Tu dominio recibe correo</strong> ({dns.mailRecords} {dns.mailRecords === 1 ? "registro MX" : "registros MX"}). No
            borres ni cambies los registros MX ni TXT: son los de tus casillas @{domain}.
          </p>
        ) : (
          <p>
            No borres ni cambies los registros MX ni TXT: si algún día usás correos @{domain}, son los de esas casillas.
          </p>
        )}
        <p>Si tu dominio hoy muestra otra web, esa web deja de verse cuando cambies el registro A. Hacelo con tu sitio nuevo ya publicado.</p>
      </Step>

      <Step n={5} title="Volvé acá y tocá «Comprobar ahora»">
        <p>Los cambios pueden tardar desde unos minutos hasta unas horas. Cuando diga «✓ Conectado», tu sitio ya se ve en https://{domain}.</p>
      </Step>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--fo-accent)] text-xs font-semibold text-white">
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-2 text-sm text-[var(--fo-text)]">
        <p className="font-medium">{title}</p>
        {children}
      </div>
    </section>
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
