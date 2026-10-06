import Link from "next/link";
import { listStoreContests } from "@/lib/store/artworks/catalog";

const ESTADO: Record<string, string> = {
  JUDGING: "En jurado",
  FINALISTS: "Finalistas",
  COMPLETED: "Terminado",
  CLOSED: "Cerrado",
  ARCHIVED: "Archivado",
};

/** Sección "Concursos": los de las organizaciones vinculadas que ya cerraron la carga de obras. */
export async function ContestsSection({ workspaceId }: { workspaceId: string }) {
  const concursos = await listStoreContests(workspaceId);
  return (
    <section className="fo-card space-y-4 p-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Concursos</h2>
        <p className="fo-helper">
          Los concursos de tus organizaciones vinculadas que ya cerraron la carga de obras. Entrá a uno para elegir qué obras
          vender.
        </p>
      </div>
      {concursos.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">
          Todavía no hay concursos para mostrar. Aparecen cuando una organización vinculada tiene un concurso en jurado,
          con finalistas o terminado.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--fo-border)]">
          {concursos.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <Link href={`/ventas/tienda/obras/${c.id}`} className="font-medium underline-offset-2 hover:underline">
                  {c.title}
                </Link>
                <p className="text-[var(--fo-muted)]">
                  {c.organizationName} · {ESTADO[c.status] ?? c.status}
                </p>
              </div>
              <span className="text-[var(--fo-muted)]">
                {c.publishedCount === 0
                  ? "Sin obras publicadas"
                  : `${c.publishedCount} ${c.publishedCount === 1 ? "obra publicada" : "obras publicadas"}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
