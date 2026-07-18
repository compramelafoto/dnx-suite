import { createConversationId } from "../../../conversation/create-conversation-id.js";
import type { ConversationStore } from "../../../conversation/conversation-store.js";
import type { AssistantRequest, AssistantResponse } from "../../../models/assistant.js";
import { processIncomingMessage } from "../../../pipeline/process-incoming-message.js";
import type { PricingRuntimeDeps } from "../../../pricing/runtime/pricing-runtime.js";
import { runPricingReview } from "../../../pricing-review/adapters/run-pricing-review.js";
import type { CalibrationLabApi } from "../../../calibration/lab/calibration-lab-api.js";
import {
  loadOwnerIdentityConfig,
  type OwnerIdentityConfig,
} from "../../../pricing/owner/owner-identity.js";
import {
  resolveOwnerPricingProfile,
  type OwnerPricingResolveResult,
} from "../../../pricing/owner/resolve-owner-pricing-profile.js";
import {
  formatAssumptionsMessage,
  formatBudgetMessage,
  formatEstadoMessage,
  outboundBudget,
} from "../commands/budget-messages.js";
import {
  textAyuda,
  textCancelado,
  textInicio,
  textNuevaConfirm,
  textNuevaStarted,
  textPrivacidad,
  textSafeError,
} from "../commands/command-texts.js";
import {
  textBudgetInvalidatedNotice,
  textIdentityMismatch,
  textNoRealBudgetToExplain,
  textProfileIncomplete,
  textProfileNotConfigured,
  textSyntheticBlocked,
} from "../commands/profile-gate-messages.js";
import {
  resolveConversationRole,
  textClientBlocksOwnerCommand,
} from "../../../conversation/role/index.js";
import type { TelegramRuntimeConfig } from "../domain/config.js";
import type {
  TelegramBudgetReviewVerdict,
  TelegramInboundMessage,
  TelegramOutboundMessage,
} from "../domain/models.js";
import { buildTelegramIdentity } from "../mapping/map-update.js";
import type { TelegramLocalStore } from "../persistence/telegram-local-store.js";
import {
  authorizeTelegramInbound,
  privateDenyMessage,
} from "../security/authorize.js";
import { segmentTelegramText } from "../rendering/format.js";

export type TelegramChannelHandlerDeps = {
  config: TelegramRuntimeConfig;
  localStore: TelegramLocalStore;
  pricingRuntime?: PricingRuntimeDeps;
  calibration?: CalibrationLabApi;
  ownerIdentity?: OwnerIdentityConfig;
  /** Tests: inyección del pipeline. */
  processMessage?: (
    request: AssistantRequest,
    deps: {
      store: ConversationStore;
      memoryClock: TelegramLocalStore["memory"];
      pricingRuntime?: PricingRuntimeDeps;
      styleEngine: "dani-conversation-v1";
    },
  ) => Promise<AssistantResponse>;
};

function normalizeCommand(text: string): string {
  const raw = text.trim();
  const at = raw.indexOf("@");
  const base = at > 0 && raw.startsWith("/") ? raw.slice(0, at) : raw;
  return base.toLowerCase();
}

export class TelegramChannelHandler {
  private readonly ownerIdentity: OwnerIdentityConfig;

  constructor(private readonly deps: TelegramChannelHandlerDeps) {
    this.ownerIdentity = deps.ownerIdentity ?? loadOwnerIdentityConfig();
  }

  private resolveOwner(inbound: TelegramInboundMessage): OwnerPricingResolveResult {
    return resolveOwnerPricingProfile(
      {
        channel: "TELEGRAM",
        telegramUserId: inbound.userId,
        telegramChatId: inbound.chatId,
      },
      this.ownerIdentity,
    );
  }

  private gateMessage(resolved: OwnerPricingResolveResult): string {
    if (resolved.status === "IDENTITY_MISMATCH") return textIdentityMismatch();
    if (resolved.status === "SYNTHETIC_BLOCKED") return textSyntheticBlocked();
    if (resolved.status === "INCOMPLETE") {
      const areas =
        resolved.missingFields.slice(0, 4).join(", ") || "datos del perfil";
      return textProfileIncomplete(areas);
    }
    return textProfileNotConfigured();
  }

