const AUTH_HEADER = "authorization";
const DEV_BYPASS_HEADER = "x-cron-dev-bypass";

function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function assertCronAuth(req: Request) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get(AUTH_HEADER);
  if (!secret) {
    if (isProduction()) {
      console.error("[cron-auth] CRON_SECRET missing in production");
      return new Response("CRON_SECRET missing", { status: 500 });
    }
    console.warn("[cron-auth] CRON_SECRET not set; allowing bypass in development");
  }

  if (!secret) {
    return null;
  }

  if (header === `Bearer ${secret}`) {
    return null;
  }

  const bypass = req.headers.get(DEV_BYPASS_HEADER);
  if (!isProduction() && bypass === "1") {
    console.warn("[cron-auth] Development bypass granted via header");
    return null;
  }

  return new Response("Unauthorized", { status: 401 });
}
