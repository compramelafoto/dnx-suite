export class PromptLibraryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "PromptLibraryError";
    this.code = code;
  }
}
