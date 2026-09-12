import Image from "next/image";
import Link from "next/link";
import { Cabecera } from "./components/cabecera";
import { FranjaFotos } from "./components/franja-fotos";
import { estiloBotonDnx } from "@/lib/boton-dnx";

/** Lo que pasa la noche del evento, en orden. */
const PASOS_DE_LA_NOCHE = [
  {
    titulo: "El código está en la mesa",
    detalle:
      "En el centro de mesa, en la entrada o en la propia pantalla. El invitado lo escanea con la cámara del celular.",
  },
  {
    titulo: "Sube sus fotos",
    detalle:
      "Sin instalar nada y sin crear ninguna cuenta. Elige las que ya tiene o saca una en el momento.",
  },
  {
    titulo: "Se revisan antes de salir",
    detalle:
      "Cada foto pasa por un control automático de contenido. Nada llega a la pantalla sin pasar por ahí.",
  },
  {
    titulo: "Aparecen en la pantalla",
    detalle:
      "En vivo, mientras la fiesta pasa. Y al otro día están todas juntas en el álbum del evento.",
  },
] as const;

/** Lo que hace quien vende el servicio, en orden. */
const PASOS_PARA_VENDER = [
  {
    titulo: "Creá tu cuenta",
    detalle:
      "Si ya usás alguna plataforma de DNX Suite, es la misma cuenta. No hay que registrarse de nuevo.",
  },
  {
    titulo: "Cargá tu marca",
    detalle:
      "Tu logo y los datos de tu empresa. Es lo que va a ver tu cliente en todo el recorrido.",
  },
  {
    titulo: "Poné tu precio",
    detalle:
      "El que vos quieras. Nosotros no fijamos ninguno ni te decimos cuánto cobrar.",
  },
  {
    titulo: "Compartí tu enlace",
    detalle:
      "Tu cliente entra, paga y el evento queda creado. Vos no tenés que hacer nada más.",
  },
] as const;

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
        className="flex min-h-[100svh] flex-col items-center justify-center pb-16 pt-20 text-center sm:pt-24"
      >
        <Image
          src="/brand/subilafoto-logo-vertical-negativo.png"
          alt="Subí la Foto"
          width={320}
          height={400}
          priority
          /*
            El límite real no es el ancho sino el **alto** de la pantalla: en el
            hero tienen que entrar el logo, la franja y la promesa. Por eso el
            tope principal está en `svh` — en una notebook de 720 el logo se
            achica solo y la frase no se cae abajo del pliegue, y en un monitor
            grande crece. Con un ancho fijo, a 720 el título quedaba 74 px
            afuera. Medido, no estimado.
          */
          className="h-auto w-auto max-h-[30svh] max-w-[min(15rem,60vw)]"
        />

        {/*
          La franja va entre el logo y la promesa: se ve la escena real antes de
          leer nada. Los degradados de los extremos usan el mismo púrpura del
          fondo, así que acá adentro las fotos entran y salen sin borde visible.
        */}
        <div className="mt-6 w-full">
          <FranjaFotos />
        </div>

        <h1 className="slf-lema mt-6 max-w-[18ch] text-balance px-6 text-[clamp(2rem,6.5vw,3.5rem)] font-extrabold leading-[1.08] tracking-[-0.02em] text-white">
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

      {/*
        La portada explica dos cosas distintas a dos personas distintas: qué
        pasa la noche del evento, y cómo lo vende quien lo contrata. Van
        separadas por fondo —clara y púrpura— porque son dos lecturas, no una
        sola larga.
      */}

      {/* ── Parte 1: la noche del evento ───────────────────────────────── */}
      <section className="sobre-claro px-6 py-24 sm:py-32" aria-labelledby="titulo-noche">
        <div className="mx-auto max-w-5xl">
          <h2
            id="titulo-noche"
            className="max-w-[16ch] text-[clamp(1.75rem,4vw,2.75rem)] font-extrabold leading-[1.1] tracking-[-0.02em]"
          >
            La noche del evento
          </h2>
          <p
            className="mt-5 max-w-[52ch] text-lg leading-relaxed"
            style={{ color: "var(--slf-tinta-suave)" }}
          >
            Todo lo que tiene que pasar, pasa solo. Nadie del equipo tiene que
            estar mirando una pantalla.
          </p>

          {/* Los números son una cronología real, no una decoración. */}
          <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {PASOS_DE_LA_NOCHE.map((paso, i) => (
              <li key={paso.titulo}>
                <span
                  aria-hidden
                  className="block text-2xl font-extrabold tabular-nums"
                  style={{ color: "var(--slf-violeta)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-lg font-extrabold leading-snug">
                  {paso.titulo}
                </h3>
                <p
                  className="mt-2 max-w-[34ch] leading-relaxed"
                  style={{ color: "var(--slf-tinta-suave)" }}
                >
                  {paso.detalle}
                </p>
              </li>
            ))}
          </ol>

          <div
            className="mt-20 border-l-2 pl-6 sm:pl-8"
            style={{ borderColor: "var(--slf-violeta)" }}
          >
            <h3 className="text-2xl font-extrabold leading-tight">
              Y los proveedores de esa noche se hacen ver
            </h3>
            <p
              className="mt-4 max-w-[60ch] text-lg leading-relaxed"
              style={{ color: "var(--slf-tinta-suave)" }}
            >
              El salón, el DJ, el catering, la ambientación, la barra, la
              animación. Cada uno puede tener su ficha con su logo dentro del
              evento. El invitado que vio algo que le gustó deja de preguntar
              «¿quién hizo esto?»: lo tiene ahí, en el celular, la misma noche
              y con ciento cincuenta personas que ya lo vieron trabajar.
            </p>
          </div>
        </div>
      </section>

      {/* ── Parte 2: cómo lo vende el proveedor ────────────────────────── */}
      <section
        className="px-6 py-24 sm:py-32"
        style={{ background: "var(--slf-purpura)", color: "var(--slf-blanco)" }}
        aria-labelledby="titulo-vender"
      >
        <div className="mx-auto max-w-5xl">
          <h2
            id="titulo-vender"
            className="max-w-[20ch] text-[clamp(1.75rem,4vw,2.75rem)] font-extrabold leading-[1.1] tracking-[-0.02em]"
          >
            Vendelo con tu marca,{" "}
            <span style={{ color: "var(--slf-amarillo)" }}>no con la nuestra</span>
          </h2>
          <p
            className="mt-5 max-w-[56ch] text-lg leading-relaxed"
            style={{ color: "var(--slf-lila)" }}
          >
            Fotógrafos, DJs, salones, productoras, wedding planners, agencias de
            egresos, organizadores de congresos, colegios. Si tenés clientes que
            hacen eventos, este servicio lo vendés vos.
          </p>

          <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {PASOS_PARA_VENDER.map((paso, i) => (
              <li key={paso.titulo}>
                <span
                  aria-hidden
                  className="block text-2xl font-extrabold tabular-nums"
                  style={{ color: "var(--slf-amarillo)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-lg font-extrabold leading-snug">
                  {paso.titulo}
                </h3>
                <p
                  className="mt-2 max-w-[34ch] leading-relaxed"
                  style={{ color: "var(--slf-lila)" }}
                >
                  {paso.detalle}
                </p>
              </li>
            ))}
          </ol>

          <div className="mt-20 grid gap-12 sm:grid-cols-2 sm:gap-16">
            <div>
              <h3 className="text-xl font-extrabold leading-tight">
                Marca blanca de verdad
              </h3>
              <p
                className="mt-4 max-w-[42ch] leading-relaxed"
                style={{ color: "var(--slf-lila)" }}
              >
                Tu cliente ve tu logo y el nombre de tu empresa. En la pantalla
                del salón, en el álbum digital y en los carteles impresos de las
                mesas. Subí la Foto no aparece en ningún lado: para tu cliente,
                el servicio es tuyo.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-extrabold leading-tight">
                Lo único que cuesta
              </h3>
              <p
                className="mt-4 max-w-[42ch] leading-relaxed"
                style={{ color: "var(--slf-lila)" }}
              >
                El{" "}
                <strong className="font-extrabold" style={{ color: "var(--slf-amarillo)" }}>
                  15% del precio que vos pongas
                </strong>
                . Nada más: sin abono mensual, sin costo de alta y sin mínimo de
                eventos. El mes que no vendés, no pagás.
              </p>
            </div>
          </div>

          <Link href="/login" className="mt-14" style={estiloBotonDnx("primario")}>
            Creá tu cuenta y armá tu enlace
          </Link>
        </div>
      </section>

      <section className="sobre-claro px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-5xl">
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
