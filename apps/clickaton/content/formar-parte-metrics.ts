/**
 * Métricas de comunidad tomadas desde ComprameLaFoto (producción).
 *
 * Criterios:
 * - Fotógrafos: User con role PHOTOGRAPHER | LAB_PHOTOGRAPHER, no bloqueados.
 * - Usuarios: User con role distinto de ADMIN (misma fuente que landing CLF).
 * - Ciudades: ciudades distintas donde hay al menos un fotógrafo con ciudad cargada.
 * - Fotografías: PlatformMetrics.photosUploadedTotal (misma fuente que la landing CLF).
 *
 * Snapshot consultado contra la DB de producción de ComprameLaFoto.
 * Actualizar cuando se quiera refrescar el banner.
 */
export const formarParteClfMetrics = {
  source: "ComprameLaFoto",
  asOf: "2026-07-22",
  photographers: 555,
  users: 662,
  citiesWithPhotographers: 152,
  photosUploadedTotal: 183_263,
} as const;

function formatMetric(value: number): string {
  return `+${new Intl.NumberFormat("es-AR").format(value)}`;
}

export const formarParteHeroMetrics = [
  {
    label: "Fotógrafos",
    value: formatMetric(formarParteClfMetrics.photographers),
  },
  {
    label: "Usuarios",
    value: formatMetric(formarParteClfMetrics.users),
  },
  {
    label: "Ciudades",
    value: formatMetric(formarParteClfMetrics.citiesWithPhotographers),
  },
  {
    label: "Fotografías",
    value: formatMetric(formarParteClfMetrics.photosUploadedTotal),
  },
] as const;
