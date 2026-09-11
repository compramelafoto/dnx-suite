import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { calcularPrecios, formatearPesos, type ModoDescarga } from "@/lib/precios";

/**
 * El enlace permanente de venta del profesional (capítulo 6.1).
 *
 * Es la única página que el fotógrafo comparte con sus clientes, y no cambia entre
 * eventos: la configura una vez y manda siempre el mismo link.
 *
 * La marca que domina acá es la del vendedor, no la nuestra.
 */

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function PaginaDeVenta({ params }: Props) {
  const { slug } = await params;

  const perfil = await prisma.subilafotoSellerProfile.findUnique({
    where: { slug },
    select: {
      displayName: true,
      headline: true,
      description: true,
      logoUrl: true,
      brandColor: true,
      basePriceCents: true,
      downloadMode: true,
      downloadPercentBps: true,
      downloadPriceCents: true,
      isPublished: true,
    },
  });

  // Un perfil sin publicar no existe para el público: mismo 404, sin pistas.
  if (!perfil || !perfil.isPublished) notFound();

  const precios = calcularPrecios({
    basePriceCents: perfil.basePriceCents,
    downloadMode: perfil.downloadMode as ModoDescarga,
    downloadPercentBps: perfil.downloadPercentBps,
    downloadPriceCents: perfil.downloadPriceCents,
  });

  const acento = perfil.brandColor ?? "var(--slf-violeta)";

  return (
    <main className="sobre-claro mx-auto max-w-2xl px-6 py-16 sm:py-24">
      <header>
        {perfil.logoUrl ? (
          <Image
            src={perfil.logoUrl}
            alt={perfil.displayName}
            width={200}
            height={80}
            className="mb-8 h-auto w-auto max-h-16"
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
          El evento
        </p>
        <p className="mt-1 text-[clamp(2rem,6vw,3rem)] font-extrabold leading-none">
          {formatearPesos(precios.baseCents)}
        </p>

        <ul className="mt-8 space-y-3 text-[0.95rem]" style={{ color: "var(--slf-lila)" }}>
          <li>Código QR para que los invitados suban sus fotos desde el celular.</li>
          <li>Sin instalar ninguna aplicación y sin crearse una cuenta.</li>
          <li>Moderación automática antes de que algo aparezca en pantalla.</li>
          <li>Proyección en vivo durante el evento y álbum digital para compartir.</li>
        </ul>

        {precios.adicionalCents === null ? (
          <p className="mt-8 border-t pt-6 text-[0.95rem]" style={{ borderColor: "#ffffff22" }}>
            La descarga de todo el material está incluida.
          </p>
        ) : (
          <div className="mt-8 border-t pt-6" style={{ borderColor: "#ffffff22" }}>
            <p className="text-[0.95rem]">
              Podés sumar la <strong>descarga de todo el material</strong> por{" "}
              <strong style={{ color: "var(--slf-amarillo)" }}>
                {formatearPesos(precios.adicionalCents)}
              </strong>{" "}
              más. Total {formatearPesos(precios.totalCents)}.
            </p>
            <p className="mt-3 text-sm" style={{ color: "var(--slf-lila)" }}>
              Podés decidirlo ahora o después del evento. El álbum queda disponible 30 días
              para verlo y compartirlo, con o sin descarga.
            </p>
          </div>
        )}
      </section>

      <div className="mt-10">
        <button
          type="button"
          disabled
          className="w-full rounded-xl px-8 py-4 text-lg font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          style={{ background: acento }}
        >
          Contratar
        </button>
        <p className="mt-3 text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
          El pago se habilita en octubre.
        </p>
      </div>
    </main>
  );
}
