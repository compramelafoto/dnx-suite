import { createHash } from "node:crypto";

export function incidentSignature(parts: Record<string, string | number | undefined>): string {
  const canon = Object.keys(parts)
    .filter((k) => parts[k] !== undefined)
    .sort()
    .map((k) => `${k}=${parts[k]}`)
    .join("|");
  return createHash("sha256").update(canon).digest("hex").slice(0, 16);
}
