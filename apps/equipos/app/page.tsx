import Image from "next/image";
import Link from "next/link";
import { formatPesos, searchListings, type PublicListing } from "@/lib/catalogo/buscar";
import { KIND_LABELS } from "@/lib/inventario/equipos";
import { Boton, BotonEnlace, MedidorConfianza, SinFoto } from "./_ui";
import { FOTOS, srcFoto, zona, type NombreFoto } from "./_ui/fotos";

// Muestra los últimos equipos publicados: se arma en cada visita.
export const dynamic = "force-dynamic";

const ULTIMOS = 6;

const CAMINOS: {
  titulo: string;
  texto: string;
  foto: NombreFoto;
  enlace: { href: string; texto: string };
}[] = [
  {
    titulo: "Comprar",
    texto:
      "Cada publicación muestra qué comprobó el portal y qué declara el vendedor, por separado. Todos los vendedores verificaron su identidad.",
    foto: "entrega",
    enlace: { href: "/equipos", texto: "Ver equipos en venta" },
  },
  {
    titulo: "Vender",
    texto:
      "Cargá tu equipo con su número de serie, fotos y factura. Cuantos más datos comprobamos, más alto queda tu nivel de confianza.",
    foto: "estuche",
    enlace: { href: "/mis-publicaciones", texto: "Mis publicaciones" },
  },
  {
    titulo: "Consultar una serie",
    texto:
      "Antes de comprar en cualquier lado, fijate si el número de serie tiene una denuncia de robo o pérdida activa.",
    foto: "feria",
    enlace: { href: "/consultar-serie", texto: "Consultar una serie" },
  },
];

/** Mosaico de «Hecho por fotógrafos»: las altas ocupan dos filas y la ancha dos columnas. */
const MOSAICO: { foto: NombreFoto; forma: "mosaico-alta" | "mosaico-ancha" | "mosaico-foto" }[] = [
  { foto: "fotografa", forma: "mosaico-alta" },
  { foto: "calle", forma: "mosaico-ancha" },
  { foto: "boda", forma: "mosaico-alta" },
  { foto: "estudio", forma: "mosaico-foto" },
  { foto: "recital", forma: "mosaico-foto" },
];

const PASOS = [
  {
    titulo: "Verificá tu identidad",
    texto:
      "Creá tu cuenta y confirmá tu correo, tu teléfono y tu documento. Así sabés con quién estás hablando, y los demás también.",
  },
  {
    titulo: "Publicá o buscá",
    texto:
      "Cargá tu equipo con su número de serie, fotos y factura, o buscá por marca, montura, precio y provincia.",
  },
  {
    titulo: "Contactá y revisá en persona",
    texto:
      "Escribile a quien vende desde la publicación, encuéntrense en un lugar seguro y probá el equipo antes de pagar.",
  },
];

function Ultimo({ l }: { l: PublicListing }) {
  const href = `/equipos/${l.id}`;
  const titulo = `${l.make} ${l.model}`;
  return (
    <li className="ultimo">
      <Link className="ultimo-imagen" href={href} tabIndex={-1} aria-hidden="true">
        {l.photoUrls[0] ? (
          // Las URL firmadas vencen: no pasan por el optimizador de imágenes.
          // eslint-disable-next-line @next/next/no-img-element
          <img className="ultimo-foto" src={l.photoUrls[0]} alt="" loading="lazy" />
        ) : (
          <SinFoto tipo={KIND_LABELS[l.kind]} titulo={titulo} className="ultimo-foto" />
        )}
      </Link>
      <h3 className="ultimo-titulo">
        <Link href={href}>{titulo}</Link>
      </h3>
      <p className="ultimo-precio">{formatPesos(l.priceArs)}</p>
      <p className="ultimo-zona">{zona(l.city, l.province)}</p>
      <MedidorConfianza level={l.trust.level} size="chico" />
    </li>
  );
}

