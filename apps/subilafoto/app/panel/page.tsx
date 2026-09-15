import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";

export const dynamic = "force-dynamic";

/** Inicio del panel del profesional. Por ahora sólo confirma quién entró. */
export default async function Panel() {
  const almacen = await cookies();
  const token = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = token ? await getSessionUserByRawToken(token) : null;

  if (!usuario) redirect("/login?next=%2Fpanel");

  // El enlace a la salud de la plataforma sólo para quien la administra: para un
  // fotógrafo no es información útil y sí es información de más.
  const fila = await prisma.user.findUnique({
    where: { id: usuario.id },
    select: { globalRole: true },
  });
  const esAdmin = fila?.globalRole === "SUPER_ADMIN" || fila?.globalRole === "PLATFORM_SUPPORT";

  return (
    <main className="sobre-claro mx-auto max-w-2xl px-6 py-20">
      <h1 className="text-3xl font-extrabold">Hola{usuario.name ? `, ${usuario.name}` : ""}</h1>
      <p className="mt-4 text-lg" style={{ color: "var(--slf-tinta-suave)" }}>
        Entraste con {usuario.email}. El panel se construye en los próximos días: acá vas a
        crear tu enlace de venta y administrar tus eventos.
      </p>

      {esAdmin ? (
        <p className="mt-8">
          <a
            href="/panel/salud"
            className="inline-flex min-h-[44px] items-center font-extrabold underline underline-offset-4"
            style={{ color: "var(--slf-violeta)" }}
          >
            Cómo va la noche
          </a>
        </p>
      ) : null}

      <form action="/api/auth/logout" method="post" className="mt-10">
        <button
          type="submit"
          className="rounded-xl px-6 py-3 font-extrabold text-white"
          style={{ background: "var(--slf-violeta)" }}
        >
          Salir
        </button>
      </form>
    </main>
  );
}
