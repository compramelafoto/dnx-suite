import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { comprarEvento } from "@/app/actions/comprar";
import { calcularPrecios, formatearPesos, type ModoDescarga } from "@/lib/precios";
import { estiloBotonDnx } from "@/lib/boton-dnx";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
};

/**
 * Los datos del comprador, antes de ir a pagar.
 *
 * Tres campos y uno es opcional. Cada campo de más es una venta menos, y acá no hace falta
 * nada más: el nombre para saber de quién es el evento y el correo para mandarle el acceso.
 * Los datos de la tarjeta no pasan por acá — eso ocurre entero dentro de Mercado Pago.
 */
export default async function Comprar({ params, searchParams }: Props) {
  const { slug } = await params;
  const { error } = await searchParams;

  const perfil = await prisma.subilafotoSellerProfile.findUnique({
    where: { slug },
    select: {
      displayName: true,
      brandColor: true,
      isPublished: true,
      basePriceCents: true,
      downloadMode: true,
      downloadPercentBps: true,
      downloadPriceCents: true,
    },
  });
  if (!perfil || !perfil.isPublished) notFound();

  const precios = calcularPrecios({
    basePriceCents: perfil.basePriceCents,
    downloadMode: perfil.downloadMode as ModoDescarga,
    downloadPercentBps: perfil.downloadPercentBps,
    downloadPriceCents: perfil.downloadPriceCents,
  });

  const acento = perfil.brandColor ?? "var(--slf-violeta)";

  return (
    <main className="sobre-claro mx-auto max-w-xl px-6 py-16 sm:py-20">
      <Link
        href={`/v/${slug}`}
        className="text-sm font-extrabold"
        style={{ color: acento }}
      >
        ← Volver
      </Link>

      <h1 className="mt-6 text-[clamp(1.6rem,4.5vw,2.25rem)] font-extrabold leading-[1.15] tracking-[-0.02em]">
        Contratar con {perfil.displayName}
      </h1>

      <div
        className="mt-8 rounded-2xl px-6 py-5"
        style={{ background: "var(--slf-purpura)", color: "white" }}
      >
        <div className="flex items-baseline justify-between gap-4">
          <span style={{ color: "var(--slf-lila)" }}>El evento</span>
          <strong className="text-2xl font-extrabold">
            {formatearPesos(precios.baseCents)}
          </strong>
        </div>
        {precios.adicionalCents !== null ? (
          <p className="mt-4 text-sm" style={{ color: "var(--slf-lila)" }}>
            La descarga de todo el material se compra después del evento, por{" "}
            {formatearPesos(precios.adicionalCents)}. Ahora pagás sólo el evento.
          </p>
        ) : (
          <p className="mt-4 text-sm" style={{ color: "var(--slf-lila)" }}>
            La descarga de todo el material está incluida.
          </p>
        )}
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-8 rounded-xl px-5 py-4"
          style={{ background: "#ff9a9a22", color: "#8a1c1c" }}
        >
          {error}
        </p>
      ) : null}

      <form action={comprarEvento} className="mt-8 space-y-5">
        <input type="hidden" name="slug" value={slug} />

        <label className="block">
          <span className="text-sm font-extrabold">Tu nombre</span>
          <input
            type="text"
            name="nombre"
            required
            maxLength={120}
            autoComplete="name"
            className="mt-2 w-full rounded-xl border px-4 py-3"
            style={{ borderColor: "var(--slf-borde)" }}
          />
        </label>

        <label className="block">
          <span className="text-sm font-extrabold">Tu correo</span>
          <input
            type="email"
            name="email"
            required
            maxLength={200}
            autoComplete="email"
            className="mt-2 w-full rounded-xl border px-4 py-3"
            style={{ borderColor: "var(--slf-borde)" }}
          />
          <span className="mt-2 block text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
            Ahí te mandamos el acceso al evento.
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-extrabold">
            Tu teléfono{" "}
            <span className="font-normal" style={{ color: "var(--slf-tinta-suave)" }}>
              (opcional)
            </span>
          </span>
          <input
            type="tel"
            name="telefono"
            maxLength={40}
            autoComplete="tel"
            className="mt-2 w-full rounded-xl border px-4 py-3"
            style={{ borderColor: "var(--slf-borde)" }}
          />
        </label>

        <button
          type="submit"
          className="w-full"
          style={{ ...estiloBotonDnx("primario"), background: acento, color: "white" }}
        >
          Ir a pagar {formatearPesos(precios.baseCents)}
        </button>

        <p className="text-sm leading-relaxed" style={{ color: "var(--slf-tinta-suave)" }}>
          El pago se hace dentro de Mercado Pago. Nunca vemos ni guardamos los datos de tu
          tarjeta. Al continuar aceptás los{" "}
          <Link href="/terminos" className="underline underline-offset-2">
            términos
          </Link>{" "}
          y la{" "}
          <Link href="/privacidad" className="underline underline-offset-2">
            política de privacidad
          </Link>
          .
        </p>
      </form>
    </main>
  );
}
