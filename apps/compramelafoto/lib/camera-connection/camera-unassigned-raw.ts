import { generateR2Key } from "@/lib/r2-client";

export const CAMERA_UNASSIGNED_RAW_PREFIX = "camera-unassigned";

export function buildCameraUnassignedRawKey(userId: number, filename: string): string {
  return generateR2Key(filename, `${CAMERA_UNASSIGNED_RAW_PREFIX}/${userId}`);
}

export function isCameraUnassignedRawKey(rawKey: string): boolean {
  return rawKey.startsWith(`${CAMERA_UNASSIGNED_RAW_PREFIX}/`);
}
