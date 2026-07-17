import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <a
        href="#contenido-principal"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:border-2 focus:border-ck-border-strong focus:bg-ck-yellow focus:px-4 focus:py-2 focus:font-semibold focus:text-ck-black"
      >
        Saltar al contenido
      </a>
      <SiteHeader />
      <main id="contenido-principal">{children}</main>
      <SiteFooter />
    </>
  );
}
