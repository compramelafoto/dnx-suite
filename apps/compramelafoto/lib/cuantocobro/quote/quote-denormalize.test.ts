import { describe, expect, it } from "vitest";
import { extractQuoteDenormalizedFields } from "./quote-denormalize";

describe("extractQuoteDenormalizedFields", () => {
  it("extrae campos de búsqueda del cliente", () => {
    const result = extractQuoteDenormalizedFields({
      client: {
        name: "Ana",
        company: "Estudio Sur",
        email: "ana@test.com",
        phone: "111",
        jobType: "Boda",
        jobLocation: "Palermo",
      },
    });

    expect(result.clientDisplayName).toBe("Ana · Estudio Sur");
    expect(result.clientCompany).toBe("Estudio Sur");
    expect(result.clientEmail).toBe("ana@test.com");
    expect(result.jobLocation).toBe("Palermo");
  });
});
