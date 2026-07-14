/**
 * Errores tipados del acceso a datos públicos.
 * No exponer mensajes internos al usuario final.
 */

export class PublicMarathonNotFoundError extends Error {
  readonly code = "MARATHON_NOT_FOUND" as const;

  constructor(slug: string) {
    super(`Public marathon not found: ${slug}`);
    this.name = "PublicMarathonNotFoundError";
  }
}

export class PublicMarathonPayloadError extends Error {
  readonly code = "MARATHON_PAYLOAD_INVALID" as const;

  constructor(detail: string) {
    super(`Invalid public marathon payload: ${detail}`);
    this.name = "PublicMarathonPayloadError";
  }
}

export class PublicMarathonNotPublicError extends Error {
  readonly code = "MARATHON_NOT_PUBLIC" as const;

  constructor(slug: string) {
    super(`Marathon is not publicly routable: ${slug}`);
    this.name = "PublicMarathonNotPublicError";
  }
}

export class PublicMarathonSourceUnavailableError extends Error {
  readonly code = "MARATHON_SOURCE_UNAVAILABLE" as const;

  constructor(message = "Public marathon data source unavailable") {
    super(message);
    this.name = "PublicMarathonSourceUnavailableError";
  }
}
