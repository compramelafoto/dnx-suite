export type MockCursorRequest = {
  mode: "READ_ONLY" | "WRITE_LIMITED";
  workspace: string;
  prompt: string;
};

export type MockCursorResponse = {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  simulatedFilesChanged: string[];
};

/**
 * Deterministic Cursor mock for tests — does not touch real filesystem.
 */
export async function runMockCursor(request: MockCursorRequest): Promise<MockCursorResponse> {
  if (request.prompt.includes("__MOCK_TIMEOUT__")) {
    return {
      code: null,
      stdout: "",
      stderr: "mock timeout",
      timedOut: true,
      simulatedFilesChanged: [],
    };
  }
  if (request.prompt.includes("__MOCK_FAIL__")) {
    return {
      code: 2,
      stdout: "",
      stderr: "mock failure",
      timedOut: false,
      simulatedFilesChanged: [],
    };
  }

  const files =
    request.mode === "WRITE_LIMITED"
      ? ["src/example.ts", "README.md"]
      : [];

  return {
    code: 0,
    stdout: [
      "MOCK_CURSOR_OK",
      `mode=${request.mode}`,
      `workspace=${request.workspace}`,
      "No secrets echoed.",
      request.mode === "WRITE_LIMITED" ? "Simulated write-limited edits (not applied in mock)." : "Read-only inspection complete.",
    ].join("\n"),
    stderr: "",
    timedOut: false,
    simulatedFilesChanged: files,
  };
}
