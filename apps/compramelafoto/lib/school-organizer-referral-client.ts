export type SchoolReferralSnapshot = {
  schoolId: number;
  albumId: number;
  timestamp: number;
};

const STORAGE_KEY = "schoolReferralByAlbum";

function readStore(): Record<string, SchoolReferralSnapshot> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, SchoolReferralSnapshot>;
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, SchoolReferralSnapshot>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage errors
  }
}

export function parseSchoolReferralRefParam(value: string | null): number | null {
  if (!value) return null;
  const match = value.trim().match(/^school_(\d+)$/);
  if (!match) return null;
  const schoolId = Number(match[1]);
  return Number.isInteger(schoolId) && schoolId > 0 ? schoolId : null;
}

export function getSchoolReferralForAlbum(albumId: number): SchoolReferralSnapshot | null {
  const store = readStore();
  const row = store[String(albumId)];
  if (!row) return null;
  if (!Number.isInteger(row.schoolId) || row.schoolId <= 0) return null;
  if (!Number.isInteger(row.albumId) || row.albumId <= 0) return null;
  return row;
}

export function saveSchoolReferralForAlbumIfMissing(input: {
  albumId: number;
  schoolId: number;
}): SchoolReferralSnapshot {
  const store = readStore();
  const key = String(input.albumId);
  const existing = store[key];
  if (existing) return existing;
  const next: SchoolReferralSnapshot = {
    albumId: input.albumId,
    schoolId: input.schoolId,
    timestamp: Date.now(),
  };
  store[key] = next;
  writeStore(store);
  return next;
}
