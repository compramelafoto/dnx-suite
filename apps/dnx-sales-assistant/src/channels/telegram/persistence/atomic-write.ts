import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/** Escritura atómica: tmp + rename. */
export async function writeJsonAtomic(
  filePath: string,
  value: unknown,
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(tmp, payload, "utf8");
  await rename(tmp, filePath);
}
