import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UI_ROOT = __dirname;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

function safeJoin(root: string, relative: string): string | undefined {
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(root)) return undefined;
  return resolved;
}

export async function serveReviewLabStatic(
  req: IncomingMessage,
  res: ServerResponse,
  urlPath: string,
): Promise<boolean> {
  let relative = "index.html";
  if (urlPath === "/review-lab" || urlPath === "/review-lab/") {
    relative = "index.html";
  } else if (urlPath.startsWith("/review-lab/")) {
    relative = urlPath.slice("/review-lab/".length) || "index.html";
    if (relative.includes("..")) {
      res.writeHead(400);
      res.end("bad request");
      return true;
    }
  } else {
    return false;
  }

  const filePath = safeJoin(UI_ROOT, relative);
  if (!filePath) {
    res.writeHead(400);
    res.end("bad request");
    return true;
  }

  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
    return true;
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("not found");
    return true;
  }
}
