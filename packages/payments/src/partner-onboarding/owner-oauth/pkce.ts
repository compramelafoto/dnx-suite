import { createHash, randomBytes } from "node:crypto";

/** RFC 7636 S256 PKCE helpers. */

export function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

export function codeChallengeS256(verifier: string): string {
  return createHash("sha256").update(verifier, "utf8").digest("base64url");
}

export function generateOAuthStateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashOAuthStateToken(state: string): string {
  return createHash("sha256").update(state, "utf8").digest("hex");
}
