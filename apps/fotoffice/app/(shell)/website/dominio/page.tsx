import { prisma } from "@repo/db";
import { loadWebsiteCmsContext } from "@/lib/website/page-context";
import { WebsiteShell } from "@/components/website/website-shell";
import { WebsiteDomainPanel } from "@/components/website/domain/website-domain-panel";
import { appUrl } from "@/lib/app-url";
import { dnsRecordsFor, parseDomainStatus } from "@/lib/website/domain/dns-records";
import { checkDomain, vercelConfig } from "@/lib/website/domain/vercel";
import { inspectDomainDns } from "@/lib/website/domain/dns-inspect";

/**
 * Sitio web → Dominio: conectar `sfpr.com.ar` (o el que sea) al sitio público.
 * Spec: docs/superpowers/specs/2026-10-02-sitio-web-dominio-propio-design.md
 */
export default async function WebsiteDomainPage() {
  const { workspace, canEdit, status, draftUpdatedAtIso } = await loadWebsiteCmsContext();

  const [row, branding] = await Promise.all([
    prisma.fotofficeWorkspaceDomain.findUnique({ where: { workspaceId: workspace.id } }),
    prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId: workspace.id }, select: { publicSlug: true } }),
  ]);

  const base = appUrl();
  const currentUrl = branding && base ? `${base}/w/${branding.publicSlug}` : null;

  // Mientras no está conectado, Vercel puede pedir registros extra (un TXT de verificación si
  // el dominio estuvo en otra cuenta). Se consultan al abrir la pantalla para mostrarlos.
  let records = row ? dnsRecordsFor(row.domain) : [];
  if (row && row.status !== "CONNECTED" && row.vercelRegisteredAt) {
    const check = await checkDomain(row.domain).catch(() => null);
    if (check) records = [...dnsRecordsFor(row.domain, { apexIp: check.apexIp }), ...check.extraRecords];
  }

  // Dónde se administra el DNS y si el dominio recibe correo: lo que necesita el paso a paso.
  const dns = row && row.status !== "CONNECTED" ? await inspectDomainDns(row.domain) : null;

  return (
    <WebsiteShell status={status} canEdit={canEdit} draftUpdatedAt={draftUpdatedAtIso}>
      <WebsiteDomainPanel
        canEdit={canEdit}
        currentUrl={currentUrl}
        vercelConnected={vercelConfig() !== null}
        domain={
          row
            ? {
                domain: row.domain,
                status: parseDomainStatus(row.status),
                registeredInVercel: row.vercelRegisteredAt !== null,
                lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
                lastError: row.lastError,
              }
            : null
        }
        records={records}
        dns={dns}
      />
    </WebsiteShell>
  );
}
