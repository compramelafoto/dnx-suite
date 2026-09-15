import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { urlDelLogo } from "@/lib/logo-url";
import { formatearPesos } from "@/lib/precios";
import { calcularVenta } from "@/lib/pagos/venta";
import { estiloBotonDnx } from "@/lib/boton-dnx";

/**
 * El enlace permanente de venta del profesional (capítulo 6.1).
 *
 * Es la única página que el fotógrafo comparte con sus clientes, y no cambia entre
 * eventos: la configura una vez y manda siempre el mismo link.
 *
 * La marca que domina acá es la del vendedor, no la nuestra.
 */

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ descarga?: string }>;
};

export default async function PaginaDeVenta({ params, searchParams }: Props) {
  const { slug } = await params;
  // El fotógrafo comparte uno de dos enlaces. El que abre el cliente decide qué compra.
  const conDescarga = (await searchParams).descarga === "si";

  const perfil = await prisma.subilafotoSellerProfile.findUnique({
    where: { slug },
    select: {
      displayName: true,
      headline: true,
      description: true,
      logoUrl: true,
      brandColor: true,
      basePriceCents: true,
      isPublished: true,
    },
  });

  // Un perfil sin publicar no existe para el público: mismo 404, sin pistas.
  if (!perfil || !perfil.isPublished) notFound();

  if (perfil.basePriceCents <= 0) notFound();
  const venta = calcularVenta({ baseCents: perfil.basePriceCents, conDescarga });

  const acento = perfil.brandColor ?? "var(--slf-violeta)";
  const logo = await urlDelLogo(perfil.logoUrl);

  return (
    <main className="sobre-claro mx-auto max-w-2xl px-6 py-16 sm:py-24">
      <header>
        {logo ? (
          /*
            Sin `next/image`: cuando el logo está en nuestro bucket la dirección viene
            firmada y vence, así que no tiene sentido que el optimizador la cachee —y
            además no estaría en la lista de dominios permitidos.
          */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={logo}
            alt={perfil.displayName}
            className="mb-8 max-h-16 w-auto"
          />
        ) : null}

        <h1 className="text-[clamp(1.9rem,5vw,2.75rem)] font-extrabold leading-[1.1] tracking-[-0.02em]">
          {perfil.displayName}
        </h1>

        {perfil.headline ? (
          <p className="mt-3 text-lg" style={{ color: "var(--slf-tinta-suave)" }}>
            {perfil.headline}
          </p>
        ) : null}
      </header>

      {perfil.description ? (
        <p
          className="mt-10 max-w-[58ch] text-lg leading-relaxed"
          style={{ color: "var(--slf-tinta-suave)" }}
        >
          {perfil.description}
        </p>
      ) : null}

      <section
        className="mt-12 rounded-2xl p-8"
        style={{ background: "var(--slf-purpura)", color: "white" }}
      >
        <p className="text-sm" style={{ color: "var(--slf-lila)" }}>
          {conDescarga ? "El evento, con la descarga incluida" : "El evento"}
        </p>
        <p className="mt-1 text-[clamp(2rem,6vw,3rem)] font-extrabold leading-none">
          {formatearPesos(venta.totalCents)}
        </p>

        <ul className="mt-8 space-y-3 text-[0.95rem]" style={{ color: "var(--slf-lila)" }}>
          <li>Código QR para que los invitados suban sus fotos desde el celular.</li>
          <li>Sin instalar ninguna aplicación y sin crearse una cuenta.</li>
          <li>Moderación automática antes de que algo aparezca en pantalla.</li>
          <li>Proyección en vivo durante el evento y álbum digital para compartir.</li>
        </ul>

        {conDescarga ? (
          <div className="mt-8 border-t pt-6" style={{ borderColor: "#ffffff22" }}>
            <p className="text-[0.95rem]">
              Incluye la <strong>descarga de todas las fotos</strong> en su calidad
              original. Te llega por correo dentro de las 24 horas de terminado el evento.
            </p>
          </div>
        ) : (
          <div className="mt-8 border-t pt-6" style={{ borderColor: "#ffffff22" }}>
            <p className="text-[0.95rem]">
              El álbum queda disponible 30 días para verlo y compartirlo. Si querés
              llevarte todas las fotos en su calidad original, la descarga se compra
              después.
            </p>
          </div>
        )}

      </section>

      <div className="mt-10">
        <Link
          href={`/v/${slug}/comprar${conDescarga ? "?descarga=si" : ""}`}
          className="w-full text-lg sm:w-auto"
          style={{ ...estiloBotonDnx("primario"), background: acento, color: "white" }}
        >
          Contratar
        </Link>
      </div>
    </main>
  );
}
