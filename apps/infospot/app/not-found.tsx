import Link from "next/link";
import { EditorialContainer, Section } from "@/components/foundations";

export default function NotFound() {
  return (
    <Section spacing="lg">
      <EditorialContainer className="max-w-xl text-center">
        <p className="is-eyebrow">404</p>
        <h1 className="is-h1 mt-3 text-4xl">No encontramos esa página</h1>
        <p className="is-body mt-4">
          Puede que el enlace haya cambiado o que el contenido ya no esté publicado.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="is-btn is-btn-solid">
            Ir al inicio
          </Link>
          <Link href="/noticias" className="is-btn is-btn-secondary">
            Ver noticias
          </Link>
          <Link href="/eventos" className="is-btn is-btn-secondary">
            Ver eventos
          </Link>
        </div>
      </EditorialContainer>
    </Section>
  );
}
