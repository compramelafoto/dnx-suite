import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";
import { buscarCompras } from "@/lib/legal/buscar-compra";
import { urgenciaDeLaSolicitud } from "@/lib/legal/urgencia";
import { formatearPesos } from "@/lib/precios";
import { Resolver } from "./resolver";

export const dynamic = "force-dynamic";

const FECHA = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });

const COLOR = {
  vencida: { fondo: "#ff9a9a22", texto: "#8a1c1c" },
  apura: { fondo: "#ffc46b22", texto: "#7c4a03" },
  "a-tiempo": { fondo: "#7ee2a822", texto: "#14532d" },
  resuelta: { fondo: "#e6dff2", texto: "#4a3a5e" },
} as const;

/**
 * Las solicitudes de arrepentimiento.
 *
 * La norma da 24 horas para contestar, así que la lista **no está ordenada por fecha sino
 * por lo que falta para vencer**: lo que importa no es cuál llegó primero.
 *
 * Al lado de cada una van las compras que podrían ser la suya. Buscarlas era el único
 * trabajo real de resolver una solicitud, y se hacía abriendo la base.
 */
export default async function Arrepentimientos() {
  const almacen = await cookies();
  const cookie = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = cookie ? await getSessionUserByRawToken(cookie) : null;
  if (!usuario) redirect("/login?next=%2Fpanel%2Farrepentimientos");

  const fila = await prisma.user.findUnique({
    where: { id: usuario.id },
    select: { globalRole: true },
  });
  const esAdmin = fila?.globalRole === "SUPER_ADMIN" || fila?.globalRole === "PLATFORM_SUPPORT";

  if (!esAdmin) {
    return (
      <main className="sobre-claro mx-auto max-w-xl px-6 py-16">
        <h1 className="text-3xl font-extrabold">Arrepentimientos</h1>
        <p className="mt-4 leading-relaxed" style={{ color: "var(--slf-tinta-suave)" }}>
          Hace falta un usuario administrador: son solicitudes de toda la plataforma.
        </p>
      </main>
    );
  }

  const ahora = new Date();

  const solicitudes = await prisma.subilafotoRetractionRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    take: 100,
    select: {
      id: true,
      receipt: true,
      email: true,
      reference: true,
      reason: true,
      status: true,
      resolution: true,
      resolvedAt: true,
      orderId: true,
      createdAt: true,
    },
  });

  // Sólo para las pendientes: buscar las compras de una resuelta es trabajo que ya se hizo.
  const pendientes = solicitudes.filter((s) => s.status === "RECEIVED");
  const candidatasPorId = new Map(
    await Promise.all(
      pendientes.map(
        async (s) =>
          [s.id, await buscarCompras({ email: s.email, referencia: s.reference })] as const,
      ),
    ),
  );

  return (
    <main className="sobre-claro mx-auto max-w-3xl px-6 py-12">
      <Link href="/panel" className="text-sm font-extrabold" style={{ color: "var(--slf-violeta)" }}>
        ← Panel
      </Link>

      <h1 className="mt-5 text-3xl font-extrabold tracking-[-0.02em]">Arrepentimientos</h1>
      <p className="mt-3 leading-relaxed" style={{ color: "var(--slf-tinta-suave)" }}>
        La Resolución 424/2020 da <strong>24 horas</strong> para contestar. Las que están por
        vencer van primero.
      </p>

      {solicitudes.length === 0 ? (
        <p className="mt-12 text-lg" style={{ color: "var(--slf-tinta-suave)" }}>
          No hay ninguna. Es la mejor noticia posible de esta pantalla.
        </p>
      ) : (
        <ul className="mt-10 space-y-6">
          {solicitudes.map((s) => {
            const urgencia = urgenciaDeLaSolicitud({
              creada: s.createdAt,
              resuelta: s.resolvedAt,
              ahora,
            });
            const c = COLOR[urgencia.nivel];

            return (
              <li
                key={s.id}
                className="rounded-2xl border p-6"
                style={{ borderColor: "var(--slf-borde)", background: "white" }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="text-lg font-extrabold tracking-wide">{s.receipt}</p>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-extrabold"
                    style={{ background: c.fondo, color: c.texto }}
                  >
                    {urgencia.texto}
                  </span>
                </div>

                <dl className="mt-4 space-y-1 text-sm">
                  <div className="flex gap-2">
                    <dt className="font-extrabold">Correo:</dt>
                    <dd className="break-all">{s.email}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-extrabold">Escribió:</dt>
                    <dd className="break-all">{s.reference}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-extrabold">Entró:</dt>
                    <dd>{FECHA.format(s.createdAt)}</dd>
                  </div>
                </dl>

                {s.reason ? (
                  <p
                    className="mt-4 rounded-xl px-4 py-3 text-sm leading-relaxed"
                    style={{ background: "var(--slf-blanco)", color: "var(--slf-tinta-suave)" }}
                  >
                    {s.reason}
                  </p>
                ) : null}

                {s.status === "RECEIVED" ? (
                  <Resolver
                    id={s.id}
                    candidatas={(candidatasPorId.get(s.id) ?? []).map((o) => ({
                      id: o.id,
                      texto: `${o.vendedor} · ${o.eventoCode ?? "sin evento"} · ${formatearPesos(o.amountCents)} · ${o.status}${o.kind === "DOWNLOAD_ADDON" ? " · descarga" : ""}`,
                      detalle: `${o.porQue} · ${o.buyerEmail} · ${FECHA.format(o.paidAt ?? o.createdAt)}`,
                    }))}
                  />
                ) : (
                  <div
                    className="mt-5 rounded-xl px-4 py-3 text-sm"
                    style={{ background: "var(--slf-blanco)" }}
                  >
                    <p className="whitespace-pre-line" style={{ color: "var(--slf-tinta)" }}>
                      {s.resolution}
                    </p>
                    <p className="mt-2" style={{ color: "var(--slf-tinta-suave)" }}>
                      {s.resolvedAt ? FECHA.format(s.resolvedAt) : ""}
                      {s.orderId ? ` · compra ${s.orderId}` : ""}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
