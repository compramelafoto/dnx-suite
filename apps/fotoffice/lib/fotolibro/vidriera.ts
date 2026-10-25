import { medidasDelProveedor, normalizarNombreProveedor } from "./medidas-pliego";
import { MODELOS_TAPA } from "./tapa/catalogo";

/**
 * Cómo se presenta cada laboratorio al elegirlo: su logo (sacado de su propia lista de precios)
 * y un resumen de lo que ofrece. Un proveedor que no está acá se muestra con sus iniciales.
 */
const MARCAS: Record<string, { logo: string; fondo: string }> = {
  roman: { logo: "/laboratorios/roman.png", fondo: "#ffffff" },
  "la isla": { logo: "/laboratorios/la-isla.png", fondo: "#ffffff" },
  // Su logo tiene letras blancas: va sobre oscuro.
  "copy express": { logo: "/laboratorios/copy-express.png", fondo: "#0f1b2d" },
};

export type VidrieraLaboratorio = {
  logo: string | null;
  fondo: string;
  iniciales: string;
  rigidas: number;
  flexibles: number;
  /** Modelos de tapa con plantilla cargada (las flexibles salen siempre del pliego). */
  tapas: string[];
};

export function vidrieraDe(nombre: string): VidrieraLaboratorio {
  const clave = normalizarNombreProveedor(nombre);
  const marca = MARCAS[clave];
  const medidas = medidasDelProveedor(nombre) ?? [];
  const iniciales = nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return {
    logo: marca?.logo ?? null,
    fondo: marca?.fondo ?? "#f1f5f9",
    iniciales: iniciales || "?",
    rigidas: medidas.filter((m) => m.linea === "RIGIDO").length,
    flexibles: medidas.filter((m) => m.linea === "FLEXIBLE").length,
    tapas: MODELOS_TAPA.filter((m) => normalizarNombreProveedor(m.laboratorio) === clave).map((m) => m.modelo),
  };
}