  private async isClientSimulation(
    inbound: TelegramInboundMessage,
  ): Promise<boolean> {
    const identity = buildTelegramIdentity(inbound);
    const stored = await this.deps.localStore.memory.get(
      identity.internalConversationId,
    );
    return resolveConversationRole(stored?.roleState) === "CLIENT";
  }

  private async blockIfClientSimulation(
    inbound: TelegramInboundMessage,
  ): Promise<TelegramOutboundMessage[] | null> {
    if (await this.isClientSimulation(inbound)) {
      return [
        { chatId: inbound.chatId, text: textClientBlocksOwnerCommand() },
      ];
    }
    return null;
  }

  async handle(
    inbound: TelegramInboundMessage,
  ): Promise<TelegramOutboundMessage[]> {
    const auth = authorizeTelegramInbound(inbound, this.deps.config);
    if (!auth.ok) {
      if (inbound.chatType === "private") {
        return [{ chatId: inbound.chatId, text: privateDenyMessage() }];
      }
      return [];
    }

    try {
      if (inbound.isCallback && inbound.callbackData) {
        return await this.handleCallback(inbound);
      }

      const cmd = normalizeCommand(inbound.text);
      if (cmd.startsWith("/")) {
        return await this.handleCommand(inbound, cmd);
      }

      const flags = this.deps.localStore.getFlags(inbound.chatId);
      if (flags.awaitingAdjustmentFeedback) {
        return await this.handleAdjustmentFeedback(inbound);
      }

      return await this.handleConversation(inbound);
    } catch {
      return [{ chatId: inbound.chatId, text: textSafeError() }];
    }
  }

  private async handleCommand(
    inbound: TelegramInboundMessage,
    cmd: string,
  ): Promise<TelegramOutboundMessage[]> {
    switch (cmd) {
      case "/inicio":
      case "/start":
        return [{ chatId: inbound.chatId, text: textInicio() }];
      case "/ayuda":
      case "/help":
        return [{ chatId: inbound.chatId, text: textAyuda() }];
      case "/privacidad":
        return [{ chatId: inbound.chatId, text: textPrivacidad() }];
      case "/nueva":
        return this.handleNueva(inbound);
      case "/cancelar":
        return this.handleCancelar(inbound);
      case "/estado":
        return this.handleEstado(inbound);
      case "/presupuesto": {
        const blocked = await this.blockIfClientSimulation(inbound);
        if (blocked) return blocked;
        return this.handlePresupuesto(inbound);
      }
      case "/explicacion": {
        const blocked = await this.blockIfClientSimulation(inbound);
        if (blocked) return blocked;
        return this.handleExplicacion(inbound);
      }
      case "/supuestos": {
        const blocked = await this.blockIfClientSimulation(inbound);
        if (blocked) return blocked;
        return this.handleSupuestos(inbound);
      }
      default:
        return [
          {
            chatId: inbound.chatId,
            text: "No conozco ese comando. Probá /ayuda.",
          },
        ];
    }
  }

  private async handleCallback(
    inbound: TelegramInboundMessage,
  ): Promise<TelegramOutboundMessage[]> {
    const data = inbound.callbackData ?? "";
    if (
      data.startsWith("budget:") &&
      data !== "budget:new" &&
      (await this.isClientSimulation(inbound))
    ) {
      return [
        { chatId: inbound.chatId, text: textClientBlocksOwnerCommand() },
      ];
    }
    switch (data) {
      case "budget:explain":
        return this.handleExplicacion(inbound);
      case "budget:assumptions":
        return this.handleSupuestos(inbound);
      case "budget:approve":
        return this.recordVerdict(inbound, "APPROVED");
      case "budget:adjust":
        await this.deps.localStore.setFlags(inbound.chatId, {
          awaitingAdjustmentFeedback: true,
        });
        return [
          {
            chatId: inbound.chatId,
            text: "¿Qué cambiarías o qué te resulta poco claro?",
          },
        ];
      case "budget:new":
        return this.handleNueva(inbound, true);
      case "budget:reject":
        return this.recordVerdict(inbound, "REJECTED");
      default:
        return [];
    }
  }

