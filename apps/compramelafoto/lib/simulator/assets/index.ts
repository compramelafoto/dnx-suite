export {
  COD_ASSETS_ROOT,
  COD_ASSET_DIRS,
  COD_BASIS_ROOT,
  HDRI_SLOT_FILES,
  codAssetUrl,
  codHdriUrl,
  type CodAssetCategory,
} from "./paths";

export { createGltfLoader, type GltfLoadResult, type GltfLoaderOptions } from "./gltf-loader";
export { getKtx2Loader, getKtx2TranscoderPath, disposeKtx2Loader } from "./ktx2-loader";
export {
  loadHdriEnvironment,
  hdriFileExists,
  type HdriEnvironmentMaps,
  type HdriLoadOptions,
} from "./hdri-loader";
export {
  HDRI_TIME_SLOTS,
  resolveHdriSlotFromMinutes,
  resolveHdriUrlFromMinutes,
  getHdriSlotLabel,
  type HdriTimeSlot,
  type HdriTimeSlotConfig,
} from "./hdri-time-of-day";
export {
  resolveHdriSceneConfig,
  type HdriSceneApplyConfig,
} from "./hdri-scene-config";
export { logHdriDev, type HdriDevEvent } from "./hdri-dev-log";
export { assetFileExists } from "./asset-file-exists";
export { logGltfDev, type GltfDevEvent } from "./gltf-dev-log";
export {
  prepareGltfScene,
  formatBoundingBox,
  applySlotTransform,
  type GltfSceneStats,
} from "./gltf-scene-prep";
export {
  PHOTOGRAPHIC_BLOCK_BOUNDS,
  PHOTOGRAPHIC_BLOCK_SLOTS,
  PHOTOGRAPHIC_VEHICLE_MAIN_SLOT,
  PHOTOGRAPHIC_PEDESTRIAN_MAIN_SLOT,
  PHOTOGRAPHIC_PEDESTRIAN_SECONDARY_SLOT,
  PHOTOGRAPHIC_PEDESTRIAN_SLOTS,
  PHOTOGRAPHIC_STATIC_PEDESTRIAN_SLOTS,
  PHOTOGRAPHIC_PEDESTRIAN_SEATED_SLOT,
  PHOTOGRAPHIC_FACADE_NORTH_B_SLOT,
  type PhotographicAssetKind,
  type PhotographicAssetSlot,
  type PhotographicVehicleMotion,
} from "./photographic-block-manifest";
