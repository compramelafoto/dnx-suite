import { PageHeader } from "@/components/page-header";

export default function SuperAdminSettingsPage() {
  const dbUrl = process.env.DATABASE_URL?.trim() ?? "";
  const dbHost = dbUrl ? safeHostFromDbUrl(dbUrl) : "No definido";

  return (
    <div className="space-y-10">
      <PageHeader
        title="Configuración global"
        description="Diagnóstico rápido de entorno para el panel Super Admin."
      />

      <section className="fo-card space-y-4">
        <h2 className="text-base font-semibold text-[var(--fo-text)]">Base de datos de Fotoffice</h2>
        <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
          Fotoffice usa el mismo cliente <code className="text-xs">@repo/db</code> que el resto de DNX
          Suite. Por eso comparte esquema Prisma y depende de <code className="text-xs">DATABASE_URL</code>{" "}
          del entorno donde corre la app.
        </p>
        <ul className="text-sm text-[var(--fo-muted)] leading-relaxed space-y-2">
          <li>
            Host actual detectado:{" "}
            <code className="text-xs bg-[var(--fo-code-bg)] px-1.5 py-0.5 rounded border border-[var(--fo-border)]">
              {dbHost}
            </code>
          </li>
          <li>
            Si el enum <code className="text-xs">Role</code> no tiene <code className="text-xs">SUPER_ADMIN</code>,
            aplicá la migración pendiente en esa misma base.
          </li>
        </ul>
      </section>
    </div>
  );
}

function safeHostFromDbUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "URL inválida";
  }
}
