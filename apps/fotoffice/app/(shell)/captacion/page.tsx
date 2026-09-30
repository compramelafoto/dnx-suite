import Link from "next/link";
import { redirect } from "next/navigation";
import { ArmazonCaptacion } from "@/components/captacion/armazon";
import { requireServiceLeadsStaff } from "@/lib/service-leads/access";
import { prepararCaptacion } from "@/lib/service-leads/preparar";

export const dynamic = "force-dynamic";
// Enganchar las consultas anteriores puede llevar un rato la primera vez.
export const maxDuration = 300;

export default async function CaptacionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspace } = await requireServiceLeadsStaff();
  if (!workspace) redirect("/workspace");
  const { vista } = await searchParams;
  // La lista vive en su propia ruta: `vista` es un parámetro reservado del motor de listados
  // (vistas guardadas) y se perdería al buscar, filtrar o paginar.
  if (vista === "lista") redirect("/captacion/lista");

  const { quedan } = await prepararCaptacion(workspace.id);

  return (
    <ArmazonCaptacion activa="tablero" quedan={quedan}>
      {/* Tarea 9: acá va el tablero. Mientras tanto, un aviso con el camino a la lista. */}
      <div className="fo-card space-y-2 text-sm">
        <p className="text-[var(--fo-muted)]">El tablero de Captación todavía no está disponible.</p>
        <Link href="/captacion/lista" className="font-medium text-[var(--fo-accent)] hover:underline">
          Ver las consultas en modo lista
        </Link>
      </div>
    </ArmazonCaptacion>
  );
}
