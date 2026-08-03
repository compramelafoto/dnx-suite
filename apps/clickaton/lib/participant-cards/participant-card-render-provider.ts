import { renderTemplatePreviewPng } from "@repo/template-engine-renderer";
import type { ResolvedTemplateDocument } from "@repo/template-engine";
import { cardRenderFailed, cardRenderUnavailable } from "./participant-card-errors";
import {
  getParticipantCardRemoteRenderCircuit,
} from "./participant-card-circuit-breaker";
import {
  buildRemoteTemplateRenderBody,
  createRemoteRenderRequestIds,
  signTemplateRenderRequest,
} from "./participant-card-remote-auth";
import {
  getCardRemoteRenderUrl,
  getTemplateRenderHmacSecret,
} from "./participant-card-feature-flags";
import { renderClickatonParticipantCard } from "./participant-card-renderer";
import type { ClickatonParticipantCardType } from "./participant-card-types";

export type ParticipantCardRenderResult = {
  png: Buffer;
  width: number;
  height: number;
  durationMs: number;
};

export interface ParticipantCardRenderProvider {
  readonly id: string;
  render(input: {
    document: ResolvedTemplateDocument;
  }): Promise<ParticipantCardRenderResult>;
}

const RETRYABLE_STATUSES = new Set([502, 503, 504]);
const CONNECT_TIMEOUT_MS = 3_000;
const TOTAL_TIMEOUT_MS = 25_000;
const MAX_ATTEMPTS = 3; // initial + 2 retries

type FetchLike = typeof fetch;

export class LocalPlaywrightRenderProvider implements ParticipantCardRenderProvider {
  readonly id = "local-playwright";

  async render(input: {
    document: ResolvedTemplateDocument;
  }): Promise<ParticipantCardRenderResult> {
    const rendered = await renderTemplatePreviewPng(input.document);
    return {
      png: rendered.png,
      width: rendered.width,
      height: rendered.height,
      durationMs: rendered.durationMs,
    };
  }
}

/** Atajo para tests — devuelve PNG fijo sin Playwright. */
export class FixedPngRenderProvider implements ParticipantCardRenderProvider {
  readonly id = "fixed-png";

  constructor(
    private readonly png: Buffer,
    private readonly width = 1080,
    private readonly height = 1920,
    private readonly delayMs = 0
  ) {}

  async render(input: {
    document: ResolvedTemplateDocument;
  }): Promise<ParticipantCardRenderResult> {
    void input;
    if (this.delayMs > 0) {
      await new Promise((r) => setTimeout(r, this.delayMs));
    }
    return {
      png: this.png,
      width: this.width,
      height: this.height,
      durationMs: this.delayMs,
    };
  }
}

export class UnavailableRenderProvider implements ParticipantCardRenderProvider {
  readonly id = "unavailable";

  async render(): Promise<ParticipantCardRenderResult> {
    throw cardRenderUnavailable(
      "Render de placas no disponible en este entorno (provider=unavailable)"
    );
  }
}

export type RemoteParticipantCardRenderProviderOptions = {
  remoteUrl?: string;
  hmacSecret?: string;
  fetchImpl?: FetchLike;
  circuit?: ReturnType<typeof getParticipantCardRemoteRenderCircuit>;
};

export class RemoteParticipantCardRenderProvider implements ParticipantCardRenderProvider {
  readonly id = "remote";

  private readonly remoteUrl: string;
  private readonly hmacSecret: string;
  private readonly fetchImpl: FetchLike;
  private readonly circuit: ReturnType<typeof getParticipantCardRemoteRenderCircuit>;

  constructor(options: RemoteParticipantCardRenderProviderOptions = {}) {
    this.remoteUrl =
      options.remoteUrl ??
      getCardRemoteRenderUrl() ??
      "";
    this.hmacSecret = options.hmacSecret ?? getTemplateRenderHmacSecret() ?? "";
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.circuit = options.circuit ?? getParticipantCardRemoteRenderCircuit();
  }

  async render(input: {
    document: ResolvedTemplateDocument;
  }): Promise<ParticipantCardRenderResult> {
    if (!this.remoteUrl) {
      throw cardRenderUnavailable(
        "CLICKATON_CARD_REMOTE_RENDER_URL no configurada para provider=remote"
      );
    }
    if (!this.hmacSecret) {
      throw cardRenderUnavailable(
        "DNX_TEMPLATE_RENDER_HMAC_SECRET no configurado para provider=remote"
      );
    }
    if (!this.circuit.canAttempt()) {
      throw cardRenderUnavailable(
        "Render remoto temporalmente no disponible (circuit breaker OPEN)"
      );
    }

    const { idempotencyKey } = createRemoteRenderRequestIds();

    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const { requestId } = createRemoteRenderRequestIds();
      const payload = buildRemoteTemplateRenderBody({
        document: input.document,
        requestId,
        idempotencyKey,
      });
      const signed = signTemplateRenderRequest({
        secret: this.hmacSecret,
        requestId,
        idempotencyKey,
        body: payload,
      });

      const controller = new AbortController();
      const connectTimer = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);
      const totalTimer = setTimeout(() => controller.abort(), TOTAL_TIMEOUT_MS);

