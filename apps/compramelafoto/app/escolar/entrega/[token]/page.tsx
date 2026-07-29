import Link from "next/link";
import { Role } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { labelPreCompraOrderItemStatus } from "@/lib/preventa-canjeable/preventa-status-labels";

export const dynamic = "force-dynamic";

function labelEstadoItem(status: string): string {
  return labelPreCompraOrderItemStatus(status);
}

function referenciaLegible(token: string): string {
  if (token.length <= 10) return token;
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

function esRolFotografo(role: Role): boolean {
  return role === Role.PHOTOGRAPHER || role === Role.LAB_PHOTOGRAPHER;
}

function VistaInvalida() {
  return (
    <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Enlace inválido o vencido</h1>
        <p className="text-sm text-gray-600">
          No pudimos encontrar esta información. Si el problema continúa, contactá al fotógrafo.
        </p>
      </div>
    </div>
  );
}

export default async function EscolarEntregaFichaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await Promise.resolve(params);
  const rawToken = decodeURIComponent(String(token || "").trim());

  if (!rawToken) {
    return <VistaInvalida />;
  }

  const item = await prisma.preCompraOrderItem.findUnique({
    where: { fulfillmentQrToken: rawToken },
    select: {
      status: true,
      fulfillmentQrToken: true,
      order: {
        select: {
          studentFirstName: true,
          studentLastName: true,
          schoolCourse: { select: { name: true, division: true } },
          album: {
            select: {
              userId: true,
              school: { select: { name: true } },
            },
          },
        },
      },
      designProject: { select: { id: true } },
    },
  });

  if (!item) {
    return <VistaInvalida />;
  }

  const auth = await getAuthUser();
  const albumUserId = item.order.album.userId;
  const esDueñoFotógrafo =
    auth != null && esRolFotografo(auth.role) && auth.id === albumUserId;

  const alumno = [item.order.studentFirstName, item.order.studentLastName].filter(Boolean).join(" ").trim() || "—";
  const curso = item.order.schoolCourse
    ? `${item.order.schoolCourse.name}${item.order.schoolCourse.division ? ` ${item.order.schoolCourse.division}` : ""}`
    : "—";
  const escuela = item.order.album.school?.name?.trim() || "—";
  const estado = labelEstadoItem(item.status);
  const refToken = item.fulfillmentQrToken ? referenciaLegible(item.fulfillmentQrToken) : referenciaLegible(rawToken);
  const designProjectId = item.designProject?.id ?? null;

  return (
    <div className="min-h-screen bg-[#f9fafb] py-10 px-4">
      <div className="max-w-lg mx-auto rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Producto escolar</p>
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Seguimiento de entrega</h1>

        <dl className="space-y-4 text-sm">
          <div>
            <dt className="text-gray-500 mb-0.5">Estado</dt>
            <dd className="text-gray-900 font-medium">{estado}</dd>
          </div>
          <div>
            <dt className="text-gray-500 mb-0.5">Alumno</dt>
            <dd className="text-gray-900">{alumno}</dd>
          </div>
          <div>
            <dt className="text-gray-500 mb-0.5">Curso</dt>
            <dd className="text-gray-900">{curso}</dd>
          </div>
          <div>
            <dt className="text-gray-500 mb-0.5">Escuela</dt>
            <dd className="text-gray-900">{escuela}</dd>
          </div>
          <div>
            <dt className="text-gray-500 mb-0.5">Referencia</dt>
            <dd className="text-gray-700 font-mono text-xs">{refToken}</dd>
          </div>
        </dl>

        {esDueñoFotógrafo ? (
          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Tu cuenta</p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/fotografo/escuelas/pedidos" className="text-[#c27b3d] hover:underline">
                  Ir a pedidos escolares
                </Link>
              </li>
              {designProjectId != null ? (
                <li>
                  <Link
                    href={`/dashboard/design-projects/${designProjectId}`}
                    className="text-[#c27b3d] hover:underline"
                  >
                    Abrir diseño
                  </Link>
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
