export { DistanceBadge } from "./DistanceBadge";
export { LocationSummary } from "./LocationSummary";
export { GeoScopeSelector } from "./GeoScopeSelector";
export { LocationSearch } from "./LocationSearch";
export { NearbyIndicator } from "./NearbyIndicator";

/**
 * MapPicker / LocationPicker con Leaflet:
 * permanecen en cada app (InfoSpot, CLF) porque dependen de assets CSS,
 * tiles y copy de marca. Usar LocationSearch + contrato DnxLocation
 * para unificar el flujo de datos.
 */
