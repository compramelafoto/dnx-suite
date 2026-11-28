import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { HIDDEN_ALBUM_GRANT_COOKIE } from "@/lib/hidden-album-audit";
import { filterPublicAlbumPhotosForHiddenVisitor } from "@/lib/hidden-album/filter-public-album-photos";
import { isAlbumReadyToSellForCheckout } from "@/lib/albums/album-sales-readiness-server";
import { toDesignTemplatePayload, type DesignTemplatePayload } from "@/lib/design-v2/client-payload";
import ProtectedAlbumWrapper from "@/components/photo/ProtectedAlbumWrapper";
import CompraDirectaFlow from "@/components/compra-directa/CompraDirectaFlow";
import { productosParaLlevar } from "@/lib/compra-directa/productos-del-album";
import { cursosDelAlbumParaElLibrito } from "@/lib/compra-directa/cursos-del-album";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "¿Qué querés llevar? | ComprameLaFoto",
  robots: { index: false, follow: false },
};

function Aviso({ titulo, texto, href, link }: { titulo: string; texto: string; href?: string; link?: string }) {
  return (
    <section className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-2xl border border-[#e7e1da] bg-white p-6">
        <h1 className="m-0 text-xl font-semibold text-[#1f2328]">{titulo}</h1>
        <p className="m-0 mt-2 text-[#4b4f56]">{texto}</p>
        {href ? (
          <p className="m-0 mt-5">
            <Link href={href} className="font-medium text-[#a8652e] underline">
              {link ?? "Ir a la galería"}
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Compra directa en un álbum con fotos ocultas hasta la selfie (el colegio): primero «¿Qué querés
 * llevar?» con los productos y sus precios, después la selfie, después una foto por casillero
 * (el librito pide su tapa y su contratapa) y al final un solo pago con Mercado Pago.
 *
 * Quien ya pagó un pack no compra acá: el botón «Ya pagué mi pack» lo lleva a recuperar su link
 * personal de canje.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const albumId = Number.parseInt(id, 10);
  if (!Number.isFinite(albumId)) return <Aviso titulo="No encontramos la galería" texto="Revisá el link." />;

  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: {
      id: true,
      title: true,
      publicSlug: true,
      userId: true,
      isTest: true,
      deletedAt: true,
      isHidden: true,
      hiddenPhotosEnabled: true,
      scanProtectionEnabled: true,
      enableDigitalPhotos: true,
      enablePrintedPhotos: true,
      includeDigitalWithPrint: true,
      digitalPhotoPriceCents: true,
      albumProfitMarginPercent: true,
      selectedLabId: true,
      pickupBy: true,
      printPricingSource: true,
      termsAcceptedAt: true,
      termsVersion: true,
      user: { select: { name: true } },
      photos: {
        where: { isRemoved: false },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, previewUrl: true, originalKey: true, sellPrint: true, sellDigital: true },
      },
    },
  });
  const galeriaHref = album?.publicSlug ? `/album/${album.publicSlug}` : `/a/${albumId}`;
  if (!album || album.deletedAt) return <Aviso titulo="No encontramos la galería" texto="Revisá el link." />;

  const viewer = await getAuthUser().catch(() => null);
  const esDelFotografo = viewer != null && (viewer.id === album.userId || viewer.role === "ADMIN");
  if (album.isHidden && !esDelFotografo) {
    return <Aviso titulo="La galería no está disponible" texto="Escribile al fotógrafo para que la vuelva a abrir." />;
  }
  if (album.isTest && !esDelFotografo) {
    return <Aviso titulo="Esta galería está en modo prueba" texto="Todavía no se puede comprar." />;
  }
  if (album.photos.length === 0) {
    return (
      <Aviso
        titulo="Las fotos todavía no están"
        texto="Cuando el fotógrafo las publique vas a poder comprarlas con este mismo link."
      />
    );
  }
  const listo = await isAlbumReadyToSellForCheckout(album).catch(() => false);
  if (!listo) {
    return (
      <Aviso
        titulo="Todavía no se puede comprar"
        texto="El fotógrafo está terminando de preparar la venta de esta galería."
        href={galeriaHref}
        link="Ver la galería"
      />
    );
  }

  const { productos, plantillas } = await productosParaLlevar({
    id: album.id,
    userId: album.userId,
    enableDigitalPhotos: album.enableDigitalPhotos,
    enablePrintedPhotos: album.enablePrintedPhotos,
    photos: album.photos,
  });
  if (productos.length === 0) {
    return <Aviso titulo="Todavía no se puede comprar" texto="Esta galería no tiene productos a la venta." href={galeriaHref} />;
  }

  const grantCookie = (await cookies()).get(HIDDEN_ALBUM_GRANT_COOKIE)?.value ?? null;
  const visible = await filterPublicAlbumPhotosForHiddenVisitor(
    album.id,
    album.hiddenPhotosEnabled,
    album.photos.map((p) => ({ id: p.id, previewUrl: p.previewUrl ?? "", originalKey: p.originalKey })),
    { photographerBypassGrant: esDelFotografo, simulateClientView: false, grantCookieValue: grantCookie }
  );
  // Sin fotos ocultas no hay selfie: se elige de toda la galería.
  const conPermiso = !album.hiddenPhotosEnabled || visible.initialHasGrant;
  const permitidas = new Set(visible.photos.map((p) => p.id));
  const photos = conPermiso
    ? album.photos
        .filter((p) => !album.hiddenPhotosEnabled || permitidas.has(p.id))
        .map((p) => ({ id: p.id, sellPrint: p.sellPrint !== false, sellDigital: p.sellDigital !== false }))
    : [];

  const designs: Array<{ benefitKey: string; template: DesignTemplatePayload }> = productos.flatMap((p) => {
    const plantilla = p.productId != null ? plantillas.get(p.productId) : undefined;
    return plantilla ? [{ benefitKey: p.key, template: toDesignTemplatePayload(plantilla.template) }] : [];
  });
  const cursos = designs.length > 0 ? await cursosDelAlbumParaElLibrito(album.id) : [];

  return (
    <ProtectedAlbumWrapper albumId={album.id} enableProtection>
      <CompraDirectaFlow
        album={{
          id: album.id,
          title: album.title,
          photographerName: album.user?.name ?? null,
          galeriaHref,
          hiddenPhotos: album.hiddenPhotosEnabled,
        }}
        productos={productos}
        conPermiso={conPermiso}
        selfieSinFotos={album.hiddenPhotosEnabled && visible.initialHasGrant && visible.photos.length === 0}
        photos={photos}
        designs={designs}
        cursos={cursos}
        comprador={{ nombre: viewer?.name ?? "", email: viewer?.email ?? "" }}
      />
    </ProtectedAlbumWrapper>
  );
}
