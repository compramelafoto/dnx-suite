import Image from "next/image";

import DnxImageSlot from "@/components/dnx/DnxImageSlot";
import { DnxCtaEntrevista, DnxCtaWhatsapp, DnxEnlaceExterno, type DnxPagina } from "@/components/dnx/DnxCta";
import DnxPlanes, { DnxPropuestasSinPrecio } from "@/components/dnx/DnxPlanes";
import {
  DNX_WEB_URL,
  GOOGLE_REVIEWS_URL,
  INSTAGRAM_URL,
  ONLINE_CALENDAR_URL,
  PORTFOLIO_SECTION_ID,
  PRESENCIAL_CALENDAR_URL,
  PROPUESTAS_SECTION_ID,
  WHATSAPP_URL,
  ceremoniaImages,
  cuotasBodas,
  fiestaImages,
  notaFinanciacionBodas,
  planesBodas,
  porQueDnxBodas,
  portfolioImages,
  preparativosImages,
  queSeLlevanBodas,
} from "@/components/dnx/bodas/data";

const PALETA = "bodas" as const;

function Tarjeta({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <h3 className="text-base font-semibold text-stone-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-stone-700">{body}</p>
    </article>
  );
}

export default function BodasLanding({ mostrarPrecios }: { mostrarPrecios: boolean }) {
  const pagina: DnxPagina = mostrarPrecios ? "bodas" : "bodas-sp";

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
    <main className="w-full min-w-0 overflow-x-hidden bg-[#faf7f4] pb-28 text-stone-900 antialiased md:pb-10">
      {/* 1. Hero — sin atajo a los precios: primero se muestra el trabajo */}
      <section className="mx-auto w-full min-w-0 max-w-7xl px-4 pb-12 pt-8 md:px-6 md:pt-12">
        <div className="grid w-full min-w-0 gap-8 lg:grid-cols-2 lg:items-center">
          <div className="order-2 min-w-0 w-full space-y-6 lg:order-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">DNX Fotografía · Bodas</p>
            <div className="flex justify-center lg:justify-start">
              <Image
                src="/dnx/logo-dnx.png"
                alt="Logo DNX Fotografía"
                width={64}
                height={64}
                className="h-14 w-14 rounded-full object-cover ring-1 ring-stone-200/80 lg:h-16 lg:w-16"
                priority
              />
            </div>
            <h1 className="text-3xl font-semibold leading-tight md:text-4xl lg:text-5xl">
              Fotografía de bodas para que el recuerdo de ese día sea eterno
            </h1>
            <p className="text-base leading-relaxed text-stone-700 md:text-lg">
              En DNX Fotografía contamos la historia de tu boda con una mirada cercana, profesional y emocional:
              preparativos, detalles, ceremonia, fiesta, familia, amigos y esos momentos espontáneos que merecen quedar
              para siempre.
            </p>
            <p className="text-sm font-medium text-stone-500">
              Funes, Rosario y alrededores · Entrevistas presenciales u online · Sin costo
            </p>
            <div className="flex flex-wrap gap-3">
              {entrevistaPresencial()}
              {entrevistaOnline}
            </div>
            {whatsapp}
          </div>
          <DnxImageSlot
            src="/dnx/bodas/hero-boda-vertical.png"
            alt="Fotografía de boda hero — DNX Fotografía"
            label="Hero boda"
            className="order-1 min-h-[420px] w-full min-w-0 lg:order-2 lg:min-h-[680px]"
            fit="cover"
            objectPosition="center top"
            priority
          />
        </div>
      </section>

      {/* 2. Portfolio: la prueba visual antes que cualquier texto */}
      <section id={PORTFOLIO_SECTION_ID} className="mx-auto w-full min-w-0 max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mx-auto mb-10 w-full min-w-0 max-w-4xl text-pretty text-center md:max-w-5xl">
          <h2 className="text-2xl font-semibold uppercase tracking-wide text-stone-900 md:text-3xl">
            Mirá primero cómo contamos una boda
          </h2>
          <p className="mt-4 text-base leading-relaxed text-stone-700">
            Cada boda tiene su ritmo, su energía y su historia. Las fotos deben reflejar eso: no solo cómo se veía el
            evento, sino cómo se sintió vivirlo.
          </p>
        </div>
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {portfolioImages.map((img, index) => (
            <div key={img.src} className="mb-4 break-inside-avoid">
              <DnxImageSlot
                src={img.src}
                alt={img.alt}
                label={img.label}
                className="min-h-[220px] md:min-h-[260px]"
                fit="cover"
                priority={index < 3}
                gallery={portfolioImages.map((item) => ({ src: item.src, alt: item.alt }))}
                currentIndex={index}
              />
            </div>
          ))}
        </div>
      </section>

      {/* 3. Lo que está en juego */}
      <section className="mx-auto w-full min-w-0 max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="mx-auto w-full min-w-0 max-w-4xl text-pretty text-center md:max-w-5xl">
          <h2 className="text-2xl font-semibold uppercase tracking-wide text-stone-900 md:text-3xl">
            Tu boda pasa una vez. El recuerdo queda para siempre.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-stone-700 md:text-lg">
            No se trata solamente de tener fotos lindas. Se trata de poder volver a sentir lo que pasó ese día: los nervios
            antes de salir, los abrazos, las miradas, los detalles, la ceremonia, la fiesta y todo lo que quizás en el
            momento no llegaste a ver.
          </p>
        </div>
      </section>

      <section className="mx-auto grid w-full min-w-0 max-w-7xl gap-8 overflow-hidden px-4 py-12 md:grid-cols-2 md:items-center md:px-6 md:py-20 md:[&>*]:min-w-0">
        <DnxImageSlot
          src="/dnx/bodas/detalles-01.png"
          alt="Detalles de boda fotografiados por DNX"
          label="Detalles boda"
          className="w-full min-h-[280px] rounded-[28px] sm:min-h-[360px] md:min-h-[480px]"
          fit="cover"
        />
        <div className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-sm md:p-10">
          <h2 className="text-2xl font-semibold md:text-3xl">No queremos que tus recuerdos vivan solo en tu memoria</h2>
          <p className="mt-4 text-stone-700">
            Queremos ser parte de esos recuerdos para que no se pierdan con el tiempo. Registrar con amor,
            profesionalismo y respeto cada momento, mientras ustedes disfrutan de su boda sin estar pendientes de la
            cámara.
          </p>
        </div>
      </section>

      {/* 4. Prueba social temprana */}
      <section className="mx-auto w-full min-w-0 max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="mx-auto w-full min-w-0 max-w-4xl text-pretty text-center md:max-w-5xl">
          <h2 className="text-2xl font-semibold uppercase tracking-wide md:text-3xl">
            Una experiencia cercana desde el primer contacto
          </h2>
          <p className="mt-4 text-base text-stone-700">
            En nuestras coberturas, las familias y parejas suelen destacar la predisposición, el buen trato, la
            tranquilidad durante el evento y la forma ordenada de trabajar. Para nosotros, la experiencia humana es tan
            importante como la calidad de las fotos.
          </p>
        </div>
        <div className="mt-8 text-center">
          <DnxEnlaceExterno href={GOOGLE_REVIEWS_URL} pagina={pagina} paleta={PALETA} destino="resenas">
            Ver las reseñas de DNX en Google
          </DnxEnlaceExterno>
        </div>
      </section>

      {/* 5. Qué te llevás exactamente */}
      <section className="mx-auto w-full min-w-0 max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mx-auto w-full min-w-0 max-w-4xl text-pretty text-center md:max-w-5xl">
          <h2 className="text-2xl font-semibold uppercase tracking-wide md:text-3xl">Qué se llevan ustedes, en concreto</h2>
          <p className="mt-4 text-base text-stone-700">
            Antes de hablar de propuestas conviene saber qué hay adentro de cualquiera de ellas.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {queSeLlevanBodas.map((item) => (
            <Tarjeta key={item.title} title={item.title} body={item.body} />
          ))}
        </div>
      </section>

      {/* 6. Por qué DNX y no otro */}
      <section className="mx-auto w-full min-w-0 max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mx-auto w-full min-w-0 max-w-4xl text-pretty text-center md:max-w-5xl">
          <h2 className="text-2xl font-semibold uppercase tracking-wide md:text-3xl">Por qué elegirnos a nosotros</h2>
          <p className="mt-4 text-base text-stone-700">
            Hay muchos fotógrafos buenos en Rosario. Estas son las razones concretas por las que las parejas se quedan
            con DNX.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {porQueDnxBodas.map((item) => (
            <Tarjeta key={item.title} title={item.title} body={item.body} />
          ))}
        </div>
      </section>

      {/* 7. Preparativos */}
      <section className="mx-auto w-full min-w-0 max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mx-auto w-full min-w-0 max-w-4xl text-pretty text-center md:max-w-5xl">
          <h2 className="text-2xl font-semibold uppercase tracking-wide md:text-3xl">Los preparativos también son parte de la historia</h2>
          <p className="mt-4 text-base text-stone-700">
            Antes de la ceremonia aparecen nervios, detalles, maquillaje, vestido, zapatos, familia, mensajes y momentos
            íntimos que después tienen un valor enorme. Por eso nos gusta registrar esa parte del día con una mirada
            sensible y cuidada.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {preparativosImages.map((img) => (
            <DnxImageSlot
              key={img.src}
              src={img.src}
              alt={img.alt}
              label={img.label}
              className="w-full"
              aspectRatio="4 / 3"
              fit="cover"
            />
          ))}
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {["Vestido, zapatos y detalles", "Maquillaje y momentos previos", "Familia acompañando", "La calma antes de la celebración"].map(
            (t) => (
              <div key={t} className="rounded-xl border border-stone-200 bg-white/90 p-4 text-center text-sm font-medium text-stone-800 shadow-sm">
                {t}
              </div>
            )
          )}
        </div>
      </section>

      {/* 7b. Ceremonia */}
      <section className="mx-auto w-full min-w-0 max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mx-auto w-full min-w-0 max-w-4xl text-pretty text-center md:max-w-5xl">
          <h2 className="text-2xl font-semibold uppercase tracking-wide md:text-3xl">La ceremonia: el momento donde todo se vuelve real</h2>
          <p className="mt-4 text-base text-stone-700">
            Miradas, manos, anillos, emoción y promesas. Durante la ceremonia buscamos registrar lo esencial sin
            interrumpir, respetando el clima del momento y cuidando cada encuadre.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {ceremoniaImages.map((img) => (
            <DnxImageSlot key={img.src} src={img.src} alt={img.alt} label={img.label} className="min-h-[260px] md:min-h-[340px]" fit="cover" />
          ))}
        </div>
      </section>

      {/* 7c. Fiesta */}
      <section className="mx-auto w-full min-w-0 max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mx-auto w-full min-w-0 max-w-4xl text-pretty text-center md:max-w-5xl">
          <h2 className="text-2xl font-semibold uppercase tracking-wide md:text-3xl">La fiesta también se cuenta con emoción</h2>
          <p className="mt-4 text-base text-stone-700">
            Después de la ceremonia llega el momento de celebrar. Ahí buscamos fotos espontáneas, energía real, abrazos,
            baile, familia, amigos y situaciones que muestran cómo se vivió la noche.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {fiestaImages.map((img) => (
            <DnxImageSlot key={img.src} src={img.src} alt={img.alt} label={img.label} className="min-h-[260px] md:min-h-[340px]" fit="cover" />
          ))}
        </div>
      </section>

      {/* 8. Cómo trabajamos */}
      <section className="mx-auto w-full min-w-0 max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mx-auto w-full min-w-0 max-w-4xl text-pretty text-center md:max-w-5xl">
          <h2 className="text-2xl font-semibold uppercase tracking-wide md:text-3xl">Cómo es trabajar con nosotros</h2>
          <p className="mt-4 text-base text-stone-700">
            Para que todo salga bien, seguimos un proceso claro desde el primer contacto hasta la entrega final.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "1. Entrevista inicial",
              body: "Nos reunimos para conocer la fecha, el lugar, el estilo de boda, sus gustos, dudas y expectativas.",
            },
            {
              title: "2. Elección de propuesta",
              body: "Les mostramos las opciones disponibles y definimos qué cobertura se adapta mejor a lo que están buscando.",
            },
            {
              title: "3. Planificación previa",
              body: "Conversamos sobre momentos importantes, horarios, preparativos, ceremonia, fiesta y cualquier detalle que quieran tener presente.",
            },
            {
              title: "4. Cobertura del evento",
              body: "El día de la boda registramos la historia completa con una mirada documental, estética y emocional.",
            },
            {
              title: "5. Selección y entrega",
              body: "Después del evento, organizamos la entrega para que puedan ver, elegir, compartir y conservar sus fotos.",
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
      <section className="mx-auto grid w-full min-w-0 max-w-7xl gap-8 overflow-hidden px-4 py-12 md:grid-cols-2 md:items-center md:px-6 md:py-20 md:[&>*]:min-w-0">
        <DnxImageSlot
          src="/dnx/bodas/portfolio-01.png"
          alt="Fotolibro premium de boda"
          label="Fotolibro premium boda"
          className="w-full min-h-[280px] rounded-[28px] md:min-h-[420px]"
          fit="cover"
        />
        <div className="space-y-4 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-2xl font-semibold md:text-3xl">Tus fotos no deberían quedar solamente en una pantalla</h2>
          <p className="text-stone-700">
            Hoy vemos casi todo desde el celular, pero hay recuerdos que merecen estar impresos. Por eso trabajamos con
            laboratorios profesionales para ofrecer fotolibros, ampliaciones, cuadros en canvas, cuadros en madera,
            gigantografías y otros formatos de alta calidad.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {["Fotolibros", "Ampliaciones", "Cuadros en canvas", "Cuadros en madera", "Gigantografías", "Presentaciones personalizadas"].map(
              (item) => (
                <div key={item} className="rounded-xl border border-stone-100 bg-stone-50/80 px-3 py-2.5 text-sm text-stone-800">
                  {item}
                </div>
              )
            )}
          </div>
          <p className="text-sm font-medium text-stone-600">
            Porque una historia importante también merece poder tocarse, guardarse y volver a verse con el paso del tiempo.
          </p>
        </div>
      </section>

      {/* 10. Objeciones */}
      <section className="mx-auto w-full min-w-0 max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <h2 className="text-center text-2xl font-semibold uppercase tracking-wide md:text-3xl">
          Sabemos lo que más preocupa al elegir fotógrafo para una boda
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[
            {
              title: "Que se pierdan momentos importantes",
              body: "Por eso planificamos antes, conversamos sobre la dinámica del evento y trabajamos atentos a los momentos que después se vuelven inolvidables.",
            },
            {
              title: "Sentirse incómodos frente a la cámara",
              body: "Los acompañamos con una dirección natural y respetuosa para que las fotos se sientan propias, sin poses forzadas.",
            },
            {
              title: "Que el fotógrafo interrumpa la boda",
              body: "Buscamos movernos con libertad, pero sin invadir. Queremos registrar lo que pasa, no modificar cada momento.",
            },
            {
              title: "Recibir solo archivos y nada más",
              body: "Además de la entrega digital, ofrecemos impresiones, fotolibros y productos para que el recuerdo también exista fuera de una pantalla.",
            },
          ].map((item) => (
            <Tarjeta key={item.title} title={item.title} body={item.body} />
          ))}
        </div>
      </section>

      {/* 11. Propuestas — con o sin importes según la variante */}
      <section className="mx-auto w-full min-w-0 max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="mx-auto w-full min-w-0 max-w-4xl text-pretty text-center md:max-w-5xl">
          <h2 className="text-2xl font-semibold uppercase tracking-wide md:text-3xl">Propuestas para diferentes formas de recordar tu boda</h2>
          <p className="mt-4 text-base text-stone-700">
            Cada boda tiene una historia distinta. Algunas parejas buscan una cobertura clara de los momentos principales.
            Otras quieren sumar sesión pre boda, fotolibros, recuerdos impresos, fotos para regalar a invitados o video.
          </p>
        </div>

        <div className="mt-10">
          {mostrarPrecios ? (
            <DnxPlanes
              id={PROPUESTAS_SECTION_ID}
              planes={planesBodas}
              cuotas={cuotasBodas}
              paleta={PALETA}
              pagina={pagina}
              notaFinanciacion={notaFinanciacionBodas}
            />
          ) : (
            <DnxPropuestasSinPrecio id={PROPUESTAS_SECTION_ID} planes={planesBodas} paleta={PALETA} />
          )}
        </div>

        <p className="mx-auto mt-8 max-w-3xl text-center text-sm text-stone-600">
          {mostrarPrecios
            ? "No hace falta que decidan todo ahora. En la entrevista revisamos la fecha, el lugar, el estilo de boda, qué productos les interesan y cuál de las propuestas tiene más sentido para ustedes."
            : "Los valores dependen de la fecha, la disponibilidad, la ciudad y los adicionales que sumen. Escribinos con la fecha de la boda y te pasamos la propuesta completa con importes y formas de pago."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {entrevistaPresencial()}
          {entrevistaOnline}
          {whatsapp}
        </div>
      </section>

      {/* 12. Quiénes somos */}
      <section className="mx-auto grid w-full min-w-0 max-w-7xl gap-8 overflow-hidden px-4 py-12 md:grid-cols-2 md:items-center md:px-6 md:py-20 md:[&>*]:min-w-0">
        <DnxImageSlot
          src="/dnx/bodas/entrevista-boda.png"
          alt="Entrevista y equipo DNX Fotografía"
          label="Entrevista boda"
          className="w-full min-h-[280px] rounded-[28px] md:min-h-[440px]"
          fit="cover"
        />
        <div className="min-w-0 w-full space-y-4">
          <h2 className="text-3xl font-semibold tracking-tight text-stone-900 md:text-4xl">Somos DNX Estudio</h2>
          <p className="text-stone-700">
            Somos un estudio fotográfico de Funes especializado en contar historias reales. En bodas, nuestro objetivo no
            es solo lograr calidad fotográfica: también queremos que la experiencia sea cercana, ordenada y humana desde
            el primer contacto hasta la entrega final.
          </p>
          <p className="text-stone-700">
            Trabajamos con fotógrafos, videógrafos, editores, maquilladoras, asesoras de imagen y laboratorios
            profesionales para ofrecer una experiencia completa y cuidada.
          </p>
          <ul className="space-y-2 text-stone-700">
            <li>· Estudio físico en San José 1672 - Local 5 - Funes.</li>
            <li>· Cobertura en Funes, Rosario y alrededores.</li>
            <li>· Experiencia en eventos sociales y bodas.</li>
            <li>· Equipo de fotografía, video, edición y laboratorios profesionales.</li>
            <li>· Trabajo ordenado con herramientas de gestión y seguimiento.</li>
            <li>· Acompañamiento personalizado desde la entrevista inicial.</li>
          </ul>
        </div>
      </section>

      {/* 13. Preguntas frecuentes */}
      <section className="mx-auto w-full min-w-0 max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <h2 className="text-center text-2xl font-semibold uppercase tracking-wide md:text-3xl">Preguntas frecuentes</h2>
        <div className="mx-auto mt-8 grid w-full min-w-0 max-w-4xl gap-4 md:grid-cols-2 md:max-w-6xl">
          {[
            {
              q: "¿La entrevista tiene costo?",
              a: "No. La entrevista inicial es sin costo y sirve para conocernos, resolver dudas, revisar disponibilidad y ver qué propuesta se adapta mejor a la boda.",
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
              a: "Lo ideal es consultar apenas tengan fecha definida, especialmente si la boda es en temporada alta.",
            },
            {
              q: "¿Cubren preparativos?",
              a: "Sí, según la propuesta elegida. Los preparativos suelen ser una parte muy valiosa de la historia porque muestran detalles, nervios, familia y momentos previos.",
            },
            {
              q: "¿Cubren ceremonia y fiesta?",
              a: "Sí. Las tres propuestas incluyen cobertura de ceremonia y de fiesta. Lo que cambia entre una y otra es qué se suma después.",
            },
            {
              q: "¿Qué pasa si no nos gusta posar?",
              a: "No hay problema. La idea no es forzar poses rígidas, sino acompañarlos con una dirección natural para que las fotos se sientan auténticas.",
            },
            {
              q: "¿Entregan fotos impresas?",
              a: "Sí. Trabajamos con fotolibros, ampliaciones, cuadros y diferentes formatos impresos según la propuesta contratada.",
            },
            {
              q: "¿También ofrecen video?",
              a: "Sí. La propuesta Premium incluye video, y en las otras se puede sumar según disponibilidad. Lo vemos en la entrevista.",
            },
            {
              q: "¿Cómo reservamos la fecha?",
              a: "Primero coordinamos una entrevista para revisar disponibilidad, propuesta y condiciones. Si la fecha está disponible, te indicamos cómo avanzar con la reserva.",
            },
            {
              q: "¿Podemos personalizar el pack?",
              a: "Sí. Las propuestas sirven como base, pero podemos revisar adicionales, productos impresos, video u otras necesidades específicas.",
            },
            {
              q: "¿Qué pasa si todavía no tenemos todo definido?",
              a: "Podés agendar igual. La entrevista también sirve para ordenar ideas, resolver dudas y entender qué tipo de cobertura tiene más sentido para la boda.",
            },
          ].map((item) => (
            <article key={item.q} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-stone-900">{item.q}</h3>
              <p className="mt-2 text-sm text-stone-700">{item.a}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 14. Cierre */}
      <section className="mx-auto w-full min-w-0 max-w-7xl px-4 py-12 md:px-6 md:py-20">
        <div className="grid w-full min-w-0 gap-8 overflow-hidden rounded-3xl border border-stone-200/80 bg-stone-900 p-6 text-white shadow-xl md:grid-cols-2 md:items-center md:p-10 md:[&>*]:min-w-0">
          <DnxImageSlot
            src="/dnx/bodas/preparativos-01.png"
            alt="Novia en preparativos antes de la boda"
            label="Cierre boda"
            className="min-h-[240px] bg-stone-800 sm:min-h-[300px] md:min-h-[360px]"
            fit="cover"
          />
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold md:text-3xl">El primer paso es revisar tu fecha y resolver tus dudas</h2>
            <p className="text-stone-200">
              Agendá una entrevista presencial u online. Te mostramos las propuestas completas, vemos disponibilidad para
              tu fecha y te ayudamos a elegir la opción más conveniente para conservar el recuerdo de tu boda.
            </p>
            <p className="text-stone-400">La entrevista es sin costo y no te compromete a contratar.</p>
            <div className="flex flex-wrap gap-3">
              {entrevistaPresencial("secondary")}
              {entrevistaOnline}
              {whatsapp}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto w-full min-w-0 max-w-7xl px-4 py-10 text-sm text-stone-600 md:px-6">
          <p className="font-semibold text-stone-900">DNX Fotografía</p>
          <p className="mt-2">San José 1672 - Local 5 - Funes</p>
          <p>Funes, Rosario y alrededores</p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            <a href={DNX_WEB_URL} target="_blank" rel="noopener noreferrer" className="hover:text-stone-900">
              Web
            </a>
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="hover:text-stone-900">
              Instagram
            </a>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="hover:text-stone-900">
              WhatsApp
            </a>
            <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noopener noreferrer" className="hover:text-stone-900">
              Reseñas
            </a>
          </div>
        </div>
      </footer>

      <div className="fixed bottom-3 left-1/2 z-50 w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-2xl border border-stone-200 bg-white/95 p-2 shadow-lg backdrop-blur md:hidden">
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
