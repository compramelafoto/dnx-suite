import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "../../../../lib/auth";
import { userIsFotorankSuperAdmin } from "../../../../lib/fotorank/access/super-admin";
import { routes } from "../../../../lib/routes";
import { ImportConsignasClient } from "./ImportConsignasClient";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ImportarConsignasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireAuth();
  if (!userIsFotorankSuperAdmin(user)) {
    redirect("/mi-actividad");
  }

  const sp = await searchParams;
  const errorRaw = sp.error;
  const error = Array.isArray(errorRaw) ? errorRaw[0] : errorRaw;

  return (
    <div className="mx-auto max-w-3xl space-y-8" data-testid="super-admin-consignas-import">
      <header className="space-y-3">
        <p className="fr-eyebrow text-gold">Biblioteca de Consignas</p>
        <h1 className="font-sans text-3xl font-semibold tracking-tight">Importar JSON</h1>
        <p className="text-sm leading-relaxed text-fr-muted">
          Cada fila se importa como borrador. Usá <code className="text-gold">themeSlug</code>{" "}
          existente (ej. <code className="text-gold">luz</code>,{" "}
          <code className="text-gold">cine</code>).
        </p>
        <Link
          href={routes.superAdmin.consignas()}
          className="text-sm text-gold hover:underline"
        >
          ← Volver al listado
        </Link>
      </header>

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      <div className="fr-recuadro border border-fr-border bg-fr-card">
        <ImportConsignasClient />
      </div>
    </div>
  );
}
