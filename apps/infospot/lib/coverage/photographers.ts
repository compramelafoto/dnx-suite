/**
 * Agregación de fotógrafos (dueño + colaboradores + contributors).
 */

import type { CoveragePhotographerInput } from "./types";

export function mergeCoveragePhotographers(
  inputs: CoveragePhotographerInput[],
): CoveragePhotographerInput[] {
  const byId = new Map<number, CoveragePhotographerInput>();
  const roleRank: Record<CoveragePhotographerInput["role"], number> = {
    PRIMARY: 3,
    COLLABORATOR: 2,
    CONTRIBUTOR: 1,
  };

  for (const p of inputs) {
    if (!p.clfUserId || !p.displayName.trim()) continue;
    const prev = byId.get(p.clfUserId);
    if (!prev) {
      byId.set(p.clfUserId, {
        ...p,
        displayName: p.displayName.trim(),
        photoCount: Math.max(0, p.photoCount),
      });
      continue;
    }
    const nextRole =
      roleRank[p.role] > roleRank[prev.role] ? p.role : prev.role;
    byId.set(p.clfUserId, {
      clfUserId: p.clfUserId,
      displayName: prev.displayName || p.displayName.trim(),
      role: nextRole,
      photoCount: Math.max(prev.photoCount, p.photoCount),
      companyName: prev.companyName || p.companyName || null,
    });
  }

  return [...byId.values()].sort((a, b) => {
    if (roleRank[b.role] !== roleRank[a.role]) {
      return roleRank[b.role] - roleRank[a.role];
    }
    return b.photoCount - a.photoCount;
  });
}
