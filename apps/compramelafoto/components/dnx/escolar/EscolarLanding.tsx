import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  BarChart3,
  CreditCard,
  EyeOff,
  Fingerprint,
  Lock,
  ShieldCheck,
  TimerReset,
  Camera,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  HandCoins,
  Headset,
  Images,
  Landmark,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Percent,
  QrCode,
  ShoppingBag,
  Store,
  Users,
} from "lucide-react";

import EscolarLeadForm from "@/components/dnx/escolar/EscolarLeadForm";
import { AAIP_RNBD_URL } from "@/components/legal/AaipBadge";
import type { EscolarBrand } from "@/lib/dnx-escolar/landing-brand";
import {
  CUIDADO_SECTION_ID,
  FORM_SECTION_ID,
  PRIVACIDAD_ESCUELAS_URL,
  buildEscolarContent,
} from "@/lib/dnx-escolar/landing-content";

const ICONOS_BENEFICIOS: LucideIcon[] = [ClipboardCheck, Banknote, FileSpreadsheet, ShoppingBag, Percent, Headset, Camera, Store];
const ICONOS_CUIDADO: LucideIcon[] = [Fingerprint, Lock, EyeOff, ShieldCheck, Download, TimerReset, CreditCard];

const BTN = "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition";
/** El color sale de --escolar-accent (negro en DNX, el color del fotógrafo si se lee bien). */
const BTN_PRIMARY = `${BTN} bg-[var(--escolar-accent)] text-white hover:opacity-85`;
const ACCENT_BG = "bg-[var(--escolar-accent)] text-white";
const BTN_SECONDARY = `${BTN} border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50`;

function Encabezado({ eyebrow, titulo, children }: { eyebrow?: string; titulo: string; children?: ReactNode }) {
  return (
    <div className="max-w-3xl">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">{eyebrow}</p>
      ) : null}
      <h2 className="mt-2 text-2xl font-semibold leading-tight tracking-[-0.02em] text-balance md:text-4xl">{titulo}</h2>
      {children ? <div className="mt-3 text-base leading-relaxed text-zinc-700">{children}</div> : null}
    </div>
  );
}

