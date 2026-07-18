import type {
  SimulateMessageErrorCode,
  SimulateMessageErrorResponse,
  SimulateValidationIssue,
} from "../types/simulate.js";

export function buildSimulateErrorResponse(
  error: SimulateMessageErrorCode,
  details?: unknown,
): SimulateMessageErrorResponse {
  const body: SimulateMessageErrorResponse = {
    ok: false,
    error,
    service: "dnx-sales-assistant",
  };
  if (details !== undefined) {
    body.details = details;
  }
  return body;
}

export function mapZodIssuesToDetails(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
): SimulateValidationIssue[] {
  return issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}
