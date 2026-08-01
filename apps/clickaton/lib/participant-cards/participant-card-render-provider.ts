import { renderTemplatePreviewPng } from "@repo/template-engine-renderer";
import type { ResolvedTemplateDocument } from "@repo/template-engine";
import { cardRenderUnavailable } from "./participant-card-errors";
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

export class RemoteRenderProvider implements ParticipantCardRenderProvider {
  readonly id = "remote";

  async render(): Promise<ParticipantCardRenderResult> {
    throw cardRenderUnavailable(
      "Render remoto no conectado aún (worker no wired). Use CLICKATON_CARD_RENDER_PROVIDER=local."
    );
  }
}

export function resolveParticipantCardRenderProvider(): ParticipantCardRenderProvider {
  // Env de runtime (Vercel/local); no forma parte del grafo turbo de build.
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- runtime provider switch
  const raw = (process.env.CLICKATON_CARD_RENDER_PROVIDER ?? "local")
    .trim()
    .toLowerCase();
  if (raw === "unavailable") return new UnavailableRenderProvider();
  if (raw === "remote") return new RemoteRenderProvider();
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
