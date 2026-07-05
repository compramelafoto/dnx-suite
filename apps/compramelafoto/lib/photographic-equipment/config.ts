export function isExifDeviceScanEnabled(): boolean {
  const raw = process.env.EXIF_DEVICE_SCAN_ENABLED;
  if (raw === undefined || raw === "") return false;
  return raw === "1" || raw.toLowerCase() === "true";
}

export function isExifDeviceScanBackfillEnabled(): boolean {
  const raw = process.env.EXIF_DEVICE_SCAN_BACKFILL_ENABLED;
  if (raw === undefined || raw === "") return true;
  return raw === "1" || raw.toLowerCase() === "true";
}

function parseBatchSize(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), 500);
}

export function getExifDeviceScanBatchSize(): number {
  return parseBatchSize(process.env.EXIF_DEVICE_SCAN_BATCH_SIZE, 100);
}

export function getExifDeviceScanBackfillBatchSize(): number {
  return parseBatchSize(
    process.env.EXIF_DEVICE_SCAN_BACKFILL_BATCH_SIZE,
    getExifDeviceScanBatchSize()
  );
}

export function getExifDeviceScanDailyBatchSize(): number {
  return parseBatchSize(process.env.EXIF_DEVICE_SCAN_DAILY_BATCH_SIZE, 300);
}

export function getExifDeviceScanTimezone(): string {
  return process.env.EXIF_DEVICE_SCAN_TIMEZONE?.trim() || "America/Argentina/Cordoba";
}

/** Ventana nocturna local: [02:00, 05:00) */
export function isWithinExifDeviceScanWindow(now = new Date()): boolean {
  const tz = getExifDeviceScanTimezone();
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(now);
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    const totalMinutes = hour * 60 + minute;
    const start = 2 * 60;
    const end = 5 * 60;
    return totalMinutes >= start && totalMinutes < end;
  } catch {
    return false;
  }
}

export function getBatchSizeForScanMode(mode: "BACKFILL" | "DAILY"): number {
  return mode === "BACKFILL"
    ? getExifDeviceScanBackfillBatchSize()
    : getExifDeviceScanDailyBatchSize();
}
