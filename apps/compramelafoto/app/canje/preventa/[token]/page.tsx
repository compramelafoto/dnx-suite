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
import type { CanjeExtrasConfig } from "@/components/canje-externo/CanjeExtrasStep";
import { productsForAlbum } from "@/lib/pricing/album-scoped-products";
import ReiniciarPruebaButton from "@/components/canje-externo/ReiniciarPruebaButton";
import { puedeUsarPackDePrueba } from "@/lib/canje-externo/reiniciar-pack-de-prueba";
import { isPlaceholderEmail, nombreNaturalDesdeExcel, parseExternalPreventaRefs } from "@/lib/canje-externo/external-preventa";
import { valoresDelPackExterno } from "@/lib/canje-externo/disenos-del-canje-externo";
import { getAuthUser } from "@/lib/auth";
import { loadDesignTemplateVersion } from "@/lib/design-v2/template";
import { toDesignTemplatePayload, type DesignTemplatePayload } from "@/lib/design-v2/client-payload";
import { loadAlbumCourses } from "@/lib/design-v2/class-list";
import { cursosDelListado, cursosParaSumar, listadoPermiteSumarCursos } from "@/lib/design-v2/listado-cursos";
import { loadSchoolDesignContext } from "@/lib/school-render/ensure-school-design-for-preventa-order-item";
import { clientPhotoInputs } from "@repo/template-editor-core";

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
      buyerPhone: true,
      redemptionOrderId: true,
      redemptionPaymentRefsJson: true,
      preventaPackSnapshotJson: true,
      preCompraPaymentRef: true,
      isTest: true,
      album: {
        select: {
          id: true,
          school: { select: { name: true, logoUrl: true } },
          title: true,
          publicSlug: true,
          userId: true,
          deletedAt: true,
          isHidden: true,
          isPublic: true,
          hiddenPhotosEnabled: true,
          scanProtectionEnabled: true,
          enableDigitalPhotos: true,
          includeDigitalWithPrint: true,
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
  /*
   * Modo prueba: un pack marcado `isTest` lo arma el fotógrafo con "Probar como cliente" (o el
   * equipo) para recorrer el canje exactamente como una familia (elegir fotos, ver el librito
   * armado, confirmar) sin tocar el pack de ninguna familia real. Sólo lo abre el dueño del
   * álbum (o un admin) con su sesión, y entra sin selfie: él no aparece en las fotos.
   */
  let modoPrueba = false;
  if (order.isTest) {
    const viewer = await getAuthUser().catch(() => null);
    if (!puedeUsarPackDePrueba(viewer, album.userId)) {
      return (
        <Aviso
          titulo="Este pack es de prueba"
          texto="Sólo lo puede abrir el fotógrafo del álbum, con su cuenta iniciada."
        />
      );
    }
    modoPrueba = true;
  }

  if (order.redemptionOrderId != null && modoPrueba) {
    return (
      <section className="mx-auto max-w-lg px-4 py-16">
        <div className="rounded-2xl border border-[#e7e1da] bg-white p-6">
          <h1 className="m-0 text-xl font-semibold text-[#1f2328]">Esta prueba ya se canjeó</h1>
          <p className="m-0 mt-2 text-[#4b4f56]">
            El canje quedó como pedido de prueba: no se cobra ni entra en tus ventas. Lo ves en{" "}
            <Link href="/fotografo/pedidos" className="font-medium text-[#a8652e] underline">
              Pedidos
            </Link>{" "}
            con la etiqueta DEMO, con las descargas igual que un pedido real. Reiniciala para volver a
            recorrerla desde el principio con este mismo link.
          </p>
          <ReiniciarPruebaButton token={token} />
        </div>
      </section>
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
  // El Excel trae "Apellido Nombre": se da vuelta para saludar con el nombre de pila.
  const familia =
    nombreNaturalDesdeExcel(externo?.parentName) || order.buyerName?.trim() || preCompra?.buyerName?.trim() || null;
  const alumno = studentNameForGreeting(
    nombreNaturalDesdeExcel(externo?.studentName) ||
      [preCompra?.studentFirstName, preCompra?.studentLastName].filter(Boolean).join(" "),
    familia
  );

  const grantCookie = (await cookies()).get(HIDDEN_ALBUM_GRANT_COOKIE)?.value ?? null;
  const visible = await filterPublicAlbumPhotosForHiddenVisitor(
    album.id,
    album.hiddenPhotosEnabled,
    album.photos.map((p) => ({ id: p.id, previewUrl: p.previewUrl ?? "", originalKey: p.originalKey })),
    { photographerBypassGrant: modoPrueba, simulateClientView: false, grantCookieValue: grantCookie }
  );

  /*
   * La selfie no encontró a nadie (casi siempre: la sacó el adulto, que no está en las fotos del
   * colegio). Antes quedaba un permiso con cero fotos y la familia veía la grilla vacía, sin forma
   * de reintentar durante 30 minutos. Ahora vuelve a ver la verificación, con el porqué.
   */
  const selfieSinFotos = album.hiddenPhotosEnabled && visible.initialHasGrant && visible.photos.length === 0;
  if (album.hiddenPhotosEnabled && (!visible.initialHasGrant || selfieSinFotos)) {
    const quien = alumno ? alumno : "tu hija o tu hijo";
    return (
      <ProtectedAlbumWrapper albumId={album.id} enableProtection>
        <section className="mx-auto max-w-lg px-4 pt-10">
          <h1 className="m-0 text-2xl font-semibold text-[#1f2328]">{familia ? `Hola, ${familia.split(/\s+/)[0]}` : "Hola"}</h1>
          <p className="m-0 mt-2 text-[#4b4f56]">
            {alumno ? `El pack de ${alumno} ya está pago. ` : "Tu pack ya está pago. "}
            En esta galería cada familia ve sólo sus fotos: primero verificá con una selfie y después elegís
            las fotos de tu pack.
          </p>
          {selfieSinFotos ? (
            <p role="alert" className="m-0 mt-3 rounded-lg bg-[#fff4e5] px-3 py-2 text-sm text-[#7a4a12]">
              No encontramos fotos con esa cara. Probá de nuevo con la cara de {quien}: de frente, con buena
              luz y sin anteojos de sol. Si sigue sin aparecer, escribile a {album.user?.name ?? "la fotógrafa"}.
            </p>
          ) : null}
          <p className="m-0 mt-3 rounded-lg bg-[#eef6f1] px-3 py-2 text-sm text-[#1f5b3f]">
            <strong>Importante:</strong> la selfie tiene que ser la cara de {quien}, no la tuya: las fotos son
            del colegio. Usá la cámara de adelante del celular, con {quien} mirando a la pantalla.
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


  // Si la plantilla del beneficio nombra sus huecos (foto individual, foto grupal), cada lugar
  // del canje lleva ese nombre. Las plantillas con huecos numerados siguen como siempre.
  // Los beneficios con diseño obligatorio (el librito) se muestran armados antes de confirmar.
  const designs: Array<{ benefitKey: string; template: DesignTemplatePayload }> = [];
  const benefits = await Promise.all(
    snapshot.benefits.map(async (b) => {
      if (!b.templateV2Id) return b;
      const template = await loadDesignTemplateVersion({ templateId: b.templateV2Id }).catch(() => null);
      if (template && b.templatePolicy === "REQUIRED" && template.slots.length > 0) {
        designs.push({ benefitKey: b.stableKey, template: toDesignTemplatePayload(template) });
      }
      const inputs = template ? clientPhotoInputs(template.slots) : [];
      return inputs.some((i) => i.role) ? { ...b, photoInputs: inputs } : b;
    })
  );
  // Los mismos textos que va a llevar el diseño real: alumno, curso, escuela, listado del curso.
  const designContext =
    designs.length > 0 && preCompraId
      ? await loadSchoolDesignContext(prisma as never, preCompraId).catch(() => null)
      : null;
  /*
   * Pack cobrado por fuera: no hay PreCompraOrder, así que el curso y el listado salen de los
   * packs cargados del Excel. Sin esto el librito mostraba sólo el nombre y «—» en curso y
   * colegio.
   */
  let designValues: Record<string, string> =
    designContext?.values ?? (alumno ? { "student.fullName": alumno } : {});
  if (designs.length > 0 && !designContext && externo) {
    designValues = await valoresDelPackExterno({
      albumId: album.id,
      externo,
      schoolName: album.school?.name,
      schoolLogoUrl: album.school?.logoUrl,
      buyerName: familia,
      photographerName: album.user?.name,
    });
  }

  /*
   * Si la plantilla deja sumar otros cursos al listado (fotos grupales con 7.° A y 7.° B), la
   * familia ve los otros cursos del colegio para sumarlos al revisar. Si no, no se manda nada.
   */
  const cursosParaSumarAlListado =
    designs.some((d) => listadoPermiteSumarCursos(d.template.blocks)) && cursosDelListado(designValues).length > 0
      ? cursosParaSumar(
          cursosDelListado(designValues),
          await loadAlbumCourses(prisma as never, album.id).catch(() => [])
        )
      : [];

  // Rostros por foto, para ofrecer como grupales sólo las fotos con mucha gente. `null` = la
  // foto todavía no se analizó.
  const usaGrupal = benefits.some((b) => "photoInputs" in b && b.photoInputs?.some((i) => i.role === "group"));
  const facesById = new Map<number, number | null>();
  if (usaGrupal && photos.length > 0) {
    const ids = photos.map((p) => p.id);
    const [analizadas, conteos] = await Promise.all([
      prisma.photo.findMany({ where: { id: { in: ids }, analyzedAt: { not: null } }, select: { id: true } }),
      prisma.faceDetection.groupBy({ by: ["photoId"], where: { photoId: { in: ids } }, _count: { _all: true } }),
    ]);
    const porFoto = new Map(conteos.map((c) => [c.photoId, c._count._all]));
    const vistas = new Set(analizadas.map((a) => a.id));
    for (const id of ids) facesById.set(id, porFoto.get(id) ?? (vistas.has(id) ? 0 : null));
  }

  /*
   * Medida de cada copia impresa del pack ("15x21"), la misma que lleva el pedido al canjear:
   * la familia ve "Copia 15x21 · se imprime horizontal" junto a la foto que eligió.
   */
  const productoIds = [
    ...new Set(
      snapshot.benefits
        .filter((b) => b.kind === "PHYSICAL" && b.photographerProductId != null)
        .map((b) => b.photographerProductId as number)
    ),
  ];
  const medidaPorProducto = new Map(
    productoIds.length > 0
      ? (
          await prisma.photographerProduct
            .findMany({ where: { id: { in: productoIds } }, select: { id: true, size: true } })
            .catch(() => [])
        ).map((p) => [p.id, p.size?.trim() || null] as const)
      : []
  );
  const benefitsConMedida = benefits.map((b) => ({
    ...b,
    printSize:
      b.kind === "PHYSICAL" && b.photographerProductId != null
        ? (medidaPorProducto.get(b.photographerProductId) ?? null)
        : null,
  }));

  /*
   * Extras que se ofrecen apenas se confirma el canje: fotos sueltas (impresa con el producto
   * de impresión del álbum, o digital) y otro librito igual. Sólo si el álbum está listo para
   * vender; en modo prueba se muestran igual para que el fotógrafo vea la pantalla, sin cobrar.
   */
  let extras: CanjeExtrasConfig | null = null;
  if (sellsSingles || modoPrueba) {
    const productos = productsForAlbum(
      await prisma.photographerProduct.findMany({
        where: { userId: album.userId, isActive: true },
        select: { id: true, name: true, size: true, acabado: true, albumId: true },
        orderBy: { id: "asc" },
      }),
      album.id
    );
    const libritoProductId =
      snapshot.benefits.find((b) => designs.some((d) => d.benefitKey === b.stableKey))?.photographerProductId ?? null;
    const libritoRow = libritoProductId ? productos.find((p) => p.id === libritoProductId) : null;
    const puntaje = (n: string) => {
      const t = n.trim().toLowerCase();
      return t === "foto impresa" ? 0 : t.startsWith("foto impresa") ? 1 : t.includes("impres") ? 2 : 3;
    };
    const impresaRow = productos
      .filter((p) => p.id !== libritoProductId && p.size)
      .sort((a, b) => puntaje(a.name) - puntaje(b.name) || a.id - b.id)[0];
    const aProducto = (p: { id: number; name: string; size: string | null; acabado: string | null }) => ({
      productId: p.id,
      name: p.name,
      size: p.size ?? "",
      finish: p.acabado ?? null,
    });
    extras = {
      digital: album.enableDigitalPhotos !== false,
      impresa: album.enablePrintedPhotos !== false && impresaRow ? aProducto(impresaRow) : null,
      librito: libritoRow?.size ? aProducto(libritoRow) : null,
      includeDigitalWithPrint: album.includeDigitalWithPrint === true,
    };
    if (!extras.digital && !extras.impresa && !extras.librito) extras = null;
  }

  return (
    <ProtectedAlbumWrapper albumId={album.id} enableProtection>
      {modoPrueba ? (
        <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
          <strong>Modo prueba.</strong> Estás viendo el canje como una familia. Ves todas las fotos
          del álbum sin selfie; una familia real primero se verifica y ve sólo las suyas. Lo que
          confirmes queda en tus Pedidos como DEMO, en $0: no se cobra, no entra en tus ventas y no
          se manda ningún correo ni WhatsApp. Los extras tampoco se cobran.
        </div>
      ) : null}
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
          benefits: benefitsConMedida,
          parentName: familia,
          studentName: alumno,
        }}
        photos={photos.map((p) => ({ ...p, faces: facesById.get(p.id) ?? null }))}
        designs={designs}
        designValues={designValues}
        pedirContacto={isPlaceholderEmail(order.buyerEmail)}
        extras={extras}
        modoPrueba={modoPrueba}
        cursosParaSumar={cursosParaSumarAlListado}
        comprador={{
          nombre: familia ?? "",
          email: isPlaceholderEmail(order.buyerEmail) ? "" : (order.buyerEmail ?? ""),
          telefono: order.buyerPhone ?? "",
        }}
      />
    </ProtectedAlbumWrapper>
  );
}
