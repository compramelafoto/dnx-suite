export class FotorankPublicSerializationError extends Error {
  readonly code: "NOT_PUBLIC" | "INVALID_PAYLOAD" | "UNSUPPORTED";

  constructor(code: FotorankPublicSerializationError["code"], message: string) {
    super(message);
    this.name = "FotorankPublicSerializationError";
    this.code = code;
  }
}

export function isFotorankPublicSerializationError(
  error: unknown,
): error is FotorankPublicSerializationError {
  return error instanceof FotorankPublicSerializationError;
}
