/**
 * Smoke de Route Handlers sin base de datos (casos que no ejecutan Prisma).
 * Ejecutar: tsx app/lib/public-api/v1/routes.selfcheck.ts
 */
import assert from "node:assert/strict";
import { GET as getBySlug } from "../../../api/public/v1/events/[slug]/route";

async function main() {
  const bad = await getBySlug(
    new Request("http://localhost/api/public/v1/events/BAD_SLUG"),
    { params: Promise.resolve({ slug: "BAD_SLUG" }) },
  );
  assert.equal(bad.status, 400);
  assert.equal(bad.headers.get("X-Fotorank-Api-Version"), "v1");
  assert.equal(bad.headers.get("Content-Type"), "application/json; charset=utf-8");
  const badBody = (await bad.json()) as {
    version: string;
    error: { code: string; message: string };
  };
  assert.equal(badBody.version, "v1");
  assert.equal(badBody.error.code, "INVALID_REQUEST");
  assert.equal(JSON.stringify(badBody).includes("stack"), false);
  assert.equal(JSON.stringify(badBody).includes("Prisma"), false);

  const weird = await getBySlug(
    new Request("http://localhost/api/public/v1/events/!!!"),
    { params: Promise.resolve({ slug: "!!!" }) },
  );
  assert.equal(weird.status, 400);

  console.log("public-api/v1 routes.selfcheck: OK (invalid slug → 400)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
