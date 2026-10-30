import { appUrl } from "@/lib/app-url";
import { scriptDeInstalacion } from "@/lib/recuperacion/programa";

export const dynamic = "force-dynamic";

/** `curl -fsSL https://fotoffice.com/api/recuperacion/instalar | sh -s CODIGO` */
export function GET() {
  return new Response(scriptDeInstalacion(appUrl()), {
    headers: { "Content-Type": "text/x-shellscript; charset=utf-8", "Cache-Control": "no-store" },
  });
}
