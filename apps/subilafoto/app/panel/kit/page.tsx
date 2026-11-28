import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";
import { paletaDelVendedor } from "@/lib/kit/colores";
import { listoParaCobrar } from "@/lib/kit/pasos";
import { textosDeVenta } from "@/lib/kit/textos";
import { esClaveDeLogo } from "@/lib/logo";
import { perfilDeVenta } from "@/lib/perfil-de-venta";
import { formatearPesos } from "@/lib/precios";
import { TextoParaCopiar } from "./copiar";
import { Piezas } from "./piezas";

export const dynamic = "force-dynamic";

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    "http://localhost:3012"
  );
}

/**
 * El kit para vender: todo lo que el fotógrafo necesita para ofrecerle el servicio a sus
 * clientes, ya armado con su marca, su precio y su enlace.
 *
 * Sólo se muestra completo cuando el enlace se puede usar. Repartir placas con un QR que
 * lleva a un 404, o a una compra que no se puede pagar, es peor que no repartir nada.
 */
export default async function Kit() {
  const almacen = await cookies();
  const cookie = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = cookie ? await getSessionUserByRawToken(cookie) : null;
  if (!usuario) redirect("/login?next=%2Fpanel%2Fkit");

  const id = await perfilDeVenta(usuario.id, usuario.name);
  const perfil = await prisma.subilafotoSellerProfile.findUnique({
    where: { id },
    select: {
      slug: true,
      displayName: true,
      logoUrl: true,
      brandColor: true,
      basePriceCents: true,
      isPublished: true,
      mpConnected: true,
    },
  });
  if (!perfil) redirect("/panel");

  const enlace = `${baseUrl()}/v/${perfil.slug}`;
  const enlaceConDescarga = `${enlace}?descarga=si`;
  const precio = formatearPesos(perfil.basePriceCents);
  const listo = listoParaCobrar(perfil);

  return (
    <main className="sobre-claro mx-auto max-w-4xl px-6 py-14">
      <Link href="/panel" className="text-sm font-extrabold" style={{ color: "var(--slf-violeta-texto)" }}>
        ← Panel
      </Link>

      <h1 className="mt-5 text-3xl font-extrabold tracking-[-0.02em]">Tu kit para vender</h1>
      <p className="mt-3 max-w-[60ch] leading-relaxed" style={{ color: "var(--slf-tinta-suave)" }}>
        Todo lo que necesitás para ofrecerle el servicio a tus clientes, con tu marca. No
        aparece SubiLaFoto en ningún lado: para tu cliente, el servicio es tuyo.
      </p>

      {!listo ? (
        <section className="mt-10 rounded-2xl p-7" style={{ background: "var(--slf-purpura)", color: "white" }}>
          <h2 className="text-xl font-extrabold">Primero terminá los tres pasos</h2>
          <p className="mt-3 leading-relaxed" style={{ color: "var(--slf-lila)" }}>
            El kit lleva tu precio y un QR a tu enlace de venta. Hasta que tu ficha esté
            publicada y Mercado Pago conectado, ese enlace no le sirve a nadie.
          </p>
          <Link
            href="/panel"
            className="mt-6 inline-flex min-h-[44px] items-center rounded-xl px-6 font-extrabold"
            style={{ background: "var(--slf-amarillo)", color: "#050505" }}
          >
            Ver qué me falta
          </Link>
        </section>
      ) : (
        <KitCompleto
          nombre={perfil.displayName}
          precio={precio}
          enlace={enlace}
          enlaceConDescarga={enlaceConDescarga}
          slug={perfil.slug}
          brandColor={perfil.brandColor}
          tieneLogo={esClaveDeLogo(perfil.logoUrl)}
        />
      )}
    </main>
  );
}

function KitCompleto(props: {
  nombre: string;
  precio: string;
  enlace: string;
  enlaceConDescarga: string;
  slug: string;
  brandColor: string | null;
  tieneLogo: boolean;
}) {
  const textos = textosDeVenta({ nombre: props.nombre, precio: props.precio, enlace: props.enlace });

  return (
    <>
      <section className="mt-10 rounded-2xl p-7" style={{ background: "var(--slf-purpura)", color: "white" }}>
        <h2 className="text-xl font-extrabold">Tu enlace</h2>
        <p className="mt-3 break-all font-extrabold" style={{ color: "var(--slf-amarillo)" }}>
          {props.enlace.replace(/^https?:\/\//, "")}
        </p>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--slf-lila)" }}>
          Es el que llevan todas las piezas. Si querés vender con la descarga de todas las
          fotos incluida, usá este otro: tu cliente paga un 10% más y a vos te queda lo
          mismo.
        </p>
        <p className="mt-2 break-all text-sm font-extrabold" style={{ color: "white" }}>
          {props.enlaceConDescarga.replace(/^https?:\/\//, "")}
        </p>
      </section>

      <section className="mt-14" aria-labelledby="titulo-textos">
        <h2 id="titulo-textos" className="text-xl font-extrabold">Textos para copiar</h2>
        <p className="mt-2 leading-relaxed" style={{ color: "var(--slf-tinta-suave)" }}>
          Ya tienen tu precio y tu enlace. Copialos, cambiales lo que quieras y mandalos.
        </p>
        <div className="mt-6 space-y-4">
          <TextoParaCopiar titulo="Mensaje de WhatsApp" uso="Para un cliente que tiene un evento" texto={textos.whatsapp} />
          <TextoParaCopiar titulo="Publicación de Instagram" uso="Para acompañar una placa" texto={textos.instagram} />
          <TextoParaCopiar titulo="El detalle del servicio" uso="Para el que ya preguntó y quiere saber qué incluye" texto={textos.detalle} />
        </div>
      </section>

      <Piezas
        nombre={props.nombre}
        precio={props.precio}
        enlace={props.enlace}
        paleta={paletaDelVendedor(props.brandColor)}
        tieneLogo={props.tieneLogo}
        slug={props.slug}
      />

      <section className="mt-14" aria-labelledby="titulo-preguntas">
        <h2 id="titulo-preguntas" className="text-xl font-extrabold">Lo que te van a preguntar</h2>
        <p className="mt-2 leading-relaxed" style={{ color: "var(--slf-tinta-suave)" }}>
          Las dudas que más aparecen, con una respuesta corta para copiar.
        </p>
        <div className="mt-6 space-y-4">
          {textos.preguntas.map((p) => (
            <TextoParaCopiar key={p.pregunta} titulo={p.pregunta} texto={p.respuesta} />
          ))}
        </div>
      </section>
    </>
  );
}
