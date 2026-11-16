/** Lo que viaja del servidor a la lista (sin fechas ni ids de rubro sueltos). */
export type TarjetaPortfolio = {
  id: string;
  titulo: string;
  /** «Rosario · 2024», o vacío. */
  detalle: string;
  portadaUrl: string | null;
  /** null = no se puede compartir (sólo llega a quien edita Trabajos). */
  url: string | null;
  motivo: string | null;
};

export type VistaRubro = {
  id: string;
  nombre: string;
  total: number;
  enlaces: { titulo: string; url: string }[];
  estilos: { estilo: string; trabajos: TarjetaPortfolio[] }[];
};
