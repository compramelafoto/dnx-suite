import { describe, expect, it } from "vitest";
import { parseStoreExternalReference, storeExternalReference } from "./external-reference";

describe("referencia externa", () => {
  it("ida y vuelta", () => expect(parseStoreExternalReference(storeExternalReference("abc"))).toBe("abc"));
  it.each([null, undefined, 42, "", "abc", "booking:abc", "store:", "store:   "])(
    "rechaza %p", (raw) => expect(parseStoreExternalReference(raw)).toBeNull());
});