  private async handleNueva(
    inbound: TelegramInboundMessage,
    force = false,
  ): Promise<TelegramOutboundMessage[]> {
    const identity = buildTelegramIdentity(inbound);
    const existing = await this.deps.localStore.memory.get(
      identity.internalConversationId,
    );
    const advanced =
      existing?.quoteRequestDraft &&
      (existing.quoteRequestDraft.serviceType ||
        existing.quoteRequestDraft.durationHours !== undefined);

    if (advanced && !force) {
      await this.deps.localStore.setFlags(inbound.chatId, {
        awaitingAdjustmentFeedback: false,
        lastBudgetStatus: "CONFIRM_NEW",
      });
      return [{ chatId: inbound.chatId, text: textNuevaConfirm() }];
    }

    await this.deps.localStore.memory.delete(identity.internalConversationId);
    await this.deps.localStore.persistConversation(
      identity.internalConversationId,
    );
    await this.deps.localStore.setFlags(inbound.chatId, {
      awaitingAdjustmentFeedback: false,
      lastBudgetStatus: undefined,
    });
    // Nueva conversación → OWNER por defecto
    return [{ chatId: inbound.chatId, text: textNuevaStarted() }];
  }

  private async handleCancelar(
    inbound: TelegramInboundMessage,
  ): Promise<TelegramOutboundMessage[]> {
    const identity = buildTelegramIdentity(inbound);
    await this.deps.localStore.memory.delete(identity.internalConversationId);
    await this.deps.localStore.persistConversation(
      identity.internalConversationId,
    );
    await this.deps.localStore.setFlags(inbound.chatId, {
      awaitingAdjustmentFeedback: false,
    });
    return [{ chatId: inbound.chatId, text: textCancelado() }];
  }

  private async handleEstado(
    inbound: TelegramInboundMessage,
  ): Promise<TelegramOutboundMessage[]> {
    const identity = buildTelegramIdentity(inbound);
    const stored = await this.deps.localStore.memory.get(
      identity.internalConversationId,
    );
    const draft = stored?.quoteRequestDraft;
    const missing: string[] = [];
    if (!draft?.serviceType || draft.serviceType === "UNKNOWN") {
      missing.push("tipo de trabajo");
    }
    if (!draft?.eventDate) missing.push("fecha");
    if (!draft?.city) missing.push("ciudad");
    if (draft?.durationHours === undefined) missing.push("duración");

    const quoteStatus =
      missing.length === 0
        ? "READY_FOR_CALCULATION"
        : draft
          ? "COLLECTING_INFORMATION"
          : "NOT_APPLICABLE";

    const owner = this.resolveOwner(inbound);
    const pricingStatus =
      owner.status === "READY" ? "PROFILE_READY" : "NOT_CONFIGURED";
    const role = resolveConversationRole(stored?.roleState);

    const lines = [
      formatEstadoMessage({
        draft,
        quoteStatus,
        missingFields: missing,
        pricingStatus,
      }),
      "",
      `Rol conversacional: ${role === "CLIENT" ? "CLIENT (simulación)" : "OWNER"}`,
    ];
    const flags = this.deps.localStore.getFlags(inbound.chatId);
    if (flags.budgetInvalidated) {
      lines.push(
        "",
        flags.budgetInvalidatedMessage ?? textBudgetInvalidatedNotice(),
      );
    }

    return [{ chatId: inbound.chatId, text: lines.join("\n") }];
  }

