"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

/** Alto del encabezado: cuando el banner ya no lo cubre, el encabezado pasa a fondo blanco. */
const ALTO = 64;

/**
 * Marco del encabezado. En la portada flota transparente sobre el banner (texto blanco) y al
 * bajar pasa a papel con una línea fina. En el resto de las páginas es papel desde el principio.
 * Los hijos leen el estado con `group-data-[sobre-foto=true]:…`.
 */
export function BarraEncabezado({ children }: { children: ReactNode }) {
  const enPortada = usePathname() === "/";
  // Si el banner todavía queda debajo del encabezado. Sólo cuenta en la portada.
  const [bannerDebajo, setBannerDebajo] = useState(true);
  const sobreFoto = enPortada && bannerDebajo;

  useEffect(() => {
    if (!enPortada) return;
    let cuadro = 0;
    const medir = () => {
      cuadro = 0;
      const banner = document.getElementById("portada");
      setBannerDebajo(!!banner && banner.getBoundingClientRect().bottom > ALTO);
    };
    const alMover = () => { if (!cuadro) cuadro = requestAnimationFrame(medir); };
    cuadro = requestAnimationFrame(medir);
    window.addEventListener("scroll", alMover, { passive: true });
    window.addEventListener("resize", alMover);
    return () => {
      window.removeEventListener("scroll", alMover);
      window.removeEventListener("resize", alMover);
      cancelAnimationFrame(cuadro);
    };
  }, [enPortada]);

  return (
    <header
      data-sobre-foto={sobreFoto}
      className={`group z-40 transition-[background-color,border-color,color] duration-300 ${enPortada ? "fixed inset-x-0 top-0" : "sticky top-0"} ${
        sobreFoto ? "mf-sobre-foto mf-texto-sobre-foto border-b border-transparent text-white" : "border-b border-[var(--mf-line)] bg-[var(--mf-bg)] text-[var(--mf-ink)]"
      }`}
    >
      {children}
    </header>
  );
}
