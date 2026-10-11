import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";
import { estiloBotonDnx } from "@/lib/boton-dnx";
import { eventoQueAdministra } from "@/lib/acceso-al-evento";
import { faltanImprescindibles, puntosDePreparacion } from "@/lib/preparacion";
import { Preparacion } from "./preparacion";
import { QueVen } from "./que-ven";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function DetalleEvento({ params }: Props) {
  const { id } = await params;

  const almacen = await cookies();
  const token = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = token ? await getSessionUserByRawToken(token) : null;
  if (!usuario) redirect(`/login?next=${encodeURIComponent(`/panel/eventos/${id}`)}`);

  const evento = await prisma.subilafotoEvent.findFirst({
    // El filtro por dueño va en el where, no en un if después de leer: así un evento
    // ajeno directamente no se trae de la base.
    where: eventoQueAdministra(id, usuario.id),
    select: {
      name: true,
      code: true,
      screenCode: true,
      status: true,
      activationAt: true,
      deactivationAt: true,
      timezone: true,
      venueName: true,
      themeTokens: true,
      coverUrl: true,
      hostsLabel: true,
      preparacion: true,
      guestsCanSeeAlbum: true,
      guestsCanSeeLive: true,
      sellerProfile: { select: { logoUrl: true, bannerUrl: true } },
    },
  });

  if (!evento) notFound();

  /*
    La preparación del evento. Nace de la fiesta del 10/10/2026, que no se hizo porque el
    salón no tenía pantalla: el producto depende de cosas del mundo físico que nadie le
    preguntó a nadie. Lo que el sistema puede ver, lo comprueba; lo del salón, se confirma.
  */
  const guardado = (evento.preparacion ?? {}) as Record<string, string>;
  const puntos = puntosDePreparacion(
    {
      tieneHorario: Boolean(evento.activationAt && evento.deactivationAt),
      tienePlantilla: evento.themeTokens !== null,
      tienePortada: Boolean(evento.coverUrl),
      tieneAnfitriones: Boolean(evento.hostsLabel?.trim()),
      tieneLogo: Boolean(evento.sellerProfile.logoUrl),
      tieneBanner: Boolean(evento.sellerProfile.bannerUrl),
      confirmado: guardado,
    },
    id,
  );
  const faltan = faltanImprescindibles(puntos);

  const enZona = (fecha: Date | null) =>
    fecha
      ? new Intl.DateTimeFormat("es-AR", {
          dateStyle: "full",
          timeStyle: "short",
          timeZone: evento.timezone,
        }).format(fecha)
      : "sin definir";

  return (
    <main className="sobre-claro mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm font-extrabold" style={{ color: "var(--slf-violeta-texto)" }}>
        En configuración
      </p>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight">{evento.name}</h1>
      {evento.venueName ? (
        <p className="mt-2" style={{ color: "var(--slf-tinta-suave)" }}>
          {evento.venueName}
        </p>
      ) : null}

      <dl className="mt-10 space-y-6">
        <div>
          <dt className="text-sm font-extrabold">Abre</dt>
          <dd style={{ color: "var(--slf-tinta-suave)" }}>{enZona(evento.activationAt)}</dd>
        </div>
        <div>
          <dt className="text-sm font-extrabold">Cierra</dt>
          <dd style={{ color: "var(--slf-tinta-suave)" }}>{enZona(evento.deactivationAt)}</dd>
        </div>
      </dl>

      <section className="mt-12">
        <h2 className="text-lg font-extrabold">Qué ven los invitados</h2>
        <p className="mt-2" style={{ color: "var(--slf-tinta-suave)" }}>
          Dos cosas distintas, y conviene no confundirlas.
        </p>
        <QueVen
          eventoId={id}
          interruptores={[
            {
              campo: "guestsCanSeeLive",
              titulo: "Muro en vivo",
              ayuda:
                "En su teléfono ven las últimas fotos que llegaron, en chico y sin poder bajarlas, sólo mientras la fiesta corre. Si el salón no tiene pantalla, esto es lo único que devuelve algo a quien sube una foto.",
              encendido: evento.guestsCanSeeLive,
            },
            {
              campo: "guestsCanSeeAlbum",
              titulo: "Álbum completo",
              ayuda:
                "Todas las fotos del evento, para siempre. Encendido, cualquiera con el QR puede recorrer y guardarse el material antes de que lo vendas.",
              encendido: evento.guestsCanSeeAlbum,
            },
          ]}
        />
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-extrabold">Antes de la fiesta</h2>
        <p className="mt-2" style={{ color: "var(--slf-tinta-suave)" }}>
          {faltan === 0
            ? "Está todo listo."
            : faltan === 1
              ? "Falta 1 cosa sin la que la fiesta se queda sin sistema."
              : `Faltan ${faltan} cosas sin las que la fiesta se queda sin sistema.`}
        </p>
        <Preparacion eventoId={id} puntos={puntos} />
      </section>

      <section
        className="mt-10 rounded-2xl p-7"
        style={{ background: "var(--slf-purpura)", color: "white" }}
      >
        <p className="text-sm" style={{ color: "var(--slf-lila)" }}>
          Código para los invitados
        </p>
        <p className="mt-1 font-extrabold tracking-[0.2em]" style={{ fontSize: "2.5rem" }}>
          {evento.code}
        </p>
        <p className="mt-6 text-sm" style={{ color: "var(--slf-lila)" }}>
          El QR y los materiales para imprimir se generan en el próximo paso.
        </p>
      </section>

      <p className="mt-8 text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
        El código de la pantalla es distinto y no se comparte con los invitados.
      </p>

      <nav className="mt-10 flex flex-wrap gap-4">
        {[
          { href: `/panel/eventos/${id}/pantalla`, texto: "Pantalla y proyección" },
          { href: `/panel/eventos/${id}/control`, texto: "Control en vivo" },
          { href: `/panel/eventos/${id}/moderacion`, texto: "Moderación" },
          { href: `/panel/eventos/${id}/portada`, texto: "Portada y nombre" },
          { href: `/panel/eventos/${id}/plantilla`, texto: "Estilo" },
          { href: `/panel/eventos/${id}/qr`, texto: "QR y materiales" },
          { href: `/panel/eventos/${id}/proveedores`, texto: "Proveedores" },
        ].map((enlace) => (
          <Link
            key={enlace.href}
            href={enlace.href}
            style={{
              ...estiloBotonDnx("secundario"),
              color: "var(--slf-violeta-texto)",
              border: "1px solid var(--slf-violeta)",
            }}
          >
            {enlace.texto}
          </Link>
        ))}
      </nav>
    </main>
  );
}