export default async function Home() {
  const { items } = await searchListings({ page: 1 });
  const ultimos = items.slice(0, ULTIMOS);

  return (
    <main id="contenido" className="inicio">
      <section className="portada" aria-labelledby="promesa">
        <div className="portada-foto">
          <Image
            src={srcFoto("portada-montana")}
            alt={FOTOS["portada-montana"].alt}
            fill
            priority
            sizes="100vw"
            className="foto-cubre"
          />
        </div>
        <div className="portada-panel">
          <h1 id="promesa" className="portada-titulo">
            Equipos usados de fotógrafos con identidad verificada
          </h1>
          <p className="portada-bajada">
            Cada equipo tiene sus papeles: quién lo vende, de dónde viene y qué datos pudimos comprobar.
          </p>
          <form className="buscador" action="/equipos" method="get" role="search">
            <label className="buscador-etiqueta" htmlFor="buscar-marca">
              Buscar por marca
            </label>
            <div className="buscador-fila">
              <input
                id="buscar-marca"
                className="control"
                name="make"
                type="search"
                placeholder="Canon, Nikon, Sony, Fujifilm"
                autoComplete="off"
              />
              <Boton>Buscar equipos</Boton>
            </div>
          </form>
        </div>
      </section>

      <section className="inicio-bloque" aria-labelledby="ultimos-titulo">
        <div className="bloque-cabecera">
          <h2 id="ultimos-titulo">Últimos equipos publicados</h2>
          {ultimos.length > 0 ? (
            <Link className="bloque-enlace" href="/equipos">
              Ver todos los equipos
            </Link>
          ) : null}
        </div>
        {ultimos.length > 0 ? (
          <ul className="ultimos">
            {ultimos.map((l) => (
              <Ultimo key={l.id} l={l} />
            ))}
          </ul>
        ) : (
          <div className="vacio">
            <div className="vacio-foto">
              <Image
                src={srcFoto("mesa-clara", true)}
                alt={FOTOS["mesa-clara"].alt}
                fill
                sizes="(min-width: 800px) 50vw, 100vw"
                className="foto-cubre"
              />
            </div>
            <div className="vacio-texto">
              <p className="vacio-titulo">Todavía no hay equipos publicados.</p>
              <p className="texto-secundario">
                Cargá tu cámara o tus lentes con su número de serie y fotos: aparecen acá apenas los
                revisamos.
              </p>
              <BotonEnlace href="/mi-equipo">Publicá el tuyo</BotonEnlace>
            </div>
          </div>
        )}
      </section>

      <section className="inicio-bloque" aria-label="Qué podés hacer">
        <ul className="caminos">
          {CAMINOS.map((c) => (
            <li key={c.titulo} className="camino">
              <div className="camino-foto">
                <Image
                  src={srcFoto(c.foto, true)}
                  alt={FOTOS[c.foto].alt}
                  fill
                  sizes="(min-width: 800px) 33vw, 100vw"
                  className="foto-cubre"
                />
              </div>
              <h2 className="camino-titulo">{c.titulo}</h2>
              <p className="texto-secundario">{c.texto}</p>
              <a className="camino-enlace" href={c.enlace.href}>
                {c.enlace.texto}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="oficio" aria-labelledby="oficio-titulo">
        <div className="oficio-interior">
          <div className="oficio-texto">
            <h2 id="oficio-titulo">Hecho por fotógrafos</h2>
            <p className="oficio-bajada">
              Para fotógrafos que trabajan: bodas, calle, estudio, recitales. Comprá y vendé el equipo con
              el que trabajás.
            </p>
          </div>
          <ul className="mosaico">
            {MOSAICO.map((m) => (
              <li key={m.foto} className={m.forma}>
                <Image
                  src={srcFoto(m.foto, true)}
                  alt={FOTOS[m.foto].alt}
                  fill
                  sizes="(min-width: 800px) 25vw, 50vw"
                  className="foto-cubre"
                />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="inicio-bloque" aria-labelledby="como-titulo">
        <div className="como">
          <div className="como-texto">
            <h2 id="como-titulo">Cómo funciona</h2>
            <ol className="como-pasos">
              {PASOS.map((p) => (
                <li key={p.titulo} className="como-paso">
                  <h3 className="como-paso-titulo">{p.titulo}</h3>
                  <p className="texto-secundario">{p.texto}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="como-foto">
            <Image
              src={srcFoto("laptop", true)}
              alt={FOTOS.laptop.alt}
              fill
              sizes="(min-width: 800px) 45vw, 100vw"
              className="foto-cubre"
            />
          </div>
        </div>
      </section>
    </main>
  );
}
