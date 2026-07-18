import type { IncomingMessage as HttpIncomingMessage, ServerResponse } from "node:http";
import { logAssistantProcessing } from "../logger/request-log.js";
import { processIncomingMessage, PipelineValidationError } from "../pipeline/process-incoming-message.js";
import { buildHttpResponseFromAssistant } from "../response/http-response-builder.js";
import { sendJson } from "../server/http-response.js";
import type { AppDeps } from "../types/app-deps.js";
import { buildSimulateErrorResponse } from "./error-response.js";
import { parseSimulateMessageRequest } from "./request-parser.js";

/**
 * POST /simulate/message — solo transporte:
 * leer request → pipeline → ResponseBuilder.
 */
export function createSimulateMessageHandler(deps: AppDeps) {
  return async (req: HttpIncomingMessage, res: ServerResponse): Promise<void> => {
    const started = Date.now();
    const parsed = await parseSimulateMessageRequest(req);
    if (!parsed.ok) {
      sendJson(res, parsed.statusCode, buildSimulateErrorResponse(parsed.error, parsed.details));
      return;
    }

    try {
      const assistantResponse = await processIncomingMessage(parsed.request, {
        store: deps.store,
        memoryClock: deps.memoryClock,
        pricingRuntime: deps.pricingRuntime,
      });
      const httpBody = buildHttpResponseFromAssistant(deps.config, assistantResponse);
      sendJson(res, 200, httpBody);
      logAssistantProcessing({
        response: assistantResponse,
        statusCode: 200,
        durationMs: Date.now() - started,
      });
    } catch (err: unknown) {
      if (err instanceof PipelineValidationError) {
        sendJson(
          res,
          400,
          buildSimulateErrorResponse("validation_error", [
            { path: "message", message: err.message },
          ]),
        );
        return;
      }
      throw err;
    }
  };
}
