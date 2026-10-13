/**
 * `bot:eval` corre fuera de Next: `server-only` no se resuelve (Next lo aliasa). Se lo reemplaza
 * por el mismo stub que usan las pruebas (test/server-only-stub.ts).
 */
import { registerHooks } from "node:module";

const stub = new URL("../test/server-only-stub.ts", import.meta.url).href;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return { url: stub, shortCircuit: true };
    return next(specifier, context);
  },
});
