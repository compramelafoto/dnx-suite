import type { ContestRulesConfiguration } from "../rules-config/types";
import { buildChatGptRulesPrompt } from "../rules-config/chatgpt-prompt";
import { hashContestRulesConfiguration } from "../rules-config/hash";
import type { ExternalRulesAiResponse } from "./structured-import";

export type ContestRulesTextGeneratorResult =
  | {
      mode: "manual_prompt";
      prompt: string;
      configurationHash: string;
    }
  | {
      mode: "openai";
      response: ExternalRulesAiResponse;
      configurationHash: string;
      model: string;
    };

export interface ContestRulesTextGenerator {
  generate(config: ContestRulesConfiguration): Promise<ContestRulesTextGeneratorResult>;
}

export class ManualPromptRulesGenerator implements ContestRulesTextGenerator {
  async generate(config: ContestRulesConfiguration): Promise<ContestRulesTextGeneratorResult> {
    return {
      mode: "manual_prompt",
      prompt: buildChatGptRulesPrompt(config),
      configurationHash: hashContestRulesConfiguration(config),
    };
  }
}

/**
 * Provider OpenAI opcional. Solo se activa si existe OPENAI_API_KEY y FOTORANK_RULES_AI_PROVIDER=openai.
 * No hardcodea modelo: usa FOTORANK_RULES_AI_MODEL.
 */
export class OpenAiContestRulesGenerator implements ContestRulesTextGenerator {
  async generate(config: ContestRulesConfiguration): Promise<ContestRulesTextGeneratorResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.FOTORANK_RULES_AI_MODEL;
    if (!apiKey || !model) {
      throw new Error("OpenAI no configurado (OPENAI_API_KEY / FOTORANK_RULES_AI_MODEL).");
    }
    // Infraestructura no presente en el monorepo: fallar cerrado hacia prompt manual.
    throw new Error(
      "OpenAiContestRulesGenerator preparado pero sin cliente oficial en el monorepo. Usá ManualPromptRulesGenerator.",
    );
  }
}

export function resolveRulesTextGenerator(): ContestRulesTextGenerator {
  const provider = (process.env.FOTORANK_RULES_AI_PROVIDER ?? "manual").toLowerCase();
  if (provider === "openai" && process.env.OPENAI_API_KEY && process.env.FOTORANK_RULES_AI_MODEL) {
    return new OpenAiContestRulesGenerator();
  }
  return new ManualPromptRulesGenerator();
}

export type ContestRulesSemanticValidatorResult = {
  contradictions: string[];
  omissions: string[];
  ambiguities: string[];
  extraRules: string[];
  risks: string[];
  confidence: number;
  /** La IA nunca marca publicable sola. */
  aiMayPublish: false;
};

export interface ContestRulesSemanticValidator {
  validate(input: {
    config: ContestRulesConfiguration;
    document: string;
    deterministic: Array<{ key: string; status: string; severity?: string }>;
  }): Promise<ContestRulesSemanticValidatorResult>;
}

/** Implementación determinística (sin LLM). */
export class DeterministicSemanticValidator implements ContestRulesSemanticValidator {
  async validate(input: {
    config: ContestRulesConfiguration;
    document: string;
    deterministic: Array<{ key: string; status: string; severity?: string }>;
  }): Promise<ContestRulesSemanticValidatorResult> {
    const contradictions = input.deterministic
      .filter((d) => d.status === "CONFLICT")
      .map((d) => d.key);
    const omissions = input.deterministic
      .filter((d) => d.status === "MISSING" || d.status === "NOT_MENTIONED")
      .map((d) => d.key);
    const extraRules = input.deterministic
      .filter((d) => d.status === "EXTRA_RULE")
      .map((d) => d.key);
    const risks: string[] = [];
    if (input.config.rights.legalReviewFlags.length) {
      risks.push(...input.config.rights.legalReviewFlags);
    }
    return {
      contradictions,
      omissions,
      ambiguities: input.deterministic.filter((d) => d.status === "UNVERIFIABLE").map((d) => d.key),
      extraRules,
      risks,
      confidence: contradictions.length ? 0.4 : omissions.length > 8 ? 0.55 : 0.75,
      aiMayPublish: false,
    };
  }
}
