import Image from "next/image";

import DnxImageSlot from "@/components/dnx/DnxImageSlot";
import { DnxCtaEntrevista, DnxCtaWhatsapp, DnxEnlaceExterno, type DnxPagina } from "@/components/dnx/DnxCta";
import DnxPlanes, { DnxPropuestasSinPrecio } from "@/components/dnx/DnxPlanes";
import {
  DNX_VIDEOS_URL,
  DNX_WEB_URL,
  GOOGLE_REVIEWS_URL,
  INSTAGRAM_URL,
  ONLINE_CALENDAR_URL,
  PORTFOLIO_SECTION_ID,
  PRESENCIAL_CALENDAR_URL,
  PROPUESTAS_SECTION_ID,
  WHATSAPP_URL,
  cuotasXv,
  eventoImages,
  notaFinanciacionXv,
  planesXv,
  porQueDnxXv,
  portfolioImages,
  preXvImages,
  queSeLlevanXv,
  testimoniosDestacados,
  testimoniosRestantes,
} from "@/components/dnx/xv/data";

const PALETA = "xv" as const;

function Testimonio({ nombre, texto }: { nombre: string; texto: string }) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <p className="text-zinc-700">“{texto}”</p>
      <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">{nombre}</p>
    </article>
  );
}

function Tarjeta({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-zinc-700">{body}</p>
    </article>
  );
}

