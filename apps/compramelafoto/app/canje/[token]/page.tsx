import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { loadExternalVoucherByToken, EXTERNAL_VOUCHER_ERROR_MESSAGES } from "@/lib/canje-externo/external-voucher";
import { resolveComboPrintProduct } from "@/lib/canje-externo/combo-print-product";
import { filterPublicAlbumPhotosForHiddenVisitor } from "@/lib/hidden-album/filter-public-album-photos";
import { HIDDEN_ALBUM_GRANT_COOKIE } from "@/lib/hidden-album-audit";
import ProtectedAlbumWrapper from "@/components/photo/ProtectedAlbumWrapper";
import HiddenAlbumVerificationGate from "@/components/photo/HiddenAlbumVerificationGate";
import CanjeFlow from "@/components/canje-externo/CanjeFlow";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Elegí las fotos de tu combo | ComprameLaFoto",
  robots: { index: false, follow: false },
};

function Aviso({ titulo, texto, albumHref }: { titulo: string; texto: string; albumHref?: string }) {
  return (
    <section className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-2xl border border-[#e7e1da] bg-white p-6">
        <h1 className="m-0 text-xl font-semibold text-[#1f2328]">{titulo}</h1>
        <p className="m-0 mt-2 text-[#4b4f56]">{texto}</p>
        {albumHref ? (
          <p className="m-0 mt-5">
            <Link href={albumHref} className="font-medium text-[#a8652e] underline">
              Ir a la galería
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Página de canje de un combo cobrado por fuera (`lib/canje-externo`). El link es de una
 * familia y dice qué álbum es. Respeta las mismas reglas de acceso que la galería:
 * en un álbum con fotos ocultas, primero la verificación con selfie y después sólo las
 * fotos de esa persona.
 */
export default async function CanjePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const lookup = await loadExternalVoucherByToken(token);
  if (!lookup.ok) {
    return <Aviso titulo="No pudimos abrir tu combo" texto={EXTERNAL_VOUCHER_ERROR_MESSAGES[lookup.error]} />;
  }
  const { voucher } = lookup;

  const album = await prisma.album.findUnique({
    where: { id: voucher.albumId },
    select: {
      id: true,
      title: true,
      publicSlug: true,
      userId: true,
      deletedAt: true,
      isHidden: true,
      isPublic: true,
      hiddenPhotosEnabled: true,
      includeDigitalWithPrint: true,
      enableDigitalPhotos: true,
      scanProtectionEnabled: true,
      user: { select: { name: true } },
      photos: {
        where: { isRemoved: false },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, previewUrl: true, originalKey: true, sellPrint: true, sellDigital: true },
      },
    },
  });
  const albumHref = album?.publicSlug ? `/album/${album.publicSlug}` : undefined;

  if (!album || album.deletedAt) {
    return (
      <Aviso
        titulo="La galería ya no está disponible"
        texto="Escribile al fotógrafo para coordinar la entrega de las fotos de tu combo."
      />
    );
  }
  if (voucher.redeemed) {
    return (
      <Aviso
        titulo="Este combo ya fue canjeado"
        texto="Las fotos de tu combo ya están pedidas. Si querés más fotos, las podés comprar en la galería."
        albumHref={albumHref}
      />
    );
  }
  if (album.isHidden) {
    return (
      <Aviso
        titulo="La galería está cerrada por ahora"
        texto="Escribile al fotógrafo para que la vuelva a abrir y puedas elegir las fotos de tu combo."
      />
    );
  }

  const product = await resolveComboPrintProduct(album.userId, voucher.refs.size, album.id);
  if (!product) {
    return (
      <Aviso
        titulo="Tu combo todavía no se puede canjear"
        texto="Falta que el fotógrafo configure el tamaño de impresión del combo. Escribile para avisarle."
        albumHref={albumHref}
      />
    );
  }

  const grantCookie = (await cookies()).get(HIDDEN_ALBUM_GRANT_COOKIE)?.value ?? null;
  const visible = await filterPublicAlbumPhotosForHiddenVisitor(
    album.id,
    album.hiddenPhotosEnabled,
    album.photos.map((p) => ({ id: p.id, previewUrl: p.previewUrl ?? "", originalKey: p.originalKey })),
    { photographerBypassGrant: false, simulateClientView: false, grantCookieValue: grantCookie }
  );

  const nombreFamilia = voucher.refs.parentName?.trim() || null;
  const alumno = voucher.refs.studentName?.trim() || null;

  if (album.hiddenPhotosEnabled && !visible.initialHasGrant) {
    return (
      <ProtectedAlbumWrapper albumId={album.id} enableProtection>
        <section className="mx-auto max-w-lg px-4 pt-10">
          <h1 className="m-0 text-2xl font-semibold text-[#1f2328]">
            {nombreFamilia ? `Hola, ${nombreFamilia}` : "Hola"}
          </h1>
          <p className="m-0 mt-2 text-[#4b4f56]">
            {alumno ? `El combo de ${alumno} ya está pago. ` : "Tu combo ya está pago. "}
            En esta galería cada familia ve sólo sus fotos: primero verificá con una selfie y
            después elegís las fotos del combo.
          </p>
        </section>
        <HiddenAlbumVerificationGate albumId={album.id} albumTitle={album.title} />
      </ProtectedAlbumWrapper>
    );
  }

  const allowed = new Set(visible.photos.map((p) => p.id));
  const photos = album.photos
    .filter((p) => allowed.has(p.id))
    .map((p) => ({ id: p.id, sellPrint: p.sellPrint !== false, sellDigital: p.sellDigital !== false }));

  return (
    <ProtectedAlbumWrapper albumId={album.id} enableProtection>
      <CanjeFlow
        token={token}
        album={{
          id: album.id,
          title: album.title,
          slug: album.publicSlug,
          photographerName: album.user?.name ?? null,
          includeDigitalWithPrint: album.includeDigitalWithPrint,
          sellsDigital: album.enableDigitalPhotos,
          scanProtection: album.scanProtectionEnabled !== false,
          // La búsqueda por selfie sólo existe para álbumes abiertos; en los de fotos
          // ocultas la familia ya ve sólo las suyas.
          selfieSearch: album.isPublic && !album.hiddenPhotosEnabled,
        }}
        combo={{
          printUnits: voucher.refs.printUnits,
          size: product.size,
          includesDigital: voucher.refs.includesDigital,
          parentName: nombreFamilia,
          studentName: alumno,
        }}
        product={product}
        photos={photos}
      />
    </ProtectedAlbumWrapper>
  );
}
