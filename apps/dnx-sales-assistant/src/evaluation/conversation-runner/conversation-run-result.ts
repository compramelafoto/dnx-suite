import type { ConversationTranscript } from "../conversation-transcript/conversation-transcript.js";
import type { DaniStyleResult } from "../dani-style/dani-style-result.js";
import type { ConversationMetrics } from "../metrics/conversation-metrics.js";
import type { ConversationScenario } from "./conversation-scenario.js";

export type ExpectationFailure = {
  code: string;
  message: string;
};

export type ConversationRunResult = {
  scenario: ConversationScenario;
  transcript: ConversationTranscript;
  metrics: ConversationMetrics;
  daniStyle: DaniStyleResult;
  expectationFailures: ExpectationFailure[];
  passed: boolean;
};
