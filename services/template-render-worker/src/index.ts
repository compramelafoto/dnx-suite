import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { authenticateRequest, AuthError, ReplayGuard } from "./auth.js";
import { loadWorkerConfig, type WorkerConfig } from "./config.js";
import { getHealthSnapshot } from "./health.js";
import { mapRenderError, renderTemplateRequest } from "./render.js";
import { templateRenderRequestSchema } from "./types.js";

function readBody(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new AuthError(413, "AUTH_BODY_TOO_LARGE", "Body supera 2MB"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function normalizeHeaders(req: IncomingMessage): Record<string, string | string[] | undefined> {
  const out: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    out[key.toLowerCase()] = value;
  }
  return out;
}

export type WorkerServerDeps = {
  config: WorkerConfig;
  replayGuard: ReplayGuard;
};

export function createTemplateRenderWorkerServer(deps: WorkerServerDeps) {
  const replayGuard = deps.replayGuard;

  return createServer(async (req, res) => {
    try {
      const method = req.method ?? "GET";
      const url = req.url ?? "/";

      if (method === "GET" && url === "/internal/health") {
        const health = await getHealthSnapshot();
        sendJson(res, health.ok ? 200 : 503, health);
        return;
      }

      if (method === "POST" && url === "/internal/template-render") {
        const body = await readBody(req, deps.config.maxBodyBytes);
        authenticateRequest({
          config: deps.config,
          headers: normalizeHeaders(req),
          body,
          replayGuard,
        });

        const parsedJson = JSON.parse(body.toString("utf8")) as unknown;
        const parsedBody = templateRenderRequestSchema.safeParse(parsedJson);
        if (!parsedBody.success) {
          sendJson(res, 422, {
            ok: false,
            error: "Body JSON inválido",
            code: "INVALID_BODY",
          });
          return;
        }

        const rendered = await renderTemplateRequest(parsedBody.data, body);
        sendJson(res, 200, rendered);
        return;
      }

      sendJson(res, 404, { ok: false, error: "Not found" });
    } catch (err) {
      if (err instanceof AuthError) {
        sendJson(res, err.statusCode, {
          ok: false,
          error: err.message,
          code: err.code,
        });
        return;
      }

      const mapped = mapRenderError(err);
      sendJson(res, mapped.status, mapped.body);
    }
  });
}

export async function startTemplateRenderWorker(): Promise<{
  port: number;
  close: () => Promise<void>;
}> {
  const config = loadWorkerConfig();
  const replayGuard = new ReplayGuard(config.replayTtlMs);
  const server = createTemplateRenderWorkerServer({ config, replayGuard });

  await new Promise<void>((resolve, reject) => {
    server.listen(config.port, "0.0.0.0", () => resolve());
    server.on("error", reject);
  });

  return {
    port: config.port,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const shutdown = async (close: () => Promise<void>, signal: string) => {
    console.log(JSON.stringify({ event: "worker.shutdown", signal }));
    try {
      await close();
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  };

  startTemplateRenderWorker()
    .then(({ port, close }) => {
      console.log(
        JSON.stringify({
          event: "worker.listen",
          port,
          note: "HMAC required for /internal/template-render",
        })
      );
      process.on("SIGTERM", () => void shutdown(close, "SIGTERM"));
      process.on("SIGINT", () => void shutdown(close, "SIGINT"));
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
