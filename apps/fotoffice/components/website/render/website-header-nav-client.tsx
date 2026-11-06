"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { isPathCurrent, type SiteNavItem } from "@/lib/website/site-nav";
import { levelStyle } from "@/lib/website/typography";

/**
 * Sólo los enlaces del menú cruzan al navegador. `WebsiteHeaderView` sigue siendo un Server
 * Component: arma el logo, el botón de login y el marco del encabezado.
 *
 * La única razón de que esto exista es saber en qué página está el visitante: `resolveSiteNav`
 * corre en el servidor y no conoce la ruta, así que quien marca el ítem actual es este
 * componente, con `usePathname()`. La regla de qué cuenta como "actual" vive en un solo lugar:
 * se importa de `isPathCurrent`, en `site-nav.ts`.
 */
export function useIsCurrentNavItem() {
  const pathname = usePathname() ?? "";
  return (item: SiteNavItem) => isPathCurrent(pathname, item.href, { exact: Boolean(item.exact) });
}

export function SiteNavLink({
  item,
  current,
  className,
  style,
  onNavigate,
}: {
  item: SiteNavItem;
  current: boolean;
  className?: string;
  style?: CSSProperties;
  onNavigate?: () => void;
}) {
  return (
    <a
      href={item.href}
      aria-current={current ? "page" : undefined}
      target={item.newTab ? "_blank" : undefined}
      rel={item.newTab ? "noopener noreferrer" : undefined}
      className={className}
      style={style}
      onClick={onNavigate}
    >
      {item.label}
    </a>
  );
}

/** El ítem actual va un punto más grueso que el resto, sea cual sea el grosor elegido. */
export const PESO_ACTUAL = {
  fontWeight: "min(900, calc(var(--wsite-menu-weight) + 200))",
} as const;

/** En el servidor no hay medidas: el efecto de medición corre recién en el navegador. */
const useMedirAntesDePintar = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Ancho que se reserva para el botón «Más» al decidir cuántos ítems entran en la fila. */
const ANCHO_BOTON_MAS = 84;
const SEPARACION = 24; // gap-6

/**
 * Los ítems a la vista, para pantallas grandes: en fila (barra superior) o en columna (barra
 * lateral fija). En el celular no se muestra: ahí manda `WebsiteMenuOverlay`.
 *
 * Los `@3xl:` son consultas de contenedor, no de pantalla: el marco del sitio (`SiteFrame`) es el
 * contenedor, así la vista previa del constructor en modo celular se ve como un celular de verdad.
 *
 * En fila, un ítem nunca se parte en dos renglones: los que no entran en el ancho disponible pasan
 * a un desplegable «Más» (se mide en el navegador, con una copia invisible de la fila completa).
 */
