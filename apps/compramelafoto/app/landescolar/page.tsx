import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

const WHATSAPP_ADVISORY_URL =
  "https://wa.me/5493413748324?text=Hola%20Dani%2C%20me%20interesa%20aplicar%20el%20sistema%20ComprameLaFoto%20para%20fotograf%C3%ADa%20escolar.%20%C2%BFPodr%C3%ADas%20asesorarme%20y%20ayudarnos%3F";

const REGISTER_ROUTE = "/registro";

const BEFORE_LIST = [
  "Cobros manuales",
  "Pedidos por WhatsApp",
  "Sobres escritos a mano",
  "Diseños editados uno por uno",
  "Familias preguntando todo el tiempo",
];

const AFTER_LIST = [
  "Preventa online",
  "Pedidos centralizados",
  "Etiquetas automáticas",
  "Diseños con datos variables",
  "Entrega ordenada y trazable",
];

const TARGET_AUDIENCE = [
  "Para fotógrafos independientes",
  "Para estudios fotográficos",
  "Para equipos que trabajan con varias instituciones",
  "Para quienes quieren ofrecer un sistema moderno a las escuelas",
];

const FEATURES = [
  {
    id: "A",
    title: "Preventa online de packs escolares",
    description:
      "Vendé antes de sacar las fotos. Las familias pueden comprar packs online y dejar cargados los datos del alumno, curso y división.",
  },
  {
    id: "B",
    title: "Gestión de alumnos, cursos y divisiones",
    description:
      "Organizá la información escolar para saber a qué alumno corresponde cada pedido y evitar errores en nombres, cursos o entregas.",
  },
  {
    id: "C",
    title: "Galería privada para familias",
    description:
      "Cada familia puede ingresar desde el celular, ver sus fotos, seleccionar las incluidas en el pack y comprar adicionales.",
  },
  {
    id: "D",
    title: "Venta de adicionales",
    description:
      "Además del pack inicial, podés vender fotos digitales, impresiones, ampliaciones, carpetas, dípticos y otros productos escolares.",
  },
  {
    id: "E",
    title: "Plantillas y diseños automáticos",
    description:
      "Creá plantillas para carpetas escolares, dípticos o productos personalizados. El sistema puede completar automáticamente nombre del alumno, curso, división, año, escuela y otros datos variables.",
  },
  {
    id: "F",
    title: "Pie de foto automático",
    description:
      "El pie de foto se genera con los datos del alumno sin tener que editar cada diseño manualmente. Menos tiempo de diseño y menos errores.",
  },
  {
    id: "G",
    title: "Etiquetas para sobres",
    description:
      "Imprimí etiquetas con nombre del alumno, número de pedido, curso, contenido, QR y datos de la escuela para preparar la entrega final de forma clara y profesional.",
  },
  {
    id: "H",
    title: "Control de producción y entrega",
    description:
      "Sabé qué pedido está pago, qué falta producir y qué está listo para entregar.",
  },
];

const OBJECTIONS = [
  {
    question: "¿Tengo que saber programar?",
    answer:
      "No. La plataforma está pensada para que el fotógrafo pueda configurar su flujo sin depender de un programador.",
  },
  {
    question: "¿Sirve si recién empiezo en fotografía escolar?",
    answer:
      "Sí. Justamente te ayuda a presentarte ante una escuela con una propuesta más profesional y ordenada.",
  },
  {
    question: "¿La escuela tiene que manejar plata?",
    answer:
      "No necesariamente. Las familias compran online y el fotógrafo administra los pedidos desde la plataforma.",
  },
  {
    question: "¿Me ayuda a vender más?",
    answer:
      "Sí, porque no te limita a un solo pack. Las familias pueden comprar adicionales después de ver sus fotos.",
  },
  {
    question: "¿Me ahorra tiempo?",
    answer:
      "Sí. Reduce tareas manuales como registrar pagos, ordenar pedidos, diseñar productos uno por uno y escribir sobres a mano.",
  },
];

const FLOW_STEPS = [
  "Creás el álbum escolar",
  "Cargás alumnos, cursos o divisiones",
  "Compartís el link de preventa",
  "Las familias compran su pack",
  "Realizás la sesión de fotos",
  "Subís las fotos",
  "Cada familia elige",
  "El sistema organiza pedidos",
  "Diseñás productos con plantillas automáticas",
  "Imprimís etiquetas y entregás",
];

