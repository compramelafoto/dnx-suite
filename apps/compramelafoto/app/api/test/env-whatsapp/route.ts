import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    hasPhoneNumberId: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
    hasAccessToken: !!process.env.WHATSAPP_ACCESS_TOKEN,
    apiVersion: process.env.WHATSAPP_API_VERSION,
    appBaseUrl: process.env.APP_BASE_URL,
  });
}