export function WebsiteHeaderNavClient({
  navItems,
  colorTexto,
  minimal = false,
  centered = false,
  vertical = false,
}: {
  navItems: SiteNavItem[];
  colorTexto: string;
  minimal?: boolean;
  centered?: boolean;
  vertical?: boolean;
}) {
  const esActual = useIsCurrentNavItem();
  const itemsVisibles = minimal ? navItems.slice(0, 1) : navItems;
  const enFila = !vertical && !centered;
  const navRef = useRef<HTMLElement>(null);
  const medidaRef = useRef<HTMLDivElement>(null);
  const masRef = useRef<HTMLDivElement>(null);
  // Cuántos ítems entran en la fila; null = todavía sin medir (se muestran todos, recortados).
  const [cuantos, setCuantos] = useState<number | null>(null);
  const [masAbierto, setMasAbierto] = useState(false);

  useMedirAntesDePintar(() => {
    if (!enFila) return;
    const nav = navRef.current;
    const medida = medidaRef.current;
    if (!nav || !medida) return;
    const calcular = () => {
      const disponible = nav.clientWidth;
      const anchos = Array.from(medida.children).map((el) => (el as HTMLElement).offsetWidth);
      const total = anchos.reduce((s, w) => s + w, 0) + SEPARACION * Math.max(anchos.length - 1, 0);
      if (disponible <= 0 || total <= disponible) {
        setCuantos(anchos.length);
        return;
      }
      let usado = ANCHO_BOTON_MAS;
      let n = 0;
      for (const w of anchos) {
        if (usado + w + SEPARACION > disponible) break;
        usado += w + SEPARACION;
        n++;
      }
      setCuantos(n);
    };
    calcular();
    const ro = new ResizeObserver(calcular);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [enFila, itemsVisibles.length]);

  // El desplegable se cierra con un clic afuera o con Escape.
  useEffect(() => {
    if (!masAbierto) return;
    const alClic = (e: MouseEvent) => {
      if (masRef.current && !masRef.current.contains(e.target as Node)) setMasAbierto(false);
    };
    const alTeclado = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setMasAbierto(false);
    };
    document.addEventListener("mousedown", alClic);
    document.addEventListener("keydown", alTeclado);
    return () => {
      document.removeEventListener("mousedown", alClic);
      document.removeEventListener("keydown", alTeclado);
    };
  }, [masAbierto]);

  const estiloItem = (actual: boolean): CSSProperties => ({
    ...levelStyle("menu", { color: false }),
    color: colorTexto,
    opacity: actual ? 1 : 0.75,
    ...(actual ? PESO_ACTUAL : {}),
  });

  const enLaFila = enFila && cuantos !== null ? itemsVisibles.slice(0, cuantos) : itemsVisibles;
  const enElMas = enFila && cuantos !== null ? itemsVisibles.slice(cuantos) : [];
  const masTieneActual = enElMas.some((item) => esActual(item));

  // Los submenús de Inicio (anclas de la portada) no se despliegan acá: aparecen en el panel
  // del menú, donde hay lugar.
  return (
    <nav
      ref={navRef}
      aria-label="Menú principal"
      className={
        vertical
          ? "hidden flex-col gap-3 @3xl:flex"
          : centered
            ? "hidden flex-wrap items-center justify-center gap-6 @3xl:flex"
            : "relative hidden min-w-0 flex-1 items-center justify-end gap-6 @3xl:flex"
      }
    >
      {enFila ? (
        // Copia invisible de la fila completa: sólo sirve para medir cuánto ocupa cada ítem.
        <div ref={medidaRef} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 flex gap-6 whitespace-nowrap">
          {itemsVisibles.map((item) => (
            <span key={item.id} style={estiloItem(esActual(item))}>
              {item.label}
            </span>
          ))}
        </div>
      ) : null}
      {enLaFila.map((item) => {
        const actual = esActual(item);
        return (
          <SiteNavLink
            key={item.id}
            item={item}
            current={actual}
            className={`transition-opacity hover:opacity-70 ${vertical ? "" : "whitespace-nowrap"}`}
            style={estiloItem(actual)}
          />
        );
      })}
      {enElMas.length > 0 ? (
        <div ref={masRef} className="relative shrink-0">
          <button
            type="button"
            aria-haspopup="true"
            aria-expanded={masAbierto}
            onClick={() => setMasAbierto((v) => !v)}
            className="inline-flex items-center gap-1 whitespace-nowrap transition-opacity hover:opacity-70"
            style={estiloItem(masTieneActual)}
          >
            Más
            <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${masAbierto ? "rotate-180" : ""}`} />
          </button>
          {masAbierto ? (
            <div
              className="absolute right-0 top-full z-30 mt-3 flex min-w-[13rem] flex-col rounded-xl py-2 shadow-lg"
              style={{
                backgroundColor: "var(--wsite-bg)",
                border: "1px solid rgba(127,127,127,0.18)",
              }}
            >
              {enElMas.map((item) => {
                const actual = esActual(item);
                return (
                  <SiteNavLink
                    key={item.id}
                    item={item}
                    current={actual}
                    onNavigate={() => setMasAbierto(false)}
                    className="whitespace-nowrap px-4 py-2 transition-opacity hover:opacity-70"
                    style={{
                      ...estiloItem(actual),
                      color: "var(--wsite-menu-color)",
                    }}
                  />
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}