const BENEFITS_PHOTOGRAPHERS = [
  "Cobrás antes de trabajar",
  "Reducís errores administrativos",
  "Vendés adicionales sin perseguir clientes",
  "Automatizás diseños escolares",
  "Preparás entregas más rápido",
  "Podés trabajar con más escuelas sin aumentar el caos",
];

const BENEFITS_FAMILIES = [
  "Compran desde el celular",
  "Pagan online",
  "Eligen sus fotos",
  "Pueden sumar fotos o productos extra",
  "Tienen una experiencia simple y clara",
];

const BENEFITS_SCHOOLS = [
  "Evitan manejar dinero",
  "Reducen reclamos",
  "Mejoran la comunicación con las familias",
  "Ofrecen un proceso moderno",
  "Ordenan la entrega final",
];

const FAQS = [
  {
    question: "¿ComprameLaFoto sirve para fotografía escolar?",
    answer:
      "Sí. Está pensado para organizar trabajos con jardines, primarias, secundarias, cursos, divisiones y pedidos por alumno.",
  },
  {
    question: "¿Puedo vender packs antes de sacar las fotos?",
    answer:
      "Sí. Podés hacer preventa online para cobrar antes y llegar al día de fotos con pedidos más ordenados.",
  },
  {
    question: "¿Las familias pueden elegir las fotos?",
    answer:
      "Sí. Cada familia accede a una galería privada para elegir las fotos incluidas en su pack y comprar adicionales.",
  },
  {
    question: "¿Puedo vender fotos adicionales?",
    answer:
      "Sí. Podés ofrecer fotos digitales, impresiones y productos escolares extra.",
  },
  {
    question: "¿El sistema ayuda a diseñar carpetas escolares?",
    answer:
      "Sí. Podés crear plantillas y usar datos variables para completar automáticamente nombre, curso, división, año y escuela.",
  },
  {
    question: "¿Puedo imprimir etiquetas para sobres?",
    answer:
      "Sí. El sistema permite generar etiquetas con datos del pedido, alumno, curso, QR y contenido para ordenar la entrega.",
  },
  {
    question: "¿La escuela tiene que manejar dinero?",
    answer:
      "No necesariamente. El sistema permite que las familias paguen online y que el fotógrafo administre los pedidos.",
  },
  {
    question: "¿Puedo usarlo desde el celular?",
    answer:
      "Sí. Las familias pueden comprar y elegir desde el celular. El fotógrafo puede gestionar gran parte del proceso desde dispositivos móviles.",
  },
];

export const metadata: Metadata = {
  title: "Sistema para fotografía escolar online | ComprameLaFoto",
  description:
    "ComprameLaFoto es una plataforma para fotógrafos escolares: preventa online, gestión de alumnos, venta de adicionales, diseño automático de carpetas escolares, etiquetas para sobres y entrega ordenada.",
  keywords: [
    "fotografía escolar",
    "sistema para fotografía escolar",
    "software para fotógrafos escolares",
    "venta de fotos escolares online",
    "preventa fotografía escolar",
    "plataforma para fotos escolares",
    "carpetas escolares automáticas",
    "etiquetas para sobres escolares",
    "ComprameLaFoto",
  ],
  openGraph: {
    title: "Sistema para fotografía escolar online | ComprameLaFoto",
    description:
      "Preventa online, gestión escolar, adicionales, diseño automático y entrega ordenada para fotógrafos escolares.",
    type: "website",
    locale: "es_AR",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sistema para fotografía escolar online | ComprameLaFoto",
    description:
      "Vendé fotos escolares online, organizá pedidos y entregá sin errores.",
  },
};

function PrimaryCta({ className = "" }: { className?: string }) {
  return (
    <Link
      href={REGISTER_ROUTE}
      className={`clf-btn clf-btn--primary ${className}`}
    >
      Crear mi usuario gratis
    </Link>
  );
}

function SecondaryCta({
  className = "",
  label = "Solicitar asesoramiento por WhatsApp",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <a
      href={WHATSAPP_ADVISORY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`clf-btn clf-btn--whatsapp ${className}`}
    >
      {label}
    </a>
  );
}

