import Image from "next/image";
import Link from "next/link";
import { Cabecera } from "./components/cabecera";
import { FranjaFotos } from "./components/franja-fotos";

export default function Home() {
  return (
    <main>
      <Cabecera />

      {/*
        El hero repite la puesta del manual: fondo púrpura profundo, logo vertical
        sin alterar y la promesa partida en tres líneas, la tercera en amarillo.
        Es la única aplicación de la marca en la página; el resto es texto.
      */}
      {/*
        La sección no lleva padding horizontal: la franja tiene que ocupar el
        ancho completo. El margen se lo pone cada bloque de texto por su cuenta.
      */}
      <section
        style={{ background: "var(--slf-purpura)" }}
        className="flex min-h-[100svh] flex-col items-center justify-center pb-16 pt-24 text-center sm:pt-28"
      >
        <Image
          src="/brand/subilafoto-logo-vertical-negativo.png"
          alt="Subí la Foto"
          width={320}
          height={400}
          priority
          /* Más chico que antes: con la franja en el medio, un logo de 17rem
             empujaba la promesa abajo del pliegue en una notebook. Se ven los
             tres: marca, escena y frase. */
          className="h-auto w-[min(11rem,48vw)]"
        />

        {/*
          La franja va entre el logo y la promesa: se ve la escena real antes de
          leer nada. Los degradados de los extremos usan el mismo púrpura del
          fondo, así que acá adentro las fotos entran y salen sin borde visible.
        */}
        <div className="mt-8 w-full">
          <FranjaFotos />
        </div>

        <h1 className="slf-lema mt-8 max-w-[18ch] text-balance px-6 text-[clamp(2rem,6.5vw,3.5rem)] font-extrabold leading-[1.08] tracking-[-0.02em] text-white">
          <span>Todas las miradas </span>
          <span>de tu evento, </span>
          <span style={{ color: "var(--slf-amarillo)" }}>en un solo lugar.</span>
        </h1>

        <p
          className="mt-8 max-w-[46ch] px-6 text-[clamp(1rem,2.4vw,1.15rem)] leading-relaxed"
          style={{ color: "var(--slf-lila)" }}
        >
          Los invitados escanean un código con el celular, suben sus fotos y
          aparecen en la pantalla del salón y en el álbum del evento. Sin bajar
          ninguna aplicación y sin crearse una cuenta.
        </p>
      </section>

      <section className="sobre-claro px-6 py-24 sm:py-32">
        <div className="mx-auto grid max-w-5xl gap-16 sm:grid-cols-[1fr_1fr] sm:gap-20">
          <div
            className="border-l-2 pl-6"
            style={{ borderColor: "var(--slf-violeta)" }}
          >
            <h2 className="text-2xl font-extrabold leading-tight">
              Si vas a un evento
            </h2>
            <p
              className="mt-4 max-w-[42ch] leading-relaxed"
              style={{ color: "var(--slf-tinta-suave)" }}
            >
              Vas a encontrar el código en la mesa, en la entrada o en la
              pantalla. Lo escaneás con la cámara del celular y ya podés subir
              tus fotos. Nada que instalar, nada que registrar.
            </p>
          </div>

          <div
            className="border-l-2 pl-6"
            style={{ borderColor: "var(--slf-violeta)" }}
          >
            <h2 className="text-2xl font-extrabold leading-tight">
              Si organizás eventos
            </h2>
            <p
              className="mt-4 max-w-[42ch] leading-relaxed"
              style={{ color: "var(--slf-tinta-suave)" }}
            >
              Vas a poder crear el evento, ponerle tu precio y venderlo con un
              enlace propio. Preparamos la plataforma para fotógrafos,
              productoras, salones y organizadores.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block font-extrabold underline underline-offset-4"
              style={{ color: "var(--slf-violeta)" }}
            >
              Entrá con tu cuenta de DNX Suite
            </Link>
          </div>
        </div>

        <div
          className="mx-auto mt-24 max-w-5xl border-t pt-10"
          style={{ borderColor: "var(--slf-borde)" }}
        >
          <p className="max-w-[52ch] text-lg leading-relaxed">
            Estamos terminando de construirla. Subí la Foto abre en{" "}
            <strong className="font-extrabold" style={{ color: "var(--slf-violeta)" }}>
              octubre de 2026
            </strong>
            .
          </p>
          {/*
            Acá va el contacto cuando exista la casilla del dominio. Publicar una
            dirección que rebota es peor que no publicar ninguna.
          */}
        </div>
      </section>

      <footer
        className="sobre-claro px-6 pb-16"
        style={{ color: "var(--slf-tinta-suave)" }}
      >
        <div className="mx-auto max-w-5xl text-sm">
          Subí la Foto es parte de DNX Suite.
        </div>
      </footer>
    </main>
  );
}
