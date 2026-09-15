import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { comprarAdicional } from "@/app/actions/adicional";
import { renovarEnlaces } from "@/app/actions/renovar";
import { estadoDelAdicional } from "@/lib/adicional";
import { condicionDePublicadas } from "@/lib/album";
import { formatearPesos } from "@/lib/precios";
import { nombreDeCategoria } from "@/lib/proveedores/categorias";
import { precioDeLaDescarga } from "@/lib/pagos/venta";
import { estiloBotonDnx } from "@/lib/boton-dnx";
import { sePuedeRenovar } from "@/lib/paquete/renovar";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string; pago?: string }>;
};

const FECHA = new Intl.DateTimeFormat("es-AR", { dateStyle: "long" });

/**
 * El panel del cliente: quien contrató el evento.
 *
 * Se entra con un enlace y sin cuenta. El enlace es la llave, así que se verifica que esté
 * vigente y no revocado en cada visita — un enlace que se compartió de más se puede
 * revocar sin tocar nada más.
 */
export default async function PanelDelCliente({ params, searchParams }: Props) {
  const { token } = await params;
  const { error, pago } = await searchParams;

  const enlace = await prisma.subilafotoAccessLink.findUnique({
    where: { token },
    select: {
      kind: true,
      revokedAt: true,
      expiresAt: true,
      event: {
        select: {
          id: true,
          name: true,
          code: true,
          downloadStatus: true,
          retentionUntil: true,
          guestsCanSeeAlbum: true,
          sellerProfile: {
            select: {
              displayName: true,
              brandColor: true,
              basePriceCents: true,
            },
          },
        },
      },
    },
  });

  const ahora = new Date();
  const vigente =
    enlace &&
    enlace.kind === "CLIENT" &&
    !enlace.revokedAt &&
    (!enlace.expiresAt || enlace.expiresAt > ahora);
  if (!vigente) notFound();

  const evento = enlace.event;
  const vendedor = evento.sellerProfile;
  const acento = vendedor.brandColor ?? "var(--slf-violeta)";

  const adicional = estadoDelAdicional({
    downloadStatus: evento.downloadStatus,
    adicionalCents: precioDeLaDescarga(vendedor.basePriceCents),
    retentionUntil: evento.retentionUntil,
    ahora,
  });

  const paquetes = await prisma.subilafotoPackage.findMany({
    where: { eventId: evento.id },
    orderBy: { partIndex: "asc" },
    select: {
      id: true,
      status: true,
      partIndex: true,
      partCount: true,
      itemCount: true,
      downloadToken: true,
      tokenExpiresAt: true,
      regenerations: true,
    },
  });

  const renovacion = sePuedeRenovar({
    paquetes,
    retentionUntil: evento.retentionUntil,
    ahora,
  });

  const publicadas = await prisma.subilafotoMedia.count({
    where: { ...condicionDePublicadas(evento.id), kind: "PHOTO" },
  });

  // Los proveedores de esa noche. Es lo que se les prometió cuando completaron su ficha:
  // que el evento les sirviera para que los vieran.
  const vendors = await prisma.subilafotoEventVendor.findMany({
    where: { eventId: evento.id },
    orderBy: { category: "asc" },
    select: { id: true, partnerId: true, category: true },
  });
  const empresas = await prisma.dnxPartner.findMany({
    where: { id: { in: vendors.map((v) => v.partnerId) }, archivedAt: null },
    select: { id: true, name: true, instagram: true, websiteUrl: true },
  });
  const empresaPorId = new Map(empresas.map((e) => [e.id, e]));

  return (
    <main className="sobre-claro mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm font-extrabold" style={{ color: acento }}>
        {vendedor.displayName}
      </p>
      <h1 className="mt-3 text-[clamp(1.7rem,5vw,2.5rem)] font-extrabold leading-[1.15] tracking-[-0.02em]">
        {evento.name}
      </h1>
      <p className="mt-3 text-lg" style={{ color: "var(--slf-tinta-suave)" }}>
        {publicadas === 0
          ? "Todavía no hay fotos publicadas."
          : `${publicadas} ${publicadas === 1 ? "foto" : "fotos"} en el álbum.`}
      </p>

      {pago === "listo" ? (
        <p className="mt-8 rounded-xl px-5 py-4" style={{ background: "#7ee2a822", color: "#14532d" }}>
          Recibimos tu pago. Preparamos el paquete y te avisamos por correo cuando esté.
        </p>
      ) : pago === "pendiente" ? (
        <p className="mt-8 rounded-xl px-5 py-4" style={{ background: "#ffc46b22", color: "#7c4a03" }}>
          Estamos esperando la confirmación de Mercado Pago. Puede tardar unos minutos.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-8 rounded-xl px-5 py-4" style={{ background: "#ff9a9a22", color: "#8a1c1c" }}>
          {error}
        </p>
      ) : null}

      {/*
        El álbum del cliente entra por su propio enlace y no por el del invitado: el
        interruptor que apaga el álbum es sobre los invitados, no sobre quien lo contrató.
      */}
      <p className="mt-10">
        <Link
          href={`/cliente/${token}/album`}
          className="font-extrabold underline underline-offset-4"
          style={{ color: acento }}
        >
          Ver el álbum del evento
        </Link>
        {evento.guestsCanSeeAlbum ? null : (
          <span className="ml-2 text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
            Sólo vos: el álbum está apagado para los invitados.
          </span>
        )}
      </p>

      <section
        className="mt-10 rounded-2xl p-7"
        style={{ background: "var(--slf-purpura)", color: "white" }}
      >
        <h2 className="text-xl font-extrabold">Descargar todo el material</h2>

        {paquetes.length > 0 ? (
          <div className="mt-5">
            {paquetes.every((p) => p.status === "READY") ? (
              <>
                <p className="leading-relaxed" style={{ color: "var(--slf-lila)" }}>
                  {paquetes.length === 1
                    ? "Tu paquete está listo."
                    : `Tu paquete viene en ${paquetes.length} partes. Bajalas todas.`}
                </p>
                <ul className="mt-4 space-y-2">
                  {paquetes.map((p) => (
                    <li key={p.id}>
                      <a
                        href={`/descarga/${p.downloadToken}`}
                        className="font-extrabold underline underline-offset-4"
                        style={{ color: "var(--slf-amarillo)" }}
                      >
                        Parte {p.partIndex} de {p.partCount}
                      </a>
                      {p.itemCount ? (
                        <span className="ml-2 text-sm" style={{ color: "var(--slf-lila)" }}>
                          {p.itemCount} fotos
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {renovacion.sePuede ? (
                  <form action={renovarEnlaces} className="mt-5">
                    <input type="hidden" name="token" value={token} />
                    <button
                      type="submit"
                      className="rounded-xl px-5 py-3 text-sm font-extrabold"
                      style={{
                        background: "transparent",
                        color: "var(--slf-amarillo)",
                        border: "2px solid var(--slf-amarillo)",
                        minHeight: "44px",
                      }}
                    >
                      Pedir enlaces nuevos
                    </button>
                  </form>
                ) : paquetes[0]?.tokenExpiresAt ? (
                  <p className="mt-4 text-sm" style={{ color: "var(--slf-lila)" }}>
                    Los enlaces valen hasta el {FECHA.format(paquetes[0].tokenExpiresAt)}. Después
                    pedís unos nuevos desde acá.
                  </p>
                ) : null}
              </>
            ) : paquetes.some((p) => p.status === "FAILED") ? (
              <p className="leading-relaxed" style={{ color: "var(--slf-lila)" }}>
                Algo falló al armar tu paquete. Ya lo estamos viendo: si no tenés noticias en
                unas horas, escribinos.
              </p>
            ) : (
              <p className="leading-relaxed" style={{ color: "var(--slf-lila)" }}>
                Estamos armando tu paquete. Te avisamos por correo cuando esté, dentro de las
                próximas 24 horas.
              </p>
            )}
          </div>
        ) : null}

        {adicional.sePuede ? (
          <>
            <p className="mt-4 leading-relaxed" style={{ color: "var(--slf-lila)" }}>
              Te llevás todas las fotos en su calidad original, en un solo archivo. Es tuyo
              y no lo alcanza el borrado a los 30 días.
            </p>
            <p className="mt-6 text-3xl font-extrabold">
              {formatearPesos(adicional.precioCents)}
            </p>
            <form action={comprarAdicional} className="mt-6">
              <input type="hidden" name="token" value={token} />
              <button
                type="submit"
                style={{ ...estiloBotonDnx("primario"), background: "var(--slf-amarillo)", color: "#050505" }}
              >
                Comprar la descarga
              </button>
            </form>
          </>
        ) : (
          <p className="mt-4 leading-relaxed" style={{ color: "var(--slf-lila)" }}>
            {adicional.motivo}
          </p>
        )}

        {evento.retentionUntil ? (
          <p className="mt-6 border-t pt-5 text-sm" style={{ borderColor: "#ffffff22", color: "var(--slf-lila)" }}>
            El material se borra automáticamente el {FECHA.format(evento.retentionUntil)}.
          </p>
        ) : null}
      </section>

      {vendors.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-xl font-extrabold">Quiénes trabajaron esa noche</h2>
          <ul className="mt-5 space-y-3">
            {vendors.map((v) => {
              const empresa = empresaPorId.get(v.partnerId);
              if (!empresa) return null;
              const enlace = empresa.websiteUrl ?? null;
              return (
                <li
                  key={v.id}
                  className="rounded-xl border px-5 py-4"
                  style={{ borderColor: "var(--slf-borde)", background: "white" }}
                >
                  <p className="font-extrabold">
                    {enlace ? (
                      <a
                        href={enlace}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="underline underline-offset-4"
                        style={{ color: acento }}
                      >
                        {empresa.name}
                      </a>
                    ) : (
                      empresa.name
                    )}
                  </p>
                  <p className="mt-1 text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
                    {nombreDeCategoria(v.category)}
                    {empresa.instagram ? ` · ${empresa.instagram}` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
