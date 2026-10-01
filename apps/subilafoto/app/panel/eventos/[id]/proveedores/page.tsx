import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";
import { qrDelEvento } from "@/lib/qr";
import { categoriaDelEnlace, nombreDeCategoria } from "@/lib/proveedores/categorias";
import { BotonDeCategoria, BotonDeEnlace } from "./boton";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    "http://localhost:3012"
  );
}

const FECHA = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });

/**
 * Los proveedores del evento.
 *
 * Un enlace para compartir con los que trabajaron esa noche, y la lista de los que ya se
 * anotaron. La lista importa tanto como el enlace: sin ella, el fotógrafo no sabe si
 * mandarlo otra vez o dejar de insistir.
 */
export default async function ProveedoresDelEvento({ params }: Props) {
  const { id } = await params;

  const almacen = await cookies();
  const cookie = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = cookie ? await getSessionUserByRawToken(cookie) : null;
  if (!usuario) {
    redirect(`/login?next=${encodeURIComponent(`/panel/eventos/${id}/proveedores`)}`);
  }

  const evento = await prisma.subilafotoEvent.findFirst({
    where: { id, sellerProfile: { userId: usuario.id } },
    select: {
      id: true,
      name: true,
      links: {
        where: { kind: "VENDOR", revokedAt: null },
        orderBy: { createdAt: "asc" },
        select: { id: true, token: true, usageCount: true, label: true },
      },
      vendors: {
        orderBy: { createdAt: "desc" },
        select: { id: true, partnerId: true, category: true, roleNote: true, createdAt: true },
      },
    },
  });
  if (!evento) notFound();

  // El general es el que no tiene rubro; el resto son los de categoría.
  const enlace = evento.links.find((l) => !categoriaDelEnlace(l.label));
  const porCategoria = evento.links
    .map((l) => ({ ...l, categoria: categoriaDelEnlace(l.label) }))
    .filter((l): l is typeof l & { categoria: string } => l.categoria !== null);
  const url = enlace ? `${baseUrl()}/p/${enlace.token}` : null;
  const svg = url ? await qrDelEvento(url) : null;

  // Los nombres viven en la base común de empresas, no en la tabla del evento.
  const empresas = await prisma.dnxPartner.findMany({
    where: { id: { in: evento.vendors.map((v) => v.partnerId) } },
    select: { id: true, name: true, city: true },
  });
  const nombrePorId = new Map(empresas.map((e) => [e.id, e]));

  return (
    <main className="sobre-claro mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-extrabold leading-tight">Proveedores del evento</h1>
      <p className="mt-3" style={{ color: "var(--slf-tinta-suave)" }}>
        {evento.name}
      </p>

      <p className="mt-6" style={{ color: "var(--slf-tinta-suave)" }}>
        Compartí este enlace con el salón, el catering, el DJ y quien haya trabajado esa
        noche. Cada uno completa su ficha en dos minutos y queda registrado en el evento.
      </p>

      {url && svg ? (
        <div
          className="mt-8 flex flex-col items-center rounded-2xl border p-8"
          style={{ borderColor: "var(--slf-borde)", background: "white" }}
        >
          {/* El SVG lo genera nuestro propio código, no viene de datos de nadie. */}
          <div className="w-[min(14rem,60vw)]" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="mt-6 break-all text-center text-sm font-extrabold">
            {url.replace(/^https?:\/\//, "")}
          </p>
          <p className="mt-2 text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
            Abierto {enlace!.usageCount} {enlace!.usageCount === 1 ? "vez" : "veces"}
          </p>
        </div>
      ) : (
        <BotonDeEnlace eventoId={evento.id} />
      )}

      {enlace ? (
        <section className="mt-10">
          <h2 className="text-xl font-extrabold">Enlaces por rubro</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
            El de arriba sirve para todos. Estos ya vienen con el rubro puesto, así que
            quien lo abre no tiene que elegirlo de una lista de treinta.
          </p>

          {porCategoria.length > 0 ? (
            <ul className="mt-5 space-y-2">
              {porCategoria.map((l) => (
                <li
                  key={l.id}
                  className="rounded-xl border px-5 py-3"
                  style={{ borderColor: "var(--slf-borde)", background: "white" }}
                >
                  <p className="font-extrabold">{nombreDeCategoria(l.categoria)}</p>
                  <p className="mt-1 break-all text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
                    {`${baseUrl()}/p/${l.token}`.replace(/^https?:\/\//, "")}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}

          <BotonDeCategoria
            eventoId={evento.id}
            yaCreadas={porCategoria.map((l) => l.categoria)}
          />
        </section>
      ) : null}

      <h2 className="mt-12 text-xl font-extrabold">
        Anotados ({evento.vendors.length})
      </h2>

      {evento.vendors.length === 0 ? (
        <p className="mt-3 text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
          Todavía no se anotó nadie. En cuanto alguien complete la ficha, aparece acá.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {evento.vendors.map((v) => {
            const empresa = nombrePorId.get(v.partnerId);
            return (
              <li
                key={v.id}
                className="rounded-xl border px-5 py-4"
                style={{ borderColor: "var(--slf-borde)", background: "white" }}
              >
                <p className="font-extrabold">{empresa?.name ?? "Empresa sin nombre"}</p>
                <p className="mt-1 text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
                  {nombreDeCategoria(v.category)}
                  {empresa?.city ? ` · ${empresa.city}` : ""}
                  {` · ${FECHA.format(v.createdAt)}`}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <a
        href={`/panel/eventos/${evento.id}`}
        className="mt-12 inline-block text-sm font-extrabold"
        style={{ color: "var(--slf-violeta)" }}
      >
        ← Volver al evento
      </a>
    </main>
  );
}
