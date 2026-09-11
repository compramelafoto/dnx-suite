import Image from "next/image";

export default function Home() {
  return (
    <main>
      {/*
        El hero repite la puesta del manual: fondo púrpura profundo, logo vertical
        sin alterar y la promesa partida en tres líneas, la tercera en amarillo.
        Es la única aplicación de la marca en la página; el resto es texto.
      */}
      <section
        style={{ background: "var(--slf-purpura)" }}
        className="flex min-h-[100svh] flex-col items-center justify-center px-6 py-20 text-center"
      >
        <Image
          src="/brand/subilafoto-logo-vertical-negativo.png"
          alt="Subí la Foto"
          width={320}
          height={400}
          priority
          className="h-auto w-[min(17rem,70vw)]"
        />

        <h1 className="slf-lema mt-14 max-w-[18ch] text-balance text-[clamp(2rem,7vw,3.75rem)] font-extrabold leading-[1.08] tracking-[-0.02em] text-white">
          <span>Todas las miradas </span>
          <span>de tu evento, </span>
          <span style={{ color: "var(--slf-amarillo)" }}>en un solo lugar.</span>
        </h1>

        <p
          className="mt-10 max-w-[46ch] text-[clamp(1rem,2.4vw,1.15rem)] leading-relaxed"
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
