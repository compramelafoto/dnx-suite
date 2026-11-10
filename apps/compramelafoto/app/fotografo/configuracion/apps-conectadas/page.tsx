import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { listarConexiones } from "@/lib/fotoffice-conexion/servicio";
import { revocarConexionAction } from "./actions";

export const dynamic = "force-dynamic";

const RUTA = "/fotografo/configuracion/apps-conectadas";

const NOMBRE_APP: Record<string, string> = { fotoffice: "FOTOFFICE" };

function fecha(d: Date | null): string {
  if (!d) return "Todavía no";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function AppsConectadasPage({
  searchParams,
}: {
  searchParams: Promise<{ revocada?: string; error?: string }>;
}) {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) redirect(`/login?redirect=${encodeURIComponent(RUTA)}`);

  const q = await searchParams;
  const conexiones = await listarConexiones(user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 md:px-6">
      <div>
        <Link href="/fotografo/configuracion" className="text-xs font-semibold uppercase tracking-wide text-[#c27b3d] hover:underline">
          Configuración
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#1a1a1a]">Apps conectadas</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#5a5a5a]">
          Apps a las que autorizaste a ver tus ventas de CompraMeLaFoto (álbum, pack, fecha, montos e id de pago de
          Mercado Pago). Ninguna ve datos de compradores ni de alumnos. Si revocás una, deja de recibir ventas al
          instante.
        </p>
      </div>

      {q.revocada && (
        <p className="rounded-lg bg-[#10b981]/10 px-4 py-3 text-sm text-[#047857]">Listo: revocaste el acceso.</p>
      )}
      {q.error && (
        <p className="rounded-lg bg-[#ef4444]/10 px-4 py-3 text-sm text-[#b91c1c]">
          No encontramos esa conexión. Puede que ya estuviera revocada.
        </p>
      )}

      {conexiones.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#111827]/15 p-6 text-sm text-[#6b7280]">
          No tenés apps conectadas.
        </p>
      ) : (
        <ul className="space-y-3">
          {conexiones.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#111827]/10 bg-white p-4">
              <div className="min-w-0">
                <p className="font-medium text-[#1a1a1a]">
                  {c.externalLabel} <span className="text-[#6b7280]">({NOMBRE_APP[c.appKey] ?? c.appKey})</span>
                </p>
                <p className="mt-1 text-xs text-[#6b7280]">
                  Conectada el {fecha(c.createdAt)} · Último uso: {fecha(c.lastUsedAt)}
                </p>
              </div>
              <form action={revocarConexionAction}>
                <input type="hidden" name="id" value={c.id} />
                <button
                  type="submit"
                  className="rounded-lg border border-[#ef4444]/40 px-4 py-2 text-sm font-medium text-[#b91c1c] hover:bg-[#ef4444]/10"
                >
                  Revocar
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
