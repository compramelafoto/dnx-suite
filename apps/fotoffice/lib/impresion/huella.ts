import "server-only";
import { createHash } from "node:crypto";
import { canonico } from "./canonico";

export function huellaDe(valor: unknown): string {
  return createHash("sha256").update(canonico(valor)).digest("hex");
}