export default function LandEscolarPage() {
  return (
    <main className="landescolar-page clf-landing bg-white text-[#111827]">
      <section className="relative overflow-hidden bg-[#f7f5f2]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(194,123,61,0.14),transparent_55%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-8 sm:py-20 lg:px-16 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="inline-flex rounded-full border border-[#c27b3d]/30 bg-[#c27b3d]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#9a5c2a]">
                Módulo Fotografía Escolar
              </p>
              <h1 className="clf-hero-title mt-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                El sistema para fotógrafos escolares que quieren vender más,
                ordenar pedidos y entregar sin errores
              </h1>
              <p className="clf-hero-text mt-6 text-base text-[#4b5563] sm:text-lg">
                ComprameLaFoto te permite cobrar packs por anticipado, organizar
                alumnos y cursos, vender adicionales, automatizar diseños
                escolares e imprimir etiquetas para entregar todo de forma rápida
                y profesional.
              </p>
              <p className="clf-text-tight mt-4 text-sm font-medium text-[#374151] sm:text-base">
                Ideal para jardines, primarias, secundarias, actos escolares,
                colaciones y campañas institucionales.
              </p>
              <div className="clf-btn-stack mt-8 sm:flex-row">
                <PrimaryCta />
                <SecondaryCta label="Solicitar asesoramiento" />
              </div>
            </div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_20px_50px_-20px_rgba(17,24,39,0.35)]">
              <Image
                src="/images/landescolar/fotografo-curso-bandera-argentina.jpg"
                alt="Fotógrafo sacando una foto de curso con bandera argentina de fondo"
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-8 sm:py-16 lg:px-16">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold leading-tight sm:text-3xl">
              De planillas, sobres y WhatsApp... a un sistema online ordenado
            </h2>
            <p className="mt-4 max-w-2xl text-[#4b5563]">
              El problema de la fotografía escolar no suele ser la toma de
              fotos. El verdadero problema aparece después: cobrar, registrar
              pedidos, responder consultas, diseñar productos, armar sobres y
              entregar sin equivocarse.
            </p>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <article className="rounded-xl border border-black/10 bg-[#fff5f5] p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-[#7f1d1d]">
                  Antes
                </h3>
                <ul className="mt-3 space-y-1.5 text-sm text-[#374151]">
                  {BEFORE_LIST.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
              <article className="rounded-xl border border-black/10 bg-[#f0fdf4] p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-[#166534]">
                  Después
                </h3>
                <ul className="mt-3 space-y-1.5 text-sm text-[#374151]">
                  {AFTER_LIST.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-black/10 bg-[#f3f4f6] shadow-sm">
            <Image
              src="/images/landescolar/escritorio-desordenado-fotos-escolares.jpg"
              alt="Escritorio desordenado con sobres y fotos escolares impresas"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        </div>
      </section>

      <section className="bg-[#f7f5f2] py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-8 lg:px-16">
          <h2 className="text-center text-2xl font-semibold sm:text-3xl">
            Pensado principalmente para fotógrafos escolares
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-center text-[#4b5563]">
            Si ya trabajás con escuelas o querés empezar a ofrecer fotografía
            escolar de forma profesional, ComprameLaFoto te ayuda a transformar
            un trabajo difícil de administrar en un proceso claro, rentable y
            repetible.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {TARGET_AUDIENCE.map((item) => (
              <div
                key={item}
                className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-medium text-[#1f2937]"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-8 sm:py-16 lg:px-16">
        <h2 className="text-center text-2xl font-semibold sm:text-3xl">
          Todo lo que necesitás para gestionar fotografía escolar de punta a
          punta
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#c27b3d]/15 text-sm font-bold text-[#9a5c2a]">
                  {feature.id}
                </span>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[#4b5563]">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[#f7f5f2] py-14 sm:py-16">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-8 lg:grid-cols-2 lg:px-16">
          <div>
            <h2 className="text-2xl font-semibold sm:text-3xl">
              De la venta online al sobre listo para entregar
            </h2>
            <p className="mt-4 max-w-2xl text-[#4b5563]">
              El sistema no termina cuando la familia compra. También te ayuda a
              ordenar la producción y la entrega final con etiquetas claras, QR,
              número de pedido y resumen del contenido.
            </p>
            <div className="clf-btn-stack mt-6 sm:flex-row">
              <PrimaryCta />
              <SecondaryCta />
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
            <Image
              src="/images/landescolar/sobres-etiquetados-compramelafoto.jpg"
              alt="Sobres ordenados y etiquetados con datos de alumnos y pedidos"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-8 sm:py-16 lg:px-16">
        <h2 className="text-center text-2xl font-semibold sm:text-3xl">
          Una solución que beneficia a todos
        </h2>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          <article className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Para fotógrafos</h3>
            <ul className="mt-4 space-y-2 text-sm text-[#4b5563]">
              {BENEFITS_PHOTOGRAPHERS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Para familias</h3>
            <ul className="mt-4 space-y-2 text-sm text-[#4b5563]">
              {BENEFITS_FAMILIES.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Para escuelas</h3>
            <ul className="mt-4 space-y-2 text-sm text-[#4b5563]">
              {BENEFITS_SCHOOLS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="bg-[#111827] py-14 text-white sm:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-8">
          <h2 className="text-center text-2xl font-semibold sm:text-3xl">
            Un ejemplo simple del flujo
          </h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {FLOW_STEPS.map((step, index) => (
              <div
                key={step}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm"
              >
                <span className="mr-2 font-semibold text-[#f8d8bb]">
                  {index + 1}.
                </span>
                {step}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14 text-center sm:px-8 sm:py-16">
        <h2 className="text-2xl font-semibold sm:text-3xl">
          Probá ComprameLaFoto en tu próximo trabajo escolar
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-[#4b5563]">
          No esperes a tener una escuela enorme para ordenar tu proceso. Empezá
          con tu próximo trabajo escolar y usá la plataforma para vender,
          organizar y entregar mejor.
        </p>
        <div className="clf-btn-stack mt-8 items-center sm:flex-row">
          <PrimaryCta />
          <SecondaryCta label="Quiero asesoramiento" />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-14 sm:px-8 sm:pb-16">
        <div className="rounded-2xl border border-[#c27b3d]/25 bg-[#fffaf5] p-6 sm:p-8">
          <h2 className="text-xl font-semibold sm:text-2xl">
            Plataforma para vender fotos escolares online con control total
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-[#4b5563] sm:text-base">
            Si sos fotógrafo escolar y buscás una plataforma para vender fotos
            escolares online, organizar pedidos, cobrar packs por anticipado y
            entregar trabajos sin errores, ComprameLaFoto te permite
            profesionalizar todo el flujo de trabajo. Podés centralizar la
            preventa, administrar datos por alumno y curso, habilitar la
            selección de fotos por familia, vender adicionales y preparar la
            entrega con etiquetas automáticas.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-8 sm:pb-16 lg:px-16">
        <h2 className="text-center text-2xl font-semibold sm:text-3xl">
          Preguntas que seguramente te estás haciendo
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {OBJECTIONS.map((item) => (
            <article
              key={item.question}
              className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm"
            >
              <h3 className="text-base font-semibold">{item.question}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#4b5563]">
                {item.answer}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-14 sm:px-8 sm:pb-16">
        <h2 className="text-center text-2xl font-semibold sm:text-3xl">
          Preguntas frecuentes
        </h2>
        <div className="mt-8 space-y-3">
          {FAQS.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-xl border border-black/10 bg-white px-5 py-4 open:border-[#c27b3d]/40"
            >
              <summary className="cursor-pointer list-none text-left font-semibold">
                {faq.question}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-[#4b5563]">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </section>

      <section className="bg-[#111827] py-14 text-white sm:py-16">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-8">
          <h2 className="text-2xl font-semibold sm:text-3xl">
            Convertí la fotografía escolar en un sistema ordenado, rentable y
            profesional
          </h2>
          <div className="clf-btn-stack mt-8 items-center sm:flex-row">
            <PrimaryCta className="clf-btn--block sm:w-auto" />
            <SecondaryCta
              className="clf-btn--block sm:w-auto"
              label="Solicitar asesoramiento por WhatsApp"
            />
          </div>
        </div>
      </section>
    </main>
  );
}
