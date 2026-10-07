import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { OrderOrigin, OrderStatus, prisma } from "@/lib/prisma";
import { getOrderIdForPackAccessToken } from "@/lib/preventa-canjeable/pack-access-tokens";
import { parsePreventaPackSnapshotV1 } from "@/lib/preventa-canjeable/preventa-pack-snapshot-v1";
import { parsePreCompraOrderIdFromPaymentRef } from "@/lib/preventa-canjeable/preventa-redeem-url";
import { studentNameForGreeting } from "@/lib/preventa-canjeable/preventa-canje-slots";
import { isAlbumReadyToSellForCheckout } from "@/lib/albums/album-sales-readiness-server";
import { filterPublicAlbumPhotosForHiddenVisitor } from "@/lib/hidden-album/filter-public-album-photos";
import { HIDDEN_ALBUM_GRANT_COOKIE } from "@/lib/hidden-album-audit";
import ProtectedAlbumWrapper from "@/components/photo/ProtectedAlbumWrapper";
import HiddenAlbumVerificationGate from "@/components/photo/HiddenAlbumVerificationGate";
import PreventaCanjeFlow from "@/components/canje-externo/PreventaCanjeFlow";
import { isPlaceholderEmail, parseExternalPreventaRefs } from "@/lib/canje-externo/external-preventa";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Elegí las fotos de tu pack | ComprameLaFoto",
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
 * Canje guiado de un pack de preventa: el link del correo (o del aviso "ya están las fotos")
 * trae a la familia acá. Mismas reglas de acceso que la galería: en un álbum con fotos
 * ocultas, primero la selfie y después sólo las fotos de esa persona.
 */
export default async function PreventaCanjePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const lookup = await getOrderIdForPackAccessToken(token);
  if (!lookup.ok) {
    return (
      <Aviso
        titulo="Este link ya no sirve"
        texto="Puede que haya vencido. Pedí uno nuevo con el mismo email con el que compraste."
        href="/cliente/recuperar-pack"
        link="Pedir un link nuevo"
      />
    );
  }

  const order = await prisma.order.findUnique({
    where: { id: lookup.orderId },
    select: {
      id: true,
      origin: true,
      status: true,
      buyerName: true,
      buyerEmail: true,
      redemptionOrderId: true,
      redemptionPaymentRefsJson: true,
      preventaPackSnapshotJson: true,
      preCompraPaymentRef: true,
      album: {
        select: {
          id: true,
          title: true,
          publicSlug: true,
          userId: true,
          deletedAt: true,
          isHidden: true,
          isPublic: true,
          hiddenPhotosEnabled: true,
          scanProtectionEnabled: true,
          enableDigitalPhotos: true,
          enablePrintedPhotos: true,
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
      },
    },
  });

  if (!order || order.origin !== OrderOrigin.PREVENTA_PACK || !order.album) {
    return <Aviso titulo="No encontramos tu pack" texto="Revisá que el link esté completo." />;
  }
  const album = order.album;
  const galeriaHref = album.publicSlug ? `/album/${album.publicSlug}` : undefined;

  if (order.status !== OrderStatus.PAID) {
    return (
      <Aviso
        titulo="Tu pago todavía no está confirmado"
        texto="Cuando Mercado Pago lo confirme vas a poder elegir tus fotos con este mismo link."
      />
    );
  }
  if (order.redemptionOrderId != null) {
    return (
      <Aviso
        titulo="Este pack ya fue canjeado"
        texto="Las fotos de tu pack ya están pedidas. Si querés más, las podés comprar en la galería."
        href={galeriaHref}
      />
    );
  }
  if (album.deletedAt || album.isHidden) {
    return (
      <Aviso
        titulo="La galería no está disponible"
        texto="Escribile al fotógrafo para que la vuelva a abrir y puedas elegir las fotos de tu pack."
      />
    );
  }
  if (album.photos.length === 0) {
    return (
      <Aviso
        titulo="Las fotos todavía no están"
        texto="Cuando el fotógrafo las publique vas a poder elegirlas con este mismo link. Guardalo."
      />
    );
  }

  let snapshot;
  try {
    snapshot = parsePreventaPackSnapshotV1(order.preventaPackSnapshotJson);
  } catch {
    return (
      <Aviso
        titulo="No pudimos leer tu pack"
        texto="Escribile al fotógrafo con el número de pedido para que lo revise."
        href={galeriaHref}
      />
    );
  }

  const preCompraId = parsePreCompraOrderIdFromPaymentRef(order.preCompraPaymentRef);
  const preCompra = preCompraId
    ? await prisma.preCompraOrder.findUnique({
        where: { id: preCompraId },
        select: { studentFirstName: true, studentLastName: true, buyerName: true },
      })
    : null;
  // Pack cobrado por fuera: no hay PreCompraOrder; alumno y adulto vienen con el pack.
  const externo = parseExternalPreventaRefs(order.redemptionPaymentRefsJson);
  const familia = externo?.parentName || order.buyerName?.trim() || preCompra?.buyerName?.trim() || null;
  const alumno = studentNameForGreeting(
    externo?.studentName ||
      [preCompra?.studentFirstName, preCompra?.studentLastName].filter(Boolean).join(" "),
    familia
  );

  const grantCookie = (await cookies()).get(HIDDEN_ALBUM_GRANT_COOKIE)?.value ?? null;
  const visible = await filterPublicAlbumPhotosForHiddenVisitor(
    album.id,
    album.hiddenPhotosEnabled,
    album.photos.map((p) => ({ id: p.id, previewUrl: p.previewUrl ?? "", originalKey: p.originalKey })),
    { photographerBypassGrant: false, simulateClientView: false, grantCookieValue: grantCookie }
  );

  if (album.hiddenPhotosEnabled && !visible.initialHasGrant) {
    return (
      <ProtectedAlbumWrapper albumId={album.id} enableProtection>
        <section className="mx-auto max-w-lg px-4 pt-10">
          <h1 className="m-0 text-2xl font-semibold text-[#1f2328]">{familia ? `Hola, ${familia.split(/\s+/)[0]}` : "Hola"}</h1>
          <p className="m-0 mt-2 text-[#4b4f56]">
            {alumno ? `El pack de ${alumno} ya está pago. ` : "Tu pack ya está pago. "}
            En esta galería cada familia ve sólo sus fotos: primero verificá con una selfie y después elegís
            las fotos de tu pack.
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
  const sellsSingles = await isAlbumReadyToSellForCheckout(album).catch(() => false);

  return (
    <ProtectedAlbumWrapper albumId={album.id} enableProtection>
      <PreventaCanjeFlow
        token={token}
        album={{
          id: album.id,
          title: album.title,
          slug: album.publicSlug,
          photographerName: album.user?.name ?? null,
          scanProtection: album.scanProtectionEnabled !== false,
          selfieSearch: album.isPublic && !album.hiddenPhotosEnabled,
          sellsSingles,
        }}
        pack={{
          name: snapshot.packName,
          benefits: snapshot.benefits,
          parentName: familia,
          studentName: alumno,
        }}
        photos={photos}
        pedirContacto={isPlaceholderEmail(order.buyerEmail)}
      />
    </ProtectedAlbumWrapper>
  );
}