      try {
        const started = Date.now();
        const response = await this.fetchImpl(this.remoteUrl, {
          method: "POST",
          headers: signed.headers,
          body: payload,
          signal: controller.signal,
        });

        const responseText = await response.text();
        let parsed: {
          ok?: boolean;
          pngBase64?: string;
          width?: number;
          height?: number;
          durationMs?: number;
          error?: string;
          code?: string;
        } = {};
        try {
          parsed = JSON.parse(responseText) as typeof parsed;
        } catch {
          parsed = {};
        }

        if (response.ok && parsed.ok && parsed.pngBase64) {
          this.circuit.recordSuccess();
          return {
            png: Buffer.from(parsed.pngBase64, "base64"),
            width: parsed.width ?? input.document.width,
            height: parsed.height ?? input.document.height,
            durationMs: parsed.durationMs ?? Date.now() - started,
          };
        }

        if (RETRYABLE_STATUSES.has(response.status)) {
          lastError = new Error(parsed.error ?? `HTTP ${response.status}`);
          if (attempt < MAX_ATTEMPTS - 1) {
            await sleep(backoffMs(attempt));
            continue;
          }
          this.circuit.recordFailure();
          throw cardRenderUnavailable(
            parsed.error ?? `Render remoto no disponible (HTTP ${response.status})`,
            { status: response.status, code: parsed.code }
          );
        }

        this.circuit.recordFailure();
        throw cardRenderFailed(
          parsed.error ?? `Render remoto falló (HTTP ${response.status})`,
          { status: response.status, code: parsed.code }
        );
      } catch (err) {
        const timedOut =
          err instanceof Error &&
          (err.name === "AbortError" || err.message.includes("aborted"));
        const retryable = timedOut || isRetryableFetchError(err);

        if (retryable && attempt < MAX_ATTEMPTS - 1) {
          lastError = err;
          await sleep(backoffMs(attempt));
          continue;
        }

        this.circuit.recordFailure();

        if (timedOut) {
          throw cardRenderUnavailable("Timeout conectando o renderizando en worker remoto", {
            connectTimeoutMs: CONNECT_TIMEOUT_MS,
            totalTimeoutMs: TOTAL_TIMEOUT_MS,
          });
        }

        if (err instanceof Error && err.message.includes("circuit breaker")) {
          throw err;
        }

        if (
          err instanceof Error &&
          (err.name === "TypeError" || err.message.includes("fetch"))
        ) {
          throw cardRenderUnavailable(`No se pudo contactar al worker remoto: ${err.message}`);
        }

        throw err;
      } finally {
        clearTimeout(connectTimer);
        clearTimeout(totalTimer);
      }
    }

    this.circuit.recordFailure();
    throw cardRenderUnavailable("Render remoto agotó reintentos", {
      cause: lastError instanceof Error ? lastError.message : String(lastError),
    });
  }
}

/** Alias histórico del provider remoto cableado. */
export const RemoteRenderProvider = RemoteParticipantCardRenderProvider;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number): number {
  return 250 * 2 ** attempt;
}

function isRetryableFetchError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

export function resolveParticipantCardRenderProvider(): ParticipantCardRenderProvider {
  // Env de runtime (Vercel/local); no forma parte del grafo turbo de build.
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- runtime provider switch
  const raw = (process.env.CLICKATON_CARD_RENDER_PROVIDER ?? "local")
    .trim()
    .toLowerCase();
  if (raw === "unavailable") return new UnavailableRenderProvider();
  if (raw === "remote") return new RemoteParticipantCardRenderProvider();
  return new LocalPlaywrightRenderProvider();
}

/** Resuelve documento + render vía pipeline completo (útil en integración). */
export async function renderParticipantCardViaLocalPipeline(input: {
  cardType: ClickatonParticipantCardType;
  templateData: Record<string, unknown>;
}): Promise<ParticipantCardRenderResult & { sourceSummary: NonNullable<Awaited<ReturnType<typeof renderClickatonParticipantCard>>["sourceSummary"]> }> {
  const rendered = await renderClickatonParticipantCard(input);
  return {
    png: rendered.png,
    width: rendered.width,
    height: rendered.height,
    durationMs: rendered.durationMs,
    sourceSummary: rendered.sourceSummary,
  };
}