/** Ilustración abstracta del recorrido de una familia (sin fotos de menores). */
function RecorridoFamilia() {
  const filas: Array<{ icon: LucideIcon; titulo: string; texto: string }> = [
    { icon: QrCode, titulo: "Reserva en preventa", texto: "Con el enlace o QR del colegio, antes de la jornada" },
    { icon: HandCoins, titulo: "Paga online", texto: "Mercado Pago, sin efectivo ni sobres" },
    { icon: Images, titulo: "Elige sus fotos", texto: "Con su enlace personal, cuando están listas" },
    { icon: Download, titulo: "Recibe sus imágenes", texto: "Descarga digital e impresos en el colegio" },
  ];
  return (
    <div aria-hidden className="relative rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm md:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">Lo que hace cada familia · preventa</p>
      <ol className="mt-4 space-y-3">
        {filas.map(({ icon: Icon, titulo, texto }, i) => (
          <li key={titulo} className="flex items-center gap-4 rounded-2xl bg-[#f4f2ee] p-3.5">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${ACCENT_BG}`}>
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-zinc-900">
                {i + 1}. {titulo}
              </span>
              <span className="block text-sm text-zinc-600">{texto}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-dashed border-zinc-300 p-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-zinc-900 ring-1 ring-zinc-200">
          <BarChart3 className="h-5 w-5" />
        </span>
        <span className="text-sm text-zinc-700">
          <span className="font-semibold text-zinc-900">El colegio</span> ve las ventas y su beneficio en su panel.
        </span>
      </div>
    </div>
  );
}

function Logo({ brand }: { brand: EscolarBrand }) {
  const alt = `Logo ${brand.nombre}`;
  if (!brand.logoUrl) {
    const inicial = brand.nombre.trim().charAt(0).toUpperCase() || "F";
    return (
      <span aria-hidden className={`flex h-10 w-10 items-center justify-center rounded-full text-base font-semibold ${ACCENT_BG}`}>
        {inicial}
      </span>
    );
  }
  if (brand.logoUrl.startsWith("/")) {
    return <Image src={brand.logoUrl} alt={alt} width={44} height={44} className="h-10 w-10 rounded-full object-cover" priority />;
  }
  // Logos de fotógrafos: vienen del bucket público (R2); <img> evita depender de remotePatterns.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={brand.logoUrl} alt={alt} width={44} height={44} className="h-10 w-10 rounded-full bg-white object-contain" />;
}

export default function EscolarLanding({ brand }: { brand: EscolarBrand }) {
  const { pasos, razonesPreventa, ventaPosterior, beneficios, cuidado, faqs } = buildEscolarContent(brand);
  const style = { "--escolar-accent": brand.accent } as CSSProperties;
  const tieneContacto = Boolean(brand.direccion || brand.localidad || brand.whatsappUrl || brand.telefonoVisible || brand.mailtoUrl);

  return (
    <main style={style} className={`overflow-x-hidden bg-[#f4f2ee] text-zinc-900 md:pb-0 ${brand.whatsappUrl ? "pb-28" : "pb-24"}`}>
      {/* Barra superior */}
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Logo brand={brand} />
          <span className="min-w-0 text-sm font-semibold leading-tight">
            <span className="block truncate">{brand.nombre}</span>
            <span className="block text-xs font-normal text-zinc-500">Fotografía escolar</span>
          </span>
        </div>
        <a href={`#${FORM_SECTION_ID}`} className="hidden text-sm font-semibold text-zinc-700 underline underline-offset-4 hover:text-zinc-900 sm:inline">
          Pedir propuesta
        </a>
      </header>

      {/* 1. Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-14 pt-6 md:px-6 md:pb-20 md:pt-10">
        <div className="grid gap-10 md:grid-cols-[1.15fr_1fr] md:items-center">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
              {brand.zona}
            </p>
            <h1 className="text-[2rem] font-semibold leading-[1.08] tracking-[-0.03em] text-balance md:text-5xl">
              Fotografía escolar sin gestionar cobros ni pedidos
            </h1>
            <p className="text-base leading-relaxed text-zinc-700 md:text-lg">
              {brand.nombre} realiza las fotos. Las familias eligen, pagan online y reciben sus imágenes mediante el
              sistema. El colegio puede obtener un beneficio sobre las ventas con rendición transparente.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a href={`#${FORM_SECTION_ID}`} className={BTN_PRIMARY}>
                Quiero una propuesta para mi colegio
              </a>
              {brand.whatsappUrl ? (
                <a href={brand.whatsappUrl} target="_blank" rel="noopener noreferrer" className={BTN_SECONDARY}>
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  WhatsApp
                </a>
              ) : null}
              {brand.mailtoUrl ? (
                <a href={brand.mailtoUrl} className={BTN_SECONDARY}>
                  <Mail className="h-4 w-4" aria-hidden />
                  Email
                </a>
              ) : null}
            </div>
            {brand.firma ? <p className="text-sm text-zinc-500">{brand.firma}</p> : null}
          </div>
          <RecorridoFamilia />
        </div>
      </section>

      {/* 2. Cómo funciona: preventa recomendada */}
      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-20">
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${ACCENT_BG}`}>Recomendado</span>
          <div className="mt-3">
            <Encabezado eyebrow="Cómo funciona" titulo="Preventa: las familias reservan y pagan antes de la jornada">
              <p>
                Es la forma que recomendamos. Cada familia compra su pack con anticipación, {brand.nombre} hace las fotos sabiendo qué
                pidió cada una, y después la familia elige sus fotos con el enlace que recibió por email.
              </p>
            </Encabezado>
          </div>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pasos.map((paso, i) => (
              <li key={paso.titulo} className="rounded-2xl border border-zinc-200 bg-[#faf9f7] p-5">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${ACCENT_BG}`}>
                  {i + 1}
                </span>
                <h3 className="mt-4 text-base font-semibold">{paso.titulo}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-700">{paso.texto}</p>
              </li>
            ))}
          </ol>

          <h3 className="mt-12 text-lg font-semibold">Por qué conviene la preventa</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {razonesPreventa.map((r) => (
              <article key={r.titulo} className="rounded-2xl border border-zinc-900/10 bg-[#f4f2ee] p-5">
                <h4 className="text-sm font-semibold">{r.titulo}</h4>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-700">{r.texto}</p>
              </article>
            ))}
          </div>

          <div className="mt-6 flex items-start gap-4 rounded-2xl border border-dashed border-zinc-300 p-5">
            <Images className="mt-0.5 h-6 w-6 shrink-0" aria-hidden />
            <div>
              <h3 className="text-base font-semibold">{ventaPosterior.titulo}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-700">{ventaPosterior.texto}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Qué cambia para el colegio */}
      <section className="mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-20">
        <Encabezado eyebrow="Para la administración" titulo="Qué cambia para el colegio">
          <p>
            El colegio conserva lo institucional: fechas, espacios, cursos y autorizaciones. Lo que se va de la
            secretaría es el cobro, el armado de pedidos y la atención de cada familia.
          </p>
        </Encabezado>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {beneficios.map((b, i) => {
            const Icon = ICONOS_BENEFICIOS[i] ?? ClipboardCheck;
            return (
              <article key={b.titulo} className="rounded-2xl border border-zinc-200 bg-white p-5">
                <Icon className="h-6 w-6 text-zinc-900" aria-hidden />
                <h3 className="mt-3 text-base font-semibold">{b.titulo}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-700">{b.texto}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* 4. Servicios y productos */}
      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-20">
          <Encabezado eyebrow="Servicios" titulo="Qué fotografiamos y qué reciben las familias" />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <article className="rounded-2xl border border-zinc-200 bg-[#faf9f7] p-6">
              <Users className="h-6 w-6" aria-hidden />
              <h3 className="mt-3 text-lg font-semibold">Fotografía anual</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-700">
                Retratos individuales y fotos grupales por curso, organizadas en la jornada que acordemos.
              </p>
            </article>
            <article className="rounded-2xl border border-zinc-200 bg-[#faf9f7] p-6">
              <Landmark className="h-6 w-6" aria-hidden />
              <h3 className="mt-3 text-lg font-semibold">Actos, jornadas y egresos</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-700">
                Coberturas de actos escolares, jornadas especiales y ceremonias de egreso.
              </p>
            </article>
            <article className="rounded-2xl border border-zinc-200 bg-[#faf9f7] p-6">
              <Package className="h-6 w-6" aria-hidden />
              <h3 className="mt-3 text-lg font-semibold">Digitales e impresos</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-700">
                En preventa, la familia elige sus fotos y las digitales quedan para descargar; los impresos se entregan
                en el colegio, identificados por alumno. En la galería posterior, la descarga se habilita al confirmarse
                el pago.
              </p>
            </article>
          </div>
          <p className="mt-6 text-sm text-zinc-600">
            Los productos, precios y plazos de entrega se acuerdan con cada colegio antes de empezar.
          </p>
        </div>
      </section>

      {/* 5. Beneficio y costos, sin cifras */}
      <section className="mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-20">
        <Encabezado eyebrow="Rendición transparente" titulo="Quién se queda con qué">
          <p>En cada venta intervienen tres conceptos distintos, y conviene tenerlos claros desde el principio.</p>
        </Encabezado>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border-2 border-zinc-900 bg-white p-6">
            <h3 className="text-base font-semibold">Beneficio del colegio</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-700">
              Un porcentaje acordado previamente con {brand.nombre}, sobre las ventas pagadas. El colegio lo ve en su panel
              y {brand.nombre} lo liquida según el acuerdo.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-700">
              Si el colegio tiene cuenta de Mercado Pago, recibe su parte directamente en esa cuenta, a medida que las
              familias pagan. {brand.nombre} cobra solo lo suyo, no la totalidad: las cuentas quedan más ordenadas para
              los dos, también en lo fiscal.
            </p>
          </article>
          <article className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h3 className="text-base font-semibold">Procesador de pago</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-700">
              Mercado Pago cobra su propio costo por procesar cada pago online.
            </p>
          </article>
          <article className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h3 className="text-base font-semibold">Plataforma</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-700">
              ComprameLaFoto, el sistema que gestiona galerías, pagos y pedidos, tiene su propia comisión.
            </p>
          </article>
        </div>
      </section>

      {/* 6. Cómo cuidamos los datos y las fotos */}
      <section id={CUIDADO_SECTION_ID} className="border-t border-zinc-200 bg-[#ecebe6]">
        <div className="mx-auto max-w-6xl px-4 py-14 md:px-6 md:py-20">
          <Encabezado eyebrow="Privacidad" titulo="Cómo cuidamos los datos y las fotos">
            <p>
              Son fotos de chicos y chicas, y los datos de sus familias. Esto es lo que hace el sistema para protegerlos,
              tal como funciona hoy.
            </p>
          </Encabezado>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cuidado.map((item, i) => {
              const Icon = ICONOS_CUIDADO[i] ?? ShieldCheck;
              return (
                <article
                  key={item.titulo}
                  className={`rounded-2xl border border-zinc-200 bg-white p-5 ${
                    // Con 7 tarjetas, la última ocupa la fila entera en vez de quedar sola a la izquierda.
                    i === cuidado.length - 1 && cuidado.length % 2 === 1 ? "sm:col-span-2 lg:col-span-3" : ""
                  }`}
                >
                  <Icon className="h-6 w-6 text-zinc-900" aria-hidden />
                  <h3 className="mt-3 text-base font-semibold">{item.titulo}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-700">{item.texto}</p>
                </article>
              );
            })}
          </div>
          <div className="mt-6 flex flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-6 sm:flex-row sm:items-center">
            <a
              href={AAIP_RNBD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 self-center rounded-lg transition-transform hover:scale-[1.03]"
            >
              <Image
                src="/aaip-rnbd.png"
                alt="AAIP — Registro Nacional de Bases de Datos Personales: ver la inscripción de ComprameLaFoto"
                width={892}
                height={669}
                sizes="144px"
                className="h-auto w-36 rounded-lg shadow-sm ring-1 ring-black/5"
              />
            </a>
            <div>
              <h3 className="text-base font-semibold">Protección de datos personales · Ley 25.326</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-700">
                Los datos de alumnos y familias se guardan en una base inscripta por ComprameLaFoto en el Registro Nacional
                de Bases de Datos Personales de la Agencia de Acceso a la Información Pública (AAIP), y se usan solo para
                gestionar la preventa, la búsqueda y la entrega de las fotos. La selfie es un dato biométrico: se procesa
                únicamente con el consentimiento expreso de la familia. Cada familia puede pedir en cualquier momento el
                acceso, la rectificación o la supresión de sus datos.
              </p>
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
                <a href={AAIP_RNBD_URL} target="_blank" rel="noopener noreferrer" className="text-zinc-900 underline underline-offset-4">
                  Ver la inscripción en argentina.gob.ar
                </a>
                <a href="/consentimiento-biometrico" className="text-zinc-900 underline underline-offset-4">
                  Consentimiento biométrico
                </a>
                <a href="/privacidad/solicitud" className="text-zinc-900 underline underline-offset-4">
                  Ejercer mis derechos
                </a>
              </p>
            </div>
          </div>
          <p className="mt-6 text-sm text-zinc-600">
            El detalle completo está en la{" "}
            <a href={PRIVACIDAD_ESCUELAS_URL} className="font-semibold text-zinc-900 underline underline-offset-4">
              política de privacidad para escuelas
            </a>
            .
          </p>
        </div>
      </section>

      {/* 7. Preguntas frecuentes */}
      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-14 md:px-6 md:py-20">
          <Encabezado eyebrow="Preguntas frecuentes" titulo="Lo que suelen preguntar las administraciones" />
          <div className="mt-8 divide-y divide-zinc-200 border-y border-zinc-200">
            {faqs.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span aria-hidden className="text-xl leading-none text-zinc-400 transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-zinc-700">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Formulario + datos del estudio */}
      <section id={FORM_SECTION_ID} className="mx-auto max-w-6xl scroll-mt-6 px-4 py-14 md:px-6 md:py-20">
        <div className="grid gap-10 md:grid-cols-[1fr_1.4fr]">
          <div>
            <Encabezado eyebrow="Propuesta" titulo="Contanos sobre tu colegio">
              <p>Con estos datos armamos una propuesta a medida. Te respondemos por email o teléfono.</p>
            </Encabezado>
            {tieneContacto ? (
              <div className="mt-8 space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 text-sm">
                <p className="font-semibold text-zinc-900">
                  {brand.nombre}
                  {brand.firma ? <span className="block font-normal text-zinc-600">{brand.firma}</span> : null}
                </p>
                {brand.direccion || brand.localidad ? (
                  <p className="flex items-start gap-2.5 text-zinc-700">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>
                      {brand.direccion}
                      {brand.direccion && brand.localidad ? <br /> : null}
                      {brand.localidad}
                    </span>
                  </p>
                ) : null}
                {brand.whatsappUrl ? (
                  <a href={brand.whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-zinc-700 hover:text-zinc-900">
                    <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
                    WhatsApp {brand.telefonoVisible}
                  </a>
                ) : null}
                {brand.mailtoUrl && brand.email ? (
                  <a href={brand.mailtoUrl} className="flex items-center gap-2.5 break-all text-zinc-700 hover:text-zinc-900">
                    <Mail className="h-4 w-4 shrink-0" aria-hidden />
                    {brand.email}
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
          <EscolarLeadForm
            source={brand.source}
            photographerHandler={brand.photographerHandler}
            cityPlaceholder={brand.photographerHandler ? (brand.localidad ? `Ej.: ${brand.localidad}` : "") : "Rosario, Funes, Roldán…"}
          />
        </div>
      </section>

      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 text-xs text-zinc-500 md:px-6">
          {brand.nombre}
          {[brand.direccion, brand.localidad].filter(Boolean).length > 0
            ? ` · ${[brand.direccion, brand.localidad].filter(Boolean).join(", ")}`
            : ""}
          . Las ventas se gestionan con ComprameLaFoto.
        </div>
      </footer>

      {/* Barra fija en celulares */}
      <div className="fixed bottom-3 left-1/2 z-50 w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-2xl border border-zinc-200 bg-white/95 p-2 shadow-lg backdrop-blur md:hidden">
        <div className={brand.whatsappUrl ? "grid grid-cols-[1.6fr_1fr] gap-2" : "grid grid-cols-1"}>
          <a href={`#${FORM_SECTION_ID}`} className={`${BTN_PRIMARY} w-full !px-3`}>
            Pedir propuesta
          </a>
          {brand.whatsappUrl ? (
            <a href={brand.whatsappUrl} target="_blank" rel="noopener noreferrer" className={`${BTN_SECONDARY} w-full !px-3`}>
              WhatsApp
            </a>
          ) : null}
        </div>
      </div>
    </main>
  );
}
