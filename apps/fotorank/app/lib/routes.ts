/**
 * Rutas centralizadas de Fotorank.
 * - Público: usar siempre slug.
 * - Panel interno: usar siempre id.
 */
export const routes = {
  concursos: {
    index: () => "/concursos",
    publico: (slug: string) => `/concursos/${slug}`,
    juradosPublico: (slug: string) => `/concursos/${slug}/jurados`,
  },
  dashboard: {
    index: () => "/dashboard",
    concursos: {
      detalle: (id: string) => `/dashboard/concursos/${id}`,
      editar: (id: string) => `/dashboard/concursos/${id}/editar`,
      fechas: (id: string) => `/dashboard/concursos/${id}/fechas`,
      jurado: (id: string) => `/dashboard/concursos/${id}/jurado`,
      modals: (id: string) => `/dashboard/concursos/${id}/modals`,
      categorias: (id: string) => `/dashboard/concursos/${id}/categorias`,
      resultados: (id: string) => `/dashboard/concursos/${id}/resultados`,
      premios: (id: string) => `/dashboard/concursos/${id}/premios`,
      comercializacion: (id: string) => `/dashboard/concursos/${id}/comercializacion`,
    },
  },
} as const;
