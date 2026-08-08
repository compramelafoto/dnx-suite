import Link from "next/link";
import { redirect } from "next/navigation";
import { listThemes } from "@repo/photo-prompt-library";
import { PromptLibraryForm } from "../../../../components/super-admin/prompt-library/PromptLibraryForm";
import { requireAuth } from "../../../../lib/auth";
import { userIsFotorankSuperAdmin } from "../../../../lib/fotorank/access/super-admin";
import { routes } from "../../../../lib/routes";
import { createConsignaAction } from "../actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NuevaConsignaPage({
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
  const themes = await listThemes();

  return (
    <div className="mx-auto max-w-3xl space-y-8" data-testid="super-admin-consigna-nueva">
      <header className="space-y-3">
        <p className="fr-eyebrow text-gold">Biblioteca de Consignas</p>
        <h1 className="font-sans text-3xl font-semibold tracking-tight">Nueva consigna</h1>
        <p className="text-sm text-fr-muted">
          Se crea como borrador. Después podés enviarla a revisión.
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
        <PromptLibraryForm
          action={createConsignaAction}
          themes={themes.map((t) => ({
            id: t.id,
            name: t.name,
            subthemes: t.subthemes.map((s) => ({
              id: s.id,
              name: s.name,
              themeId: s.themeId,
            })),
          }))}
          submitLabel="Crear borrador"
        />
      </div>
    </div>
  );
}
