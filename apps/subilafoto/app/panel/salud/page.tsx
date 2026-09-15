import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";
import { mirarLaSalud } from "@/lib/salud/mirar";

export const dynamic = "force-dynamic";

/**
 * Cómo va la noche.
 *
 * La pantalla que se mira el 10 de octubre. Está pensada para leerse de un vistazo desde
 * el teléfono, parado: primero el semáforo, después lo que hay que hacer, y recién al
 * final los números.
 *
 * Se recarga sola cada medio minuto. Un panel que hay que refrescar a mano es un panel
 * que nadie mira.
 */

const RELOJ = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" });

const COLOR = {
  bien: { fondo: "#7ee2a822", texto: "#14532d", punto: "#16a34a" },
  atrasado: { fondo: "#ffc46b22", texto: "#7c4a03", punto: "#d97706" },
  caido: { fondo: "#ff9a9a22", texto: "#8a1c1c", punto: "#dc2626" },
} as const;

const TITULO = {
  bien: "Todo corriendo",
  atrasado: "Algo se está atrasando",
  caido: "Hay algo que no está corriendo",
} as const;

export default async function Salud() {
  const almacen = await cookies();
  const cookie = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = cookie ? await getSessionUserByRawToken(cookie) : null;
  if (!usuario) redirect("/login?next=%2Fpanel%2Fsalud");

  /*
    Esta pantalla muestra el estado de **toda** la plataforma, no el de un evento. Por eso
    no alcanza con estar logueado: la sesión da acceso a lo propio, y acá no hay nada
    propio.
  */
  const fila = await prisma.user.findUnique({
    where: { id: usuario.id },
    select: { globalRole: true },
  });
  const esAdmin = fila?.globalRole === "SUPER_ADMIN" || fila?.globalRole === "PLATFORM_SUPPORT";

  if (!esAdmin) {
    return (
      <main className="sobre-claro mx-auto max-w-xl px-6 py-16">
        <h1 className="text-3xl font-extrabold">Salud del sistema</h1>
        <p className="mt-4 leading-relaxed" style={{ color: "var(--slf-tinta-suave)" }}>
          Esta pantalla es de la plataforma, no de tu cuenta, así que hace falta un usuario
          administrador. La misma información sale por <code>/api/salud</code> con la llave
          de servicio.
        </p>
      </main>
    );
  }

  const salud = await mirarLaSalud();
  const c = COLOR[salud.semaforo];

  return (
    <main className="sobre-claro mx-auto max-w-3xl px-6 py-12">
      {/* Sin JavaScript: la etiqueta del navegador alcanza y la pantalla no depende de
          que el cliente cargue nada. */}
      <meta httpEquiv="refresh" content="30" />

      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-3xl font-extrabold tracking-[-0.02em]">Cómo va la noche</h1>
        <p className="text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
          {RELOJ.format(salud.ahora)}
        </p>
      </div>

      <div
        className="mt-6 flex items-center gap-4 rounded-2xl px-6 py-5"
        style={{ background: c.fondo, color: c.texto }}
      >
        <span
          aria-hidden="true"
          className="h-4 w-4 shrink-0 rounded-full"
          style={{ background: c.punto }}
        />
        <p className="text-xl font-extrabold">{TITULO[salud.semaforo]}</p>
      </div>

      {salud.alertas.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xl font-extrabold">Qué hacer</h2>
          <ul className="mt-4 space-y-4">
            {salud.alertas.map((a) => {
              const ca = a.gravedad === "grave" ? COLOR.caido : COLOR.atrasado;
              return (
                <li key={a.clave} className="rounded-xl px-5 py-4" style={{ background: ca.fondo }}>
                  <p className="font-extrabold" style={{ color: ca.texto }}>
                    {a.titulo}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--slf-tinta)" }}>
                    {a.queHacer}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="text-xl font-extrabold">Las tareas automáticas</h2>
        <ul className="mt-4 space-y-2">
          {salud.crones.map((cron) => {
            const cc = COLOR[cron.diagnostico.estado];
            return (
              <li
                key={cron.nombre}
                className="flex items-center gap-4 rounded-xl border px-5 py-3"
                style={{ borderColor: "var(--slf-borde)", background: "white" }}
              >
                <span
                  aria-hidden="true"
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ background: cc.punto }}
                />
                <span className="font-extrabold">{cron.nombre}</span>
                <span className="ml-auto text-right text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
                  {cron.diagnostico.detalle}
                  <span className="ml-2 opacity-60">(cada {cron.cadencia} min)</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-extrabold">
          Eventos abiertos ({salud.eventosActivos.length})
        </h2>
        {salud.eventosActivos.length === 0 ? (
          <p className="mt-3 text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
            Ninguno en este momento.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {salud.eventosActivos.map((e) => (
              <li
                key={e.code}
                className="rounded-xl border px-5 py-3"
                style={{ borderColor: "var(--slf-borde)", background: "white" }}
              >
                <p className="font-extrabold">
                  {e.name} <span className="font-medium opacity-60">{e.code}</span>
                </p>
                <p className="mt-1 text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
                  {e.fotos} {e.fotos === 1 ? "foto" : "fotos"}
                  {e.cierra ? ` · cierra ${RELOJ.format(e.cierra)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
          {salud.fotosUltimaHora} {salud.fotosUltimaHora === 1 ? "foto subida" : "fotos subidas"} en
          la última hora.
        </p>
      </section>
    </main>
  );
}
