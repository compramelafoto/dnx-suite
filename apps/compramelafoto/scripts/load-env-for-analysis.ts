import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function extractEnvValue(text: string, key: string): string | null {
  const prefix = `${key}=`;
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith(prefix)) continue;
    let raw = line.slice(prefix.length);
    if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
      raw = raw.slice(1, -1);
    }
    return raw;
  }
  return null;
}

/** Convierte `\n` estructurales (fuera de strings JSON) a espacio. */
function unescapeDotenvJson(s: string): string {
  let out = "";
  let inString = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') {
      let bs = 0;
      for (let j = i - 1; j >= 0 && s[j] === "\\"; j--) bs++;
      if (bs % 2 === 0) inString = !inString;
      out += c;
      continue;
    }
    if (!inString && c === "\\" && s[i + 1] === "n") {
      out += " ";
      i++;
      continue;
    }
    out += c;
  }
  return out;
}

function loadSimpleEnv(path: string) {
  if (!existsSync(path)) return;
  const text = readFileSync(resolve(path), "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (key === "GOOGLE_APPLICATION_CREDENTIALS_JSON") continue;
    let value = line.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = value;
    }
  }

  const googleRaw = extractEnvValue(text, "GOOGLE_APPLICATION_CREDENTIALS_JSON");
  if (googleRaw && !process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const fixed = unescapeDotenvJson(googleRaw);
    // Validar que parsea
    JSON.parse(fixed);
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = fixed;
  }
}

export function loadAnalysisEnv() {
  for (const file of [
    ".env.vercel.production.local",
    ".env.production.local",
    ".env.local",
  ]) {
    try {
      loadSimpleEnv(file);
    } catch (err) {
      console.warn(`[load-env] skip ${file}:`, (err as Error)?.message || err);
    }
  }
}
