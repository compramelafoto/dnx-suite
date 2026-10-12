import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root,
  resolve: { alias: { "@": root } },
  test: {
    environment: "node",
    include: [
      "lib/bot/**/*.test.ts",
      "lib/support/create-ticket.test.ts",
      "lib/albums/album-settings-update.test.ts",
      "lib/album-packs/album-pack-basic-rules.test.ts",
      "lib/fotografo/profile-field-rules.test.ts",
      "app/api/bot/**/*.test.ts",
      "app/api/internal/bot/**/*.test.ts",
      "app/api/cron/bot-resumen/*.test.ts",
      "app/api/cron/bot-outreach/*.test.ts",
      "lib/email-marketing/unsubscribe-token.test.ts",
      "lib/auth/registrar-ultimo-ingreso.test.ts",
      "app/api/dashboard/albums/*/route.patch.test.ts",
      "app/api/dashboard/albums/*/route.patch-school.test.ts",
      "app/api/fotografo/schools/route.test.ts",
      "app/api/fotografo/schools/*/courses/route.test.ts",
      "lib/schools/school-setup.test.ts",
      "lib/albums/album-school-settings.test.ts",
      "app/api/dashboard/albums/*/packs/**/*.test.ts",
      "app/api/fotografo/update/*.test.ts",
      "app/api/admin/schools/*/organizers/invite/route.test.ts",
      "lib/schools/invite-organizer.test.ts",
      "app/pago/reintentar/*/page.test.ts",
    ],
  },
});
