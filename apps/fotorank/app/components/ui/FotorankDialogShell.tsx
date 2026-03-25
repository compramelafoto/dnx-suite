import Link from "next/link";
import Image from "next/image";

type FotorankDialogShellProps = {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  /** Enlaces bajo la tarjeta (p. ej. volver al inicio). */
  footerLinks?: React.ReactNode;
  /** Ancho máximo de la tarjeta. */
  maxWidthClassName?: string;
};

/**
 * Ventanas de acceso (organizador / jurado): tarjeta centrada en viewport, logo wordmark grande y centrado,
 * tipografía y bloques de contenido centrados, ritmo vertical amplio.
 */
export function FotorankDialogShell({
  title,
  subtitle,
  children,
  footerLinks,
  maxWidthClassName = "max-w-md",
}: FotorankDialogShellProps) {
  return (
    <div className="relative min-h-[100dvh] bg-fr-bg font-sans">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_-15%,rgba(212,175,55,0.14),transparent_58%)]"
        aria-hidden
      />
      <div className="relative flex min-h-[100dvh] flex-col items-center justify-center px-4 py-14 sm:px-6 sm:py-16 md:py-20">
        <div
          className={`relative mx-auto w-full ${maxWidthClassName} rounded-2xl border border-[#3a3327] bg-[#0b0d12] shadow-[0_0_0_1px_rgba(212,175,55,0.08),0_22px_80px_rgba(0,0,0,0.72),0_0_60px_rgba(212,175,55,0.12)]`}
        >
          <div className="fr-modal-content border-0 !pt-10 !pb-10 md:!pt-12 md:!pb-12">
            <div className="mb-10 flex justify-center md:mb-12 lg:mb-14">
              <Link
                href="/"
                className="inline-flex shrink-0 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d12]"
                aria-label="FotoRank — inicio"
              >
                <Image
                  src="/fotorank-logo.png"
                  alt="FotoRank"
                  width={360}
                  height={120}
                  priority
                  className="h-[5.5rem] w-auto sm:h-24 md:h-[6.75rem] lg:h-28"
                />
              </Link>
            </div>

            <h1 className="text-balance text-center font-sans text-3xl font-semibold tracking-tight text-fr-primary md:text-4xl">
              {title}
            </h1>

            {subtitle ? (
              <div className="mx-auto mt-7 max-w-md text-balance text-center font-sans text-lg font-medium leading-relaxed text-fr-muted md:mt-9 md:text-xl md:leading-relaxed">
                {subtitle}
              </div>
            ) : null}

            <div
              className={`flex w-full flex-col items-stretch gap-10 md:gap-12 ${subtitle ? "mt-12 md:mt-14 lg:mt-16" : "mt-12 md:mt-14"}`}
            >
              {children}
            </div>
          </div>
        </div>

        {footerLinks ? (
          <div className="mt-12 flex max-w-md flex-wrap items-center justify-center gap-x-6 gap-y-3 text-center text-sm text-fr-muted md:mt-14">
            {footerLinks}
          </div>
        ) : null}
      </div>
    </div>
  );
}