  private async handlePresupuesto(
    inbound: TelegramInboundMessage,
  ): Promise<TelegramOutboundMessage[]> {
    const owner = this.resolveOwner(inbound);
    if (owner.status !== "READY") {
      await this.deps.localStore.setFlags(inbound.chatId, {
        lastBudgetStatus: "NOT_CONFIGURED",
      });
      return [{ chatId: inbound.chatId, text: this.gateMessage(owner) }];
    }

    const identity = buildTelegramIdentity(inbound);
    const stored = await this.deps.localStore.memory.get(
      identity.internalConversationId,
    );

    const { review } = await runPricingReview({
      draft: stored?.quoteRequestDraft,
      amountsVisible: true,
      inline: { profile: owner.profile, catalog: owner.catalog },
    });

    if (review.status === "NOT_CONFIGURED") {
      await this.deps.localStore.setFlags(inbound.chatId, {
        lastBudgetStatus: "NOT_CONFIGURED",
      });
      return [{ chatId: inbound.chatId, text: textProfileNotConfigured() }];
    }

    const text = formatBudgetMessage(stored?.quoteRequestDraft, review);
    const ready = review.status === "READY";
    await this.deps.localStore.setFlags(inbound.chatId, {
      lastBudgetStatus: review.status,
      budgetInvalidated: false,
      budgetInvalidatedMessage: undefined,
    });
    return [outboundBudget(inbound.chatId, text, ready)];
  }

  private async handleExplicacion(
    inbound: TelegramInboundMessage,
  ): Promise<TelegramOutboundMessage[]> {
    const owner = this.resolveOwner(inbound);
    if (owner.status !== "READY") {
      return [{ chatId: inbound.chatId, text: textNoRealBudgetToExplain() }];
    }

    const flags = this.deps.localStore.getFlags(inbound.chatId);
    if (flags.budgetInvalidated || flags.lastBudgetStatus === "NOT_CONFIGURED") {
      return [{ chatId: inbound.chatId, text: textNoRealBudgetToExplain() }];
    }

    const identity = buildTelegramIdentity(inbound);
    const stored = await this.deps.localStore.memory.get(
      identity.internalConversationId,
    );
    const { review } = await runPricingReview({
      draft: stored?.quoteRequestDraft,
      amountsVisible: true,
      inline: { profile: owner.profile, catalog: owner.catalog },
    });

    if (review.status !== "READY") {
      return [{ chatId: inbound.chatId, text: textNoRealBudgetToExplain() }];
    }

    const text = review.explanationDani
      .replace(/\bcore\b/gi, "cálculo")
      .replace(/\bengine\b/gi, "cálculo")
      .replace(/\bpipeline\b/gi, "proceso")
      .replace(/\.local/gi, "configuración local");

    return segmentTelegramText(text).map((part) => ({
      chatId: inbound.chatId,
      text: part,
    }));
  }

  private async handleSupuestos(
    inbound: TelegramInboundMessage,
  ): Promise<TelegramOutboundMessage[]> {
    const owner = this.resolveOwner(inbound);
    if (owner.status !== "READY") {
      return [{ chatId: inbound.chatId, text: this.gateMessage(owner) }];
    }

    const identity = buildTelegramIdentity(inbound);
    const stored = await this.deps.localStore.memory.get(
      identity.internalConversationId,
    );
    const { review } = await runPricingReview({
      draft: stored?.quoteRequestDraft,
      amountsVisible: false,
      inline: { profile: owner.profile, catalog: owner.catalog },
    });
    return [
      {
        chatId: inbound.chatId,
        text: formatAssumptionsMessage(review),
      },
    ];
  }

