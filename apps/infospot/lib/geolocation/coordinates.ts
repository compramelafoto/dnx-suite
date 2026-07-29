/**
 * Validación de coordenadas — delega en @repo/geo (DNX GEO ENGINE).
 */

export {
  validateCoordinates,
  hasUsableEventCoordinates,
  hasUsableCoordinates,
  parseLatLon,
  type CoordinateValidation,
} from "@repo/geo/coordinates";