export default function XvLanding({ mostrarPrecios }: { mostrarPrecios: boolean }) {
  const pagina: DnxPagina = mostrarPrecios ? "xv" : "xv-sp";

  const entrevistaPresencial = (variant: "primary" | "secondary" = "primary") => (
    <DnxCtaEntrevista href={PRESENCIAL_CALENDAR_URL} pagina={pagina} paleta={PALETA} modo="presencial" variant={variant}>
      Entrevista presencial
    </DnxCtaEntrevista>
  );

  const entrevistaOnline = (
    <DnxCtaEntrevista href={ONLINE_CALENDAR_URL} pagina={pagina} paleta={PALETA} modo="online" variant="secondary">
      Entrevista online
    </DnxCtaEntrevista>
  );

  const whatsapp = (
    <DnxCtaWhatsapp href={WHATSAPP_URL} pagina={pagina} paleta={PALETA}>
      Consultar disponibilidad por WhatsApp
    </DnxCtaWhatsapp>
  );

  return (
    <main className="overflow-x-hidden bg-[#f4f2ee] pb-28 text-zinc-900 md:pb-10 [&_h1]:w-full [&_h1]:max-w-none [&_h1]:tracking-[-0.03em] [&_h2]:w-full [&_h2]:max-w-none [&_h2]:tracking-[-0.025em] [&_h2]:leading-[1.05] [&_h3]:w-full [&_h3]:max-w-none [&_h3]:tracking-[-0.015em] [&_p]:w-full [&_p]:max-w-none [&_p]:leading-relaxed [&_article]:border-zinc-300/80 [&_article]:shadow-none">
      {/* 1. Hero — sin atajo a los precios: primero se muestra el trabajo */}
      <section className="mx-auto max-w-7xl px-4 pb-12 pt-8 md:px-6 md:pt-12">
        <div className="grid gap-8 md:grid-cols-2 md:items-center">
          <div className="order-2 space-y-6 md:order-1">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">DNX Estudio · XV</p>
            <div className="flex justify-center md:justify-start">
              <Image
                src="/dnx/logo-dnx.png"
                alt="Logo DNX Estudio"
                width={64}
                height={64}
                className="h-14 w-14 rounded-full object-cover md:h-16 md:w-16"
                priority
              />
            </div>
            <h1 className="text-3xl font-semibold leading-tight md:text-5xl">
              Fotografía de XV para que tu hija tenga un recuerdo completo de una etapa que no se repite
            </h1>
            <p className="text-base leading-relaxed text-zinc-700 md:text-lg">
              En DNX Estudio acompañamos a cada familia antes, durante y después de la fiesta: sesión PRE XV,
              cobertura del evento, dirección de poses, productos impresos y una forma de trabajo pensada para que
              todos disfruten con tranquilidad.
            </p>
            <p className="text-sm font-medium text-zinc-500">
              Funes, Rosario y alrededores · Entrevistas presenciales u online · Sin costo
            </p>
            <div className="flex flex-wrap gap-3">
              {entrevistaPresencial()}
              {entrevistaOnline}
            </div>
            {whatsapp}
          </div>
          <DnxImageSlot
            src="/dnx/xv/hero-xv.jpg"
            alt="Fotografía profesional de quinceañera por DNX"
            label="Imagen hero XV"
            className="order-1 min-h-[360px] sm:min-h-[440px] md:order-2 md:min-h-[760px]"
            fit="contain"
            priority
          />
        </div>
      </section>

      {/* 2. Portfolio: la prueba visual antes que cualquier texto */}
      <section id={PORTFOLIO_SECTION_ID} className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mx-auto mb-8 w-full max-w-5xl text-center">
          <h2 className="text-3xl font-semibold uppercase leading-tight text-balance md:text-4xl">
            Mirá primero el tipo de recuerdo que podemos crear
          </h2>
          <p className="mt-4 text-base leading-relaxed text-zinc-700">
            Cada foto de esta página es de una quinceañera real que confió en DNX. Hay sesiones previas, fiesta,
            familia, amigos, detalles y momentos espontáneos.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {["Sesión PRE XV", "Fiesta", "Familia y amigos", "Detalles", "Momentos espontáneos", "Productos"].map((tag) => (
              <span key={tag} className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
          {portfolioImages.map((image, index) => (
            <DnxImageSlot
              key={image.src}
              src={image.src}
              alt={image.alt}
              label={image.label}
              className="mb-4 break-inside-avoid rounded-[28px]"
              priority={index === 0}
            />
          ))}
        </div>
      </section>

      {/* 3. Lo que está en juego */}
      <section className="mx-auto grid max-w-7xl gap-8 overflow-hidden px-4 py-12 md:grid-cols-2 md:items-center md:px-6 md:py-20 md:[&>*]:min-w-0">
        <DnxImageSlot
          src="/dnx/xv/emocional-xv.jpg"
          alt="Retrato emocional de quinceañera y su familia"
          label="Bloque emocional XV"
          className="w-full max-w-full min-h-[280px] rounded-[28px] sm:min-h-[340px] md:min-h-[500px]"
        />
        <div className="min-w-0 rounded-3xl bg-white p-6 shadow-sm md:p-10">
          <h2 className="text-2xl font-semibold md:text-3xl">
            No se trata solo de sacar fotos. Se trata de contar una etapa irrepetible.
          </h2>
          <p className="mt-4 whitespace-pre-line text-zinc-700">
            {`Los XV son mucho más que una fiesta. Son una etapa de cambios, de sueños, de familia y de emociones que pasan una sola vez.

Por eso nuestro trabajo no empieza el día del evento. Te acompañamos desde la planificación, la sesión previa, la elección de productos y cada detalle visual para que el recuerdo tenga coherencia, estética y valor emocional.`}
          </p>
        </div>
      </section>

      {/* 4. Prueba social temprana */}
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="mx-auto w-full max-w-5xl text-center">
          <h2 className="text-3xl font-semibold uppercase leading-tight text-balance md:text-4xl">
            Lo que dicen las familias que ya pasaron por acá
          </h2>
        </div>
        <div className="mx-auto mt-8 grid w-full max-w-5xl gap-4 md:grid-cols-2">
          {testimoniosDestacados.map((item) => (
            <Testimonio key={item.nombre} nombre={item.nombre} texto={item.texto} />
          ))}
        </div>
      </section>

      {/* 5. Qué te llevás exactamente */}
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mx-auto w-full max-w-5xl text-center">
          <h2 className="text-3xl font-semibold uppercase leading-tight text-balance md:text-4xl">
            Qué se lleva tu familia, en concreto
          </h2>
          <p className="mt-4 text-base leading-relaxed text-zinc-700">
            Antes de hablar de propuestas conviene saber qué hay adentro de cualquiera de ellas.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {queSeLlevanXv.map((item) => (
            <Tarjeta key={item.title} title={item.title} body={item.body} />
          ))}
        </div>
      </section>

      {/* 6. Por qué DNX y no otro */}
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mx-auto w-full max-w-5xl text-center">
          <h2 className="text-3xl font-semibold uppercase leading-tight text-balance md:text-4xl">
            Por qué elegirnos a nosotros
          </h2>
          <p className="mt-4 text-base leading-relaxed text-zinc-700">
            Hay muchos fotógrafos buenos en Rosario. Estas son las razones concretas por las que las familias se
            quedan con DNX.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {porQueDnxXv.map((item) => (
            <Tarjeta key={item.title} title={item.title} body={item.body} />
          ))}
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-14">
        <DnxImageSlot
          src="/dnx/xv/separador-xv-02.png"
          alt="Separador visual artístico de quinceañera"
          label="Separador visual XV"
          className="min-h-[260px] sm:min-h-[320px] md:min-h-[380px]"
        />
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center md:px-10">
          <p className="w-full max-w-5xl rounded-2xl bg-black/45 px-4 py-3 text-base font-medium text-white backdrop-blur-sm sm:px-5 sm:py-4 sm:text-lg md:text-3xl">
            No hacemos fotos iguales para todas. Cada quinceañera tiene una historia distinta.
          </p>
        </div>
      </section>

      {/* 7. Sesión PRE XV */}
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mx-auto w-full max-w-5xl text-center">
          <h2 className="text-3xl font-semibold uppercase leading-tight text-balance md:text-4xl">
            Sesión PRE XV: una experiencia pensada para que ella sea protagonista
          </h2>
          <p className="mt-4 text-base leading-relaxed text-zinc-700">
            La sesión previa es uno de los momentos más importantes del proceso. Es el espacio donde la quinceañera
            puede verse, reconocerse y disfrutar de una producción pensada para ella, con dirección de poses,
            elección de locación y una estética acorde a su personalidad.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "Dirección de poses",
              body: "La guiamos para que se sienta cómoda y segura, sin forzar gestos ni poses que no tengan que ver con ella.",
            },
            {
              title: "Locación con sentido",
              body: "Buscamos espacios que acompañen su estilo, su historia y la estética que quiere para sus XV.",
            },
            {
              title: "Producción cuidada",
              body: "Trabajamos la luz, los encuadres, los cambios de vestuario y los detalles para crear una experiencia completa.",
            },
            {
              title: "Fotos con utilidad real",
              body: "Las imágenes pueden usarse para invitaciones, cuadros, redes, fotolibros y productos impresos.",
            },
          ].map((item) => (
            <article key={item.title} className="rounded-2xl border border-zinc-200 bg-white p-5 text-zinc-700 shadow-sm">
              <h3 className="font-semibold text-zinc-900">{item.title}</h3>
              <p className="mt-2 text-sm">{item.body}</p>
            </article>
          ))}
        </div>
        <div className="mt-8 columns-1 gap-4 sm:columns-2 lg:columns-4">
          {preXvImages.map((image) => (
            <DnxImageSlot
              key={image.src}
              src={image.src}
              alt={image.alt}
              label="Galería PRE XV"
              className="mb-4 break-inside-avoid rounded-[28px]"
            />
          ))}
        </div>
      </section>

      {/* 7b. La fiesta */}
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mx-auto w-full max-w-5xl text-center">
          <h2 className="text-3xl font-semibold uppercase leading-tight text-balance md:text-4xl">El día de la fiesta, cada momento importa</h2>
          <p className="mt-4 text-base leading-relaxed text-zinc-700">
            Durante el evento no solo buscamos las fotos posadas. También estamos atentos a lo que pasa alrededor: la
            entrada, los abrazos, la familia, los amigos, el baile, los detalles y esos momentos espontáneos que
            después se vuelven los más valiosos.
          </p>
        </div>
        <div className="mt-8 columns-1 gap-4 md:columns-3">
          {eventoImages.map((image) => (
            <DnxImageSlot
              key={image.src}
              src={image.src}
              alt={image.alt}
              label="Cobertura evento XV"
              className="mb-4 break-inside-avoid rounded-[28px]"
            />
          ))}
        </div>
      </section>

      {/* 8. Cómo trabajamos */}
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <h2 className="text-center text-3xl font-semibold uppercase md:text-4xl">Cómo es trabajar con nosotros</h2>
        <p className="mx-auto mt-4 w-full max-w-5xl text-center text-base leading-relaxed text-zinc-700">
          Para que todo salga bien, seguimos un proceso claro desde el primer contacto hasta la entrega final.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "1. Entrevista inicial",
              body: "Nos reunimos con la familia para conocer la fecha, el estilo de la fiesta, las ideas de la quinceañera y qué tipo de recuerdo quieren conservar.",
            },
            {
              title: "2. Elección de propuesta",
              body: "Te mostramos las opciones disponibles y definimos qué cobertura se adapta mejor a la fiesta, al presupuesto y a la importancia que quieran darle al recuerdo.",
            },
            {
              title: "3. Sesión PRE XV",
              body: "Realizamos una sesión previa con dirección, estética y producción para que la quinceañera viva una experiencia propia antes del evento.",
            },
            {
              title: "4. Cobertura del evento",
              body: "El día de la fiesta cubrimos los momentos más importantes con una mirada documental, estética y emocional.",
            },
            {
              title: "5. Selección y entrega",
              body: "Después del evento, la familia accede a sus fotos de forma organizada para elegir, conservar y compartir.",
            },
            {
              title: "6. Productos finales",
              body: "Entregamos fotografías digitales, impresiones, fotolibros, cuadros o productos personalizados según la propuesta contratada.",
            },
          ].map((step) => (
            <Tarjeta key={step.title} title={step.title} body={step.body} />
          ))}
        </div>
      </section>

      {/* 9. Productos impresos */}
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-2 md:items-center md:px-6 md:py-20 md:[&>*]:min-w-0">
        <DnxImageSlot
          src="/dnx/xv/productos-xv-01.jpg"
          alt="Productos impresos para fotografía de XV"
          label="Productos impresos XV"
          className="w-full max-w-full min-h-[280px] sm:min-h-[340px] md:min-h-[470px]"
        />
        <div className="space-y-4 rounded-3xl bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-3xl font-semibold">Tus fotos no deberían quedar solamente en el celular</h2>
          <p className="text-zinc-700">
            Las fotos digitales son importantes, pero los recuerdos más valiosos también merecen estar impresos. Por
            eso ofrecemos fotolibros, ampliaciones, cuadros y presentaciones personalizadas para que esta etapa pueda
            conservarse y volver a vivirse con el paso del tiempo.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {["Fotolibros", "Ampliaciones", "Cuadros", "Presentaciones personalizadas"].map((item) => (
              <div key={item} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                {item}
              </div>
            ))}
          </div>
          <p className="text-sm font-medium text-zinc-600">
            Porque un recuerdo importante no debería perderse entre miles de archivos.
          </p>
        </div>
      </section>

      {/* 10. Objeciones */}
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <h2 className="text-center text-3xl font-semibold uppercase md:text-4xl">
          Sabemos lo que más preocupa a una familia al contratar fotografía
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[
            {
              title: "Que se pierdan momentos importantes",
              body: "Por eso hacemos una entrevista previa, conocemos la dinámica de la fiesta y trabajamos atentos a las situaciones que después se transforman en recuerdos.",
            },
            {
              title: "Que la quinceañera se sienta incómoda",
              body: "La dirección de poses está pensada para acompañarla con respeto, confianza y naturalidad, incluso si es tímida o no está acostumbrada a posar.",
            },
            {
              title: "Que todo quede improvisado",
              body: "Trabajamos con un proceso claro: entrevista, propuesta, sesión previa, cobertura, selección, entrega y productos finales.",
            },
            {
              title: "Que las fotos queden perdidas en una pantalla",
              body: "Además de la entrega digital, ofrecemos productos impresos para conservar y revivir este recuerdo de una forma real.",
            },
          ].map((item) => (
            <Tarjeta key={item.title} title={item.title} body={item.body} />
          ))}
        </div>
      </section>

      {/* 11. Propuestas — con o sin importes según la variante */}
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mx-auto w-full max-w-5xl text-center">
          <h2 className="text-3xl font-semibold uppercase leading-tight text-balance md:text-4xl">
            Elegí la propuesta según cómo querés recordar tus XV
          </h2>
          <p className="mt-4 text-base leading-relaxed text-zinc-700">
            Algunas familias buscan una cobertura clara y profesional. Otras quieren sumar sesión previa, fotolibros,
            video, backstage, impresiones y una experiencia más completa.
          </p>
        </div>

        <div className="mt-10">
          {mostrarPrecios ? (
            <DnxPlanes
              id={PROPUESTAS_SECTION_ID}
              planes={planesXv}
              cuotas={cuotasXv}
              paleta={PALETA}
              pagina={pagina}
              notaFinanciacion={notaFinanciacionXv}
            />
          ) : (
            <DnxPropuestasSinPrecio id={PROPUESTAS_SECTION_ID} planes={planesXv} paleta={PALETA} />
          )}
        </div>

        <p className="mx-auto mt-8 max-w-3xl text-center text-sm text-zinc-600">
          {mostrarPrecios
            ? "No hace falta que decidas todo ahora. En la entrevista revisamos tu fecha, el estilo de fiesta, qué le gustaría a la quinceañera, qué productos les interesan y cuál de las propuestas tiene más sentido para ustedes."
            : "Los valores dependen de la fecha, la disponibilidad y los adicionales que sumen. Escribinos con la fecha de la fiesta y te pasamos la propuesta completa con importes y formas de pago."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {entrevistaPresencial()}
          {entrevistaOnline}
          {whatsapp}
        </div>
      </section>

      {/* 12. Resto de la prueba social */}
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mx-auto w-full max-w-5xl text-center">
          <h2 className="text-3xl font-semibold uppercase leading-tight text-balance md:text-4xl">
            La tranquilidad también es parte del trabajo
          </h2>
          <p className="mt-4 text-base leading-relaxed text-zinc-700">
            Las familias no solo valoran las fotos. También valoran el acompañamiento y la forma en la que vivimos el
            proceso junto a ellas.
          </p>
        </div>
        <div className="mx-auto mt-8 grid w-full max-w-5xl gap-4 md:grid-cols-2">
          {testimoniosRestantes.map((item) => (
            <Testimonio key={item.nombre} nombre={item.nombre} texto={item.texto} />
          ))}
        </div>
        <div className="mt-8 text-center">
          <DnxEnlaceExterno href={GOOGLE_REVIEWS_URL} pagina={pagina} paleta={PALETA} destino="resenas">
            Ver todas las reseñas de Google
          </DnxEnlaceExterno>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-2 md:items-center md:px-6 md:py-20 md:[&>*]:min-w-0">
        <DnxImageSlot
          src="/dnx/xv/dnx-estudio-xv.jpg"
          alt="Estudio fotográfico DNX Estudio en Funes"
          label="Presentación estudio DNX"
          className="w-full min-h-[280px] sm:min-h-[340px] md:min-h-[500px]"
        />
        <div className="space-y-4">
          <h2 className="text-3xl font-semibold uppercase md:text-4xl">Somos DNX Estudio</h2>
          <p className="text-zinc-700">
            Somos un estudio especializado en fotografía de quinceañeras. Acompañamos a familias de Funes, Rosario y
            alrededores en una etapa muy especial: los XV de sus hijas.
          </p>
          <p className="text-zinc-700">
            Nuestro trabajo combina fotografía profesional, dirección cuidada, planificación previa, productos
            impresos y una experiencia cercana para que el resultado final no sea solo una galería de fotos, sino un
            recuerdo completo de esta historia.
          </p>
          <ul className="space-y-2 text-zinc-700">
            <li>- Especialistas en fotografía de quinceañeras.</li>
            <li>- Estudio físico en San José 1672 - Local 5 - Funes.</li>
            <li>- Cobertura en Funes, Rosario y alrededores.</li>
            <li>- Experiencia en sesiones PRE XV y eventos sociales.</li>
            <li>- Entrega de productos digitales e impresos.</li>
            <li>- Acompañamiento personalizado desde la entrevista inicial.</li>
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 text-center md:px-6 md:py-20">
        <h2 className="text-3xl font-semibold uppercase leading-tight text-balance md:text-4xl">
          También podemos contar parte de la historia en video
        </h2>
        <p className="mx-auto mt-4 w-full max-w-5xl text-base leading-relaxed text-zinc-700">
          Algunas propuestas permiten sumar video, backstage o resúmenes para conservar no solo cómo se veía la
          fiesta, sino también cómo se vivió.
        </p>
        <div className="mt-6">
          <DnxEnlaceExterno href={DNX_VIDEOS_URL} pagina={pagina} paleta={PALETA} destino="videos">
            Ver videos de DNX
          </DnxEnlaceExterno>
        </div>
      </section>

      {/* 13. Preguntas frecuentes */}
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <h2 className="text-center text-3xl font-semibold uppercase md:text-4xl">Preguntas frecuentes</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[
            {
              q: "¿La entrevista tiene costo?",
              a: "No. La entrevista inicial es sin costo y sirve para conocernos, resolver dudas y ver qué propuesta se adapta mejor a la fiesta.",
            },
            {
              q: "¿Puede ser online?",
              a: "Sí. Podemos hacer la entrevista por videollamada o presencial en nuestro estudio.",
            },
            {
              q: "¿Dónde están ubicados?",
              a: "Estamos en San José 1672 - Local 5 - Funes, y trabajamos en Funes, Rosario y alrededores.",
            },
            {
              q: "¿Con cuánto tiempo conviene reservar?",
              a: "Lo ideal es consultar apenas tengan fecha definida, especialmente en temporada alta.",
            },
            {
              q: "¿La sesión PRE XV está incluida?",
              a: "Sí, en las tres propuestas. Lo que cambia entre una y otra es qué se suma después: fotolibros, video, impresiones y productos.",
            },
            {
              q: "¿Qué pasa si mi hija es tímida o no sabe posar?",
              a: "No hay problema. La sesión está guiada de principio a fin. La ayudamos con poses, gestos y movimientos para que se sienta cómoda, sin forzar una actitud que no tenga que ver con ella.",
            },
            {
              q: "¿Entregan fotos impresas?",
              a: "Sí. Trabajamos con productos impresos, fotolibros y diferentes formatos según el pack contratado.",
            },
            {
              q: "¿Cómo reservamos la fecha?",
              a: "Primero coordinamos una entrevista para revisar disponibilidad, propuesta y condiciones. Si la fecha está disponible, te indicamos cómo avanzar con la reserva.",
            },
            {
              q: "¿Los valores se pueden financiar?",
              a: "Sí. Contamos con opciones de financiación sin recargo hasta el día de la fiesta o hasta un máximo de 6 pagos, según la propuesta elegida.",
            },
            {
              q: "¿Podemos personalizar el pack?",
              a: "Sí. Los packs sirven como base, pero en la entrevista podemos revisar adicionales, productos impresos, video, backstage u otras necesidades específicas.",
            },
            {
              q: "¿Cuánto tarda la entrega?",
              a: "Los tiempos de entrega se informan en la entrevista según la propuesta contratada y el tipo de productos incluidos.",
            },
            {
              q: "¿Qué pasa si todavía no tenemos todo definido?",
              a: "Podés agendar igual. La entrevista también sirve para ordenar ideas, resolver dudas y entender qué tipo de cobertura tiene más sentido para la fiesta.",
            },
            {
              q: "¿Cubren ceremonia?",
              a: "Las propuestas principales están enfocadas en sesión PRE XV y fiesta. Si la familia necesita cubrir una ceremonia u otro momento especial, lo evaluamos en la entrevista.",
            },
          ].map((item) => (
            <article key={item.q} className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h3 className="font-semibold">{item.q}</h3>
              <p className="mt-2 text-zinc-700">{item.a}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 14. Cierre */}
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="grid gap-8 rounded-3xl bg-zinc-900 p-6 text-white md:grid-cols-2 md:items-center md:p-10 md:[&>*]:min-w-0">
          <DnxImageSlot
            src="/dnx/xv/cierre-xv.jpg"
            alt="Cierre de experiencia fotográfica para XV"
            label="Cierre CTA XV"
            className="min-h-[240px] bg-zinc-700 sm:min-h-[280px] md:min-h-[360px]"
          />
          <div className="space-y-4">
            <h2 className="text-3xl font-semibold">El primer paso es revisar tu fecha y resolver tus dudas</h2>
            <p className="text-zinc-200">
              Agendá una entrevista presencial u online. Te mostramos las propuestas completas, vemos disponibilidad
              para tu fecha y te ayudamos a elegir la opción más conveniente para tus XV.
            </p>
            <p className="text-zinc-300">La entrevista es sin costo y no te compromete a contratar.</p>
            <div className="flex flex-wrap gap-3">
              {entrevistaPresencial("secondary")}
              {entrevistaOnline}
              {whatsapp}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 text-sm text-zinc-600 md:px-6">
          <p className="font-semibold text-zinc-900">DNX Estudio</p>
          <p className="mt-2">San José 1672 - Local 5 - Funes</p>
          <p>Funes, Rosario y alrededores</p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            <a href={DNX_WEB_URL} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900">
              Web
            </a>
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900">
              Instagram
            </a>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900">
              WhatsApp
            </a>
            <a href={DNX_VIDEOS_URL} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900">
              Videos
            </a>
            <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900">
              Reseñas
            </a>
          </div>
        </div>
      </footer>

      <div className="fixed bottom-3 left-1/2 z-50 w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-2xl border border-zinc-200 bg-white/95 p-2 shadow-lg backdrop-blur md:hidden">
        <div className="grid grid-cols-2 gap-2">
          <DnxCtaEntrevista
            href={PRESENCIAL_CALENDAR_URL}
            pagina={pagina}
            paleta={PALETA}
            modo="presencial"
            className="w-full !px-4"
          >
            Presencial
          </DnxCtaEntrevista>
          <DnxCtaEntrevista
            href={ONLINE_CALENDAR_URL}
            pagina={pagina}
            paleta={PALETA}
            modo="online"
            variant="secondary"
            className="w-full !px-4"
          >
            Online
          </DnxCtaEntrevista>
        </div>
      </div>
    </main>
  );
}
