export type CursorBinaryDiscovery = {
  found: boolean;
  path: string | null;
  source: "env" | "which-agent" | "local-agent" | "which-cursor-agent" | "local-cursor-agent" | null;
};

export type CursorAuthStatus =
  | "AUTHENTICATED"
  | "CURSOR_AUTH_REQUIRED"
  | "UNKNOWN"
  | "BINARY_NOT_FOUND";

export type CursorAgentStatus = {
  binary: CursorBinaryDiscovery;
  version: string | null;
  auth: CursorAuthStatus;
  authDetail: string;
  loginHint: string | null;
};

export type CursorAskResult =
  | {
      ok: true;
      output: string;
    }
  | {
      ok: false;
      code:
        | "BINARY_NOT_FOUND"
        | "CURSOR_AUTH_REQUIRED"
        | "READ_ONLY_NOT_GUARANTEED"
        | "WRITE_DISABLED"
        | "SPAWN_ERROR"
        | "TIMEOUT"
        | "NON_ZERO_EXIT";
      message: string;
    };
