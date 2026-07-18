import type { IncomingMessage } from "node:http";

const DEFAULT_MAX_BYTES = 64_000;

export class JsonBodyError extends Error {
  readonly code: "empty_body" | "payload_too_large" | "invalid_json";

  constructor(code: JsonBodyError["code"], message: string) {
    super(message);
    this.name = "JsonBodyError";
    this.code = code;
  }
}

export async function readJsonBody(
  req: IncomingMessage,
  maxBytes = DEFAULT_MAX_BYTES,
): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > maxBytes) {
      throw new JsonBodyError("payload_too_large", "El cuerpo supera el límite permitido");
    }
    chunks.push(buf);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) {
    throw new JsonBodyError("empty_body", "El cuerpo JSON está vacío");
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new JsonBodyError("invalid_json", "JSON inválido");
  }
}
