import Link from "next/link";
import { EDITORIAL_STOCK } from "@/lib/editorial-stock";

function stock(id: (typeof EDITORIAL_STOCK)[number]["id"]) {
  return EDITORIAL_STOCK.find((item) => item.id === id) ?? EDITORIAL_STOCK[0]!;
}

const pillars = [
  { title: "Publicación gratuita", detail: "Subí tu evento sin costo de entrada." },
  { title: "Mayor difusión", detail: "Llegá a quienes buscan qué hacer." },
  { title: "Noticias antes y después", detail: "Agenda previa y relato posterior." },
  { title: "Cobertura fotográfica", detail: "Convocá miradas profesionales." },
  { title: "Convocatoria de fotógrafos", detail: "Conectá con quien puede cubrirlo." },
  { title: "Inscripciones online", detail: "Próximamente, sin salir de Info Spot." },
  { title: "Acreditaciones", detail: "Próximamente, para prensa y equipos." },
] as const;

/**
 * Bloque protagonista — el organizador es el centro de la propuesta.
 * Solo experiencia visual (sin backend).
 */
export function HomeOrganizerPitch() {
  return (
    <section aria-labelledby="home-organizer-heading" className="relative">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-14 lg:items-end">
        <div className="lg:col-span-6">
          <p className="is-eyebrow">Para organizadores</p>
          <h2
            id="home-organizer-heading"
            className="is-h2 mt-4 max-w-xl text-3xl md:text-4xl lg:text-5xl"
          >
            ¿Organizás un evento?
          </h2>
          <p className="is-body mt-5 max-w-xl text-base md:text-lg">
            Info Spot es mucho más que un medio digital. Es la plataforma donde
            miles de personas pueden descubrir tus eventos — y donde la historia
            sigue después del cierre.
          </p>

          <Link
            href="/publicar-evento"
            className="is-btn is-btn-solid mt-8 h-12 px-7 text-sm"
          >
            Publicar mi evento
          </Link>
        </div>

        <div className="relative overflow-hidden lg:col-span-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={stock("festival").src}
            alt="Público en un evento"
            className="aspect-[4/5] w-full object-cover sm:aspect-[16/11] lg:aspect-[5/4] lg:min-h-[28rem]"
            loading="lazy"
            draggable={false}
          />
        </div>
      </div>

      <ul className="mt-14 grid gap-x-8 gap-y-8 border-t border-[var(--is-border)] pt-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {pillars.map((item) => (
          <li key={item.title} className="space-y-2">
            <p className="flex items-start gap-2 text-[0.9375rem] font-semibold tracking-[-0.01em] text-[var(--is-text)]">
              <span className="mt-0.5 text-[var(--is-accent)]" aria-hidden>
                ✓
              </span>
              {item.title}
            </p>
            <p className="pl-5 text-sm leading-relaxed text-[var(--is-text-secondary)]">
              {item.detail}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
