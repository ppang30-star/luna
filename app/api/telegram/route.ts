import { NextResponse } from "next/server"

// Server-side Telegram proxy to avoid client-side CORS issues.
// The browser sends the message text here, and this route relays it to the Telegram Bot API.
const TELEGRAM_BOT_TOKEN = "8915994764:AAG9EL7kBCy5ob6g4KWs93EAPzN56x47uyc"
const TELEGRAM_CHAT_ID = "-5034317914"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const message: unknown = body?.message

    if (typeof message !== "string" || message.trim() === "") {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid 'message' field" },
        { status: 400 }
      )
    }

    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: "HTML",
        }),
      }
    )

    const data = await response.json().catch(() => null)

    if (!response.ok || !data?.ok) {
      const errorMsg = data
        ? `Telegram API Error: ${JSON.stringify(data)}`
        : `HTTP ${response.status}: ${response.statusText}`
      console.error("[Telegram] API Error:", errorMsg)
      return NextResponse.json({ ok: false, error: errorMsg }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error("[Telegram] Server Error:", errorMsg)
    return NextResponse.json({ ok: false, error: errorMsg }, { status: 500 })
  }
}
