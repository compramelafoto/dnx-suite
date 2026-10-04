/**
 * Invitación a regalar la inscripción, justo debajo de los precios.
 *
 * Va en violeta de marca (`--ck-brand-violet`) y no en amarillo a propósito:
 * el amarillo es el camino principal —inscribirse— y dos botones del mismo
 * color compiten. El violeta se lee como "otra cosa", que es lo que es.
 */
export function RegistrationGiftCta({ editionSlug }: { editionSlug: string }) {
  return (
    <section
      aria-labelledby="regalo-cta-titulo"
      className="rounded-[var(--ck-radius-card)] border-2 border-ck-violet bg-ck-accent-soft p-6 text-center md:p-8"
    >
      <p className="ck-label text-ck-violet">🎁 Para regalar</p>
      <h2
        id="regalo-cta-titulo"
        className="mt-3 text-xl font-semibold tracking-tight text-ck-text md:text-2xl"
      >
        ¿Se lo querés regalar a alguien?
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-ck-text-secondary md:text-base">
        Pagás vos y tu amigo recibe un código para activar su lugar. Elige su
        sede y su talle él mismo, así que no tenés que adivinar nada.
      </p>
      <a
        href={`/maratones/${editionSlug}/regalar`}
        className="mt-6 inline-flex min-h-14 items-center justify-center gap-2 rounded-[var(--ck-radius-control)] border-2 border-ck-violet bg-ck-violet px-8 text-base font-bold text-white transition-transform hover:-translate-y-0.5 active:translate-y-px md:text-lg"
      >
        Comprale el lugar a un amigo
      </a>
    </section>
  );
}
