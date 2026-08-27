/**
 * Imágenes de presentación de un concurso, administrables sin desplegar.
 *
 * Punto de entrada único del módulo. Nadie fuera de acá debería importar los
 * archivos internos: así se puede cambiar cómo se guardan o procesan las
 * imágenes sin tocar el resto de la aplicación.
 */

export {
  CONTEST_MEDIA_KINDS,
  CONTEST_MEDIA_ALLOWED_MIME,
  CONTEST_MEDIA_MAX_UPLOAD_BYTES,
  CONTEST_MEDIA_MIN_SOURCE_WIDTH,
  CONTEST_MEDIA_MIN_SOURCE_HEIGHT,
  CONTEST_MEDIA_SPECS,
  CONTEST_MEDIA_ASPECT_RATIO,
  contestMediaSpec,
  isContestMediaKind,
  isSixteenByNine,
  aspectRatioDelta,
  formatBytes,
  formatDimensions,
  type ContestMediaKind,
  type ContestMediaMime,
  type ContestMediaSpec,
} from "./specs";

export {
  sniffImageType,
  validateUploadBytes,
  validateImageDimensions,
  validateAltText,
  aspectRatioWarning,
  type ContestMediaValidationError,
} from "./validation";

export {
  readSourceInfo,
  processContestMedia,
  buildPreviewDataUri,
  type ProcessedContestMedia,
  type ContestMediaSourceInfo,
} from "./processing";

export {
  resolveContestMediaAccess,
  authorizeContestMediaWrite,
  type ContestMediaAccess,
  type ContestMediaAuthzFailure,
} from "./access";

export {
  saveContestMedia,
  deleteContestMedia,
  updateContestMediaMeta,
  getActiveContestMedia,
  getContestMediaAsset,
  listContestMediaHistory,
  type ContestMediaRecord,
  type SaveContestMediaResult,
} from "./service";

export {
  contestMediaUrl,
  contestMediaAbsoluteUrl,
  contestMediaIsPubliclyVisible,
  pickContestMedia,
  type ResolvedContestMedia,
} from "./public-url";

export {
  contestMediaStorageKey,
  contestMediaStoragePrefix,
  storageKeyBelongsToContest,
} from "./storage-keys";

export {
  resolveManagedContestMedia,
  resolveManagedContestMediaBatch,
  type ManagedMediaBundle,
} from "./presentation-bridge";
