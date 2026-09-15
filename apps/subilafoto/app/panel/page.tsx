import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";
import { perfilDeVenta } from "@/lib/perfil-de-venta";
import { formatearPesos } from "@/lib/precios";

export const dynamic = "force-dynamic";

const FECHA = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });

const ESTADO: Record<string, { texto: string; fondo: string; tinta: string }> = {
  CONFIGURING: { texto: "Sin configurar", fondo: "#e6dff2", tinta: "#4a3a5e" },
  SCHEDULED: { texto: "Agendado", fondo: "#d9b9ff55", tinta: "#3b0f6b" },
  ACTIVE: { texto: "Abierto ahora", fondo: "#7ee2a855", tinta: "#14532d" },
  CLOSED: { texto: "Cerrado", fondo: "#e6dff2", tinta: "#4a3a5e" },
  ARCHIVED: { texto: "Borrado", fondo: "#e6dff2", tinta: "#4a3a5e" },
  CANCELLED: { texto: "Cancelado", fondo: "#ff9a9a33", tinta: "#8a1c1c" },
};

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    "http://localhost:3012"
  );
}

/**
 * El panel del profesional.
 *
 * Era una pantalla que decía "hola" y nada más: no había forma de encontrar un evento ya
 * creado ni de llegar a la ficha de venta. Ahora es lo primero que hace falta ver —si el
 * enlace está publicado y si Mercado Pago está conectado— y después la lista.
 */
export default async function Panel() {
  const almacen = await cookies();
  const token = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = token ? await getSessionUserByRawToken(token) : null;
  if (!usuario) redirect("/login?next=%2Fpanel");

  const perfilId = await perfilDeVenta(usuario.id, usuario.name);

  const [perfil, eventos, fila] = await Promise.all([
    prisma.subilafotoSellerProfile.findUnique({
      where: { id: perfilId },
      select: {
        slug: true,
        displayName: true,
        basePriceCents: true,
        isPublished: true,
        mpConnected: true,
      },
    }),
    prisma.subilafotoEvent.findMany({
      where: { sellerProfileId: perfilId },
      orderBy: [{ activationAt: "desc" }, { createdAt: "desc" }],
      take: 50,
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        activationAt: true,
        _count: { select: { media: true } },
      },
    }),
    prisma.user.findUnique({ where: { id: usuario.id }, select: { globalRole: true } }),
  ]);

  const esAdmin = fila?.globalRole === "SUPER_ADMIN" || fila?.globalRole === "PLATFORM_SUPPORT";
  const listoParaVender = Boolean(perfil?.isPublished && perfil.basePriceCents > 0);
  const enlace = `${baseUrl()}/v/${perfil?.slug ?? ""}`;

  return (
    <main className="sobre-claro mx-auto max-w-2xl px-6 py-14">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-3xl font-extrabold tracking-[-0.02em]">
          Hola{usuario.name ? `, ${usuario.name.split(" ")[0]}` : ""}
        </h1>
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="text-sm font-extrabold underline underline-offset-4" style={{ color: "var(--slf-tinta-suave)" }}>
            Salir
          </button>
        </form>
      </div>

      {/* Lo primero: si se puede vender o no. Es la pregunta que trae al panel. */}
      <section
        className="mt-8 rounded-2xl p-7"
        style={{ background: "var(--slf-purpura)", color: "white" }}
      >
        {listoParaVender ? (
          <>
            <h2 className="text-xl font-extrabold">Tu enlace de venta está publicado</h2>
            <p className="mt-3 break-all font-extrabold" style={{ color: "var(--slf-amarillo)" }}>
              {enlace.replace(/^https?:\/\//, "")}
            </p>
            <p className="mt-3 text-sm" style={{ color: "var(--slf-lila)" }}>
              {formatearPesos(perfil!.basePriceCents)} por evento.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-xl font-extrabold">Todavía no podés vender</h2>
            <p className="mt-3 leading-relaxed" style={{ color: "var(--slf-lila)" }}>
              {perfil && perfil.basePriceCents > 0
                ? "Tu ficha tiene precio pero está sin publicar."
                : "Falta poner tu precio y publicar tu ficha."}
            </p>
          </>
        )}

        {!perfil?.mpConnected ? (
          <p className="mt-5 border-t pt-5 text-sm" style={{ borderColor: "#ffffff22", color: "var(--slf-lila)" }}>
            Mercado Pago no está conectado: nadie puede pagarte todavía.
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/panel/perfil"
            className="inline-flex min-h-[44px] items-center rounded-xl px-6 font-extrabold"
            style={{ background: "var(--slf-amarillo)", color: "#050505" }}
          >
            {listoParaVender ? "Editar mi ficha" : "Completar mi ficha"}
          </Link>
          {!perfil?.mpConnected ? (
            <a
              href="/api/pagos/conectar"
              className="inline-flex min-h-[44px] items-center rounded-xl border-2 px-6 font-extrabold"
              style={{ borderColor: "var(--slf-amarillo)", color: "var(--slf-amarillo)" }}
            >
              Conectar Mercado Pago
            </a>
          ) : null}
        </div>
      </section>

      <div className="mt-12 flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-extrabold">Tus eventos ({eventos.length})</h2>
        <Link
          href="/panel/eventos/nuevo"
          className="text-sm font-extrabold"
          style={{ color: "var(--slf-violeta)" }}
        >
          Crear uno
        </Link>
      </div>

      {eventos.length === 0 ? (
        <p className="mt-4" style={{ color: "var(--slf-tinta-suave)" }}>
          Todavía no tenés ninguno. Cuando un cliente compre desde tu enlace, el evento
          aparece acá solo.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {eventos.map((e) => {
            const badge = ESTADO[e.status] ?? ESTADO.CONFIGURING!;
            return (
              <li key={e.id}>
                <Link
                  href={`/panel/eventos/${e.id}`}
                  className="flex items-center gap-4 rounded-xl border px-5 py-4"
                  style={{ borderColor: "var(--slf-borde)", background: "white" }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-extrabold">{e.name}</span>
                    <span className="mt-1 block text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
                      {e.code}
                      {e.activationAt ? ` · ${FECHA.format(e.activationAt)}` : ""}
                      {e._count.media > 0 ? ` · ${e._count.media} fotos` : ""}
                    </span>
                  </span>
                  <span
                    className="shrink-0 rounded-full px-3 py-1 text-xs font-extrabold"
                    style={{ background: badge.fondo, color: badge.tinta }}
                  >
                    {badge.texto}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {esAdmin ? (
        <p className="mt-12">
          <Link
            href="/panel/salud"
            className="inline-flex min-h-[44px] items-center font-extrabold underline underline-offset-4"
            style={{ color: "var(--slf-violeta)" }}
          >
            Cómo va la noche
          </Link>
        </p>
      ) : null}
    </main>
  );
}