  private async recordVerdict(
    inbound: TelegramInboundMessage,
    verdict: TelegramBudgetReviewVerdict,
  ): Promise<TelegramOutboundMessage[]> {
    const owner = this.resolveOwner(inbound);
    if (owner.status !== "READY") {
      return [{ chatId: inbound.chatId, text: this.gateMessage(owner) }];
    }
    const flags = this.deps.localStore.getFlags(inbound.chatId);
    if (
      flags.budgetInvalidated ||
      flags.lastBudgetStatus === "NOT_CONFIGURED" ||
      flags.lastBudgetStatus !== "READY"
    ) {
      return [{ chatId: inbound.chatId, text: textNoRealBudgetToExplain() }];
    }

    const identity = buildTelegramIdentity(inbound);
    await this.deps.localStore.addReview({
      conversationId: identity.internalConversationId,
      chatId: inbound.chatId,
      verdict,
    });

    if (this.deps.calibration) {
      try {
        this.deps.calibration.ingestPricingExplanationReview({
          sessionId: `tg-${inbound.chatId}`,
          verdict:
            verdict === "REJECTED"
              ? "INCORRECT"
              : verdict === "APPROVED"
                ? "APPROVED"
                : "NEEDS_ADJUSTMENT",
          code: "PRICING_EXPLANATION_OTHER",
          note: `telegram:${verdict}`,
          explanationVersion: "dani-pricing-explanation-v1",
          createdAt: new Date().toISOString(),
        });
      } catch {
        // calibración opcional
      }
    }

    const msg =
      verdict === "APPROVED"
        ? "Marcado como aprobado. No cambié precios ni fórmulas automáticamente."
        : verdict === "REJECTED"
          ? "Marcado como rechazado. Contame después qué ajustarías."
          : "Necesita ajuste. ¿Qué cambiarías o qué te resulta poco claro?";

    if (verdict === "NEEDS_ADJUSTMENT") {
      await this.deps.localStore.setFlags(inbound.chatId, {
        awaitingAdjustmentFeedback: true,
      });
    }

    return [{ chatId: inbound.chatId, text: msg }];
  }

  private async handleAdjustmentFeedback(
    inbound: TelegramInboundMessage,
  ): Promise<TelegramOutboundMessage[]> {
    const identity = buildTelegramIdentity(inbound);
    await this.deps.localStore.addReview({
      conversationId: identity.internalConversationId,
      chatId: inbound.chatId,
      verdict: "NEEDS_ADJUSTMENT",
      note: inbound.text.slice(0, 2000),
    });
    await this.deps.localStore.setFlags(inbound.chatId, {
      awaitingAdjustmentFeedback: false,
    });

    if (this.deps.calibration) {
      try {
        this.deps.calibration.ingestPricingExplanationReview({
          sessionId: `tg-${inbound.chatId}`,
          verdict: "NEEDS_ADJUSTMENT",
          code: "PRICING_EXPLANATION_OTHER",
          note: inbound.text.slice(0, 2000),
          explanationVersion: "dani-pricing-explanation-v1",
          createdAt: new Date().toISOString(),
        });
      } catch {
        // ignore
      }
    }

    return [
      {
        chatId: inbound.chatId,
        text: "Gracias, registré tu feedback. No modifiqué precios ni el estilo automáticamente.",
      },
    ];
  }

  private async handleConversation(
    inbound: TelegramInboundMessage,
  ): Promise<TelegramOutboundMessage[]> {
    const identity = buildTelegramIdentity(inbound);
    const flags = this.deps.localStore.getFlags(inbound.chatId);

    // Confirmación de /nueva
    if (
      flags.lastBudgetStatus === "CONFIRM_NEW" &&
      /^(si|sí|dale|ok|confirmo)\b/i.test(inbound.text.trim())
    ) {
      return this.handleNueva(inbound, true);
    }

    const process =
      this.deps.processMessage ?? processIncomingMessage;

    const response = await process(
      {
        message: {
          from: identity.pipelineFrom,
          text: inbound.text,
          channel: "telegram",
          receivedAt: inbound.receivedAt,
        },
      },
      {
        store: this.deps.localStore.conversationStore,
        memoryClock: this.deps.localStore.memory,
        pricingRuntime: this.deps.pricingRuntime,
        styleEngine: "dani-conversation-v1",
      },
    );

    await this.deps.localStore.persistConversation(
      identity.internalConversationId,
    );

    // Si quedó listo, ofrecer presupuesto sin spamear montos en el reply natural
    const parts = segmentTelegramText(response.text).map((text) => ({
      chatId: inbound.chatId,
      text,
    }));

    const role = resolveConversationRole(response.memory.roleState);
    if (
      role === "OWNER" &&
      response.quoteRequest?.status === "READY_FOR_CALCULATION"
    ) {
      parts.push({
        chatId: inbound.chatId,
        text: "Cuando quieras, pedime /presupuesto para ver el mínimo sostenible y el recomendado.",
      });
    }

    return parts;
  }
}

export function telegramConversationIdForChat(chatId: string): string {
  return createConversationId(`tg${chatId}`);
}
