import { isSuperAdmin } from "@repo/auth-guards";
import { prisma } from "@repo/db";
import { getPortalUser } from "@/lib/guards";
import { DecisionForm } from "./DecisionForm";

export const dynamic = "force-dynamic";

export default async function VerificacionesEnRevisionPage() {
  const user = await getPortalUser();
  if (!user || !(await isSuperAdmin(user))) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-xl font-semibold">No autorizado</h1>
      </main>
    );
  }

  // Sólo filas de verificación en revisión: la base se comparte con CLF y no se expone nada más.
  const filas = await prisma.identityVerification.findMany({
    where: { status: "IN_REVIEW" },
    orderBy: { updatedAt: "asc" },
    select: {
      id: true,
      providerRef: true,
      rejectionReason: true,
      updatedAt: true,
      user: { select: { email: true, name: true } },
    },
  });

  const clfUrl = process.env.CLF_URL?.replace(/\/+$/, "");
  const fecha = new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  });

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">Verificaciones en revisión</h1>
      {clfUrl && (
        <p className="text-sm">
          <a className="underline" href={`${clfUrl}/admin/equipos-robados`}>
            Ver denuncias de equipos robados
          </a>
        </p>
      )}
      {filas.length === 0 && <p className="text-sm">No hay verificaciones pendientes.</p>}
      {filas.map((f) => (
        <section key={f.id} className="rounded border border-gray-300 p-4">
          <p className="font-medium">{f.user.name ?? "(sin nombre)"}</p>
          <p className="text-sm">{f.user.email}</p>
          <p className="text-sm text-gray-600">En revisión desde {fecha.format(f.updatedAt)}</p>
          <p className="text-sm">Motivo del proveedor: {f.rejectionReason ?? "sin detalle"}</p>
          <p className="text-sm">Sesión del proveedor: {f.providerRef ?? "sin referencia"}</p>
          <DecisionForm id={f.id} />
        </section>
      ))}
    </main>
  );
}
