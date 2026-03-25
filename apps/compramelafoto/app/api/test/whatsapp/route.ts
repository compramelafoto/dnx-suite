import { NextResponse } from "next/server";
import { sendWhatsAppTemplate } from "@/lib/whatsapp/sendTemplate";

export async function GET() {
  try {
    const result = await sendWhatsAppTemplate({
      to: "549341XXXXXXXX", // reemplazar por tu número
      templateName: "_order_pending_reminder",
      bodyVariables: ["Daniel"],
      buttonVariables: ["a/test-album/comprar/resumen?orderId=123"],
    });

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error: unknown) {
    const err = error as { response?: { data?: unknown }; message?: string };
    return NextResponse.json(
      {
        ok: false,
        error: err?.response?.data ?? err?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}
